-- =============================================================================
-- Per-match online vs offline round counts, stamped at publish. Drives:
--   - the match report format (a HYBRID match - some online rounds - must use the
--     ONLINE report layout, not the offline-only one; offline = online_count = 0)
--   - the "Rounds 1-N online, N+1-M offline" label on hybrid reports.
-- Public-readable (they live on matches, already readable by the report).
-- =============================================================================
alter table public.matches
  add column if not exists online_round_count  integer,
  add column if not exists offline_round_count integer;
