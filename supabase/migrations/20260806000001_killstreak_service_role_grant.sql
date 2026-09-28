-- =============================================================================
-- Grant service_role table privileges on killstreak_definitions
-- =============================================================================
-- service_role bypasses RLS but still needs TABLE-level grants here (CLI-created
-- tables don't inherit them). Without this, server-side writes — the admin
-- badge-upload tooling and any future webhook/cron that touches killstreaks —
-- fail with "permission denied for table killstreak_definitions".
-- =============================================================================
grant select, insert, update, delete on public.killstreak_definitions to service_role;
