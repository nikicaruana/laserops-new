-- =============================================================================
-- Admin-write RLS for the match tables.
-- When RLS was first enabled, matches + match_player_aggregate got a public_read
-- policy only (they were written solely by service role / definer functions, so
-- no write policy was needed). The admin Match Manager now writes them directly
-- through the admin session, so without an INSERT/UPDATE/DELETE policy every
-- write fails with "new row violates row-level security policy". Add the same
-- admin_all policy the config tables use. (match_signups already has its own.)
-- =============================================================================

drop policy if exists matches_admin_all on public.matches;
create policy matches_admin_all on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists match_player_aggregate_admin_all on public.match_player_aggregate;
create policy match_player_aggregate_admin_all on public.match_player_aggregate
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
