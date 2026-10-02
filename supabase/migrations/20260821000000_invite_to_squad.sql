-- Squad-specific invite: a captain/officer of p_squad_id invites a player by ops
-- tag to THAT squad (invite_to_my_squad only targets the caller's PRIMARY squad,
-- which is wrong when managing a non-primary squad from its page).
create or replace function public.invite_to_squad(p_squad_id uuid, p_ops_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); target uuid; sq_name text; me_tag text;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if not exists (
    select 1 from public.squad_members
    where squad_id = p_squad_id and account_id = acct and role in ('captain', 'officer')
  ) then
    raise exception 'You must captain or officer this squad to invite players.';
  end if;
  select id into target from public.accounts where lower(ops_tag) = lower(btrim(p_ops_tag)) limit 1;
  if target is null then raise exception 'Player not found.'; end if;
  if target = acct then raise exception 'You cannot invite yourself.'; end if;
  if exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = target) then
    raise exception 'They are already in this squad.';
  end if;
  if exists (select 1 from public.squad_invites where squad_id = p_squad_id and invitee_id = target and status = 'pending') then
    return; -- already invited; no-op
  end if;
  insert into public.squad_invites (squad_id, invitee_id, invited_by) values (p_squad_id, target, acct);
  select name into sq_name from public.squads where id = p_squad_id;
  select ops_tag into me_tag from public.accounts where id = acct;
  perform public.emit_notification(target, 'squad_invite',
    coalesce(me_tag, 'Someone') || ' invited you to ' || coalesce(sq_name, 'their squad'), null,
    '/player-portal/squads');
end;
$$;
grant execute on function public.invite_to_squad(uuid, text) to authenticated;
