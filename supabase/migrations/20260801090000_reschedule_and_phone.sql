-- =============================================================================
-- Rescheduling + phone-required-to-book.
--   - reschedule_match: move a planned game (keeps all participants/signups) and
--     notify everyone. Blocked once live/completed/cancelled.
--   - Booking requires a mobile number on the account (so we can reach players
--     when a game has to move). Phone stays optional otherwise.
--   - Cancelling a paid game already auto-flags refunds (admin_cancel_match); the
--     blackout-conflict UI reuses reschedule_match / admin_cancel_match per game.
-- =============================================================================

-- Notification type for a moved game.
insert into public.notification_types (key, label, description, priority, sends_email, sends_push, delay_hours, sort_order)
values ('game_rescheduled', 'A game you are in was moved', 'A game you signed up to has a new date/time.', 2, false, true, 0, 14)
on conflict (key) do nothing;

-- Move a planned game to a new date/time and notify every signed-up player.
create or replace function public.reschedule_match(p_match_id uuid, p_new_scheduled_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_new_scheduled_at is null then raise exception 'Pick a new date and time.'; end if;
  select id, status, title into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status in ('live', 'completed', 'cancelled') then
    raise exception 'A % game cannot be rescheduled.', m.status;
  end if;

  update public.matches set scheduled_at = p_new_scheduled_at where id = p_match_id;

  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select s.account_id, 'game_rescheduled', nt.priority,
         coalesce(m.title, 'Your game') || ' was moved',
         'This game has a new date and time. Open it to see the details.',
         '/player-portal/games/' || p_match_id::text
  from public.match_signups s
  join public.notification_types nt on nt.key = 'game_rescheduled' and nt.is_active
  where s.match_id = p_match_id and s.status = 'registered';
end;
$$;
grant execute on function public.reschedule_match(uuid, timestamptz) to authenticated;

-- --- phone required to book -------------------------------------------------
create or replace function public.assert_bookable_account(p_acct uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.accounts where id = p_acct and phone_e164 is not null and btrim(phone_e164) <> ''
  ) then
    raise exception 'Add a mobile number to your profile before booking a game.';
  end if;
end;
$$;

-- Direct signups (match_signups insert) require a phone. Walk-ins added by admins
-- go through match_participants, which is unaffected.
create or replace function public.trg_require_phone_for_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_id is not null then
    perform public.assert_bookable_account(new.account_id);
  end if;
  return new;
end;
$$;
drop trigger if exists require_phone_for_signup on public.match_signups;
create trigger require_phone_for_signup before insert on public.match_signups
  for each row execute function public.trg_require_phone_for_signup();

-- Recreate the two player creation RPCs to require a phone (keeps the availability
-- gate + existing behaviour).
create or replace function public.create_private_booking(p_title text, p_scheduled_at timestamptz, p_headcount integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid;
begin
  if acct is null then raise exception 'You need an account to book a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games/bookings at a time.'; end if;
  insert into public.matches (title, scheduled_at, status, min_players, is_private, pricing_mode, created_by)
    values (nullif(btrim(p_title), ''), p_scheduled_at, 'tentative', greatest(coalesce(p_headcount, 1), 1), true, 'flat', acct)
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.create_private_booking(text, timestamptz, integer) to authenticated;

create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games at a time.'; end if;

  insert into public.matches (title, scheduled_at, status, min_players, max_players, price_eur, pricing_mode, is_double_xp, is_private, created_by)
    values (nullif(btrim(p_title), ''), p_scheduled_at, 'tentative', greatest(coalesce(p_min_players, 10), 1), p_max_players, p_price_eur, 'per_player', false, false, acct)
    returning id into new_id;

  insert into public.match_signups (match_id, account_id, status) values (new_id, acct, 'registered')
    on conflict (match_id, account_id) do nothing;

  select ops_tag into tag from public.accounts where id = acct;
  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select distinct m2.account_id, 'squad_open_game', nt.priority,
         coalesce(tag, 'A squadmate') || ' opened a game',
         coalesce(nullif(btrim(p_title), ''), 'A new open game'),
         '/player-portal/games/' || new_id::text
  from public.squad_members m1
  join public.squad_members m2 on m2.squad_id = m1.squad_id and m2.account_id <> acct
  join public.notification_types nt on nt.key = 'squad_open_game' and nt.is_active
  where m1.account_id = acct;

  return new_id;
end;
$$;
grant execute on function public.create_player_match(text, timestamptz, integer, integer, numeric) to authenticated;

-- Organizer contact for the blackout-conflict resolver (admin-only): who to call
-- to move a game. Returns the created_by account's name + phone per match.
create or replace function public.match_organizers(p_match_ids uuid[])
returns table (match_id uuid, full_name text, ops_tag text, phone_e164 text)
language sql security definer set search_path = public as $$
  select m.id, a.full_name, a.ops_tag, a.phone_e164
  from public.matches m
  left join public.accounts a on a.id = m.created_by
  where m.id = any(p_match_ids) and public.is_admin();
$$;
grant execute on function public.match_organizers(uuid[]) to authenticated;
