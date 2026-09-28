-- =============================================================================
-- Emit notifications from the social RPCs (they run as definer, so they can call
-- emit_notification even though players can't). Redefined to add one emit each,
-- only when the underlying action actually happened (not on a no-op re-action).
--   follow_player      -> followed_you (to the followee)
--   invite_to_my_squad -> squad_invite (to the invitee)
--   invite_to_match    -> game_invite  (to the invitee)
-- =============================================================================

create or replace function public.follow_player(p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); target uuid; n integer; me_tag text;
begin
  if acct is null then raise exception 'Sign in to follow players.'; end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then raise exception 'Player not found.'; end if;
  if target = acct then raise exception 'You cannot follow yourself.'; end if;
  insert into public.follows (follower_id, followee_id) values (acct, target) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    select ops_tag into me_tag from public.accounts where id = acct;
    perform public.emit_notification(target, 'followed_you',
      coalesce(me_tag, 'Someone') || ' followed you', null,
      '/player-portal/player-stats/summary?ops=' || coalesce(me_tag, ''));
  end if;
end;
$$;

create or replace function public.invite_to_my_squad(p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); sq uuid; target uuid; sq_name text; me_tag text;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  select squad_id into sq from public.squad_members where account_id = acct and is_primary and role in ('captain', 'officer') limit 1;
  if sq is null then raise exception 'You must captain or officer your primary squad to invite players.'; end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then raise exception 'Player not found.'; end if;
  if target = acct then raise exception 'You cannot invite yourself.'; end if;
  if exists (select 1 from public.squad_members where squad_id = sq and account_id = target) then
    raise exception 'They are already in your squad.';
  end if;
  if exists (select 1 from public.squad_invites where squad_id = sq and invitee_id = target and status = 'pending') then
    return;
  end if;
  insert into public.squad_invites (squad_id, invitee_id, invited_by) values (sq, target, acct);
  select name into sq_name from public.squads where id = sq;
  select ops_tag into me_tag from public.accounts where id = acct;
  perform public.emit_notification(target, 'squad_invite',
    coalesce(me_tag, 'Someone') || ' invited you to ' || coalesce(sq_name, 'their squad'), null,
    '/player-portal/squads');
end;
$$;

create or replace function public.invite_to_match(p_match_id uuid, p_invitee_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); m_title text; me_tag text;
begin
  if acct is null then raise exception 'Not signed in.'; end if;
  if p_invitee_account_id = acct then raise exception 'You can''t invite yourself.'; end if;
  if not exists (select 1 from public.matches where id = p_match_id) then raise exception 'Game not found.'; end if;
  if not public.is_admin()
     and not exists (select 1 from public.matches m where m.id = p_match_id and m.created_by = acct)
     and not exists (select 1 from public.match_signups s where s.match_id = p_match_id and s.account_id = acct and s.status <> 'cancelled')
  then
    raise exception 'Only players in this game can invite others.';
  end if;
  if exists (select 1 from public.match_signups s where s.match_id = p_match_id and s.account_id = p_invitee_account_id and s.status <> 'cancelled') then return; end if;
  if exists (select 1 from public.match_invites where match_id = p_match_id and invitee_id = p_invitee_account_id and status = 'pending') then return; end if;
  insert into public.match_invites (match_id, invitee_id, invited_by) values (p_match_id, p_invitee_account_id, acct);
  select coalesce(title, match_code, 'a game') into m_title from public.matches where id = p_match_id;
  select ops_tag into me_tag from public.accounts where id = acct;
  perform public.emit_notification(p_invitee_account_id, 'game_invite',
    coalesce(me_tag, 'Someone') || ' invited you to ' || m_title, null,
    '/player-portal/games/' || p_match_id::text);
end;
$$;
