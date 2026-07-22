-- =============================================================================
-- Enable RLS on accounts (PII protection)
-- =============================================================================
-- accounts holds player PII on a cloud database, so it must not be readable via
-- the public PostgREST API. Enabling RLS with NO policies denies all access to
-- the anon and authenticated roles — the table becomes reachable only through
-- the service role / direct SQL (which the dashboard CSV import and Table Editor
-- use, so seeding still works).
--
-- NOT forced: the table owner and service role intentionally bypass RLS so we
-- can load and manage the data. The real access policies — a player reading
-- their own row (auth_user_id = auth.uid()) and admins reading all — are added
-- with the auth layer at build-order step 10.
-- =============================================================================

alter table public.accounts enable row level security;
