-- =============================================================================
-- Streak rule config (data-driven engine). Each streak carries a `rule` jsonb
-- (the composable building blocks in lib/ingestion/streak-engine.ts) that the
-- generic evaluator runs. Seed the 23 built-ins' rules. Editable via the block
-- builder — this is what makes streaks configurable for resale.
-- =============================================================================

alter table public.streak_definitions add column if not exists rule jsonb;

update public.streak_definitions as s set rule = v.rule
from (values
  ('kill_streak_3',   '{"kind":"consecutive","event":"kill","count":3,"reset_on":["death"]}'::jsonb),
  ('kill_streak_5',   '{"kind":"consecutive","event":"kill","count":5,"reset_on":["death"]}'::jsonb),
  ('kill_streak_10',  '{"kind":"consecutive","event":"kill","count":10,"reset_on":["death"]}'::jsonb),
  ('kill_streak_20',  '{"kind":"consecutive","event":"kill","count":20,"reset_on":["death"]}'::jsonb),
  ('survivor',        '{"kind":"count","event":"kill","count":3,"scope":"life","actor_hp_max":50}'::jsonb),
  ('first_blood',     '{"kind":"first_of","event":"kill"}'::jsonb),
  ('last_blood',      '{"kind":"last_of","event":"kill"}'::jsonb),
  ('clutch_move',     '{"kind":"combo_window","window_seconds":30,"requirements":[{"event":"kill","count":2},{"event":"capture","count":1}]}'::jsonb),
  ('ptfo',            '{"kind":"distinct","event":"capture","count":2,"scope":"life","distinct_by":"base"}'::jsonb),
  ('map_domination',  '{"kind":"distinct","event":"capture","count":3,"scope":"life","distinct_by":"base"}'::jsonb),
  ('clean_sweep',     '{"kind":"cover_set","event":"kill","set":"opponents","scope":"round"}'::jsonb),
  ('grim_reaper',     '{"kind":"cover_set","event":"kill","set":"opponents","scope":"life"}'::jsonb),
  ('streak_ender',    '{"kind":"victim_streak","event":"kill","min_streak":5}'::jsonb),
  ('bully',           '{"kind":"per_target","event":"kill","count":10,"scope":"round","target":"victim"}'::jsonb),
  ('hold_base_3min',  '{"kind":"hold_duration","min_seconds":180}'::jsonb),
  ('hold_base_5min',  '{"kind":"hold_duration","min_seconds":300}'::jsonb),
  ('hold_base_10min', '{"kind":"hold_duration","min_seconds":600}'::jsonb),
  ('captures_3',      '{"kind":"count","event":"capture","count":3,"scope":"round"}'::jsonb),
  ('captures_5',      '{"kind":"count","event":"capture","count":5,"scope":"round"}'::jsonb),
  ('captures_10',     '{"kind":"count","event":"capture","count":10,"scope":"round"}'::jsonb),
  ('burner_1',        '{"kind":"burn","count":1}'::jsonb),
  ('burner_2',        '{"kind":"burn","count":2}'::jsonb),
  ('shadow',          '{"kind":"survive_round","require_event":"kill","require_count":5}'::jsonb)
) as v(streak_key, rule)
where s.streak_key = v.streak_key;
