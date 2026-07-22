-- =============================================================================
-- Seed · accolade_definitions + accolade_rules (§4.14)
-- =============================================================================
-- 15 accolades from the Accolades sheet (name/description/badge/xp),
-- all scope='match'. points=0: accolades grant XP (progression), not the match
-- score/ledger currency. Rules verified to reproduce 100% of the real
-- Accolade_* winner columns in Game_Data_Lookup (per-match superlatives; Apex
-- Predator uses special zero-death K/D, Specialist groups per weapon).
-- Idempotent: definitions upsert on (name, scope); rules are replaced.
-- =============================================================================

insert into public.accolade_definitions (name, description, badge_url, xp, points, scope, is_active) values
  ('MVP', 'The Highest Score', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-MVP_b9u9ja.png', 100, 0, 'match', true),
  ('Reaper', 'The Most Kills', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Reaper_v2nw75.png', 100, 0, 'match', true),
  ('Kamikaze', 'The Most Deaths', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Kamikaze_i1zcgn.png', 50, 0, 'match', true),
  ('Tank', 'The Least Deaths', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889562/LaserOps-Accolades-Tank_a7covz.png', 75, 0, 'match', true),
  ('Rambo', 'The Most Shots Fired', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Rambo_zgisll.png', 50, 0, 'match', true),
  ('Ammo Saver', 'The Least Shots Fired', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889560/LaserOps-Accolades-Ammo_Saver_hf23lr.png', 50, 0, 'match', true),
  ('Apex Predator', 'The Best Kill/Death Ratio', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889560/LaserOps-Accolades-Apex_Predator_hggvzw.png', 100, 0, 'match', true),
  ('Eagle Eye', 'The Highest Accuracy', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889560/LaserOps-Accolades-Eagle_Eye_rwrk8e.png', 75, 0, 'match', true),
  ('Spray n Pray', 'The Lowest Accuracy', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Spray_N_Pray_ouaft3.png', 50, 0, 'match', true),
  ('Specialist', 'The Highest Score With Each Weapon', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Specialist_bkp9j2.png', 75, 0, 'match', true),
  ('Punisher', 'The Most Hits', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889560/LaserOps-Accolades-Punisher_tj5j1m.png', 75, 0, 'match', true),
  ('Swiss Cheese', 'The Most Hits Taken', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Swiss_Cheese_oz63ir.png', 50, 0, 'match', true),
  ('Ghost', 'The Least Hits Taken', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889560/LaserOps-Accolades-Ghost_evfmwi.png', 75, 0, 'match', true),
  ('Heavy Hitter', 'The Most Damage Done', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889561/LaserOps-Accolades-Heavy_Hitter_avw1cm.png', 100, 0, 'match', true),
  ('Pacifist', 'The Least Damage Done', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1777889560/LaserOps-Accolades-Pacifist_jdaumq.png', 50, 0, 'match', true)
on conflict (operator_id, name, scope) do update
  set description = excluded.description, badge_url = excluded.badge_url,
      xp = excluded.xp, points = excluded.points, is_active = excluded.is_active, updated_at = now();

delete from public.accolade_rules
  where accolade_definition_id in (select id from public.accolade_definitions where scope = 'match');

insert into public.accolade_rules (accolade_definition_id, rule_type, stat_key, direction, params)
select d.id, 'match_superlative', v.stat, v.dir, v.params::jsonb
from (values
  ('MVP', 'score', 'max', '{}'),
  ('Reaper', 'frags', 'max', '{}'),
  ('Kamikaze', 'deaths', 'max', '{}'),
  ('Tank', 'deaths', 'min', '{}'),
  ('Rambo', 'shots', 'max', '{}'),
  ('Ammo Saver', 'shots', 'min', '{}'),
  ('Apex Predator', 'kd', 'max', '{"zero_death_rule":"undefeated_ranks_top_tiebreak_by_frags"}'),
  ('Eagle Eye', 'accuracy', 'max', '{}'),
  ('Spray n Pray', 'accuracy', 'min', '{}'),
  ('Specialist', 'score', 'max', '{"group_by":"gun"}'),
  ('Punisher', 'hits', 'max', '{}'),
  ('Swiss Cheese', 'wounds', 'max', '{}'),
  ('Ghost', 'wounds', 'min', '{}'),
  ('Heavy Hitter', 'damage', 'max', '{}'),
  ('Pacifist', 'damage', 'min', '{}')
) as v(name, stat, dir, params)
join public.accolade_definitions d on d.name = v.name and d.scope = 'match';
