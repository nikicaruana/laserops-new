-- =============================================================================
-- match_player_aggregate: store spawn kills + spawn damage (voided from scoring)
-- =============================================================================
-- The Kill Score already excludes kills/damage dealt inside the spawn-protection
-- window. The report now DISPLAYS the scored (spawn-adjusted) kills/damage, and
-- surfaces the excluded amounts in two greyed "Sp. K" / "Sp. Dmg" columns, so a
-- player can see what didn't count. Store them per player for the read model.
-- Existing rows stay null (show 0) until their match is re-published.
-- =============================================================================
alter table public.match_player_aggregate
  add column if not exists spawn_kills  integer,
  add column if not exists spawn_damage numeric;

comment on column public.match_player_aggregate.spawn_kills is
  'Kills inside the spawn-protection window — voided from Kill Score; shown greyed in the report.';
comment on column public.match_player_aggregate.spawn_damage is
  'Damage inside the spawn-protection window — voided from Kill Score; shown greyed in the report.';
