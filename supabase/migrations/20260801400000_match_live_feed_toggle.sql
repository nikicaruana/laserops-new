-- =============================================================================
-- Per-match "live feed" switch. Off by default: private bookings (or any game we
-- don't stream) just upload JSONs manually afterwards. Turn it on to enable the
-- tablet listener + the player/admin live views for that match.
-- =============================================================================
alter table public.matches
  add column if not exists live_feed_enabled boolean not null default false;
