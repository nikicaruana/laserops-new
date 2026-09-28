-- =============================================================================
-- Pass match name + date/time tokens into the cancel + reschedule notifications
-- =============================================================================
-- Adds SQL date/time formatters (Malta time, matching lib/match-time.ts) and
-- recreates admin_cancel_match + reschedule_match so their emitted notifications
-- carry the data the email templates use: {{matchLabel}} (cancel), and the
-- old + new {{matchDate}}/{{matchTimeRange}} (reschedule). Time range = start ->
-- start + matches.duration_minutes (default 180 = 3h).
-- =============================================================================

create or replace function public.fmt_match_date(p_ts timestamptz)
returns text language sql immutable as $$
  select to_char(p_ts at time zone 'Europe/Malta', 'FMDay, DD FMMonth YYYY');
$$;

create or replace function public.fmt_match_time_range(p_ts timestamptz, p_dur integer)
returns text language sql immutable as $$
  select to_char(p_ts at time zone 'Europe/Malta', 'HH24:MI') || ' – ' ||
         to_char((p_ts + make_interval(mins => coalesce(p_dur, 180))) at time zone 'Europe/Malta', 'HH24:MI');
$$;

-- Cancel a match (admin) and notify signed-up players.
create or replace function public.admin_cancel_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id, status, title into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status in ('completed', 'cancelled') then return; end if;

  update public.matches set status = 'cancelled' where id = p_match_id;

  -- Paid players get flagged for a refund.
  update public.match_signups set refund_status = 'pending'
    where match_id = p_match_id and status = 'registered' and paid_at is not null and refund_status is null;

  -- Notify each registered player (refund variant for those who paid).
  insert into public.notifications (account_id, type_key, priority, title, body, href, data)
  select s.account_id,
         case when s.paid_at is not null then 'match_cancelled_refund' else 'match_cancelled' end,
         nt.priority,
         coalesce(m.title, 'Your game') || ' was cancelled',
         case when s.paid_at is not null then 'This game was cancelled. You will be refunded.' else 'This game was cancelled.' end,
         '/player-portal/games/' || p_match_id::text,
         jsonb_build_object('matchLabel', coalesce(m.title, 'Your game'))
  from public.match_signups s
  join public.notification_types nt
    on nt.key = (case when s.paid_at is not null then 'match_cancelled_refund' else 'match_cancelled' end)
   and nt.is_active
  where s.match_id = p_match_id and s.status = 'registered';
end;
$$;
grant execute on function public.admin_cancel_match(uuid) to authenticated;

-- Reschedule a match (admin) — capture the OLD schedule before moving it.
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
