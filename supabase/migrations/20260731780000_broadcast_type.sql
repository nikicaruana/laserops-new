-- =============================================================================
-- Admin broadcast notification type. Powers the "Send a notification" composer:
-- one-off announcements to everyone / a player / a squad. Per-send email control
-- is handled by the broadcast route (it pre-stamps email_sent_at when email is
-- off), so this type keeps sends_email = true and a null subject (each broadcast
-- emails with its own title as the subject).
-- =============================================================================
insert into public.notification_types (key, label, description, priority, is_active, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order)
values (
  'admin_broadcast',
  'Admin announcement',
  'One-off announcements sent from the admin broadcast composer.',
  3, true, true, null,
  '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#0a0a0a;color:#ffffff;"><div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #262626;padding:28px;"><p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffde00;font-weight:700;">LaserOps</p><h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;">{{title}}</h1><p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#bbbbbb;">{{body}}</p><p style="margin:0;"><a href="{{link}}" style="display:inline-block;background:#ffde00;color:#111111;font-weight:700;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">View</a></p></div></body></html>',
  false, 0, 99
)
on conflict (key) do nothing;
