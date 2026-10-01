-- =============================================================================
-- Let the service role READ elo_config, so a service-role recompute (the launch
-- full XP/level/Elo replay) can load the Elo params. recomputeProgression reads
-- elo_config + xp_config + rank_levels + matches + match_player_aggregate; all
-- but elo_config were already granted to service_role.
-- =============================================================================
grant select on public.elo_config to service_role;
