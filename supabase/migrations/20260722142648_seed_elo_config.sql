-- =============================================================================
-- Seed · elo_config + elo_tiers (§4.12) — from the ELO settings sheet
-- =============================================================================
-- Two logical tables in one sheet: 16 settings (key/value) + 7 tier bands.
-- elo_config.value widened to text: most values are numeric, but Resnapshot_Mode
-- (enum) and Match_Size_Adjustment_Enabled (Yes/No) are not. The app casts the
-- numeric ones when computing. Idempotent upserts.
-- =============================================================================

alter table public.elo_config alter column value type text using value::text;

insert into public.elo_config (key, value, note) values
  ('Starting_ELO', '1000', 'Default Elo for new players'),
  ('K_Factor', '36', 'Base team result movement before match-size adjustment'),
  ('Performance_K', '13', 'Base personal performance modifier before match-size adjustment'),
  ('Max_Performance_Adjustment', '16', 'Base cap on personal bonus/penalty before match-size adjustment'),
  ('Max_Total_ELO_Change', '30', 'Cap on total Elo movement per match'),
  ('Elo_Divisor', '400', 'Standard Elo curve divisor'),
  ('Min_Resolved_Players', '2', 'Safety check before snapshotting'),
  ('Default_New_Player_ELO', '1000', 'Same as starting Elo unless changed'),
  ('Resnapshot_Mode', 'From_Match_Onwards', 'Reminder for script behaviour'),
  ('Team_Builder_Unknown_ELO', '900', 'Elo value given to first-time / unknown players in team builder'),
  ('Match_Size_Adjustment_Enabled', 'Yes', 'Enables dynamic weighting by match size'),
  ('Match_Size_Baseline', '12', 'Neutral match size; around 6v6'),
  ('Team_K_Min_Multiplier', '0.6', 'Lowest team-result weighting for large matches'),
  ('Team_K_Max_Multiplier', '1.1', 'Highest team-result weighting for small matches'),
  ('Performance_Min_Multiplier', '1', 'Lowest personal-performance weighting'),
  ('Performance_Max_Multiplier', '1.8', 'Highest personal-performance weighting for large matches')
on conflict (operator_id, key) do update
  set value = excluded.value, note = excluded.note, updated_at = now();

insert into public.elo_tiers (tier_name, min_elo, max_elo, sort_order) values
  ('Recruit', 0, 849, 1),
  ('Rookie', 850, 949, 2),
  ('Regular', 950, 1049, 3),
  ('Operator', 1050, 1149, 4),
  ('Specialist', 1150, 1249, 5),
  ('Veteran', 1250, 1349, 6),
  ('Elite', 1350, 9999, 7)
on conflict (operator_id, tier_name) do update
  set min_elo = excluded.min_elo, max_elo = excluded.max_elo,
      sort_order = excluded.sort_order, updated_at = now();
