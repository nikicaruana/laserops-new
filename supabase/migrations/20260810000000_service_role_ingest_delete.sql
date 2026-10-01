-- =============================================================================
-- Let the service role delete match_ingest_rounds, so service-role batch/cleanup
-- tooling can manage ingested rounds (e.g. clearing a mis-ingested match's rows).
-- Reads/writes were already granted elsewhere; this adds delete.
-- =============================================================================
grant delete on public.match_ingest_rounds to service_role;
