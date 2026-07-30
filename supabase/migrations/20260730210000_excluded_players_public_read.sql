-- =============================================================================
-- excluded_players — expose the active prize-ineligible nickname list publicly
-- =============================================================================
-- The armory ("all guns unlocked" for excluded/admin players so they can test
-- weapons) and the homepage season leaders need to read which nicknames are
-- prize-ineligible. Only nickname + status are exposed to anon; the `reason`
-- column stays private (no anon grant on it). RLS restricts reads to active
-- rows, so disabled exclusions are never leaked.
-- =============================================================================

grant select (nickname, status) on public.excluded_players to anon;

drop policy if exists excluded_players_active_read on public.excluded_players;
create policy excluded_players_active_read on public.excluded_players
  for select to anon, authenticated using (status = 'active');
