-- =============================================================================
-- Grant service_role read access to the email template + config tables
-- =============================================================================
-- lib/email.ts and the notification dispatcher read notification_types.email_html
-- and email_config through the SERVICE client to render templated mail. These
-- CLI-created tables were only granted to `authenticated`, so those reads hit
-- "permission denied for table" and every email silently fell back to a bare
-- <p>body</p>. Granting SELECT to service_role makes the stored templates render.
-- (RLS still gates the authenticated/admin paths; service_role bypasses RLS.)
-- =============================================================================
grant select on public.notification_types to service_role;
grant select on public.email_config to service_role;
