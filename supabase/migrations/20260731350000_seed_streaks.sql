-- =============================================================================
-- Seed the built-in streaks into streak_definitions (admin Streaks panel) with
-- tiers + points. streak_key links each definition to the detector
-- (lib/ingestion/streaks.ts) so the commit step can attach points/tier by key.
-- Idempotent upsert on (operator_id, name).
-- =============================================================================

alter table public.streak_definitions
  add column if not exists tier       integer,
  add column if not exists streak_key text;

create unique index if not exists streak_definitions_key_idx
  on public.streak_definitions (operator_id, streak_key) where streak_key is not null;

insert into public.streak_definitions (streak_key, name, description, tier, points, is_active) values
  ('kill_streak_3',   '3-Streak',       '3 kills in a row (no dying)',                                     1, 25,  true),
  ('kill_streak_5',   '5-Streak',       '5 kills in a row (no dying)',                                     2, 50,  true),
  ('kill_streak_10',  '10-Streak',      '10 kills in a row (no dying)',                                    3, 100, true),
  ('kill_streak_20',  '20-Streak',      '20 kills in a row (no dying)',                                    4, 200, true),
  ('survivor',        'Survivor',       '3 kills while on 50 health or less',                              2, 50,  true),
  ('first_blood',     'First Blood',    'First kill of a round',                                           1, 25,  true),
  ('last_blood',      'Last Blood',     'Final kill of a round',                                           1, 25,  true),
  ('clutch_move',     'Clutch Move',    'At least 2 kills and a base capture in under 30 seconds',         2, 50,  true),
  ('ptfo',            'PTFO',           'Capturing 2 different bases in one life',                         2, 50,  true),
  ('map_domination',  'Map Domination', 'Capturing 3 different bases in one life',                         3, 100, true),
  ('clean_sweep',     'Clean Sweep',    'Killing all members of the opposing team at least once in a round', 2, 50, true),
  ('grim_reaper',     'Grim Reaper',    'Killing all the members of the opposing team at least once without dying', 3, 100, true),
  ('streak_ender',    'Streak Ender',   'Killing someone who is on at least a 5-kill streak',              2, 50,  true),
  ('hold_base_3min',  '3 Min Hold',     'Holding down a base for 3 minutes without losing it',             2, 50,  true),
  ('hold_base_5min',  '5 Min Hold',     'Holding down a base for 5 minutes without losing it',             3, 100, true),
  ('hold_base_10min', '10 Min Hold',    'Holding down a base for 10 minutes without losing it',            4, 200, true),
  ('captures_3',      '3x Cap',         '3 base captures in one round',                                    1, 25,  true),
  ('captures_5',      '5x Cap',         '5 base captures in one round',                                    2, 50,  true),
  ('captures_10',     '10x Cap',        '10 base captures in one round',                                   3, 100, true),
  ('burner_1',        'Burner',         'Burning 1 base in a round (capturing it and taking it to the fully captured state)',  2, 50,  true),
  ('burner_2',        '2x Burner',      'Burning 2 bases in a round (capturing them and taking them to the fully captured state)', 3, 100, true),
  ('bully',           'Bully',          'Killing the same player 10 times in one round',                   3, 100, true),
  ('shadow',          'Shadow',         'Go an entire round without dying (at least 5 kills to qualify)',  3, 100, true)
on conflict (operator_id, name) do update
  set streak_key  = excluded.streak_key,
      description = excluded.description,
      tier        = excluded.tier,
      points      = excluded.points,
      updated_at  = now();
