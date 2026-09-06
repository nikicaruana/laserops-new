-- =============================================================================
-- The Match Report player card shows Streaks, Nemesis, and head-to-head kill
-- lists. These are derived from the round files (admin-only), but the report is
-- public — so the publish step persists them (with opponent names already
-- resolved) onto the per-player aggregate, which is public-readable.
--   streaks   : [{ key, count, points }]
--   nemesis   : { nickname, profilePicUrl, level, killsFor, killsAgainst } | null
--   killed    : [{ nickname, count }]   (opponents this player killed)
--   killed_by : [{ nickname, count }]   (opponents who killed this player)
-- =============================================================================
alter table public.match_player_aggregate
  add column if not exists streaks   jsonb,
  add column if not exists nemesis   jsonb,
  add column if not exists killed    jsonb,
  add column if not exists killed_by jsonb;
