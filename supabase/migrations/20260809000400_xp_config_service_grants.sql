-- =============================================================================
-- Fix: the XP publish path (/api/admin/progression, used by the Progression
-- Calibrator's "Publish & recompute") upserts xp_config + rank_levels with the
-- service role, but service_role had no write grant on xp_config and only SELECT
-- on rank_levels -> every publish failed with "permission denied", so saved XP
-- formula / level-curve changes never persisted. Grant the writes.
-- =============================================================================
grant select, insert, update on public.xp_config   to service_role;
grant select, insert, update on public.rank_levels to service_role;
