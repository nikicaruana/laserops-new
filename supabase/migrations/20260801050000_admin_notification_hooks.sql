-- =============================================================================
-- Admin-notification emit hooks. Each fires an admin_notifications alert from the
-- authoritative definer trigger / RPC for that event, and clears the alert when
-- the state resolves (so the feed reflects reality, not history):
--   sync_match_quorum   -> game_needs_confirmation / game_dropped_below_min /
--                          game_fully_booked (the quorum trigger already computes
--                          exactly these transitions).
--   matches update      -> game_cancelled (non-admin cancels only) /
--                          match_awaiting_ingestion, and clears lifecycle alerts.
--   matches insert      -> slot_contention (overlapping open games).
--   request_ladder_join -> ladder_join_request.
--   match_signups update-> refund_pending (a paid signup flagged for a refund),
--                          cleared when the refund resolves.
-- =============================================================================

-- --- quorum transitions: needs-confirmation / dropped-below-min / fully-booked --
create or replace function public.sync_match_quorum()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  reg integer;
  paid integer;
  onday integer;
  m record;
  href text;
begin
  mid := coalesce(new.match_id, old.match_id);

  select
    count(*) filter (where status = 'registered'),
    count(*) filter (where status = 'registered' and paid_at is not null),
    count(*) filter (where status = 'registered' and payment_intent = 'on_day')
  into reg, paid, onday
  from public.match_signups where match_id = mid;

  update public.matches
    set registered_count = reg, paid_count = paid, on_day_count = onday
    where id = mid;

  select status, min_players, max_players, reached_quorum_at, title into m from public.matches where id = mid;
  href := '/admin/matches/' || mid::text;

  -- Only auto-toggle between tentative and awaiting_confirm; once an admin has
  -- confirmed (or it's live/completed/cancelled), leave the status alone.
  if reg >= m.min_players and m.status = 'tentative' then
    update public.matches
      set status = 'awaiting_confirm', reached_quorum_at = coalesce(m.reached_quorum_at, now())
      where id = mid;
    perform public.clear_admin_notification('dropped:' || mid::text);
    perform public.emit_admin_notification('game_needs_confirmation',
      coalesce(m.title, 'A game') || ' needs confirmation',
      'It reached its minimum of ' || m.min_players || ' players.',
      href, 'match', mid, 'needsconfirm:' || mid::text);
  elsif reg < m.min_players and m.status = 'awaiting_confirm' then
    update public.matches
      set status = 'tentative', reached_quorum_at = null
      where id = mid;
    perform public.clear_admin_notification('needsconfirm:' || mid::text);
    perform public.emit_admin_notification('game_dropped_below_min',
      coalesce(m.title, 'A game') || ' dropped below its minimum',
      'A withdrawal took it back under ' || m.min_players || ' players (now ' || reg || ').',
      href, 'match', mid, 'dropped:' || mid::text);
  end if;

  -- Fully booked: one alert while at capacity, cleared when a spot frees up.
  if m.max_players is not null and reg >= m.max_players then
    perform public.emit_admin_notification('game_fully_booked',
      coalesce(m.title, 'A game') || ' is fully booked',
      'It reached its maximum of ' || m.max_players || ' players.',
      href, 'match', mid, 'fullbooked:' || mid::text);
  else
    perform public.clear_admin_notification('fullbooked:' || mid::text);
  end if;

  return null;
end;
$$;

-- --- match lifecycle: cancelled / awaiting-ingestion, and alert cleanup --------
create or replace function public.trg_admin_match_alerts()
returns trigger language plpgsql security definer set search_path = public as $$
declare href text := '/admin/matches/' || new.id::text;
begin
  if new.status is distinct from old.status then
    -- Any move out of the open states resolves the open-game alerts.
    if new.status in ('confirmed', 'live', 'completed', 'cancelled') then
      perform public.clear_admin_notification('needsconfirm:' || new.id::text);
      perform public.clear_admin_notification('dropped:' || new.id::text);
      perform public.clear_admin_notification('fullbooked:' || new.id::text);
      perform public.clear_admin_notification('contention:' || new.id::text);
    end if;

    if new.status = 'cancelled' then
      perform public.clear_admin_notification('ingest:' || new.id::text);
      -- Suppress when an admin is the one cancelling (they already know).
      if not public.is_admin() then
        perform public.emit_admin_notification('game_cancelled',
          coalesce(new.title, 'A game') || ' was cancelled',
          null, href, 'match', new.id, 'cancelled:' || new.id::text);
      end if;
    elsif new.status = 'completed' and new.xp_distributed_at is null then
      perform public.emit_admin_notification('match_awaiting_ingestion',
        coalesce(new.title, 'A game') || ' is awaiting processing',
        'The game is completed but its stats / XP have not been committed yet.',
        href, 'match', new.id, 'ingest:' || new.id::text);
    end if;
  end if;

  -- Ingestion done -> drop the reminder.
  if new.xp_distributed_at is not null and old.xp_distributed_at is null then
    perform public.clear_admin_notification('ingest:' || new.id::text);
  end if;

  return null;
end;
$$;

drop trigger if exists admin_match_alerts on public.matches;
create trigger admin_match_alerts
  after update on public.matches
  for each row
  when (new.status is distinct from old.status or new.xp_distributed_at is distinct from old.xp_distributed_at)
  execute function public.trg_admin_match_alerts();

-- --- slot contention: a new open game overlapping another open game's window ----
create or replace function public.trg_admin_match_contention()
returns trigger language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  if new.scheduled_at is null or new.status not in ('tentative', 'awaiting_confirm', 'confirmed') then
    return null;
  end if;
  select count(*) into c from public.matches m
    where m.id <> new.id
      and m.status in ('tentative', 'awaiting_confirm', 'confirmed')
      and m.scheduled_at between new.scheduled_at - interval '3 hours' and new.scheduled_at + interval '3 hours';
  if c > 0 then
    perform public.emit_admin_notification('slot_contention',
      'Overlapping games detected',
      coalesce(new.title, 'A new game') || ' overlaps the time window of ' || c || ' other open game' || case when c = 1 then '' else 's' end || '.',
      '/admin/matches/' || new.id::text, 'match', new.id, 'contention:' || new.id::text);
  end if;
  return null;
end;
$$;

drop trigger if exists admin_match_contention on public.matches;
create trigger admin_match_contention
  after insert on public.matches
  for each row execute function public.trg_admin_match_contention();

-- --- refund flagged for processing ---------------------------------------------
create or replace function public.trg_admin_refund_alert()
returns trigger language plpgsql security definer set search_path = public as $$
declare tag text; ttl text;
begin
  if new.refund_status = 'pending' and (old.refund_status is distinct from 'pending') then
    select ops_tag into tag from public.accounts where id = new.account_id;
    select title into ttl from public.matches where id = new.match_id;
    perform public.emit_admin_notification('refund_pending',
      'Refund needed: ' || coalesce(tag, 'a player'),
      coalesce(tag, 'A player') || ' is owed a refund for ' || coalesce(ttl, 'a cancelled game') || '.',
      '/admin/matches/' || new.match_id::text, 'match', new.match_id, 'refund:' || new.id::text);
  elsif old.refund_status = 'pending' and new.refund_status is distinct from 'pending' then
    perform public.clear_admin_notification('refund:' || new.id::text);
  end if;
  return null;
end;
$$;

drop trigger if exists admin_refund_alert on public.match_signups;
create trigger admin_refund_alert
  after update on public.match_signups
  for each row
  when (new.refund_status is distinct from old.refund_status)
  execute function public.trg_admin_refund_alert();

-- --- squad requests to join a ladder -------------------------------------------
create or replace function public.request_ladder_join(p_ladder_key text, p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); lid uuid; rid uuid; sq_name text; l_name text;
begin
  select id, name into lid, l_name from public.ladders where key = p_ladder_key and is_active;
  if lid is null then raise exception 'Ladder not found.'; end if;
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = acct and role in ('captain', 'officer')) then
    raise exception 'Only a captain or officer can request to join.';
  end if;
  if exists (select 1 from public.ladder_squads where ladder_id = lid and squad_id = p_squad_id) then
    raise exception 'Your squad is already on this ladder.';
  end if;
  if exists (select 1 from public.ladder_join_requests where ladder_id = lid and squad_id = p_squad_id and status = 'pending') then
    return;
  end if;
  insert into public.ladder_join_requests (ladder_id, squad_id, requested_by) values (lid, p_squad_id, acct)
    returning id into rid;

  select name into sq_name from public.squads where id = p_squad_id;
  perform public.emit_admin_notification('ladder_join_request',
    coalesce(sq_name, 'A squad') || ' wants to join the ' || coalesce(l_name, 'ladder'),
    'Review the request to accept or decline it.',
    '/admin/ladders/' || lid::text, 'ladder', lid, 'ladderjoin:' || rid::text);
end;
$$;
grant execute on function public.request_ladder_join(text, uuid) to authenticated;
