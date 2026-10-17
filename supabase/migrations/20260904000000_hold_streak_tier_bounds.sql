-- =============================================================================
-- Hold-streak tiers: add the upper bound (`up_to`) to the 3- and 5-min rules.
--
-- The hold_base_* rules in streak_definitions only had a lower bound
-- (min_seconds), so the data-driven streak engine (evaluateStreaks, used by the
-- admin ingest cross-check) fired EVERY tier a single hold crossed — a 10-min
-- hold also showed 5-min and 3-min badges. The live commit (detectStreaks) is
-- hard-coded to fire only the highest tier; this aligns the engine/preview with
-- it. hold_base_10min stays open-ended (it is the top tier).
--   3min: 180–300s   5min: 300–600s   10min: 600s+
-- =============================================================================
update public.streak_definitions
   set rule = rule || '{"up_to": 300}'::jsonb
 where streak_key = 'hold_base_3min' and rule->>'kind' = 'hold_duration';

update public.streak_definitions
   set rule = rule || '{"up_to": 600}'::jsonb
 where streak_key = 'hold_base_5min' and rule->>'kind' = 'hold_duration';
