-- =============================================================================
-- Booking window: the close time is now the LATEST START (was finish-by).
-- =============================================================================
-- Previously the window meant a game had to FINISH by close_time (a ~3h session
-- offset). Per the admin's request the end time is now simply the latest time a
-- game may START, so the 3h offset is dropped from the availability gate. (Game
-- spacing / conflicts still use the ~3h session length elsewhere - unchanged.)
-- =============================================================================

create or replace function public.is_booking_open(p_ts timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare d date; loc timestamp; sid uuid; ov record; wh record;
begin
  if p_ts is null then return true; end if;
  loc := (p_ts at time zone 'Europe/Malta');   -- wall clock
  d := loc::date;
  select * into ov from public.booking_date_overrides where the_date = d;
  if found then
    if not ov.is_open then return false; end if;
    if ov.open_time is not null and loc < (d + ov.open_time) then return false; end if;
    if ov.close_time is not null and loc > (d + ov.close_time) then return false; end if;  -- close = latest start
    return true;
  end if;
  sid := public.active_booking_season(d);
  select * into wh from public.booking_weekly_hours where season_id = sid and weekday = extract(dow from d)::int;
  if not found or not wh.is_open then return false; end if;
  return loc >= (d + wh.open_time) and loc <= (d + wh.close_time);  -- start within [open, close]
end;
$$;
grant execute on function public.is_booking_open(timestamptz) to anon, authenticated;
