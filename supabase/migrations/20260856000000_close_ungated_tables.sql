-- =============================================================================
-- SECURITY: enable RLS on the remaining tables that had write grants to
-- `authenticated` but never had RLS enabled (same class of bug as matches in
-- 20260855). Without RLS, any logged-in user could directly modify/delete rows:
--   * match_player_aggregate - TAMPER WITH MATCH STATS (kills/score/etc.)
--   * token_bundles / token_config - CHANGE STORE PRICES / token rules
--   * excluded_players / operators - change config
-- Enable RLS and (re)assert the intended policies: public/authenticated reads
-- unchanged, admin-only writes, everything else goes through service_role /
-- SECURITY DEFINER RPCs (which bypass RLS).
-- =============================================================================

-- ---- match_player_aggregate: public read (leaderboards/reports), admin write.
alter table public.match_player_aggregate enable row level security;
drop policy if exists match_player_aggregate_public_read on public.match_player_aggregate;
create policy match_player_aggregate_public_read on public.match_player_aggregate
  for select to anon, authenticated using (true);
drop policy if exists match_player_aggregate_admin_all on public.match_player_aggregate;
create policy match_player_aggregate_admin_all on public.match_player_aggregate
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- operators: authenticated read (no secrets; anon never had access), admin write.
alter table public.operators enable row level security;
drop policy if exists operators_read on public.operators;
create policy operators_read on public.operators
  for select to authenticated using (true);
drop policy if exists operators_admin_all on public.operators;
create policy operators_admin_all on public.operators
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- excluded_players: existing active read, add admin write.
alter table public.excluded_players enable row level security;
drop policy if exists excluded_players_active_read on public.excluded_players;
create policy excluded_players_active_read on public.excluded_players
  for select to anon, authenticated using (status = 'active');
drop policy if exists excluded_players_admin_all on public.excluded_players;
create policy excluded_players_admin_all on public.excluded_players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- token_bundles: policies already correct, just enable RLS.
alter table public.token_bundles enable row level security;
drop policy if exists token_bundles_read on public.token_bundles;
create policy token_bundles_read on public.token_bundles
  for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists token_bundles_admin on public.token_bundles;
create policy token_bundles_admin on public.token_bundles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---- token_config: policies already correct, just enable RLS.
alter table public.token_config enable row level security;
drop policy if exists token_config_read on public.token_config;
create policy token_config_read on public.token_config
  for select to anon, authenticated using (true);
drop policy if exists token_config_admin on public.token_config;
create policy token_config_admin on public.token_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
