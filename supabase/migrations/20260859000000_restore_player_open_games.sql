-- =============================================================================
-- Restore player-created open games (revert the admin-only guard from 20260857).
-- Players CAN create open games again and delete THEIR OWN. The actual problem
-- (players deleting admin / other people's games) is already handled by RLS
-- (20260855/56) + the delete_player_match creator check. What remained was the
-- organiser-departure HANDOFF transferring an admin's game to a player; fix that
-- so an ADMIN organiser's game becomes a LaserOps house game, while a PLAYER
-- organiser's game is still handed to the next player (keeps player games alive).
-- =============================================================================

-- 1. create_player_match WITHOUT the admin-only guard (back to the 20260814 body).
create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.has_played_game() then
    raise exception 'You can open your own games once you have played at least one. Join an open game to get started.';
  end if;
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  if not public.is_admin() and public.has_booking_conflict(p_scheduled_at, 180) then
    raise exception 'Another game is booked around that time. Games need a break between them.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games at a time.'; end if;

  insert into public.matches (title, scheduled_at, status, min_players, max_players, price_eur, duration_minutes, pricing_mode, is_double_xp, is_private, created_by, location_id)
    values (nullif(btrim(p_title), ''), p_scheduled_at, 'tentative', greatest(coalesce(p_min_players, 10), 1), p_max_players,
            coalesce((select default_price_eur from public.pricing_config where id = 1), 35),
            coalesce((select session_minutes from public.pricing_config where id = 1), 180),
            'per_player', false, false, acct,
            (select id from public.locations where is_default limit 1))
    returning id into new_id;

  insert into public.match_signups (match_id, account_id, status) values (new_id, acct, 'registered')
    on conflict (match_id, account_id) do nothing;

  select ops_tag into tag from public.accounts where id = acct;
  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select distinct m2.account_id, 'squad_open_game', nt.priority,
         coalesce(tag, 'A squadmate') || ' opened a game',
         coalesce(nullif(btrim(p_title), ''), 'A new open game'),
         '/player-portal/games/' || new_id::text
  from public.squad_members m1
  join public.squad_members m2 on m2.squad_id = m1.squad_id and m2.account_id <> acct
  join public.notification_types nt on nt.key = 'squad_open_game' and nt.is_active
  where m1.account_id = acct;

  return new_id;
end;
$$;

-- 2. Organiser departure: ADMIN organiser -> house game (never to a player);
--    PLAYER organiser -> hand to the next player, else becomes a house game.
create or replace function public.handle_organiser_departure()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; newcreator uuid;
begin
  if tg_op = 'UPDATE' and not (old.status = 'registered' and new.status is distinct from 'registered') then
    return null;
  end if;
  if tg_op = 'DELETE' and old.status is distinct from 'registered' then
    return null;
  end if;

  select id, created_by, status, title into m from public.matches where id = old.match_id;
  if m.id is null or m.status not in ('tentative', 'awaiting_confirm', 'confirmed') then return null; end if;
  -- Only when the person leaving is the current organiser.
  if m.created_by is distinct from old.account_id then return null; end if;

  -- An ADMIN organiser leaving: the game stays LaserOps-organised (house).
  if exists (select 1 from public.accounts where id = old.account_id and coalesce(is_admin, false)) then
    update public.matches set created_by = null where id = m.id;
    return null;
  end if;

  -- A PLAYER organiser leaving: hand off to the earliest remaining registered
  -- player so the game survives; if nobody is left, it becomes a house game.
  select account_id into newcreator
    from public.match_signups
    where match_id = m.id and status = 'registered' and account_id is distinct from old.account_id
    order by created_at asc limit 1;

  if newcreator is not null then
    update public.matches set created_by = newcreator where id = m.id;
    insert into public.notifications (account_id, type_key, priority, title, body, href)
    select newcreator, 'game_organiser_transferred', nt.priority,
           'You are now organising ' || coalesce(m.title, 'a game'),
           'The previous organiser backed out. The game carries on - you can manage it from your games.',
           '/player-portal/games/' || m.id::text
    from public.notification_types nt where nt.key = 'game_organiser_transferred' and nt.is_active;
  else
    update public.matches set created_by = null where id = m.id;
  end if;
  return null;
end;
$$;
