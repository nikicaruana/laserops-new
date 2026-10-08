-- =============================================================================
-- Booking seasons v2: start + end date, a fallback "default" template, and a
-- yearly-recurring range model.
--   - Each dated season now has BOTH a start (month/day) and an end (month/day),
--     recurring every year. A range may wrap the new year (start > end).
--   - Exactly one DEFAULT season (is_default) with no date range holds the
--     "default times" used for any date not covered by a dated season.
--   - Resolution order (unchanged for overrides): a date override / blackout
--     wins; otherwise the dated season whose range contains the date; otherwise
--     the default times.
-- is_booking_open() and booking_calendar() are unchanged - they already delegate
-- to active_booking_season(), which now does the range + default-fallback logic.
-- =============================================================================

-- 1. Schema: start/end become nullable (the default has no range); add end + flag.
alter table public.booking_seasons alter column start_month drop not null;
alter table public.booking_seasons alter column start_day   drop not null;
alter table public.booking_seasons add column if not exists end_month int check (end_month between 1 and 12);
alter table public.booking_seasons add column if not exists end_day   int check (end_day   between 1 and 31);
alter table public.booking_seasons add column if not exists is_default boolean not null default false;

-- 2. Make the existing all-year/earliest season the DEFAULT (loses its range).
update public.booking_seasons
set is_default = true, name = 'Default', start_month = null, start_day = null, end_month = null, end_day = null
where id = (
  select id from public.booking_seasons
  order by (case when start_month = 1 and start_day = 1 then 0 else 1 end), sort_order, start_month, start_day
  limit 1
);
-- Any OTHER pre-existing seasons had no end date - close them at Dec 31 so they
-- stay valid ranges until an admin edits them.
update public.booking_seasons set end_month = 12, end_day = 31 where is_default = false and end_month is null;

-- 3. active_booking_season: the dated season whose recurring range contains the
--    date (wrap-aware), else the default. Lowest sort_order wins on overlap.
create or replace function public.active_booking_season(d date)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.id
       from public.booking_seasons s
       cross join (select extract(month from d)::int as m, extract(day from d)::int as dy) md
      where s.is_default = false
        and s.start_month is not null and s.start_day is not null
        and s.end_month is not null and s.end_day is not null
        and (
          case
            when (s.start_month, s.start_day) <= (s.end_month, s.end_day)
              then (md.m, md.dy) between (s.start_month, s.start_day) and (s.end_month, s.end_day)
            else (md.m, md.dy) >= (s.start_month, s.start_day) or (md.m, md.dy) <= (s.end_month, s.end_day)
          end
        )
      order by s.sort_order nulls last, s.start_month, s.start_day
      limit 1),
    (select id from public.booking_seasons where is_default = true limit 1)
  );
$$;

-- 4. upsert_booking_season now takes start + end; a new season copies the
--    default's weekly hours as its starting point.
drop function if exists public.upsert_booking_season(uuid, text, int, int);
create or replace function public.upsert_booking_season(
  p_id uuid, p_name text, p_start_month int, p_start_day int, p_end_month int, p_end_day int
) returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_start_month is null or p_start_month < 1 or p_start_month > 12
     or p_start_day is null or p_start_day < 1 or p_start_day > 31
     or p_end_month is null or p_end_month < 1 or p_end_month > 12
     or p_end_day is null or p_end_day < 1 or p_end_day > 31 then
    raise exception 'Invalid season start/end date.';
  end if;
  if p_id is null then
    insert into public.booking_seasons (name, start_month, start_day, end_month, end_day, is_default, sort_order)
      values (coalesce(nullif(btrim(p_name), ''), 'Season'), p_start_month, p_start_day, p_end_month, p_end_day, false,
              (select coalesce(max(sort_order), 0) + 1 from public.booking_seasons))
      returning id into sid;
    -- Seed its week from the current default times (fallback to open 09:00-22:00).
    insert into public.booking_weekly_hours (season_id, weekday, is_open, open_time, close_time)
      select sid, wd, coalesce(d.is_open, true), coalesce(d.open_time, '09:00'), coalesce(d.close_time, '22:00')
      from generate_series(0, 6) wd
      left join public.booking_weekly_hours d
        on d.weekday = wd and d.season_id = (select id from public.booking_seasons where is_default = true limit 1);
  else
    if (select is_default from public.booking_seasons where id = p_id) then
      raise exception 'The default times have no date range.';
    end if;
    update public.booking_seasons
      set name = coalesce(nullif(btrim(p_name), ''), name),
          start_month = p_start_month, start_day = p_start_day,
          end_month = p_end_month, end_day = p_end_day
      where id = p_id;
    sid := p_id;
  end if;
  return sid;
end;
$$;
grant execute on function public.upsert_booking_season(uuid, text, int, int, int, int) to authenticated;

-- 5. delete: never the default.
create or replace function public.delete_booking_season(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if (select is_default from public.booking_seasons where id = p_id) then
    raise exception 'The default times cannot be deleted.';
  end if;
  delete from public.booking_seasons where id = p_id; -- cascades its weekly hours
end;
$$;
grant execute on function public.delete_booking_season(uuid) to authenticated;

-- 6. Set all 7 weekdays of a season to one window in a single call (uniform mode).
create or replace function public.set_booking_weekly_all(p_season_id uuid, p_is_open boolean, p_open time, p_close time)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.booking_weekly_hours (season_id, weekday, is_open, open_time, close_time)
  select p_season_id, g, p_is_open, coalesce(p_open, '09:00'), coalesce(p_close, '22:00') from generate_series(0, 6) g
  on conflict (season_id, weekday) do update set is_open = excluded.is_open, open_time = excluded.open_time, close_time = excluded.close_time;
end;
$$;
grant execute on function public.set_booking_weekly_all(uuid, boolean, time, time) to authenticated;
