-- =============================================================================
-- Seed level_unlocks from the admin's level -> reward mapping (2026-09-28).
-- =============================================================================
-- Reward types: "1.5x XP Token" -> reward_xp_1_5=1, "2x XP Token" ->
-- reward_double_xp=1, "1 LaserOps Token" -> reward_tokens=1, "0.5 LaserOps
-- Token" -> reward_tokens=0.5. Levels not listed have no reward. Replaces the
-- table wholesale (this mapping is authoritative). The progression UI derives the
-- reward image from the reward type (reward_images), so no icon_url needed.
-- =============================================================================
delete from public.level_unlocks where true;

insert into public.level_unlocks (level, title, reward_tokens, reward_double_xp, reward_xp_1_5, is_active) values
  (3,  '1.5x XP boost',   0,   0, 1, true),
  (5,  '1.5x XP boost',   0,   0, 1, true),
  (10, 'Double XP boost', 0,   1, 0, true),
  (13, '1.5x XP boost',   0,   0, 1, true),
  (15, '1 game token',    1,   0, 0, true),
  (17, 'Double XP boost', 0,   1, 0, true),
  (20, '0.5 game token',  0.5, 0, 0, true),
  (22, '1.5x XP boost',   0,   0, 1, true),
  (23, 'Double XP boost', 0,   1, 0, true),
  (25, '1 game token',    1,   0, 0, true),
  (26, '1.5x XP boost',   0,   0, 1, true),
  (27, '1.5x XP boost',   0,   0, 1, true),
  (28, '1.5x XP boost',   0,   0, 1, true),
  (29, 'Double XP boost', 0,   1, 0, true),
  (30, '1 game token',    1,   0, 0, true),
  (31, '1.5x XP boost',   0,   0, 1, true),
  (33, 'Double XP boost', 0,   1, 0, true),
  (34, '1.5x XP boost',   0,   0, 1, true),
  (35, '1 game token',    1,   0, 0, true),
  (37, '0.5 game token',  0.5, 0, 0, true),
  (38, 'Double XP boost', 0,   1, 0, true),
  (39, '1.5x XP boost',   0,   0, 1, true),
  (40, '1 game token',    1,   0, 0, true),
  (42, '0.5 game token',  0.5, 0, 0, true),
  (43, 'Double XP boost', 0,   1, 0, true),
  (44, '1.5x XP boost',   0,   0, 1, true),
  (45, '1 game token',    1,   0, 0, true),
  (47, 'Double XP boost', 0,   1, 0, true),
  (48, '0.5 game token',  0.5, 0, 0, true),
  (49, 'Double XP boost', 0,   1, 0, true),
  (50, '1 game token',    1,   0, 0, true);
