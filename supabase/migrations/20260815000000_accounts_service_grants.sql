-- =============================================================================
-- service_role needs explicit grants in this project. Allow it to read + create
-- + update accounts so the launch player-migration tooling (create missing
-- migrated_unclaimed accounts for players in the registration export, align an
-- unclaimed account's ops_tag to the current in-game handle) can run as a
-- script. No DELETE grant. The protect_account_fields() guard only blocks the
-- 'authenticated' end-user role, so service_role writes pass through it.
-- =============================================================================
grant select, insert, update on public.accounts to service_role;
