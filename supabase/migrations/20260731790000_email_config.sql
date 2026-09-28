-- =============================================================================
-- Email config: the site-wide values that fill email templates (logo, socials,
-- links, sender identity) plus URL templates for per-player/per-match links.
-- Mirrors the old Google Sheets "Email_Config". Admin-editable; the dispatch
-- cron reads it with the service role. Keys double as template tokens (e.g.
-- {{logoUrl}}); *Template values are themselves rendered with {{matchId}} /
-- {{nickname}} to produce {{matchReportUrl}} / {{playerProfileUrl}}.
-- =============================================================================
create table public.email_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
create trigger trg_email_config_updated_at before update on public.email_config
  for each row execute function public.set_updated_at();

alter table public.email_config enable row level security;
drop policy if exists email_config_admin_all on public.email_config;
create policy email_config_admin_all on public.email_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.email_config to authenticated;
grant select on public.email_config to service_role;

insert into public.email_config (key, value) values
  ('logoUrl',                  'https://res.cloudinary.com/dqud5b7pa/image/upload/v1781471617/LaserOps_Logo_PNG_600px_yellow_kxsfpc.png'),
  ('instagramIconUrl',         'https://res.cloudinary.com/dqud5b7pa/image/upload/v1781119881/Instagram_Logo-64px_vqdfki.png'),
  ('facebookIconUrl',          'https://res.cloudinary.com/dqud5b7pa/image/upload/v1781119881/Facebook_Logo-64px_kjnf1v.png'),
  ('googleReviewUrl',          'https://g.page/r/Cfj-n-dS8DDaEBM/review'),
  ('gameCalendarUrl',          'https://www.laseropsmalta.com/events/open-games'),
  ('whatsappCommunityUrl',     'https://chat.whatsapp.com/Duox9CiCmasKsv8tcuQScZ'),
  ('bookingUrl',               'https://www.laseropsmalta.com/booking'),
  ('instagramUrl',             'https://www.instagram.com/laserops.mt/'),
  ('facebookUrl',              'https://www.facebook.com/laserops.mt'),
  ('replyToEmail',             'scores@laseropsmalta.com'),
  ('senderName',               'LaserOps Scores'),
  ('fromEmail',                'scores@laseropsmalta.com'),
  ('matchReportUrlTemplate',   'https://www.laseropsmalta.com/match-report?match={{matchId}}'),
  ('playerProfileUrlTemplate', 'https://www.laseropsmalta.com/player-portal/player-stats/summary?ops={{nickname}}'),
  ('reminderFromEmail',        'info@laseropsmalta.com'),
  ('reminderReplyToEmail',     'info@laseropsmalta.com'),
  ('reminderSenderName',       'LaserOps')
on conflict (key) do nothing;
