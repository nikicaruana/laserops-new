-- =============================================================================
-- One-time pre-launch cleanup: remove pay-after-game TEST data from prod.
--   * Test matches: LO-TEST-PAY / -PAY2 / -PAY3 / -PAY4, and "Singup to Pay Test".
--   * All test tokens granted to Kini + Niki, their token ledger (grants + spends),
--     pack requests, spend attempts, and any financial records tied to them.
-- Runs as the migration (superuser), so it bypasses the service-role RLS/grant
-- gaps on the token + financial tables. Idempotent: no-op where rows are gone.
-- =============================================================================
do $$
declare
  test_matches uuid[];
  acct_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into test_matches from public.matches
    where match_code in ('LO-TEST-PAY', 'LO-TEST-PAY2', 'LO-TEST-PAY3', 'LO-TEST-PAY4')
       or title ilike 'Singup to Pay Test';

  select coalesce(array_agg(id), '{}') into acct_ids from public.accounts
    where lower(email) in ('nikicaruana@gmail.com', 'niki@laseropsmalta.com');

  -- Token ledger + lots + requests + spend attempts for the two test accounts.
  delete from public.token_transactions   where account_id = any(acct_ids);
  delete from public.token_lots            where account_id = any(acct_ids);
  delete from public.token_pack_requests   where account_id = any(acct_ids);
  delete from public.token_spend_attempts  where account_id = any(acct_ids);

  -- Financial records for the two test accounts, and for the test matches.
  delete from public.financial_entries where account_id = any(acct_ids);
  delete from public.financial_entries where match_id = any(test_matches);

  -- Any token ledger rows tied to the test matches (belt and braces).
  delete from public.token_transactions where match_id = any(test_matches);

  -- Test match children, then the matches themselves.
  delete from public.match_drink_orders    where match_id = any(test_matches);
  delete from public.match_participants     where match_id = any(test_matches);
  delete from public.match_signups          where match_id = any(test_matches);
  delete from public.match_player_aggregate where match_id = any(test_matches);
  delete from public.match_ingest_rounds    where match_id = any(test_matches);
  delete from public.notifications n
    where exists (select 1 from unnest(test_matches) tm where n.href like '%' || tm::text || '%')
       or n.href like '%LO-TEST-PAY%';
  delete from public.matches where id = any(test_matches);

  -- Admin alert(s) for the test pack request(s).
  delete from public.admin_notifications where type_key = 'token_pack_request';
end $$;
