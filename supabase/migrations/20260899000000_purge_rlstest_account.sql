-- =============================================================================
-- Purge the load-test account rlstest_1791610417260@example.com
-- (id bec4ef91-ca1e-4de0-b183-f272b295aec1). Its example.com address makes
-- Resend reject any email batch it is part of (one bad address fails the whole
-- resend.batch.send slice of 100), which stalled the launch mailing-list send.
-- The service role has no delete grant on accounts/notifications, so this runs
-- as postgres via the migration. Its campaign-recipient rows were already
-- removed; no game/stats rows reference it.
-- =============================================================================
delete from public.notifications where account_id = 'bec4ef91-ca1e-4de0-b183-f272b295aec1';
delete from public.accounts     where id          = 'bec4ef91-ca1e-4de0-b183-f272b295aec1';
