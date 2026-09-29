-- =============================================================================
-- Service-role SELECT grants for the XP celebration.
-- getPendingXpCelebration reads these via the service client, but they were
-- only granted to anon/authenticated — so the service client saw them empty
-- (no rank badges, no unlocks, fallback avatar). Grant service_role read.
-- (match_player_aggregate / matches / reward_images were already granted.)
-- =============================================================================
grant select on public.level_unlocks         to service_role;
grant select on public.rank_levels           to service_role;
grant select on public.player_stats_lifetime to service_role;
