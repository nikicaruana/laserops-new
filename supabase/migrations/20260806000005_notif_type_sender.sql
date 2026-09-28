-- =============================================================================
-- Per-notification-type sender identity overrides
-- =============================================================================
-- Each email notification type can now set its own From / Sender name / Reply-to.
-- NULL means "fall back to the global email_config default" (fromEmail /
-- senderName / replyToEmail). Lets, e.g., match_reminder send from info@ while
-- payment/refund mail keeps scores@.
-- =============================================================================
alter table public.notification_types
  add column if not exists email_from       text,
  add column if not exists email_sender_name text,
  add column if not exists email_reply_to   text;
