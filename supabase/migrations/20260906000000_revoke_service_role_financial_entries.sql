-- =============================================================================
-- Revoke the service_role access granted in 20260905000000. That grant was a
-- temporary enabler for a one-off backlog finance import; the ledger is locked
-- back down to admin-only now the import is done.
-- =============================================================================
revoke select, insert, update, delete on public.financial_entries from service_role;
