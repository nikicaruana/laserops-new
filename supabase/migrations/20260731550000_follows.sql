-- =============================================================================
-- Player follows (social graph). A player can follow another; the profile shows
-- squads + "Followed by N". Writes go through SECURITY DEFINER RPCs keyed by ops
-- tag (the profile page identifies players by ops tag).
-- =============================================================================
create table public.follows (
  follower_id uuid not null references public.accounts(id) on delete cascade,
  followee_id uuid not null references public.accounts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;
-- A player can see who THEY follow; counts + is-following come via definer RPCs.
drop policy if exists follows_select_own on public.follows;
create policy follows_select_own on public.follows for select to authenticated
  using (follower_id = public.current_account_id());
grant select on public.follows to authenticated;

-- --- RPCs -------------------------------------------------------------------
create or replace function public.follow_player(p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); target uuid;
begin
  if acct is null then raise exception 'Sign in to follow players.'; end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then raise exception 'Player not found.'; end if;
  if target = acct then raise exception 'You cannot follow yourself.'; end if;
  insert into public.follows (follower_id, followee_id) values (acct, target) on conflict do nothing;
end;
$$;
grant execute on function public.follow_player(text) to authenticated;

create or replace function public.unfollow_player(p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); target uuid;
begin
  if acct is null then raise exception 'Sign in to follow players.'; end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then return; end if;
  delete from public.follows where follower_id = acct and followee_id = target;
end;
$$;
grant execute on function public.unfollow_player(text) to authenticated;

-- Social summary for a profile: their account id, follower count, whether the
-- caller follows them, and whether it's the caller.
create or replace function public.player_social(p_ops_tag text)
returns table (account_id uuid, follower_count integer, is_following boolean, is_self boolean)
language sql security definer set search_path = public as $$
  select a.id,
         (select count(*) from public.follows f where f.followee_id = a.id)::int,
         exists (select 1 from public.follows f where f.follower_id = public.current_account_id() and f.followee_id = a.id),
         a.id = public.current_account_id()
  from public.accounts a
  where lower(a.ops_tag) = lower(btrim(p_ops_tag))
  limit 1;
$$;
grant execute on function public.player_social(text) to anon, authenticated;

-- The squads a player is in (name + badge), for the profile Social section.
create or replace function public.player_squads(p_ops_tag text)
returns table (squad_id uuid, name text, badge_url text)
language sql security definer set search_path = public as $$
  select s.id, s.name, s.badge_url
  from public.squad_members m
  join public.squads s on s.id = m.squad_id
  join public.accounts a on a.id = m.account_id
  where lower(a.ops_tag) = lower(btrim(p_ops_tag))
  order by m.is_primary desc, s.name;
$$;
grant execute on function public.player_squads(text) to anon, authenticated;
