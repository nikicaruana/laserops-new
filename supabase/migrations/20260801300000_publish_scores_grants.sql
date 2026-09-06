-- =============================================================================
-- Publish Scores (commit step) writes the per-player aggregates and accolade
-- awards via the service role (after the server verifies admin + 2FA). Grant the
-- service role the needed privileges on those two tables (matches was already
-- granted in 20260731720000).
-- =============================================================================
grant select, insert, update, delete on public.match_player_aggregate to service_role;
grant select, insert, update, delete on public.match_awards           to service_role;
