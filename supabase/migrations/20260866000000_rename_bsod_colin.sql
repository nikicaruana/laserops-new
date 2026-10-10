-- =============================================================================
-- Backfill another known past rename into the kill matrix: "BSoD" -> "Colin".
-- Same fix as 20260864000000 / 20260865000000: merge the split opponent identity
-- so rivalry tallies reconcile. Exact whole-nickname match. Future renames are
-- handled automatically by the propagate_ops_tag_change trigger.
-- =============================================================================
select public.rename_in_kill_matrix('BSoD', 'Colin');
