-- =============================================================================
-- Table-level GRANTs for the anon / authenticated roles
-- =============================================================================
-- RLS (chunk 3) sets the ROW-level rules, but Postgres checks TABLE-level
-- privileges first — and tables created via CLI migrations don't inherit
-- Supabase's dashboard default grants. Without these, every anon/authenticated
-- query fails with "permission denied for table" before RLS is even evaluated
-- (which is exactly what broke the profile/badge account read).
--
-- Grants are the *capability*; the RLS policies remain the *filter*:
--   * config + read-models + match data -> SELECT to anon & authenticated
--     (public-read policies decide the rows; here everyone can see all).
--   * config / accounts / internal tables also get write privileges to
--     authenticated, but the admin-write & own-row RLS policies gate WHICH
--     rows/operations actually succeed — a non-admin still can't write.
--   * accounts + operators + excluded_players: NO anon grant at all (PII /
--     internal). accounts SELECT/UPDATE is scoped to the caller's own row by
--     RLS; the protect trigger still blocks protected-field edits.
-- service_role is unaffected (it already bypasses grants and RLS).
-- =============================================================================

-- Config: public read, admin write (RLS gates the writes)
do $$ declare t text; begin
  foreach t in array array[
    'teams','guns','gun_damage_history','elo_config','elo_tiers','xp_config',
    'rank_levels','rating_config','rating_brackets','score_formula_config',
    'scoring_eras','seasons','spawn_camp_config','accolade_definitions',
    'accolade_rules','streak_definitions','streak_rules','challenges'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Match data + read-models: public read only (written by service role / definer fns)
do $$ declare t text; begin
  foreach t in array array[
    'matches','match_player_aggregate','match_awards',
    'player_stats_lifetime','leaderboard_period_stats','player_gun_stats',
    'player_ratings','season_challenge_standings'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- accounts: authenticated only (RLS scopes to own row / admin). Never anon.
grant select, insert, update, delete on public.accounts to authenticated;

-- Internal admin-only tables (RLS restricts to admins). Never anon.
grant select, insert, update, delete on public.operators to authenticated;
grant select, insert, update, delete on public.excluded_players to authenticated;

-- Hall of Fame views run security_invoker, so the caller needs SELECT on the
-- view itself (underlying tables are already granted above).
grant select on public.v_hof_accolade_leaders to anon, authenticated;
grant select on public.v_hof_all_time_records  to anon, authenticated;
grant select on public.v_hof_season_champions  to anon, authenticated;
