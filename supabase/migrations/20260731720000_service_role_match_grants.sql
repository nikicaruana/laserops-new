-- =============================================================================
-- The Stripe webhook and the cron jobs connect as `service_role` (which bypasses
-- RLS) but still need table-level privileges. The match tables were only granted
-- to `authenticated`, so a service-role write hits "permission denied for table
-- match_signups". Grant the writes those trusted server jobs perform:
--   * webhook  → mark a signup paid (match_signups)
--   * go-live / waitlist crons → match + signup updates
-- =============================================================================
grant select, insert, update, delete on public.match_signups     to service_role;
grant select, insert, update, delete on public.matches           to service_role;
grant select, insert, update, delete on public.match_participants to service_role;
