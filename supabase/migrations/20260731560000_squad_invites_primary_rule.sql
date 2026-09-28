-- =============================================================================
-- 1. Invariant: a player can only be captain/officer in their PRIMARY squad.
-- 2. Direct squad invites: a manager invites a specific player to their squad.
-- =============================================================================

-- --- 1. Manager-only-in-primary --------------------------------------------
-- NOT VALID so existing rows aren't retro-checked, but every future insert/update
-- must satisfy it: a non-primary membership can only be a plain member.
alter table public.squad_members
  drop constraint if exists squad_manager_primary;
alter table public.squad_members
  add constraint squad_manager_primary check (is_primary or role = 'member') not valid;

-- Creating a squad makes it your PRIMARY (you're its captain, and a captain must
-- be primary) — demoting any current primary to secondary.
create or replace function public.create_squad(p_name text, p_description text, p_is_searchable boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); created integer; joined integer; new_id uuid;
begin
  if acct is null then raise exception 'You need an account to create a squad.'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'Give your squad a name.'; end if;
  select count(*) into created from public.squads where created_by = acct;
  if created >= 1 then raise exception 'You can only create one squad.'; end if;
  select count(*) into joined from public.squad_members where account_id = acct;
  if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;

  insert into public.squads (name, description, is_searchable, invite_code, captain_account_id, created_by)
    values (btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_is_searchable, true),
            encode(extensions.gen_random_bytes(8), 'hex'), acct, acct)
    returning id into new_id;

  update public.squad_members set is_primary = false where account_id = acct;  -- new squad becomes primary
  insert into public.squad_members (squad_id, account_id, role, is_primary) values (new_id, acct, 'captain', true);
  return new_id;
end;
$$;

-- Promote only a member whose PRIMARY squad is this one.
create or replace function public.set_squad_role(p_squad_id uuid, p_account_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if p_role not in ('officer', 'member') then raise exception 'Invalid role.'; end if;
  if not exists (select 1 from public.squads where id = p_squad_id and captain_account_id = acct) then
    raise exception 'Only the captain can change roles.';
  end if;
  if p_account_id = acct then raise exception 'Transfer the captaincy to change your own role.'; end if;
  if p_role = 'officer' and not exists (
    select 1 from public.squad_members where squad_id = p_squad_id and account_id = p_account_id and is_primary
  ) then
    raise exception 'A player can only be an officer in their primary squad.';
  end if;
  update public.squad_members set role = p_role
    where squad_id = p_squad_id and account_id = p_account_id and role <> 'captain';
end;
$$;

-- New captain must have this squad as their primary.
create or replace function public.transfer_captain(p_squad_id uuid, p_new_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (select 1 from public.squads where id = p_squad_id and captain_account_id = acct) then
    raise exception 'Only the captain can transfer the captaincy.';
  end if;
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = p_new_account_id and is_primary) then
    raise exception 'The new captain must have this as their primary squad.';
  end if;
  update public.squad_members set role = 'officer' where squad_id = p_squad_id and account_id = acct;
  update public.squad_members set role = 'captain' where squad_id = p_squad_id and account_id = p_new_account_id;
  update public.squads set captain_account_id = p_new_account_id where id = p_squad_id;
end;
$$;

-- Can't switch your primary away from a squad you captain/officer.
create or replace function public.set_primary_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = acct) then
    raise exception 'You are not in this squad.';
  end if;
  if exists (select 1 from public.squad_members where account_id = acct and squad_id <> p_squad_id and role in ('captain', 'officer')) then
    raise exception 'Transfer your captain/officer role before changing your primary squad.';
  end if;
  update public.squad_members set is_primary = false where account_id = acct;
  update public.squad_members set is_primary = true where account_id = acct and squad_id = p_squad_id;
end;
$$;

-- --- 2. Direct squad invites -----------------------------------------------
create table public.squad_invites (
  id            uuid primary key default gen_random_uuid(),
  squad_id      uuid not null references public.squads(id) on delete cascade,
  invitee_id    uuid not null references public.accounts(id) on delete cascade,
  invited_by    uuid references public.accounts(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create unique index squad_invite_one_pending on public.squad_invites (squad_id, invitee_id) where status = 'pending';

alter table public.squad_invites enable row level security;
drop policy if exists squad_invites_select_own on public.squad_invites;
create policy squad_invites_select_own on public.squad_invites for select to authenticated
  using (invitee_id = public.current_account_id());
grant select on public.squad_invites to authenticated;

-- Manager invites a player (by ops tag) to their PRIMARY squad.
create or replace function public.invite_to_my_squad(p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); sq uuid; target uuid;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  select squad_id into sq from public.squad_members where account_id = acct and is_primary and role in ('captain', 'officer') limit 1;
  if sq is null then raise exception 'You must captain or officer your primary squad to invite players.'; end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then raise exception 'Player not found.'; end if;
  if target = acct then raise exception 'You cannot invite yourself.'; end if;
  if exists (select 1 from public.squad_members where squad_id = sq and account_id = target) then
    raise exception 'They are already in your squad.';
  end if;
  if exists (select 1 from public.squad_invites where squad_id = sq and invitee_id = target and status = 'pending') then
    return;
  end if;
  insert into public.squad_invites (squad_id, invitee_id, invited_by) values (sq, target, acct);
end;
$$;
grant execute on function public.invite_to_my_squad(text) to authenticated;

-- Context for the "Invite to squad" button (whether the caller can invite the
-- target, and their squad's name).
create or replace function public.my_squad_invite_context(p_target_ops_tag text)
returns table (squad_name text)
language sql security definer set search_path = public as $$
  select s.name
  from public.squad_members m
  join public.squads s on s.id = m.squad_id
  where m.account_id = public.current_account_id() and m.is_primary and m.role in ('captain', 'officer')
    and exists (
      select 1 from public.accounts a
      where lower(a.ops_tag) = lower(btrim(p_target_ops_tag))
        and a.id <> public.current_account_id()
        and not exists (select 1 from public.squad_members m2 where m2.squad_id = m.squad_id and m2.account_id = a.id)
    )
  limit 1;
$$;
grant execute on function public.my_squad_invite_context(text) to authenticated;

-- Invitee's pending invites (hub + bell).
create or replace function public.my_pending_squad_invites()
returns table (invite_id uuid, squad_id uuid, squad_name text, badge_url text)
language sql security definer set search_path = public as $$
  select i.id, s.id, s.name, s.badge_url
  from public.squad_invites i join public.squads s on s.id = i.squad_id
  where i.invitee_id = public.current_account_id() and i.status = 'pending'
  order by i.created_at;
$$;
grant execute on function public.my_pending_squad_invites() to authenticated;

create or replace function public.respond_squad_invite(p_invite_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); inv record; members integer; joined integer;
begin
  select * into inv from public.squad_invites where id = p_invite_id;
  if not found then raise exception 'Invite not found.'; end if;
  if inv.invitee_id <> acct then raise exception 'Not your invite.'; end if;
  if inv.status <> 'pending' then raise exception 'Already handled.'; end if;
  if p_accept then
    if not exists (select 1 from public.squad_members where squad_id = inv.squad_id and account_id = acct) then
      select count(*) into members from public.squad_members where squad_id = inv.squad_id;
      if members >= 20 then raise exception 'That squad is full (20 members).'; end if;
      select count(*) into joined from public.squad_members where account_id = acct;
      if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;
      insert into public.squad_members (squad_id, account_id, role, is_primary) values (inv.squad_id, acct, 'member', joined = 0);
    end if;
    update public.squad_invites set status = 'accepted', resolved_at = now() where id = p_invite_id;
  else
    update public.squad_invites set status = 'declined', resolved_at = now() where id = p_invite_id;
  end if;
end;
$$;
grant execute on function public.respond_squad_invite(uuid, boolean) to authenticated;
