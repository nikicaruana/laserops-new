-- =============================================================================
-- Squad join requests. A publicly-joinable (is_searchable) squad can be found in
-- Find a Squad; a player clicks "Request to join", which sends a pending request
-- to the captain + officers (surfaced in their notification bell). They accept
-- or decline. Invite links still bypass this (instant join).
-- =============================================================================
create table public.squad_join_requests (
  id         uuid primary key default gen_random_uuid(),
  squad_id   uuid not null references public.squads(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index squad_join_req_one_pending on public.squad_join_requests (squad_id, account_id) where status = 'pending';
create index squad_join_req_squad_idx on public.squad_join_requests (squad_id) where status = 'pending';

alter table public.squad_join_requests enable row level security;
-- A player can see their own requests (to show "Requested"); managers read via RPC.
drop policy if exists squad_join_req_select_own on public.squad_join_requests;
create policy squad_join_req_select_own on public.squad_join_requests for select to authenticated
  using (account_id = public.current_account_id());
grant select on public.squad_join_requests to authenticated;

-- --- RPCs -------------------------------------------------------------------
create or replace function public.request_to_join_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  acct     uuid := public.current_account_id();
  joinable boolean;
  joined   integer;
begin
  if acct is null then raise exception 'You need an account to request to join.'; end if;
  select is_searchable into joinable from public.squads where id = p_squad_id;
  if joinable is null then raise exception 'Squad not found.'; end if;
  if not joinable then raise exception 'This squad is invite-only.'; end if;
  if exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = acct) then
    raise exception 'You are already in this squad.';
  end if;
  select count(*) into joined from public.squad_members where account_id = acct;
  if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;

  -- Idempotent: skip if a request is already pending (the partial unique index
  -- is the backstop against a concurrent double-submit).
  if exists (
    select 1 from public.squad_join_requests
    where squad_id = p_squad_id and account_id = acct and status = 'pending'
  ) then
    return;
  end if;
  insert into public.squad_join_requests (squad_id, account_id) values (p_squad_id, acct);
end;
$$;
grant execute on function public.request_to_join_squad(uuid) to authenticated;

create or replace function public.respond_join_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  acct    uuid := public.current_account_id();
  req     record;
  members integer;
  joined  integer;
begin
  select * into req from public.squad_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  if req.status <> 'pending' then raise exception 'That request was already handled.'; end if;
  if not exists (
    select 1 from public.squad_members
    where squad_id = req.squad_id and account_id = acct and role in ('captain', 'officer')
  ) then
    raise exception 'Only a captain or officer can respond.';
  end if;

  if p_accept then
    if exists (select 1 from public.squad_members where squad_id = req.squad_id and account_id = req.account_id) then
      update public.squad_join_requests set status = 'accepted', resolved_at = now() where id = p_request_id;
      return;
    end if;
    select count(*) into members from public.squad_members where squad_id = req.squad_id;
    if members >= 20 then raise exception 'The squad is full (20 members).'; end if;
    select count(*) into joined from public.squad_members where account_id = req.account_id;
    if joined >= 2 then raise exception 'That player is already in 2 squads.'; end if;
    insert into public.squad_members (squad_id, account_id, role, is_primary)
      values (req.squad_id, req.account_id, 'member', joined = 0);
    update public.squad_join_requests set status = 'accepted', resolved_at = now() where id = p_request_id;
  else
    update public.squad_join_requests set status = 'declined', resolved_at = now() where id = p_request_id;
  end if;
end;
$$;
grant execute on function public.respond_join_request(uuid, boolean) to authenticated;

-- Pending requests for a squad (captain/officer only) — for the manage page.
create or replace function public.squad_pending_requests(p_squad_id uuid)
returns table (request_id uuid, account_id uuid, ops_tag text, profile_pic_url text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (
    select 1 from public.squad_members where squad_id = p_squad_id and account_id = acct and role in ('captain', 'officer')
  ) then
    raise exception 'Not allowed.';
  end if;
  return query
    select r.id, r.account_id, a.ops_tag, a.profile_pic_url, r.created_at
    from public.squad_join_requests r
    join public.accounts a on a.id = r.account_id
    where r.squad_id = p_squad_id and r.status = 'pending'
    order by r.created_at;
end;
$$;
grant execute on function public.squad_pending_requests(uuid) to authenticated;

-- Summary for the notification bell: squads the caller manages that have pending
-- requests, with the count.
create or replace function public.squad_manager_pending_summary()
returns table (squad_id uuid, squad_name text, pending_count integer)
language sql security definer set search_path = public as $$
  select s.id, s.name, count(r.id)::int
  from public.squads s
  join public.squad_members m on m.squad_id = s.id and m.account_id = public.current_account_id() and m.role in ('captain', 'officer')
  join public.squad_join_requests r on r.squad_id = s.id and r.status = 'pending'
  group by s.id, s.name;
$$;
grant execute on function public.squad_manager_pending_summary() to authenticated;
