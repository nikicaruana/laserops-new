-- =============================================================================
-- Streak tweaks (2026-09-28): rename the kill-streak feats to "N Piece" (to
-- match the badge art) and promote 2x Burner to Tier 4 with the Tier-4 reward.
-- Matched by the stable streak_key (scoring references the key, not the name).
-- =============================================================================
update public.streak_definitions set name = '3 Piece'  where streak_key = 'kill_streak_3';
update public.streak_definitions set name = '5 Piece'  where streak_key = 'kill_streak_5';
update public.streak_definitions set name = '10 Piece' where streak_key = 'kill_streak_10';
update public.streak_definitions set name = '20 Piece' where streak_key = 'kill_streak_20';

-- 2x Burner -> Tier 4, rewarded like the other Tier-4 streaks (200 pts).
update public.streak_definitions set tier = 4, points = 200 where streak_key = 'burner_2';
