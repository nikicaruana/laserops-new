-- =============================================================================
-- Three more streaks: Immortal, Revenge and Redemption. Seeds the definitions
-- (name/tier/points/streak_key) plus their engine rule jsonb, mirroring
-- 20260731350000 and 20260731360000. The data-driven engine
-- (lib/ingestion/streak-engine) gained matching "revenge" and "redemption" rule
-- kinds; Immortal reuses the existing "count" kind (HP-capped kills in a life).
--   Immortal    — more than 1 kill while on 10 HP or less (in one life).
--   Revenge     — kill the player who most recently killed you.
--   Redemption  — get a kill after dying 3 times in a row with no kills.
-- Idempotent upsert on (operator_id, name).
-- =============================================================================

insert into public.streak_definitions (streak_key, name, description, tier, points, is_active) values
  ('immortal',   'Immortal',   'Get more than 1 kill while on 10 health or less',            2, 50, true),
  ('revenge',    'Revenge',    'Kill the person who killed you last',                        1, 25, true),
  ('redemption', 'Redemption', 'Get a kill after dying at least 3 times in a row with no kills', 1, 25, true)
on conflict (operator_id, name) do update
  set streak_key  = excluded.streak_key,
      description = excluded.description,
      tier        = excluded.tier,
      points      = excluded.points,
      updated_at  = now();

update public.streak_definitions set rule = '{"kind":"count","event":"kill","count":2,"scope":"life","actor_hp_max":10}'::jsonb where streak_key = 'immortal';
update public.streak_definitions set rule = '{"kind":"revenge"}'::jsonb                                                          where streak_key = 'revenge';
update public.streak_definitions set rule = '{"kind":"redemption","deaths_required":3}'::jsonb                                   where streak_key = 'redemption';
