-- 20260801030000_derive_squad_colours.sql
-- --------------------------------------------------------------------
-- Auto-detect which team COLOUR each squad played as in a squad-vs-squad match
-- (ladder or casual), from the committed per-player data. Each player entry in
-- match_player_aggregate carries a team_colour and an account_id; squad_members
-- maps accounts to squads. So a squad's colour is simply the colour the majority
-- of its members were on. This is the headband -> account -> squad derivation:
-- the round file assigns each headband a team colour, the roster links headbands
-- to accounts, and accounts belong to squads.
--
-- Two entry points:
--   derive_match_squad_colours(match_id, overwrite)  - internal, no admin gate,
--     for the future ingestion commit to call after writing aggregate entries
--     (overwrite = false so a manual admin choice is never clobbered).
--   detect_match_squad_colours(match_id)             - admin RPC, overwrite = true,
--     the "Detect from game data" button on the manage-match page.
-- Both return the detected (home_colour, away_colour) so the UI can report them.

-- Core derivation. Reads the committed aggregate, tallies team colours per squad,
-- canonicalises each to the matching teams.colour (so the value lines up with the
-- colour dropdown and record_ladder_result), and resolves a collision (both
-- squads' top colour the same) in favour of the squad with the stronger majority.
create or replace function public.derive_match_squad_colours(p_match_id uuid, p_overwrite boolean default false)
returns table (home_colour text, away_colour text)
language plpgsql security definer set search_path = public as $$
declare
  m record;
  home_c text; home_n int;
  away_c text; away_n int;
begin
  select id, home_squad_id, away_squad_id, home_squad_colour, away_squad_colour into m
    from public.matches where id = p_match_id;
  if m.id is null or m.home_squad_id is null or m.away_squad_id is null then
    return query select null::text, null::text; return;
  end if;

  with agg as (
    select coalesce(t.colour, a.team_colour) as colour, sm.squad_id, count(*)::int as n
    from public.match_player_aggregate a
    join public.squad_members sm on sm.account_id = a.account_id
    left join public.teams t on lower(t.colour) = lower(a.team_colour) and t.is_active
    where a.match_id = p_match_id
      and a.team_colour is not null
      and a.account_id is not null
      and sm.squad_id in (m.home_squad_id, m.away_squad_id)
    group by coalesce(t.colour, a.team_colour), sm.squad_id
  )
  select colour, n into home_c, home_n from agg where squad_id = m.home_squad_id order by n desc, colour limit 1;
  select colour, n into away_c, away_n from agg where squad_id = m.away_squad_id order by n desc, colour limit 1;

  -- Collision: both squads read as the same colour. Keep it for the squad with
  -- the stronger majority; give the other its next-best distinct colour.
  if home_c is not null and home_c = away_c then
    if coalesce(home_n, 0) >= coalesce(away_n, 0) then
      select colour into away_c
        from (
          select coalesce(t.colour, a.team_colour) as colour, count(*)::int as n
          from public.match_player_aggregate a
          join public.squad_members sm on sm.account_id = a.account_id
          left join public.teams t on lower(t.colour) = lower(a.team_colour) and t.is_active
          where a.match_id = p_match_id and a.team_colour is not null and sm.squad_id = m.away_squad_id
          group by coalesce(t.colour, a.team_colour)
        ) q
        where colour <> home_c order by n desc, colour limit 1;
    else
      select colour into home_c
        from (
          select coalesce(t.colour, a.team_colour) as colour, count(*)::int as n
          from public.match_player_aggregate a
          join public.squad_members sm on sm.account_id = a.account_id
          left join public.teams t on lower(t.colour) = lower(a.team_colour) and t.is_active
          where a.match_id = p_match_id and a.team_colour is not null and sm.squad_id = m.home_squad_id
          group by coalesce(t.colour, a.team_colour)
        ) q
        where colour <> away_c order by n desc, colour limit 1;
    end if;
  end if;

  -- Write, but never overwrite a value that already exists unless asked, and
  -- never blank an existing value with a null detection.
  update public.matches set
    home_squad_colour = case when home_c is not null and (p_overwrite or home_squad_colour is null) then home_c else home_squad_colour end,
    away_squad_colour = case when away_c is not null and (p_overwrite or away_squad_colour is null) then away_c else away_squad_colour end
    where id = p_match_id;

  return query select home_c, away_c;
end;
$$;

revoke execute on function public.derive_match_squad_colours(uuid, boolean) from public, anon;
grant execute on function public.derive_match_squad_colours(uuid, boolean) to service_role;

-- Admin-triggered detection (the "Detect from game data" button). Overwrites so a
-- deliberate re-detect refreshes both colours from the latest data.
create or replace function public.detect_match_squad_colours(p_match_id uuid)
returns table (home_colour text, away_colour text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query select * from public.derive_match_squad_colours(p_match_id, true);
end;
$$;

revoke execute on function public.detect_match_squad_colours(uuid) from public, anon;
grant execute on function public.detect_match_squad_colours(uuid) to authenticated;
