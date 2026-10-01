-- =============================================================================
-- Let the service role READ the scoring config, so a service-role scoring path
-- (e.g. the launch match-backlog batch importer) can load the admin formula +
-- exploit thresholds. Publish itself reads them with the admin session (RLS
-- policies already allow that); these grants cover the trusted server path.
-- service_role needs EXPLICIT grants in this project (defaults are revoked).
-- =============================================================================
grant select on public.score_formula to service_role;
grant select on public.game_modes to service_role;
grant select on public.base_trading_config to service_role;
grant select on public.spawn_camp_config to service_role;
