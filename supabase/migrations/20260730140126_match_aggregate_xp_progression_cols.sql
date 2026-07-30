-- =============================================================================
-- match_player_aggregate: the pre-computed XP-animation columns for the
-- Match Report / Last Match per-player XP card
-- =============================================================================
-- These are already computed in the Sheet (Game_Data_Lookup) — the original
-- aggregate migration just didn't bring them over. Adding them so the Supabase
-- match-report engine can READ them (no recomputation), exactly like the Sheets
-- version does. Populated by re-running the aggregate import (gen_matches.mjs
-- updated to map these columns).
--   XP_Total_Before_Match / XP_Total_After_Match       -> running lifetime XP
--   XP_Current_Level_Min_Before_Match / _Next_Level_   -> level XP thresholds
--   XP_Level_Progress_Start / _End                     -> bar fill 0-1
--   XP_Level_Up_In_Match                               -> did they level up
-- =============================================================================

alter table public.match_player_aggregate
  add column if not exists xp_total_before_match          numeric,
  add column if not exists xp_total_after_match           numeric,
  add column if not exists xp_level_min_before_match      numeric,
  add column if not exists xp_next_level_min_before_match numeric,
  add column if not exists xp_level_progress_start        numeric,
  add column if not exists xp_level_progress_end          numeric,
  add column if not exists xp_level_up_in_match           boolean;
