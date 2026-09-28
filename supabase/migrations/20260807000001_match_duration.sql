-- =============================================================================
-- matches.duration_minutes — game length, for the end time / time range
-- =============================================================================
-- Games are a fixed length (default 3 hours = 180 min); admins can raise it for
-- longer events (e.g. a large double-XP game at 3.5 hours = 210). Players never
-- pick this. The end time / displayed time range is scheduled_at + this. Stored
-- as minutes (most future-proof and simple to add to; end = start + interval).
-- =============================================================================
alter table public.matches
  add column if not exists duration_minutes integer not null default 180;
