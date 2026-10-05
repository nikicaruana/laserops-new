-- =============================================================================
-- Show the game title ({{matchLabel}}) in every game-specific email + make the
-- bell copy for game notifications readable.
--
-- 1) reschedule_match now passes matchLabel in the notification data (cancel
--    already did; report-live + payment already did via code).
-- 2) Add a yellow {{matchLabel}} line under the heading of the four game emails
--    that were missing it (confirmed, payment, reminder, rescheduled). The
--    report-live + cancelled-refund emails already show it.
-- 3) Bell copy: give the game types a readable title/body using {{matchLabel}}
--    (now that the data carries it), so the admin editor shows real wording
--    instead of {{title}}/{{body}} placeholders.
--
-- Pairs with code edits that add matchLabel to the data of the confirm /
-- match-reminders / go-live / match-photos-notify emits.
-- =============================================================================

-- 1) reschedule_match: add matchLabel to the notification data.
create or replace function public.reschedule_match(p_match_id uuid, p_new_scheduled_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_new_scheduled_at is null then raise exception 'Pick a new date and time.'; end if;
  select id, status, title, scheduled_at, duration_minutes into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status in ('live', 'completed', 'cancelled') then
    raise exception 'A % game cannot be rescheduled.', m.status;
  end if;

  update public.matches set scheduled_at = p_new_scheduled_at where id = p_match_id;

  insert into public.notifications (account_id, type_key, priority, title, body, href, data)
  select s.account_id, 'game_rescheduled', nt.priority,
         coalesce(m.title, 'Your game') || ' was moved',
         'This game has a new date and time. Open it to see the details.',
         '/player-portal/games/' || p_match_id::text,
         jsonb_build_object(
           'matchLabel', coalesce(m.title, 'Your game'),
           'oldMatchDate', public.fmt_match_date(m.scheduled_at),
           'oldMatchTimeRange', public.fmt_match_time_range(m.scheduled_at, m.duration_minutes),
           'matchDate', public.fmt_match_date(p_new_scheduled_at),
           'matchTimeRange', public.fmt_match_time_range(p_new_scheduled_at, m.duration_minutes)
         )
  from public.match_signups s
  join public.notification_types nt on nt.key = 'game_rescheduled' and nt.is_active
  where s.match_id = p_match_id and s.status = 'registered';
end;
$$;
grant execute on function public.reschedule_match(uuid, timestamptz) to authenticated;

-- 2) Add a {{matchLabel}} line under the heading of the four missing game emails.
--    Idempotent: only when the template doesn't already contain {{matchLabel}}.
update public.notification_types set email_html = replace(email_html,
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">You&rsquo;re in, {{nickname}}.</h1>',
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">You&rsquo;re in, {{nickname}}.</h1>
                <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">{{matchLabel}}</p>')
  where key = 'game_confirmed_pay' and position('{{matchLabel}}' in email_html) = 0;

update public.notification_types set email_html = replace(email_html,
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">You&rsquo;re all set, {{nickname}}.</h1>',
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">You&rsquo;re all set, {{nickname}}.</h1>
                <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">{{matchLabel}}</p>')
  where key = 'payment_confirmed' and position('{{matchLabel}}' in email_html) = 0;

update public.notification_types set email_html = replace(email_html,
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Gear up, {{nickname}}.</h1>',
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Gear up, {{nickname}}.</h1>
            <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">{{matchLabel}}</p>')
  where key = 'match_reminder' and position('{{matchLabel}}' in email_html) = 0;

update public.notification_types set email_html = replace(email_html,
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Your game has moved, {{nickname}}.</h1>',
  '<h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Your game has moved, {{nickname}}.</h1>
                <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">{{matchLabel}}</p>')
  where key = 'game_rescheduled' and position('{{matchLabel}}' in email_html) = 0;

-- 3) Readable bell copy for the game types (matchLabel now in their data).
update public.notification_types
  set bell_title = '{{matchLabel}} is confirmed',
      bell_body  = 'This game is confirmed. Pay now to secure your spot and book your gun.'
  where key = 'game_confirmed_pay';
update public.notification_types set bell_title = '{{matchLabel}} is live' where key = 'game_live';
update public.notification_types set bell_title = '{{matchLabel}}' where key = 'match_reminder';
update public.notification_types
  set bell_body = 'Photos from {{matchLabel}} have been uploaded. Take a look and tag yourself.'
  where key = 'match_photos_added';
