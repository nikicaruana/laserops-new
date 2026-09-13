-- =============================================================================
-- v2 relative-performance XP model (admin Progression Calibrator)
-- -----------------------------------------------------------------------------
-- Adds the config for the lobby-relative XP model, a per-player multiplier column
-- so config changes can recompute XP retroactively, and seeds the level map to
-- the v2 default curve. All editable later via the admin calibrator. v2-rebuild
-- only; the live site is unaffected.
-- =============================================================================

-- 1. New xp_config keys (relative model). Round_Win_XP / Match_Win_XP already seeded.
insert into public.xp_config (key, value, note) values
  ('Base_XP',          0,    'Flat XP just for playing a match'),
  ('Performance_Pool', 2500, 'XP pool multiplied by the player''s lobby-relative rating (score / match average)'),
  ('Rating_Cap',       4.0,  'Rating is capped here for the performance term, so one freak game cannot run away')
on conflict (operator_id, key) do update
  set value = excluded.value, note = excluded.note, updated_at = now();

-- 2. Per-player XP multiplier used for a match (double / 1.5x token spent at sign-in;
--    1 when none). Stored so the recompute can reapply it without re-ingesting.
alter table public.match_player_aggregate
  add column if not exists xp_multiplier numeric not null default 1;

-- 3. v2 default level map: minXP(L) = 1000 * (L-1)^2, 50 levels, Recruit -> Legend.
--    Editable via the admin calibrator; this is just the starting default.
insert into public.rank_levels (level, rank_name, score_threshold)
select
  L,
  (array['Recruit','Operative','Ranger','Specialist','Veteran','Elite','Commander','Warlord','Apex','Legend'])[least(10, floor((L-1)/5)::int + 1)],
  (1000 * power(L - 1, 2))::numeric
from generate_series(1, 50) as L
on conflict (operator_id, level) do update
  set rank_name = excluded.rank_name, score_threshold = excluded.score_threshold, updated_at = now();
