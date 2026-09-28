-- =============================================================================
-- Squads (foundation). Players form squads (max 20), with roles captain/officer/
-- member. A player creates at most 1 squad and belongs to at most 2 (one primary,
-- one secondary). Searchable squads appear on Find a Squad; all are joinable by
-- invite link. Ladders + squad-vs-squad matches build on this later.
-- All writes go through SECURITY DEFINER RPCs that enforce the caps/roles.
-- =============================================================================

create table public.squads (
  id                 uuid primary key default gen_random_uuid(),
  operator_id        uuid not null default '00000000-0000-0000-0000-000000000001'
                       references public.operators(id) on delete cascade,
  name               text not null,
  slug               text,
  description        text,
  badge_url          text,
  is_searchable      boolean not null default true,
  invite_code        text unique,
  captain_account_id uuid not null references public.accounts(id),
  created_by         uuid references public.accounts(id),
  member_count       integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index squads_searchable_idx on public.squads (is_searchable) where is_searchable;
create trigger trg_squads_updated_at before update on public.squads
  for each row execute function public.set_updated_at();

create table public.squad_members (
  id         uuid primary key default gen_random_uuid(),
  squad_id   uuid not null references public.squads(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  role       text not null default 'member' check (role in ('captain', 'officer', 'member')),
  is_primary boolean not null default true,
  joined_at  timestamptz not null default now(),
  unique (squad_id, account_id)
);
create index squad_members_account_idx on public.squad_members (account_id);
-- Exactly one captain per squad; at most one primary squad per player.
create unique index squad_one_captain on public.squad_members (squad_id) where role = 'captain';
create unique index squad_member_one_primary on public.squad_members (account_id) where is_primary;

-- --- member_count maintenance ----------------------------------------------
create or replace function public.sync_squad_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(new.squad_id, old.squad_id);
begin
  update public.squads set member_count = (select count(*) from public.squad_members where squad_id = sid) where id = sid;
  return null;
end;
$$;
create trigger trg_squad_member_count after insert or delete on public.squad_members
  for each row execute function public.sync_squad_member_count();

-- --- RLS --------------------------------------------------------------------
-- Visibility check as a SECURITY DEFINER function so the two tables' policies
-- don't reference each other's RLS (which Postgres rejects as infinite
-- recursion). A squad is visible if searchable, you're a member, or admin.
create or replace function public.can_view_squad(p_squad_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.squads s
    where s.id = p_squad_id
      and (
        s.is_searchable
        or public.is_admin()
        or exists (select 1 from public.squad_members m where m.squad_id = s.id and m.account_id = public.current_account_id())
      )
  );
$$;

alter table public.squads enable row level security;
alter table public.squad_members enable row level security;

drop policy if exists squads_select on public.squads;
create policy squads_select on public.squads for select to anon, authenticated
  using (public.can_view_squad(id));
grant select on public.squads to anon, authenticated;

drop policy if exists squad_members_select on public.squad_members;
create policy squad_members_select on public.squad_members for select to anon, authenticated
  using (public.can_view_squad(squad_id));
grant select on public.squad_members to anon, authenticated;

-- =============================================================================
-- RPCs (all SECURITY DEFINER; enforce caps + roles).
-- =============================================================================
create or replace function public.create_squad(p_name text, p_description text, p_is_searchable boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  acct    uuid := public.current_account_id();
  created integer;
  joined  integer;
  new_id  uuid;
begin
  if acct is null then raise exception 'You need an account to create a squad.'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'Give your squad a name.'; end if;

  select count(*) into created from public.squads where created_by = acct;
  if created >= 1 then raise exception 'You can only create one squad.'; end if;
  select count(*) into joined from public.squad_members where account_id = acct;
  if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;

  insert into public.squads (name, description, is_searchable, invite_code, captain_account_id, created_by)
    values (btrim(p_name), nullif(btrim(p_description), ''), coalesce(p_is_searchable, true),
            encode(extensions.gen_random_bytes(8), 'hex'), acct, acct)
    returning id into new_id;

  insert into public.squad_members (squad_id, account_id, role, is_primary)
    values (new_id, acct, 'captain', joined = 0);
  return new_id;
end;
$$;
grant execute on function public.create_squad(text, text, boolean) to authenticated;

create or replace function public.join_squad_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  acct   uuid := public.current_account_id();
  sid    uuid;
  joined integer;
  members integer;
begin
  if acct is null then raise exception 'You need an account to join a squad.'; end if;
  select id into sid from public.squads where invite_code = p_code;
  if sid is null then raise exception 'That squad invite is not valid.'; end if;
  if exists (select 1 from public.squad_members where squad_id = sid and account_id = acct) then
    return sid; -- already a member
  end if;
  select count(*) into joined from public.squad_members where account_id = acct;
  if joined >= 2 then raise exception 'You can be in at most 2 squads.'; end if;
  select count(*) into members from public.squad_members where squad_id = sid;
  if members >= 20 then raise exception 'That squad is full (20 members).'; end if;

  insert into public.squad_members (squad_id, account_id, role, is_primary)
    values (sid, acct, 'member', joined = 0);
  return sid;
end;
$$;
grant execute on function public.join_squad_by_code(text) to authenticated;

create or replace function public.leave_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  my   record;
  other uuid;
begin
  select * into my from public.squad_members where squad_id = p_squad_id and account_id = acct;
  if not found then raise exception 'You are not in this squad.'; end if;
  if my.role = 'captain' then raise exception 'Transfer the captaincy or disband the squad first.'; end if;
  delete from public.squad_members where id = my.id;
  -- If they left their primary squad, promote their remaining squad to primary.
  if my.is_primary then
    select id into other from public.squad_members where account_id = acct limit 1;
    if other is not null then update public.squad_members set is_primary = true where id = other; end if;
  end if;
end;
$$;
grant execute on function public.leave_squad(uuid) to authenticated;

-- Captain-only: promote/demote a member between officer and member.
create or replace function public.set_squad_role(p_squad_id uuid, p_account_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if p_role not in ('officer', 'member') then raise exception 'Invalid role.'; end if;
  if not exists (select 1 from public.squads where id = p_squad_id and captain_account_id = acct) then
    raise exception 'Only the captain can change roles.';
  end if;
  if p_account_id = acct then raise exception 'Transfer the captaincy to change your own role.'; end if;
  update public.squad_members set role = p_role
    where squad_id = p_squad_id and account_id = p_account_id and role <> 'captain';
end;
$$;
grant execute on function public.set_squad_role(uuid, uuid, text) to authenticated;

create or replace function public.transfer_captain(p_squad_id uuid, p_new_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (select 1 from public.squads where id = p_squad_id and captain_account_id = acct) then
    raise exception 'Only the captain can transfer the captaincy.';
  end if;
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = p_new_account_id) then
    raise exception 'That player is not in the squad.';
  end if;
  -- Old captain -> officer, new member -> captain (the partial unique index needs
  -- the old captain vacated first).
  update public.squad_members set role = 'officer' where squad_id = p_squad_id and account_id = acct;
  update public.squad_members set role = 'captain' where squad_id = p_squad_id and account_id = p_new_account_id;
  update public.squads set captain_account_id = p_new_account_id where id = p_squad_id;
end;
$$;
grant execute on function public.transfer_captain(uuid, uuid) to authenticated;

create or replace function public.set_primary_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = acct) then
    raise exception 'You are not in this squad.';
  end if;
  -- Two steps so the one-primary partial unique index never sees two true at once.
  update public.squad_members set is_primary = false where account_id = acct;
  update public.squad_members set is_primary = true where account_id = acct and squad_id = p_squad_id;
end;
$$;
grant execute on function public.set_primary_squad(uuid) to authenticated;

-- Captain-only: edit the squad.
create or replace function public.update_squad(p_squad_id uuid, p_name text, p_description text, p_is_searchable boolean, p_badge_url text)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (select 1 from public.squads where id = p_squad_id and captain_account_id = acct) then
    raise exception 'Only the captain can edit the squad.';
  end if;
  update public.squads set
    name          = coalesce(nullif(btrim(p_name), ''), name),
    description    = case when p_description is null then description else nullif(btrim(p_description), '') end,
    is_searchable  = coalesce(p_is_searchable, is_searchable),
    badge_url      = coalesce(p_badge_url, badge_url)
  where id = p_squad_id;
end;
$$;
grant execute on function public.update_squad(uuid, text, text, boolean, text) to authenticated;

-- Captain or officer: remove a member (never the captain).
create or replace function public.kick_squad_member(p_squad_id uuid, p_account_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (
    select 1 from public.squad_members
    where squad_id = p_squad_id and account_id = acct and role in ('captain', 'officer')
  ) then
    raise exception 'Only a captain or officer can remove members.';
  end if;
  delete from public.squad_members
    where squad_id = p_squad_id and account_id = p_account_id and role <> 'captain';
end;
$$;
grant execute on function public.kick_squad_member(uuid, uuid) to authenticated;

create or replace function public.disband_squad(p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not exists (select 1 from public.squads where id = p_squad_id and captain_account_id = acct) then
    raise exception 'Only the captain can disband the squad.';
  end if;
  delete from public.squads where id = p_squad_id;
end;
$$;
grant execute on function public.disband_squad(uuid) to authenticated;

-- Roster reader (ops tags + roles). Definer because a viewer can't read other
-- accounts under RLS; guarded to a viewable squad (searchable / member / admin).
create or replace function public.squad_roster(p_squad_id uuid)
returns table (account_id uuid, ops_tag text, role text, is_primary boolean, joined_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_squad(p_squad_id) then
    raise exception 'Not allowed.';
  end if;
  return query
    select sm.account_id, a.ops_tag, sm.role, sm.is_primary, sm.joined_at
    from public.squad_members sm
    join public.accounts a on a.id = sm.account_id
    where sm.squad_id = p_squad_id
    order by (sm.role = 'captain') desc, (sm.role = 'officer') desc, sm.joined_at;
end;
$$;
grant execute on function public.squad_roster(uuid) to authenticated;
