-- =============================================================================
-- Fix the Supabase "Security Definer View" CRITICAL lint on two HoF views.
-- =============================================================================
-- v_hof_all_time_records + v_hof_streak_leaders were recreated by a later
-- CREATE OR REPLACE VIEW (20260807000013) which dropped the security_invoker
-- setting 20260729081910 had applied, reverting them to SECURITY DEFINER (they
-- ran as the owner and bypassed RLS). Re-apply security_invoker so they honour
-- the querying user's permissions + RLS, matching the other HoF views. The
-- underlying match_player_aggregate is public-readable, so anon/authenticated
-- still read these leaderboards (verified).
-- =============================================================================
alter view public.v_hof_all_time_records set (security_invoker = true);
alter view public.v_hof_streak_leaders  set (security_invoker = true);
