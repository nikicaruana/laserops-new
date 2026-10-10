-- =============================================================================
-- Backfill another known past rename into the kill matrix: "Maltese Predator"
-- renamed to "Tenmil Sokhet". Same fix as 20260864000000 (Kyle -> Kkkyle):
-- merge the split opponent identity so rivalry tallies reconcile. Exact
-- whole-nickname match, so no other player is affected. Future renames are
-- handled automatically by the propagate_ops_tag_change trigger.
-- =============================================================================
select public.rename_in_kill_matrix('Maltese Predator', 'Tenmil Sokhet');
