-- =============================================================================
-- First-party, consent-free landing page counter (Welbee's QR offer first).
-- One row per page view / CTA click. No cookies or device storage: unique
-- visitors are a daily-rotating salted hash of IP + user agent computed in the
-- /api/track route, so the raw IP is never stored and hashes can't be linked
-- across days. Written only by the service role; admins read.
-- =============================================================================
create table if not exists public.page_events (
  id            bigint generated always as identity primary key,
  path          text not null,
  kind          text not null check (kind in ('view', 'cta_signup', 'cta_games')),
  day           date not null default (now() at time zone 'Europe/Malta')::date,
  visitor_hash  text,
  source        text,
  referrer_host text,
  created_at    timestamptz not null default now()
);

create index if not exists page_events_path_day_idx on public.page_events (path, day);

alter table public.page_events enable row level security;

drop policy if exists page_events_admin_read on public.page_events;
create policy page_events_admin_read on public.page_events
  for select to authenticated using (public.is_admin());

grant select on public.page_events to authenticated;
grant select, insert on public.page_events to service_role;

-- Aggregates for the admin "Landing page stats" view (invoker rights, so RLS
-- limits them to admins). Keeps the page clear of the 1000-row select cap.
create or replace function public.page_event_daily(p_path text)
returns table (day date, views bigint, visitors bigint, cta_signup bigint, cta_games bigint)
language sql stable security invoker set search_path = public as $$
  select e.day,
         count(*) filter (where e.kind = 'view'),
         count(distinct e.visitor_hash) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'cta_signup'),
         count(*) filter (where e.kind = 'cta_games')
  from public.page_events e
  where e.path = p_path
  group by e.day
  order by e.day desc;
$$;

create or replace function public.page_event_sources(p_path text)
returns table (source text, views bigint, visitors bigint)
language sql stable security invoker set search_path = public as $$
  select coalesce(e.source, e.referrer_host, '(direct / QR)'),
         count(*),
         count(distinct (e.day, e.visitor_hash))
  from public.page_events e
  where e.path = p_path and e.kind = 'view'
  group by 1
  order by 2 desc;
$$;

grant execute on function public.page_event_daily(text) to authenticated;
grant execute on function public.page_event_sources(text) to authenticated;
