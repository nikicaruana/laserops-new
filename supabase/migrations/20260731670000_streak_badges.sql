-- =============================================================================
-- Streak badge art (uploaded to Cloudinary laseropsmalta.com/streak-badges). Sets streak_definitions.
-- badge_url per streak_key from the LaserOps-Streaks v2 asset pack. Idempotent.
-- =============================================================================
update public.streak_definitions d set badge_url = v.url
from (values
  ('bully', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032310/laseropsmalta.com/streak-badges/bully.png'),
  ('burner_1', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032311/laseropsmalta.com/streak-badges/burner_1.png'),
  ('burner_2', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032305/laseropsmalta.com/streak-badges/burner_2.png'),
  ('captures_10', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032303/laseropsmalta.com/streak-badges/captures_10.png'),
  ('captures_3', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032307/laseropsmalta.com/streak-badges/captures_3.png'),
  ('captures_5', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032310/laseropsmalta.com/streak-badges/captures_5.png'),
  ('clean_sweep', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032312/laseropsmalta.com/streak-badges/clean_sweep.png'),
  ('clutch_move', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032312/laseropsmalta.com/streak-badges/clutch_move.png'),
  ('first_blood', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032313/laseropsmalta.com/streak-badges/first_blood.png'),
  ('grim_reaper', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032315/laseropsmalta.com/streak-badges/grim_reaper.png'),
  ('hold_base_10min', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032302/laseropsmalta.com/streak-badges/hold_base_10min.png'),
  ('hold_base_3min', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032306/laseropsmalta.com/streak-badges/hold_base_3min.png'),
  ('hold_base_5min', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032308/laseropsmalta.com/streak-badges/hold_base_5min.png'),
  ('immortal', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032315/laseropsmalta.com/streak-badges/immortal.png'),
  ('kill_streak_10', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032303/laseropsmalta.com/streak-badges/kill_streak_10.png'),
  ('kill_streak_20', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032304/laseropsmalta.com/streak-badges/kill_streak_20.png'),
  ('kill_streak_3', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032307/laseropsmalta.com/streak-badges/kill_streak_3.png'),
  ('kill_streak_5', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032309/laseropsmalta.com/streak-badges/kill_streak_5.png'),
  ('last_blood', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032316/laseropsmalta.com/streak-badges/last_blood.png'),
  ('map_domination', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032317/laseropsmalta.com/streak-badges/map_domination.png'),
  ('ptfo', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032318/laseropsmalta.com/streak-badges/ptfo.png'),
  ('redemption', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032318/laseropsmalta.com/streak-badges/redemption.png'),
  ('revenge', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032319/laseropsmalta.com/streak-badges/revenge.png'),
  ('shadow', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032320/laseropsmalta.com/streak-badges/shadow.png'),
  ('streak_ender', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032320/laseropsmalta.com/streak-badges/streak_ender.png'),
  ('survivor', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1786032321/laseropsmalta.com/streak-badges/survivor.png')
) as v(streak_key, url)
where d.streak_key = v.streak_key;
