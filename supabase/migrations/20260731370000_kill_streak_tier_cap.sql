-- Kill-streak tier cap: a single life awards only the HIGHEST tier it reached,
-- not every tier passed through (a 6-kill life gives a 5-Streak, not a 3-Streak
-- AND a 5-Streak). Implemented with the engine's `up_to` bound: a run fires a
-- tier only if it reaches `count` but stays below the next tier's `up_to`.
-- Backfills the four built-in kill-streak rules with the new field. Idempotent.
update public.streak_definitions as s set rule = v.rule
from (values
  ('kill_streak_3',  '{"kind":"consecutive","event":"kill","count":3,"reset_on":["death"],"up_to":5}'::jsonb),
  ('kill_streak_5',  '{"kind":"consecutive","event":"kill","count":5,"reset_on":["death"],"up_to":10}'::jsonb),
  ('kill_streak_10', '{"kind":"consecutive","event":"kill","count":10,"reset_on":["death"],"up_to":20}'::jsonb),
  ('kill_streak_20', '{"kind":"consecutive","event":"kill","count":20,"reset_on":["death"],"up_to":null}'::jsonb)
) as v(streak_key, rule)
where s.streak_key = v.streak_key;
