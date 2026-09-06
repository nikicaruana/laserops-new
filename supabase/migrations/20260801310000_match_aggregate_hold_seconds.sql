-- =============================================================================
-- The Match Report shows a "Cap Time" column (seconds a player held bases). The
-- publish step computes it (PlayerReport.holdSeconds); store it on the per-player
-- aggregate so the report can read it back. Captures already have a column.
-- =============================================================================
alter table public.match_player_aggregate
  add column if not exists hold_seconds numeric;
