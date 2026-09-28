-- =============================================================================
-- One sender identity for all emails: drop the reminder-specific trio. Every
-- notification email uses fromEmail / senderName / replyToEmail (set them to
-- e.g. noreply@laseropsmalta.com in Email settings). 20260731790000 seeded the
-- reminder keys; this removes them everywhere (idempotent).
-- =============================================================================
delete from public.email_config where key in ('reminderFromEmail', 'reminderReplyToEmail', 'reminderSenderName');
