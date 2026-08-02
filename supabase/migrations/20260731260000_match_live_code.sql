-- =============================================================================
-- Live entry code — when an admin starts a match it goes live with a 4-digit
-- code, spoken on site so only players who are there can join. went_live_at
-- records the moment. (The code only matters while status = 'live'.)
-- =============================================================================

alter table public.matches
  add column if not exists entry_code   text,
  add column if not exists went_live_at timestamptz;
