-- =============================================================================
-- Admin broadcast: per-send sender override + email-only mailing-list campaigns.
--
-- 1) Per-send "Send from" on notifications. The dispatch cron already resolves a
--    sender per type; these two nullable columns let a single broadcast override
--    the From address / display name without touching the type. Null = fall back
--    to the type's sender, then the global email_config default.
--
-- 2) Email-only campaigns. A one-off announcement emailed to the opted-in mailing
--    list with NO bell notification (e.g. "the new site is live"). Content lives
--    once on email_campaigns; one row per recipient on email_campaign_recipients.
--    A dedicated cron (email-campaigns) drains pending recipients in batches so a
--    few-hundred-recipient blast can't time out, and any failure retries next run.
--    Audience is always marketing_opt_in = true with a non-null email (locked by
--    the API, recorded here as the `audience` label for the record).
-- =============================================================================

alter table public.notifications
  add column if not exists email_from        text,
  add column if not exists email_sender_name text;

create table if not exists public.email_campaigns (
  id                uuid primary key default gen_random_uuid(),
  created_by        uuid references public.accounts(id) on delete set null,
  subject           text not null,
  title             text not null,
  body              text,
  href              text,
  email_from        text,
  email_sender_name text,
  audience          text not null default 'marketing_opt_in',
  total             integer not null default 0,
  sent              integer not null default 0,
  failed            integer not null default 0,
  status            text not null default 'sending',  -- sending | done
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_email_campaigns_updated_at before update on public.email_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.email_campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  account_id  uuid references public.accounts(id) on delete set null,
  email       text not null,
  ops_tag     text,
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now()
);
-- Fast "what's still pending for this campaign" scan for the cron.
create index if not exists email_campaign_recipients_pending_idx
  on public.email_campaign_recipients (campaign_id) where sent_at is null;

alter table public.email_campaigns            enable row level security;
alter table public.email_campaign_recipients  enable row level security;

-- Admins read (compose + track progress); all writes go through the service role.
drop policy if exists email_campaigns_admin_read on public.email_campaigns;
create policy email_campaigns_admin_read on public.email_campaigns
  for select to authenticated using (public.is_admin());
drop policy if exists email_campaign_recipients_admin_read on public.email_campaign_recipients;
create policy email_campaign_recipients_admin_read on public.email_campaign_recipients
  for select to authenticated using (public.is_admin());

grant select on public.email_campaigns           to authenticated;
grant select on public.email_campaign_recipients to authenticated;
-- service_role needs EXPLICIT grants here (crons/webhooks get "permission denied" otherwise).
grant select, insert, update, delete on public.email_campaigns           to service_role;
grant select, insert, update, delete on public.email_campaign_recipients to service_role;
