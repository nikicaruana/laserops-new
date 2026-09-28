-- =============================================================================
-- Dedup stamp for the 24h-before match reminder: set once when the reminder for
-- a match is sent, so the cron fires it exactly once per match.
-- =============================================================================
alter table public.matches add column if not exists reminder_sent_at timestamptz;
