-- =============================================================================
-- Booking availability master calendar. Admins control which days/times games
-- can be booked; players see this on the games calendar, and player-initiated
-- bookings are blocked outside available windows (e.g. when the team is away).
--
--   booking_weekly_hours   : the default weekly template (per weekday: open? +
--                            daily window). 7 rows, open by default.
--   booking_date_overrides : per-date exceptions - a blackout (is_open=false) or
--                            a special opening / custom hours (is_open=true).
-- Availability for a date = its override if one exists, else the weekly template.
-- All times are Europe/Malta wall-clock.
-- =============================================================================

create table public.booking_weekly_hours (
  weekday    int primary key check (weekday between 0 and 6), -- 0 = Sunday
  is_open    boolean not null default true,
  open_time  time not null default '09:00',
  close_time time not null default '22:00'
);
insert into public.booking_weekly_hours (weekday)
  select g from generate_series(0, 6) g
  on conflict (weekday) do nothing;

create table public.booking_date_overrides (
  the_date   date primary key,
  is_open    boolean not null,
  open_time  time,
  close_time time,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.booking_weekly_hours enable row level security;
alter table public.booking_date_overrides enable row level security;

-- Everyone reads availability (players see the calendar); admins write.
drop policy if exists booking_weekly_read on public.booking_weekly_hours;
create policy booking_weekly_read on public.booking_weekly_hours for select to anon, authenticated using (true);
drop policy if exists booking_weekly_admin on public.booking_weekly_hours;
create policy booking_weekly_admin on public.booking_weekly_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.booking_weekly_hours to anon, authenticated;

drop policy if exists booking_override_read on public.booking_date_overrides;
create policy booking_override_read on public.booking_date_overrides for select to anon, authenticated using (true);
drop policy if exists booking_override_admin on public.booking_date_overrides;
create policy booking_override_admin on public.booking_date_overrides for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.booking_date_overrides to anon, authenticated;

-- --- read model -------------------------------------------------------------
-- Resolved availability per date in a range (override wins over weekly template).
create or replace function public.booking_calendar(p_from date, p_to date)
returns table (the_date date, is_open boolean, open_time time, close_time time, note text, is_override boolean)
language sql security definer set search_path = public as $$
  select g::date,
         coalesce(o.is_open, w.is_open, false),
         coalesce(o.open_time, w.open_time),
         coalesce(o.close_time, w.close_time),
         o.note,
         (o.the_date is not null)
  from generate_series(p_from, least(p_to, p_from + 400), interval '1 day') g
  left join public.booking_date_overrides o on o.the_date = g::date
  left join public.booking_weekly_hours w on w.weekday = extract(dow from g)::int
  order by g;
$$;
grant execute on function public.booking_calendar(date, date) to anon, authenticated;

-- Is booking open at a given instant? Resolves the Europe/Malta wall date/time.
create or replace function public.is_booking_open(p_ts timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare d date; t time; ov record; wh record;
begin
  if p_ts is null then return true; end if;
  d := (p_ts at time zone 'Europe/Malta')::date;
  t := (p_ts at time zone 'Europe/Malta')::time;
  select * into ov from public.booking_date_overrides where the_date = d;
  if found then
    if not ov.is_open then return false; end if;
    if ov.open_time is not null and t < ov.open_time then return false; end if;
    if ov.close_time is not null and t > ov.close_time then return false; end if;
    return true;
  end if;
  select * into wh from public.booking_weekly_hours where weekday = extract(dow from d)::int;
  if not found or not wh.is_open then return false; end if;
  return t >= wh.open_time and t <= wh.close_time;
end;
$$;
grant execute on function public.is_booking_open(timestamptz) to anon, authenticated;

-- --- admin mutations --------------------------------------------------------
create or replace function public.set_booking_weekly(p_weekday int, p_is_open boolean, p_open time, p_close time)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.booking_weekly_hours (weekday, is_open, open_time, close_time)
    values (p_weekday, p_is_open, coalesce(p_open, '09:00'), coalesce(p_close, '22:00'))
    on conflict (weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
end;
$$;
grant execute on function public.set_booking_weekly(int, boolean, time, time) to authenticated;

create or replace function public.set_booking_override(p_date date, p_is_open boolean, p_open time, p_close time, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.booking_date_overrides (the_date, is_open, open_time, close_time, note)
    values (p_date, p_is_open, p_open, p_close, nullif(btrim(p_note), ''))
    on conflict (the_date) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time, note = excluded.note;
end;
$$;
grant execute on function public.set_booking_override(date, boolean, time, time, text) to authenticated;

create or replace function public.clear_booking_override(p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  delete from public.booking_date_overrides where the_date = p_date;
end;
$$;
grant execute on function public.clear_booking_override(date) to authenticated;

-- Blackout a whole range (e.g. away dates): close every date in [from, to].
create or replace function public.block_booking_range(p_from date, p_to date, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid date range.'; end if;
  insert into public.booking_date_overrides (the_date, is_open, note)
  select g::date, false, nullif(btrim(p_note), '')
  from generate_series(p_from, p_to, interval '1 day') g
  on conflict (the_date) do update set is_open = false, open_time = null, close_time = null, note = excluded.note;
end;
$$;
grant execute on function public.block_booking_range(date, date, text) to authenticated;

-- --- enforcement in the player booking flows --------------------------------
-- Recreate create_private_booking with an availability gate (admins bypass).
create or replace function public.create_private_booking(p_title text, p_scheduled_at timestamptz, p_headcount integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid;
begin
  if acct is null then raise exception 'You need an account to book a game.'; end if;
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
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

-- Recreate create_player_match (keeps the squadmate notify) + availability gate.
create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
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
