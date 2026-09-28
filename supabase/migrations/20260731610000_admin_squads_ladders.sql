-- =============================================================================
-- Admin control over squads + ladders, ladder config fields, and ladder join
-- requests (admin accept/deny).
-- =============================================================================

-- --- 1. Admin full control (RLS admin_all) ---------------------------------
drop policy if exists squads_admin_all on public.squads;
create policy squads_admin_all on public.squads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.squads to authenticated;

drop policy if exists squad_members_admin_all on public.squad_members;
create policy squad_members_admin_all on public.squad_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.squad_members to authenticated;

drop policy if exists ladders_admin_all on public.ladders;
create policy ladders_admin_all on public.ladders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.ladders to authenticated;

drop policy if exists ladder_squads_admin_all on public.ladder_squads;
create policy ladder_squads_admin_all on public.ladder_squads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant insert, update, delete on public.ladder_squads to authenticated;

-- --- 2. Ladder config fields -----------------------------------------------
alter table public.ladders
  add column if not exists description     text,
  add column if not exists image_url       text,
  add column if not exists squad_limit     integer,                       -- null = unlimited
  add column if not exists challenge_range integer not null default 2,    -- positions above/below you can challenge
  add column if not exists max_idle_days   integer not null default 30,   -- drop a place after this many idle days
  add column if not exists start_date      date,
  add column if not exists end_date        date;

-- --- 3. Ladder join requests -----------------------------------------------
create table public.ladder_join_requests (
  id           uuid primary key default gen_random_uuid(),
  ladder_id    uuid not null references public.ladders(id) on delete cascade,
  squad_id     uuid not null references public.squads(id) on delete cascade,
  requested_by uuid references public.accounts(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create unique index ladder_join_req_one_pending on public.ladder_join_requests (ladder_id, squad_id) where status = 'pending';

alter table public.ladder_join_requests enable row level security;
drop policy if exists ladder_join_req_admin_all on public.ladder_join_requests;
create policy ladder_join_req_admin_all on public.ladder_join_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists ladder_join_req_select_own on public.ladder_join_requests;
create policy ladder_join_req_select_own on public.ladder_join_requests for select to authenticated
  using (exists (select 1 from public.squad_members m where m.squad_id = ladder_join_requests.squad_id and m.account_id = public.current_account_id()));
grant select on public.ladder_join_requests to authenticated;

-- A captain/officer requests their squad joins a ladder.
create or replace function public.request_ladder_join(p_ladder_key text, p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); lid uuid;
begin
  select id into lid from public.ladders where key = p_ladder_key and is_active;
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
  insert into public.ladder_join_requests (ladder_id, squad_id, requested_by) values (lid, p_squad_id, acct);
end;
$$;
grant execute on function public.request_ladder_join(text, uuid) to authenticated;

-- Admin: append a squad to a ladder (enforces squad_limit).
create or replace function public.admin_add_squad_to_ladder(p_ladder_id uuid, p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cap integer; cnt integer; nextpos integer;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if exists (select 1 from public.ladder_squads where ladder_id = p_ladder_id and squad_id = p_squad_id) then return; end if;
  select squad_limit into cap from public.ladders where id = p_ladder_id;
  select count(*) into cnt from public.ladder_squads where ladder_id = p_ladder_id;
  if cap is not null and cnt >= cap then raise exception 'Ladder is at its squad limit.'; end if;
  select coalesce(max(position), 0) + 1 into nextpos from public.ladder_squads where ladder_id = p_ladder_id;
  insert into public.ladder_squads (ladder_id, squad_id, position) values (p_ladder_id, p_squad_id, nextpos);
end;
$$;
grant execute on function public.admin_add_squad_to_ladder(uuid, uuid) to authenticated;

-- Admin: pending requests for a ladder (with squad name).
create or replace function public.ladder_pending_requests(p_ladder_id uuid)
returns table (request_id uuid, squad_id uuid, squad_name text, badge_url text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
    select r.id, s.id, s.name, s.badge_url, r.created_at
    from public.ladder_join_requests r join public.squads s on s.id = r.squad_id
    where r.ladder_id = p_ladder_id and r.status = 'pending'
    order by r.created_at;
end;
$$;
grant execute on function public.ladder_pending_requests(uuid) to authenticated;

-- Admin: accept (enrol) / decline a request.
create or replace function public.respond_ladder_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare req record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into req from public.ladder_join_requests where id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  if req.status <> 'pending' then raise exception 'Already handled.'; end if;
  if p_accept then
    perform public.admin_add_squad_to_ladder(req.ladder_id, req.squad_id);
    update public.ladder_join_requests set status = 'accepted', resolved_at = now() where id = p_request_id;
  else
    update public.ladder_join_requests set status = 'declined', resolved_at = now() where id = p_request_id;
  end if;
end;
$$;
grant execute on function public.respond_ladder_request(uuid, boolean) to authenticated;
