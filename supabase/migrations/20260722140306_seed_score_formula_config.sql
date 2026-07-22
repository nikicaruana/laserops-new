-- =============================================================================
-- Seed · score_formula_config (§4.9)
-- =============================================================================
-- The scoring formula, pulled out of the Google Sheet's baked column into
-- editable config. Verified to reproduce 100% of historical LaserOps_Score:
--
--   score = ROUNDUP(
--     ( frags*KILL_WEIGHT + (hits * gun_damage) * DAMAGE_WEIGHT )
--     * (1 + accuracy * ACCURACY_WEIGHT)
--     * (1 + kd * KD_WEIGHT)
--   , 0)
--
-- where gun_damage is the date-resolved value from gun_damage_history, accuracy
-- is hits/shots (as stored), and kd = frags/deaths (or frags when deaths = 0).
--
-- CAPTURE_WEIGHT / CAPTURE_TIME_WEIGHT are new 2.0 objective-play terms, seeded
-- at 0 so the formula behaves identically to today until they're deliberately
-- tuned. Idempotent: upserts on (operator_id, key).
-- =============================================================================

insert into public.score_formula_config (key, value, note) values
  ('KILL_WEIGHT',         50,   'Points per frag'),
  ('DAMAGE_WEIGHT',       0.2,  'Weight on total damage (hits x gun_damage)'),
  ('ACCURACY_WEIGHT',     0.2,  'Accuracy multiplier: base x (1 + accuracy x this)'),
  ('KD_WEIGHT',           0.12, 'K/D multiplier: base x (1 + kd x this)'),
  ('CAPTURE_WEIGHT',      0,    'New in 2.0 — objective captures. 0 = no effect (matches current formula)'),
  ('CAPTURE_TIME_WEIGHT', 0,    'New in 2.0 — objective hold time. 0 = no effect (matches current formula)')
on conflict (operator_id, key) do update
  set value = excluded.value,
      note  = excluded.note,
      updated_at = now();
