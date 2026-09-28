-- =============================================================================
-- One game at a time (single arena). A new booking cannot clash with an existing
-- CONFIRMED or LIVE game, and there must be at least a 1-HOUR gap between games -
-- the soonest a game can start is 1h after another finishes (and vice-versa).
-- Games are treated as 3h sessions. Enforced in the player booking RPCs; the
-- availability picker also greys out clashing slots via busy_slots.
-- =============================================================================

-- True if a new [start, start+minutes] booking clashes with a confirmed/live game
-- once a 1h buffer is applied on each side (existing games assumed 3h).
create or replace function public.has_booking_conflict(p_start timestamptz, p_minutes integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    where m.status in ('confirmed', 'live')
      and m.scheduled_at is not null
      and p_start < m.scheduled_at + interval '3 hours' + interval '1 hour'
      and m.scheduled_at < p_start + make_interval(mins => p_minutes) + interval '1 hour'
  );
$$;
grant execute on function public.has_booking_conflict(timestamptz, integer) to authenticated;

-- Busy windows (confirmed/live games) in a date range - times only, no details,
-- so the client picker can grey out clashing slots without leaking private data.
create or replace function public.busy_slots(p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.scheduled_at, m.scheduled_at + interval '3 hours'
  from public.matches m
  where m.status in ('confirmed', 'live')
    and m.scheduled_at is not null
    and m.scheduled_at >= (p_from - 1)::timestamptz
    and m.scheduled_at < (least(p_to, p_from + 400) + 2)::timestamptz
  order by m.scheduled_at;
$$;
grant execute on function public.busy_slots(date, date) to anon, authenticated;

-- Recreate the two player booking RPCs to also reject clashes (admins bypass).
create or replace function public.create_private_booking(p_title text, p_scheduled_at timestamptz, p_headcount integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid;
begin
  if acct is null then raise exception 'You need an account to book a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  if not public.is_admin() and public.has_booking_conflict(p_scheduled_at, 180) then
    raise exception 'Another game is booked around that time. Games need at least an hour between them.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games/bookings at a time.'; end if;
  insert into public.matches (title, scheduled_at, status, min_players, is_private, pricing_mode, created_by)
    values (nullif(btrim(p_title), ''), p_scheduled_at, 'tentative', greatest(coalesce(p_headcount, 1), 1), true, 'flat', acct)
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.create_private_booking(text, timestamptz, integer) to authenticated;

create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  if not public.is_admin() and public.has_booking_conflict(p_scheduled_at, 180) then
    raise exception 'Another game is booked around that time. Games need at least an hour between them.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games at a time.'; end if;

  insert into public.matches (title, scheduled_at, status, min_players, max_players, price_eur, pricing_mode, is_double_xp, is_private, created_by)
    values (nullif(btrim(p_title), ''), p_scheduled_at, 'tentative', greatest(coalesce(p_min_players, 10), 1), p_max_players, p_price_eur, 'per_player', false, false, acct)
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
grant execute on function public.create_player_match(text, timestamptz, integer, integer, numeric) to authenticated;
