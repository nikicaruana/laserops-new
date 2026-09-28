-- =============================================================================
-- Opening your own OPEN game now requires having PLAYED at least one game first
-- (so brand-new accounts can't organise before they've turned up). Signing up to
-- an existing open game is unaffected - that's how a newcomer plays their first.
-- "Played" = has a match_participants row (joined a game roster) OR committed
-- stats in match_player_aggregate. Private bookings are NOT gated.
-- =============================================================================

create or replace function public.has_played_game()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.match_participants where account_id = public.current_account_id())
      or exists (select 1 from public.match_player_aggregate where account_id = public.current_account_id());
$$;
grant execute on function public.has_played_game() to anon, authenticated;

-- Recreate create_player_match with the played-a-game gate (admins bypass).
create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.has_played_game() then
    raise exception 'You can open your own games once you have played at least one. Join an open game to get started.';
  end if;
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  if not public.is_admin() and public.has_booking_conflict(p_scheduled_at, 180) then
    raise exception 'Another game is booked around that time. Games need at least an hour between them.';
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
