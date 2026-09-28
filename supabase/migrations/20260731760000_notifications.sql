-- =============================================================================
-- Notification system (config-driven + persistent).
--   notification_types : admin-managed catalogue (priority, email on/off + HTML
--                        template, push flag, active, optional delay).
--   notifications      : per-user instances (unread until seen_at set). Priority
--                        is copied from the type at emit so the bell can order
--                        without a join. deliver_at supports delayed types.
--   emit_notification  : the single insert path (definer; only server jobs /
--                        other definer RPCs may call it, so players can't forge).
--   mark/undo RPCs     : dismiss one, mark all seen (returns ids for Undo), undo.
-- Priority: 1 = highest (shown first); ties broken by newest first.
-- =============================================================================

create table public.notification_types (
  key           text primary key,
  label         text not null,
  description   text,
  priority      integer not null default 3,
  is_active     boolean not null default true,
  sends_email   boolean not null default false,
  email_subject text,
  email_html    text,
  sends_push    boolean not null default false,
  delay_hours   integer not null default 0,
  sort_order    integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_notification_types_updated_at before update on public.notification_types
  for each row execute function public.set_updated_at();

alter table public.notification_types enable row level security;
drop policy if exists notification_types_admin_all on public.notification_types;
create policy notification_types_admin_all on public.notification_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.notification_types to authenticated;

-- Shared default email template ({{title}}/{{body}}/{{link}} substituted at send).
-- Admins can customise per type in the notifications panel.
do $$
declare tpl text := '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#0a0a0a;color:#ffffff;"><div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #262626;padding:28px;"><p style="margin:0 0 12px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#ffde00;font-weight:700;">LaserOps</p><h1 style="margin:0 0 10px;font-size:20px;color:#ffffff;">{{title}}</h1><p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#bbbbbb;">{{body}}</p><p style="margin:0;"><a href="{{link}}" style="display:inline-block;background:#ffde00;color:#111111;font-weight:700;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">View</a></p></div></body></html>';
begin
  insert into public.notification_types (key, label, description, priority, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order) values
    ('game_live',              'A game you are in is now live',              'Sign in to your live game.',                                        1, false, null, null, false, 0, 1),
    ('game_confirmed_pay',     'A game you are signed up to is confirmed',   'The game is confirmed and you can pay.',                            2, true,  'Your LaserOps game is confirmed', tpl, true, 0, 2),
    ('payment_confirmed',      'Your payment is confirmed',                  'Your payment for a match is confirmed.',                            2, true,  'Payment received',                tpl, true, 0, 3),
    ('refunded',               'You have been refunded',                     'A refund has been processed for you.',                              2, true,  'You have been refunded',          tpl, true, 0, 4),
    ('match_cancelled',        'A match you were signed up to was cancelled','A match you were signed up to has been cancelled.',                 3, false, null, null, false, 0, 5),
    ('match_cancelled_refund', 'A confirmed match was cancelled',            'A confirmed match you were signed up to was cancelled; you will be refunded.', 3, true, 'Your game was cancelled', tpl, true, 0, 6),
    ('match_report_live',      'A match report is live',                     'A match report from a game you played in is live.',                 3, false, null, null, true, 0, 7),
    ('game_invite',            'Someone invited you to a game',              'A player invited you to a game.',                                   4, false, null, null, true, 0, 8),
    ('squad_invite',           'Someone invited you to a squad',             'A squad invited you to join.',                                      4, false, null, null, false, 0, 9),
    ('weapon_unlocked',        'You unlocked a weapon',                      'You unlocked a new weapon. Shown ~24h after the match report goes live.', 4, false, null, null, true, 24, 10),
    ('personal_record',        'You broke a personal record',               'You broke a personal record. Shown ~24h after the match report goes live.', 4, false, null, null, true, 24, 11),
    ('followed_you',           'Someone followed you',                       'Another player followed you.',                                      5, false, null, null, false, 0, 12),
    ('squad_open_game',        'A squadmate organised an open game',         'Someone in your squad opened a new game.',                          5, false, null, null, false, 0, 13)
  on conflict (key) do nothing;
end $$;

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(id) on delete cascade,
  type_key      text not null references public.notification_types(key),
  priority      integer not null default 3,
  title         text not null,
  body          text,
  href          text,
  data          jsonb,
  deliver_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  seen_at       timestamptz,
  email_sent_at timestamptz,
  push_sent_at  timestamptz
);
create index notifications_inbox_idx on public.notifications (account_id, seen_at, priority, created_at desc);
create index notifications_dispatch_idx on public.notifications (deliver_at) where email_sent_at is null;

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
  using (account_id = public.current_account_id());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (account_id = public.current_account_id()) with check (account_id = public.current_account_id());
-- No client INSERT: rows come only from emit_notification / service jobs.
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.notifications to service_role;

-- The single insert path. Definer + not granted to players, so only other
-- definer RPCs and the service role (server jobs) can emit.
create or replace function public.emit_notification(
  p_account_id uuid, p_type_key text, p_title text,
  p_body text default null, p_href text default null, p_data jsonb default null, p_deliver_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.notification_types; nid uuid;
begin
  select * into t from public.notification_types where key = p_type_key;
  if not found or not t.is_active then return null; end if;
  insert into public.notifications (account_id, type_key, priority, title, body, href, data, deliver_at)
    values (p_account_id, p_type_key, t.priority, p_title, p_body, p_href, p_data,
            coalesce(p_deliver_at, now() + make_interval(hours => coalesce(t.delay_hours, 0))))
    returning id into nid;
  return nid;
end;
$$;
revoke execute on function public.emit_notification(uuid, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.emit_notification(uuid, text, text, text, text, jsonb, timestamptz) to service_role;

-- Dismiss one (on click).
create or replace function public.dismiss_notification(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set seen_at = now()
   where id = p_id and account_id = public.current_account_id() and seen_at is null;
$$;
grant execute on function public.dismiss_notification(uuid) to authenticated;

-- Mark all currently-shown notifications seen; returns the ids so the client can
-- offer an Undo.
create or replace function public.mark_all_notifications_seen()
returns setof uuid language sql security definer set search_path = public as $$
  update public.notifications set seen_at = now()
   where account_id = public.current_account_id() and seen_at is null and deliver_at <= now()
   returning id;
$$;
grant execute on function public.mark_all_notifications_seen() to authenticated;

-- Undo a mark-all (restore the given ids to unread).
create or replace function public.undo_notifications_seen(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.notifications set seen_at = null
   where account_id = public.current_account_id() and id = any(p_ids);
$$;
grant execute on function public.undo_notifications_seen(uuid[]) to authenticated;

-- Realtime so the bell reacts instantly.
alter table public.notifications replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
