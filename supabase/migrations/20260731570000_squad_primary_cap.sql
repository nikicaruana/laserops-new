-- The 20-member squad cap applies to PRIMARY members only; secondary members
-- (players whose primary squad is elsewhere) are unlimited. Rework the three
-- join paths to only enforce the cap when the joiner would be a primary member
-- (i.e. this is their first squad).
create or replace function public.join_squad_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); sid uuid; joined integer; pmembers integer;
begin
  if acct is null then raise exception 'You need an account to join a squad.'; end if;
  select id into sid from public.squads where invite_code = p_code;
  if sid is null then raise exception 'That squad invite is not valid.'; end if;
  if exists (select 1 from public.squad_members where squad_id = sid and account_id = acct) then
    return sid;
  end if;
  select count(*) into joined from public.squad_members where account_id = acct;
  if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;
  if joined = 0 then
    select count(*) into pmembers from public.squad_members where squad_id = sid and is_primary;
    if pmembers >= 20 then raise exception 'That squad is full (20 primary members). You can still join as a secondary member if it becomes your second squad.'; end if;
  end if;
  insert into public.squad_members (squad_id, account_id, role, is_primary) values (sid, acct, 'member', joined = 0);
  return sid;
end;
$$;

create or replace function public.respond_join_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); req record; pmembers integer; joined integer;
begin
  select * into req from public.squad_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  if req.status <> 'pending' then raise exception 'That request was already handled.'; end if;
  if not exists (
    select 1 from public.squad_members where squad_id = req.squad_id and account_id = acct and role in ('captain', 'officer')
  ) then
    raise exception 'Only a captain or officer can respond.';
  end if;

  if p_accept then
    if exists (select 1 from public.squad_members where squad_id = req.squad_id and account_id = req.account_id) then
      update public.squad_join_requests set status = 'accepted', resolved_at = now() where id = p_request_id;
      return;
    end if;
    select count(*) into joined from public.squad_members where account_id = req.account_id;
    if joined >= 2 then raise exception 'That player is already in 2 squads.'; end if;
    if joined = 0 then
      select count(*) into pmembers from public.squad_members where squad_id = req.squad_id and is_primary;
      if pmembers >= 20 then raise exception 'The squad is full (20 primary members).'; end if;
    end if;
    insert into public.squad_members (squad_id, account_id, role, is_primary) values (req.squad_id, req.account_id, 'member', joined = 0);
    update public.squad_join_requests set status = 'accepted', resolved_at = now() where id = p_request_id;
  else
    update public.squad_join_requests set status = 'declined', resolved_at = now() where id = p_request_id;
  end if;
end;
$$;

create or replace function public.respond_squad_invite(p_invite_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); inv record; pmembers integer; joined integer;
begin
  select * into inv from public.squad_invites where id = p_invite_id;
  if not found then raise exception 'Invite not found.'; end if;
  if inv.invitee_id <> acct then raise exception 'Not your invite.'; end if;
  if inv.status <> 'pending' then raise exception 'Already handled.'; end if;
  if p_accept then
    if not exists (select 1 from public.squad_members where squad_id = inv.squad_id and account_id = acct) then
      select count(*) into joined from public.squad_members where account_id = acct;
      if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;
      if joined = 0 then
        select count(*) into pmembers from public.squad_members where squad_id = inv.squad_id and is_primary;
        if pmembers >= 20 then raise exception 'That squad is full (20 primary members).'; end if;
      end if;
      insert into public.squad_members (squad_id, account_id, role, is_primary) values (inv.squad_id, acct, 'member', joined = 0);
    end if;
    update public.squad_invites set status = 'accepted', resolved_at = now() where id = p_invite_id;
  else
    update public.squad_invites set status = 'declined', resolved_at = now() where id = p_invite_id;
  end if;
end;
$$;
