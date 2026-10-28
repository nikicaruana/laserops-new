-- Store the Google Calendar event id created for a match on the shared
-- "LaserOps Malta Bookings" calendar, so later updates (reschedule) and
-- removals (cancel) target the same event instead of duplicating it.
alter table public.matches add column if not exists google_event_id text;
