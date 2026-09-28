-- =============================================================================
-- Booking seasons + finish-by-close semantics.
--   - The weekly template becomes PER SEASON. A season is a named period that
--     recurs each year, defined by a start (month + day); it runs until the next
--     season's start (wrapping around new year). e.g. "Summer" opening later for
--     the longer evenings.
--   - Availability window now means games must FINISH by the close time. With a
--     ~3h session, a 09:00-22:00 day allows a latest START of 19:00; 22:00 can't
--     be booked as a start time.
-- =============================================================================

-- Session length used to enforce finish-by-close. If sessions ever vary, this is
-- the single knob (kept inline in is_booking_open below).

-- 1. Seasons.
create table if not exists public.booking_seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_month int not null check (start_month between 1 and 12),
  start_day   int not null check (start_day between 1 and 31),
  sort_order  int,
  created_at  timestamptz not null default now()
);
alter table public.booking_seasons enable row level security;
drop policy if exists booking_seasons_read on public.booking_seasons;
create policy booking_seasons_read on public.booking_seasons for select to anon, authenticated using (true);
drop policy if exists booking_seasons_admin on public.booking_seasons;
create policy booking_seasons_admin on public.booking_seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.booking_seasons to anon, authenticated;

-- Default season holds the existing weekly hours.
insert into public.booking_seasons (name, start_month, start_day, sort_order)
select 'All year', 1, 1, 0
where not exists (select 1 from public.booking_seasons);

-- 2. Make weekly hours per-season.
alter table public.booking_weekly_hours add column if not exists season_id uuid references public.booking_seasons(id) on delete cascade;
update public.booking_weekly_hours
  set season_id = (select id from public.booking_seasons order by sort_order, start_month, start_day limit 1)
  where season_id is null;
alter table public.booking_weekly_hours drop constraint if exists booking_weekly_hours_pkey;
alter table public.booking_weekly_hours alter column season_id set not null;
alter table public.booking_weekly_hours add primary key (season_id, weekday);

-- 3. The season a date falls in: latest season start <= that date-in-year, else
--    (wrap-around) the last season of the year.
create or replace function public.active_booking_season(d date)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.id from public.booking_seasons s
       where (s.start_month, s.start_day) <= (extract(month from d)::int, extract(day from d)::int)
       order by s.start_month desc, s.start_day desc limit 1),
    (select s.id from public.booking_seasons s order by s.start_month desc, s.start_day desc limit 1)
  );
$$;

-- 4. is_booking_open: games must FINISH by the close time (~3h session).
create or replace function public.is_booking_open(p_ts timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare d date; loc timestamp; sid uuid; ov record; wh record; end_ts timestamp;
begin
  if p_ts is null then return true; end if;
  loc := (p_ts at time zone 'Europe/Malta');   -- wall clock
  d := loc::date;
  end_ts := loc + interval '3 hours';           -- session length
  select * into ov from public.booking_date_overrides where the_date = d;
  if found then
    if not ov.is_open then return false; end if;
    if ov.open_time is not null and loc < (d + ov.open_time) then return false; end if;
    if ov.close_time is not null and end_ts > (d + ov.close_time) then return false; end if;
    return true;
  end if;
  sid := public.active_booking_season(d);
  select * into wh from public.booking_weekly_hours where season_id = sid and weekday = extract(dow from d)::int;
  if not found or not wh.is_open then return false; end if;
  return loc >= (d + wh.open_time) and end_ts <= (d + wh.close_time);
end;
$$;
grant execute on function public.is_booking_open(timestamptz) to anon, authenticated;

-- 5. booking_calendar resolves each date's season (override still wins).
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
  left join lateral (
    select wh.is_open, wh.open_time, wh.close_time
    from public.booking_weekly_hours wh
    where wh.season_id = public.active_booking_season(g::date)
      and wh.weekday = extract(dow from g)::int
  ) w on true
  order by g;
$$;
grant execute on function public.booking_calendar(date, date) to anon, authenticated;

-- 6. Season admin RPCs.
create or replace function public.upsert_booking_season(p_id uuid, p_name text, p_start_month int, p_start_day int)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_start_month is null or p_start_month < 1 or p_start_month > 12 or p_start_day is null or p_start_day < 1 or p_start_day > 31 then
    raise exception 'Invalid season start date.';
  end if;
  if p_id is null then
    insert into public.booking_seasons (name, start_month, start_day, sort_order)
      values (coalesce(nullif(btrim(p_name), ''), 'Season'), p_start_month, p_start_day,
              (select coalesce(max(sort_order), 0) + 1 from public.booking_seasons))
      returning id into sid;
    insert into public.booking_weekly_hours (season_id, weekday, is_open, open_time, close_time)
      select sid, g, true, '09:00', '22:00' from generate_series(0, 6) g;
  else
    update public.booking_seasons set name = coalesce(nullif(btrim(p_name), ''), name), start_month = p_start_month, start_day = p_start_day where id = p_id;
    sid := p_id;
  end if;
  return sid;
end;
$$;
grant execute on function public.upsert_booking_season(uuid, text, int, int) to authenticated;

create or replace function public.delete_booking_season(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if (select count(*) from public.booking_seasons) <= 1 then raise exception 'Keep at least one season.'; end if;
  delete from public.booking_seasons where id = p_id; -- cascades its weekly hours
end;
$$;
grant execute on function public.delete_booking_season(uuid) to authenticated;

-- 7. set_booking_weekly is now per-season (signature change: drop old, recreate).
drop function if exists public.set_booking_weekly(int, boolean, time, time);
create or replace function public.set_booking_weekly(p_season_id uuid, p_weekday int, p_is_open boolean, p_open time, p_close time)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.booking_weekly_hours (season_id, weekday, is_open, open_time, close_time)
    values (p_season_id, p_weekday, p_is_open, coalesce(p_open, '09:00'), coalesce(p_close, '22:00'))
    on conflict (season_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
end;
$$;
grant execute on function public.set_booking_weekly(uuid, int, boolean, time, time) to authenticated;
