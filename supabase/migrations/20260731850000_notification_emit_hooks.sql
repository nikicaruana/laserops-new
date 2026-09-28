-- =============================================================================
-- Remaining notification emit hooks:
--   admin_cancel_match  -> match_cancelled / match_cancelled_refund (+ flags paid
--                          signups for refund) so the cancel button can notify.
--   admin_start_match   -> game_live when an admin starts a match by hand.
--   create_player_match -> squad_open_game to the creator's squadmates.
-- The admin actions become RPCs (the buttons previously patched matches directly
-- with no server hook). Definer functions may emit notifications directly.
-- =============================================================================

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
  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select s.account_id,
         case when s.paid_at is not null then 'match_cancelled_refund' else 'match_cancelled' end,
         nt.priority,
         coalesce(m.title, 'Your game') || ' was cancelled',
         case when s.paid_at is not null then 'This game was cancelled. You will be refunded.' else 'This game was cancelled.' end,
         '/player-portal/games/' || p_match_id::text
  from public.match_signups s
  join public.notification_types nt
    on nt.key = (case when s.paid_at is not null then 'match_cancelled_refund' else 'match_cancelled' end)
   and nt.is_active
  where s.match_id = p_match_id and s.status = 'registered';
end;
$$;
grant execute on function public.admin_cancel_match(uuid) to authenticated;

-- Start a confirmed match (admin): go live, generate the join code, notify players.
create or replace function public.admin_start_match(p_match_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare m record; code text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id, status, title into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status <> 'confirmed' then raise exception 'Only a confirmed match can be started.'; end if;

  code := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  update public.matches set status = 'live', entry_code = code, went_live_at = now()
    where id = p_match_id and status = 'confirmed';

  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select s.account_id, 'game_live', nt.priority,
         coalesce(m.title, 'Your game') || ' is live',
         'Your game is live now. Sign in to join.',
         '/player-portal/games/' || p_match_id::text
  from public.match_signups s
  join public.notification_types nt on nt.key = 'game_live' and nt.is_active
  where s.match_id = p_match_id and s.status = 'registered';

  return code;
end;
$$;
grant execute on function public.admin_start_match(uuid) to authenticated;

-- Recreate create_player_match to also notify the creator's squadmates.
create or replace function public.create_player_match(
  p_title        text,
  p_scheduled_at timestamptz,
  p_min_players  integer,
  p_max_players  integer,
  p_price_eur    numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  acct   uuid := public.current_account_id();
  active integer;
  new_id uuid;
  tag    text;
begin
  if acct is null then
    raise exception 'You need an account to create a game.';
  end if;

  select count(*) into active from public.matches
    where created_by = acct
      and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then
    raise exception 'You can have at most 3 active games at a time.';
  end if;

  insert into public.matches (
    title, scheduled_at, status, min_players, max_players,
    price_eur, pricing_mode, is_double_xp, is_private, created_by
  ) values (
    nullif(btrim(p_title), ''), p_scheduled_at, 'tentative',
    greatest(coalesce(p_min_players, 10), 1), p_max_players,
    p_price_eur, 'per_player', false, false, acct
  )
  returning id into new_id;

  -- The organizer is playing too: sign them up automatically.
  insert into public.match_signups (match_id, account_id, status)
    values (new_id, acct, 'registered')
    on conflict (match_id, account_id) do nothing;

  -- Notify the creator's squadmates that they opened a game.
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
