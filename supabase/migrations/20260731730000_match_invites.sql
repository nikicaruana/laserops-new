-- =============================================================================
-- Invite a specific player to a match (mirrors squad_invites). A player in a game
-- (signed up / creator / admin) invites one of the people they follow; the
-- invitee gets a notification-bell alert linking to the game. Signing up resolves
-- the invite. Also adds my_following() for the invite picker.
-- =============================================================================

create table public.match_invites (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  invitee_id  uuid not null references public.accounts(id) on delete cascade,
  invited_by  uuid references public.accounts(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index match_invite_one_pending on public.match_invites (match_id, invitee_id) where status = 'pending';

alter table public.match_invites enable row level security;
drop policy if exists match_invites_select_own on public.match_invites;
create policy match_invites_select_own on public.match_invites for select to authenticated
  using (invitee_id = public.current_account_id());
grant select on public.match_invites to authenticated;

-- Players the caller follows (for the invite picker).
create or replace function public.my_following()
returns table (account_id uuid, ops_tag text, profile_pic_url text)
language sql security definer set search_path = public as $$
  select a.id, a.ops_tag, a.profile_pic_url
  from public.follows f
  join public.accounts a on a.id = f.followee_id
  where f.follower_id = public.current_account_id()
  order by a.ops_tag;
$$;
grant execute on function public.my_following() to authenticated;

-- Create a pending invite. Caller must be in the game; skips self / already-in /
-- duplicate-pending.
create or replace function public.invite_to_match(p_match_id uuid, p_invitee_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if acct is null then raise exception 'Not signed in.'; end if;
  if p_invitee_account_id = acct then raise exception 'You can''t invite yourself.'; end if;
  if not exists (select 1 from public.matches where id = p_match_id) then raise exception 'Game not found.'; end if;
  if not public.is_admin()
     and not exists (select 1 from public.matches m where m.id = p_match_id and m.created_by = acct)
     and not exists (select 1 from public.match_signups s where s.match_id = p_match_id and s.account_id = acct and s.status <> 'cancelled')
  then
    raise exception 'Only players in this game can invite others.';
  end if;
  -- Already signed up, or already invited → no-op.
  if exists (select 1 from public.match_signups s where s.match_id = p_match_id and s.account_id = p_invitee_account_id and s.status <> 'cancelled') then return; end if;
  if exists (select 1 from public.match_invites where match_id = p_match_id and invitee_id = p_invitee_account_id and status = 'pending') then return; end if;
  insert into public.match_invites (match_id, invitee_id, invited_by) values (p_match_id, p_invitee_account_id, acct);
end;
$$;
grant execute on function public.invite_to_match(uuid, uuid) to authenticated;

-- Bell: pending match invites for the caller (only for still-joinable games).
create or replace function public.my_pending_match_invites()
returns table (invite_id uuid, match_id uuid, title text, invited_by_ops_tag text)
language sql security definer set search_path = public as $$
  select mi.id, mi.match_id, coalesce(m.title, m.match_code, 'A game'), a.ops_tag
  from public.match_invites mi
  join public.matches m on m.id = mi.match_id
  left join public.accounts a on a.id = mi.invited_by
  where mi.invitee_id = public.current_account_id()
    and mi.status = 'pending'
    and m.status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
$$;
grant execute on function public.my_pending_match_invites() to authenticated;

-- Signing up (or waitlisting) resolves any pending invite so the bell clears.
create or replace function public.resolve_match_invite_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('registered', 'waitlisted') then
    update public.match_invites set status = 'accepted', resolved_at = now()
      where match_id = new.match_id and invitee_id = new.account_id and status = 'pending';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_resolve_match_invite on public.match_signups;
create trigger trg_resolve_match_invite after insert or update on public.match_signups
  for each row execute function public.resolve_match_invite_on_signup();

-- Realtime so the invitee's bell reacts instantly.
alter table public.match_invites replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_invites'
  ) then
    alter publication supabase_realtime add table public.match_invites;
  end if;
end $$;
