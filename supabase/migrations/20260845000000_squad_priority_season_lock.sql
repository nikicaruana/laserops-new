-- =============================================================================
-- Squad priority: competitive representation, season lock, and attribution.
-- =============================================================================
-- "Priority" = squad_members.is_primary. New rules so a player in two squads
-- can't flip allegiance to game the competition:
--   1. SEASON LOCK - while a season is active (seasons.status = 'active'), any
--      operation that would change your is_primary is blocked: set_primary_squad,
--      leaving your primary (while you still hold a secondary), and creating a
--      second squad. Your locked primary is whatever it is when the season starts.
--   2. REPRESENTATION - in a squad-vs-squad match where BOTH squads are yours you
--      may only represent your PRIMARY (never your secondary against your primary).
--   3. ATTRIBUTION - squad_match_signups.squad_id already freezes the squad you
--      played with at signup; nothing reads live is_primary for a played match.
--   4. XP seeding counts PRIMARY members only, so your lifetime XP seeds just the
--      one squad you compete for (no more double-count across two squads).
-- All writes still flow through these SECURITY DEFINER RPCs.
-- =============================================================================

-- Helper: is a competitive season currently active?
create or replace function public.competitive_season_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.seasons where status = 'active');
$$;
grant execute on function public.competitive_season_active() to anon, authenticated;

-- UI helper: lock state + which season + when it unlocks (always one row).
create or replace function public.squad_priority_lock()
returns table (locked boolean, season_name text, unlock_on date)
language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.seasons where status = 'active') as locked,
    (select name    from public.seasons where status = 'active' order by ends_on desc nulls last limit 1) as season_name,
    (select ends_on from public.seasons where status = 'active' order by ends_on desc nulls last limit 1) as unlock_on;
$$;
grant execute on function public.squad_priority_lock() to anon, authenticated;

-- 1. set_primary_squad - blocked outright during an active season.
create or replace function public.set_primary_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if public.competitive_season_active() then
    raise exception 'Your squad priority is locked for the competitive season. You can change it once the season ends.';
  end if;
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

-- 2. leave_squad - can't leave your PRIMARY mid-season while you still hold a
--    secondary (leaving would auto-promote the secondary = a priority flip).
--    Leaving a secondary, or leaving your only squad, is still allowed.
create or replace function public.leave_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  my   record;
  other uuid;
begin
  select * into my from public.squad_members where squad_id = p_squad_id and account_id = acct;
  if not found then raise exception 'You are not in this squad.'; end if;
  if my.role = 'captain' then raise exception 'Transfer the captaincy or disband the squad first.'; end if;
  if my.is_primary and public.competitive_season_active()
     and exists (select 1 from public.squad_members where account_id = acct and squad_id <> p_squad_id) then
    raise exception 'You can''t leave your primary squad while a competitive season is active - your priority is locked until it ends.';
  end if;
  delete from public.squad_members where id = my.id;
  -- If they left their primary squad, promote their remaining squad to primary.
  if my.is_primary then
    select id into other from public.squad_members where account_id = acct limit 1;
    if other is not null then update public.squad_members set is_primary = true where id = other; end if;
  end if;
end;
$$;
grant execute on function public.leave_squad(uuid) to authenticated;

-- 3. create_squad - a player who already has a squad can't create another
--    mid-season (the new squad would become primary, demoting the current one).
--    A squadless player may still form their first squad.
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
  if joined >= 1 and public.competitive_season_active() then
    raise exception 'You can''t create another squad while a competitive season is active - your squad priority is locked until it ends.';
  end if;

  insert into public.squads (name, description, is_searchable, invite_code, captain_account_id, created_by)
    values (btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_is_searchable, true),
            encode(extensions.gen_random_bytes(8), 'hex'), acct, acct)
    returning id into new_id;

  update public.squad_members set is_primary = false where account_id = acct;  -- new squad becomes primary
  insert into public.squad_members (squad_id, account_id, role, is_primary) values (new_id, acct, 'captain', true);
  return new_id;
end;
$$;

-- 4. signup_squad_match - representation rule. If both squads are yours, you
--    represent your PRIMARY (you can never field your secondary against it).
create or replace function public.signup_squad_match(p_squad_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  mh   uuid;
  ma   uuid;
  in_home boolean;
  in_away boolean;
  prim uuid;
  side uuid;
begin
  select home_squad_id, away_squad_id into mh, ma from public.squad_matches where id = p_squad_match_id;
  if mh is null then raise exception 'Match not found.'; end if;
  in_home := exists (select 1 from public.squad_members where squad_id = mh and account_id = acct);
  in_away := exists (select 1 from public.squad_members where squad_id = ma and account_id = acct);
  if not in_home and not in_away then raise exception 'You are not in either squad.'; end if;
  if in_home and in_away then
    -- Both squads are yours: represent your primary only.
    select squad_id into prim from public.squad_members
      where account_id = acct and is_primary and squad_id in (mh, ma) limit 1;
    if prim is null then raise exception 'Set a primary squad before signing up.'; end if;
    side := prim;
  elsif in_home then
    side := mh;
  else
    side := ma;
  end if;
  insert into public.squad_match_signups (squad_match_id, account_id, squad_id)
    values (p_squad_match_id, acct, side)
    on conflict (squad_match_id, account_id) do nothing;
end;
$$;
grant execute on function public.signup_squad_match(uuid) to authenticated;

-- 5. squad_roster_xp - seed ladder positions from PRIMARY members only, so a
--    dual-squad player's lifetime XP counts for the one squad they compete for.
create or replace function public.squad_roster_xp(p_squad_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(psl.total_xp, 0)), 0)
  from public.squad_members sm
  left join public.player_stats_lifetime psl on psl.account_id = sm.account_id
  where sm.squad_id = p_squad_id and sm.is_primary;
$$;
grant execute on function public.squad_roster_xp(uuid) to anon, authenticated;
