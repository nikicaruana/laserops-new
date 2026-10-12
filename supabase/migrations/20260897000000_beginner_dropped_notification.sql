-- =============================================================================
-- Notify a player when they're auto-removed from a beginners game for leveling
-- past its cap. In-app bell notification (no email).
-- =============================================================================
insert into public.notification_types
  (key, label, description, priority, is_active, sends_email, sends_push, delay_hours, sort_order, bell_title, bell_body)
values
  ('beginner_level_dropped', 'Dropped from a beginners game',
   'Player leveled past a beginners game cap and was removed from it.',
   3, true, false, false, 0, 16,
   'Removed from {{matchLabel}}',
   'You have leveled past the beginners level cap, so you are no longer signed up for {{matchLabel}}. Plenty of open games await at your level.')
on conflict (key) do update set
  label = excluded.label, description = excluded.description, priority = excluded.priority,
  is_active = excluded.is_active, sends_email = excluded.sends_email, sends_push = excluded.sends_push,
  delay_hours = excluded.delay_hours, sort_order = excluded.sort_order,
  bell_title = excluded.bell_title, bell_body = excluded.bell_body;

-- Emit the bell notification for each sign-up dropped by the sweep.
create or replace function public.drop_overcap_beginner_signups()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in
    update public.match_signups s
       set status = 'cancelled'
      from public.matches m, public.player_stats_lifetime l
     where s.match_id = m.id
       and l.account_id = s.account_id
       and s.status in ('registered', 'waitlisted')
       and m.is_beginner = true
       and m.beginner_max_level is not null
       and m.status in ('tentative', 'awaiting_confirm', 'confirmed')
       and coalesce(m.scheduled_at, now()) > now()
       and coalesce(l.current_level, 1) > m.beginner_max_level
    returning s.account_id as account_id, s.match_id as match_id, m.title as title
  loop
    n := n + 1;
    insert into public.notifications (account_id, type_key, priority, title, body, href, data)
    select r.account_id, 'beginner_level_dropped', nt.priority,
           'Removed from ' || coalesce(r.title, 'a beginners game'),
           'You have leveled past the beginners level cap, so you are no longer signed up for '
             || coalesce(r.title, 'this game') || '.',
           '/player-portal/games/' || r.match_id::text,
           jsonb_build_object('matchLabel', coalesce(r.title, 'the game'))
    from public.notification_types nt
    where nt.key = 'beginner_level_dropped' and nt.is_active;
  end loop;
  return n;
end;
$$;
