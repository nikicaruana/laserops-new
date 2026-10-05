-- =============================================================================
-- Admin-editable BELL copy (title + body) + 2FA gate on all notification-type
-- edits.
--
-- 1) bell_title / bell_body columns + a SQL {{token}} renderer, so the in-app
--    bell text is admin-controlled like the email template already is. The
--    emit_notification RPC renders these (falling back to the code-provided
--    title/body when a field is blank). Tokens: {{title}}/{{body}} = the code
--    default, {{nickname}}/{{opsTag}} = recipient, plus any per-notification
--    data keys ({{matchLabel}}, {{matchDate}}, {{matchTime}}, ...). Rendering is
--    SQL-side so it also covers trigger-emitted notifications. Seeded so the
--    output is byte-identical to the old hardcoded copy.
--
-- 2) notification_types writes now require a 2FA-elevated (aal2) session, like
--    the scoring/exploit config, so bell AND email copy can only be changed with
--    a TOTP code. Reads stay admin-only (any assurance level).
-- =============================================================================

alter table public.notification_types
  add column if not exists bell_title text,
  add column if not exists bell_body  text;

-- SQL-side token renderer (mirrors lib/email-tokens for the bell).
create or replace function public.render_notif_text(tmpl text, p_data jsonb, p_opstag text, p_title text, p_body text)
returns text language plpgsql immutable as $$
declare result text := tmpl; k text; v text;
begin
  if result is null then return null; end if;
  result := replace(result, '{{nickname}}', coalesce(nullif(p_opstag, ''), 'there'));
  result := replace(result, '{{opsTag}}',   coalesce(p_opstag, ''));
  result := replace(result, '{{title}}',    coalesce(p_title, ''));
  result := replace(result, '{{body}}',     coalesce(p_body, ''));
  if p_data is not null then
    for k, v in select key, value from jsonb_each_text(p_data) loop
      result := replace(result, '{{' || k || '}}', coalesce(v, ''));
    end loop;
  end if;
  -- Drop any unresolved tokens (match the email engine: unknown token => "").
  result := regexp_replace(result, '\{\{[^}]+\}\}', '', 'g');
  return result;
end;
$$;

-- emit_notification now renders the bell templates (same signature => grants kept).
create or replace function public.emit_notification(
  p_account_id uuid, p_type_key text, p_title text,
  p_body text default null, p_href text default null, p_data jsonb default null, p_deliver_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.notification_types; nid uuid; v_tag text; v_title text; v_body text;
begin
  select * into t from public.notification_types where key = p_type_key;
  if not found or not t.is_active then return null; end if;
  select ops_tag into v_tag from public.accounts where id = p_account_id;
  v_title := case when nullif(btrim(coalesce(t.bell_title, '')), '') is not null
                  then public.render_notif_text(t.bell_title, p_data, v_tag, p_title, p_body)
                  else p_title end;
  v_body  := case when nullif(btrim(coalesce(t.bell_body, '')), '') is not null
                  then public.render_notif_text(t.bell_body, p_data, v_tag, p_title, p_body)
                  else p_body end;
  insert into public.notifications (account_id, type_key, priority, title, body, href, data, deliver_at)
    values (p_account_id, p_type_key, t.priority, v_title, v_body, p_href, p_data,
            coalesce(p_deliver_at, now() + make_interval(hours => coalesce(t.delay_hours, 0))))
    returning id into nid;
  return nid;
end;
$$;

-- Seed bell copy. Default = echo the code-provided title/body (behaviour
-- unchanged); readable overrides where the default is static / token-friendly so
-- admins SEE the real wording. These overrides reproduce the old copy exactly.
update public.notification_types
  set bell_title = coalesce(bell_title, '{{title}}'),
      bell_body  = coalesce(bell_body,  '{{body}}');

update public.notification_types set bell_title = 'Payment confirmed',
  bell_body = 'Your payment for {{matchLabel}} is confirmed. See you on the field.' where key = 'payment_confirmed';
update public.notification_types set bell_title = 'Your match report is live',
  bell_body = 'The report for {{matchLabel}} is up. See your kills, captures, accolades and where you ranked.' where key = 'match_report_live';
update public.notification_types set bell_body = 'Your game is on {{matchDate}} at {{matchTime}}.' where key = 'match_reminder';
update public.notification_types set bell_body = 'Your game is live now. Sign in to join.' where key = 'game_live';
update public.notification_types set bell_title = 'Match photos are up' where key = 'match_photos_added';
update public.notification_types set bell_title = 'Game tokens added' where key = 'tokens_granted';
update public.notification_types set bell_title = 'You have been refunded' where key = 'refunded';
update public.notification_types set bell_title = 'Great first game!',
  bell_body = 'You just played your first LaserOps game. Here is how to make the most of it.' where key = 'first_game_followup';

-- 2FA gate: split read (any-aal admin) from write (aal2 admin).
drop policy if exists notification_types_admin_all   on public.notification_types;
drop policy if exists notification_types_admin_read  on public.notification_types;
drop policy if exists notification_types_admin_write on public.notification_types;
create policy notification_types_admin_read on public.notification_types
  for select to authenticated using (public.is_admin());
create policy notification_types_admin_write on public.notification_types
  for all to authenticated
  using (public.is_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  with check (public.is_admin() and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
