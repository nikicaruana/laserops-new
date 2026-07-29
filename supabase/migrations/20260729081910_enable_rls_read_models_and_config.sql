-- =============================================================================
-- RLS chunk 3: enable RLS + public-read policies across read-models & config
-- =============================================================================
-- Turns on Row-Level Security everywhere in the public schema and adds the
-- policies that let the 2.0 site read game data through the anon key, while
-- writes stay admin-only and `accounts` (PII) stays locked (chunk 1). Follows
-- the Supabase model: table-level grants exist by default; RLS is the real gate.
--
--   A. config (game rules)          -> anon/authenticated SELECT, admins write
--   B. match data + read-models     -> anon/authenticated SELECT only
--                                      (written by service role / definer fns)
--   C. operators, excluded_players  -> admin-only (no public access)
--   D. Hall of Fame views           -> security_invoker, inherit the table RLS
--
-- Idempotent: RLS enable is a no-op if already on; policies dropped-then-created.
-- =============================================================================

-- A. Config: public read + admin write --------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'teams','guns','gun_damage_history','elo_config','elo_tiers','xp_config',
    'rank_levels','rating_config','rating_brackets','score_formula_config',
    'scoring_eras','seasons','spawn_camp_config','accolade_definitions',
    'accolade_rules','streak_definitions','streak_rules','challenges'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_write', t);
  end loop;
end $$;

-- B. Match data + read-models: public read only -----------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'matches','match_player_aggregate','match_awards',
    'player_stats_lifetime','leaderboard_period_stats','player_gun_stats',
    'player_ratings','season_challenge_standings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
  end loop;
end $$;

-- C. Internal tables: admin-only (accounts already locked in chunk 1) --------
do $$
declare t text;
begin
  foreach t in array array['operators','excluded_players'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_all', t);
  end loop;
end $$;

-- D. Views run as the querying user so they inherit the RLS above (all
--    underlying tables are public-readable). PG15+ security_invoker.
alter view public.v_hof_accolade_leaders set (security_invoker = true);
alter view public.v_hof_all_time_records  set (security_invoker = true);
alter view public.v_hof_season_champions  set (security_invoker = true);
