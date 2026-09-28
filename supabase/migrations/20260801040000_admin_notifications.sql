-- =============================================================================
-- Admin notifications: an operational alert feed for the admin panel.
--   admin_notification_types : small catalogue (priority / active / label), so
--                              admins can later re-prioritise or mute a kind.
--   admin_notifications       : ONE row per event, shared across all admins (not
--                              duplicated per admin, and kept out of the player
--                              `notifications` bell). Optional dedupe_key coalesces
--                              repeat alerts for the same state (one "needs
--                              confirmation" per game).
--   admin_notification_reads  : per-admin seen state (so each admin dismisses
--                              independently).
-- Emitted only from definer triggers / RPCs via emit_admin_notification, so there
-- is no client-trusted insert path. Read through admin_notification_feed (returns
-- a per-admin `seen` flag); realtime on the table keeps the bell live.
-- =============================================================================

create table public.admin_notification_types (
  key         text primary key,
  label       text not null,
  description text,
  priority    integer not null default 3,
  is_active   boolean not null default true,
  sort_order  integer,
  created_at  timestamptz not null default now()
);

insert into public.admin_notification_types (key, label, description, priority, sort_order) values
  ('game_needs_confirmation', 'Game needs confirmation', 'A game reached its minimum and is awaiting your confirmation.', 2, 1),
  ('game_cancelled',          'Game cancelled',          'A game was cancelled (by its organiser or the system).',        2, 2),
  ('refund_pending',          'Refund needs processing', 'A paid signup is flagged for a refund.',                        2, 3),
  ('game_dropped_below_min',  'Game dropped below minimum','A withdrawal took a game back under its minimum players.',     3, 4),
  ('ladder_join_request',     'Squad wants to join a ladder','A squad requested to join a ladder.',                        3, 5),
  ('game_fully_booked',       'Game fully booked',       'A game reached its maximum players.',                           3, 6),
  ('slot_contention',         'Overlapping games',       'A new game overlaps the time window of another open game.',     3, 7),
  ('match_awaiting_ingestion','Game awaiting processing','A completed game has no stats / XP committed yet.',             3, 8)
on conflict (key) do nothing;

alter table public.admin_notification_types enable row level security;
drop policy if exists admin_notif_types_admin_all on public.admin_notification_types;
create policy admin_notif_types_admin_all on public.admin_notification_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.admin_notification_types to authenticated;

create table public.admin_notifications (
  id          uuid primary key default gen_random_uuid(),
  type_key    text not null references public.admin_notification_types(key),
  priority    integer not null default 3,
  title       text not null,
  body        text,
  href        text,
  entity_type text,
  entity_id   uuid,
  dedupe_key  text,
  data        jsonb,
  created_at  timestamptz not null default now()
);
create unique index admin_notifications_dedupe on public.admin_notifications (dedupe_key) where dedupe_key is not null;
create index admin_notifications_feed_idx on public.admin_notifications (priority, created_at desc);

alter table public.admin_notifications enable row level security;
drop policy if exists admin_notifications_admin_select on public.admin_notifications;
create policy admin_notifications_admin_select on public.admin_notifications
  for select to authenticated using (public.is_admin());
-- No client INSERT/UPDATE/DELETE: rows come only from emit_admin_notification.
grant select on public.admin_notifications to authenticated;
grant select, insert, update, delete on public.admin_notifications to service_role;

create table public.admin_notification_reads (
  notification_id uuid not null references public.admin_notifications(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  seen_at         timestamptz not null default now(),
  primary key (notification_id, account_id)
);
alter table public.admin_notification_reads enable row level security;
drop policy if exists admin_notif_reads_own on public.admin_notification_reads;
create policy admin_notif_reads_own on public.admin_notification_reads
  for all to authenticated using (account_id = public.current_account_id()) with check (account_id = public.current_account_id());
grant select, insert, delete on public.admin_notification_reads to authenticated;

-- Realtime so the admin bell reacts instantly to new alerts.
alter table public.admin_notifications replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_notifications') then
    alter publication supabase_realtime add table public.admin_notifications;
  end if;
end $$;

-- --- emit / clear (server-only) ---------------------------------------------
-- The single insert path. Definer + granted only to service_role, so only server
-- jobs and other definer functions (the lifecycle hooks) can raise admin alerts.
-- dedupe_key + on-conflict-do-nothing coalesces repeat alerts for the same state.
create or replace function public.emit_admin_notification(
  p_type_key text, p_title text, p_body text default null, p_href text default null,
  p_entity_type text default null, p_entity_id uuid default null,
  p_dedupe_key text default null, p_data jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.admin_notification_types; nid uuid;
begin
  select * into t from public.admin_notification_types where key = p_type_key;
  if not found or not t.is_active then return null; end if;
  insert into public.admin_notifications (type_key, priority, title, body, href, entity_type, entity_id, dedupe_key, data)
    values (p_type_key, t.priority, p_title, p_body, p_href, p_entity_type, p_entity_id, p_dedupe_key, p_data)
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id into nid;
  return nid;
end;
$$;
revoke execute on function public.emit_admin_notification(text, text, text, text, text, uuid, text, jsonb) from public, anon;
grant execute on function public.emit_admin_notification(text, text, text, text, text, uuid, text, jsonb) to service_role;

-- Clear alerts by dedupe key (used when a state resolves, e.g. a game that dropped
-- below minimum climbs back, or a completed game finally gets ingested).
create or replace function public.clear_admin_notification(p_dedupe_key text)
returns void language sql security definer set search_path = public as $$
  delete from public.admin_notifications where dedupe_key = p_dedupe_key;
$$;
revoke execute on function public.clear_admin_notification(text) from public, anon;
grant execute on function public.clear_admin_notification(text) to service_role;

-- --- admin read model -------------------------------------------------------
-- The feed: every alert with a per-admin `seen` flag (unseen first, then priority,
-- then newest). Drives the bell + the dashboard panel.
create or replace function public.admin_notification_feed()
returns table (id uuid, priority integer, title text, body text, href text, seen boolean, created_at timestamptz)
language sql security definer set search_path = public as $$
  select n.id, n.priority, n.title, n.body, n.href,
         (r.notification_id is not null) as seen, n.created_at
  from public.admin_notifications n
  left join public.admin_notification_reads r
    on r.notification_id = n.id and r.account_id = public.current_account_id()
  where public.is_admin()
  order by (r.notification_id is not null), n.priority, n.created_at desc
  limit 100;
$$;
grant execute on function public.admin_notification_feed() to authenticated;

-- Dismiss one (mark seen for the current admin).
create or replace function public.dismiss_admin_notification(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.admin_notification_reads (notification_id, account_id) values (p_id, acct)
    on conflict do nothing;
end;
$$;
grant execute on function public.dismiss_admin_notification(uuid) to authenticated;

-- Mark all currently-unseen alerts seen; returns the ids for an Undo.
create or replace function public.mark_all_admin_notifications_seen()
returns setof uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
    with ins as (
      insert into public.admin_notification_reads (notification_id, account_id)
      select n.id, acct from public.admin_notifications n
      where not exists (select 1 from public.admin_notification_reads r where r.notification_id = n.id and r.account_id = acct)
      on conflict do nothing
      returning notification_id
    )
    select ins.notification_id from ins;
end;
$$;
grant execute on function public.mark_all_admin_notifications_seen() to authenticated;

-- Undo a mark-all (restore the given ids to unseen for the current admin).
create or replace function public.undo_admin_notifications_seen(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  delete from public.admin_notification_reads where account_id = acct and notification_id = any(p_ids);
end;
$$;
grant execute on function public.undo_admin_notifications_seen(uuid[]) to authenticated;
