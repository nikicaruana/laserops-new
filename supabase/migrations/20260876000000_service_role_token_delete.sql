-- Let the backend (service_role) delete token ledger rows, for support/test
-- resets (e.g. reversing a mis-granted or mis-spent token). service_role is
-- backend-only and already has insert/update here.
grant delete on public.token_transactions to service_role;
grant delete on public.token_lots         to service_role;
