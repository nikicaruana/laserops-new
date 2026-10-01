-- =============================================================================
-- "Match photos are up" notification + email.
-- When an admin announces that a match's photos are uploaded, every player who
-- took part gets an in-app notification + email. photos_notified_at guards it so
-- players are notified once per match (the admin uploads the batch, then clicks
-- Notify). The email goes out via the normal notifications-dispatch cron using
-- this type's template (admin-editable at /admin/notifications/match_photos_added).
-- =============================================================================

alter table public.matches
  add column if not exists photos_notified_at timestamptz;

do $$
declare tpl text := '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#0a0a0a;color:#ffffff;"><div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #262626;padding:28px;"><p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffde00;font-weight:700;">LaserOps</p><h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;">{{title}}</h1><p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#bbbbbb;">{{body}}</p><p style="margin:0;"><a href="{{link}}" style="display:inline-block;background:#ffde00;color:#111111;font-weight:700;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">View photos</a></p></div></body></html>';
begin
  insert into public.notification_types
    (key, label, description, priority, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order)
  values
    ('match_photos_added', 'Match photos are up',
     'Photos from a game you played in have been uploaded.',
     4, true, 'Your match photos are up', tpl, true, 0, 14)
  on conflict (key) do nothing;
end $$;
