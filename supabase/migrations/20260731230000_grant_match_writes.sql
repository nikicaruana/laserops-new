-- =============================================================================
-- Grant writes on match tables to authenticated (RLS still gates them).
-- matches + match_player_aggregate were originally SELECT-only (written by
-- service role / definer fns). The admin Match Manager now writes them directly
-- via the admin session, so the authenticated role needs INSERT/UPDATE/DELETE
-- at the table level. The admin_all RLS policy (using is_admin()) remains the
-- filter — a non-admin still can't write any row.
-- =============================================================================

grant insert, update, delete on public.matches                to authenticated;
grant insert, update, delete on public.match_player_aggregate  to authenticated;
