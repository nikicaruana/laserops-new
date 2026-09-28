-- =============================================================================
-- Ladders (Stage A): the two competitive ladders + squad enrolment/positions.
--   company — invite-only (admin enrols orgs); has a sponsor-name slot.
--   pro     — open; a squad captain/officer enrols their squad.
-- Positions are seeded by squad-roster total XP (admin "reseed" at season start);
-- match-driven movement (swap on win, monthly drop) arrives in Stage B.
-- =============================================================================
create table public.ladders (
  id           uuid primary key default gen_random_uuid(),
  key          text unique not null,
  name         text not null,
  sponsor_name text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
insert into public.ladders (key, name) values
  ('company', 'Company Ladder'),
  ('pro',     'Pro Ladder')
on conflict (key) do nothing;

create table public.ladder_squads (
  id            uuid primary key default gen_random_uuid(),
  ladder_id     uuid not null references public.ladders(id) on delete cascade,
  squad_id      uuid not null references public.squads(id) on delete cascade,
  position      integer not null,
  last_match_at timestamptz,
  joined_at     timestamptz not null default now(),
  unique (ladder_id, squad_id)
);
create index ladder_squads_ladder_idx on public.ladder_squads (ladder_id, position);

alter table public.ladders enable row level security;
drop policy if exists ladders_public_read on public.ladders;
create policy ladders_public_read on public.ladders for select to anon, authenticated using (true);
grant select on public.ladders to anon, authenticated;

alter table public.ladder_squads enable row level security;
drop policy if exists ladder_squads_public_read on public.ladder_squads;
create policy ladder_squads_public_read on public.ladder_squads for select to anon, authenticated using (true);
grant select on public.ladder_squads to anon, authenticated;

-- Squad roster total XP (sum of members' lifetime XP) — the seeding metric.
create or replace function public.squad_roster_xp(p_squad_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(psl.total_xp, 0)), 0)
  from public.squad_members sm
  left join public.player_stats_lifetime psl on psl.account_id = sm.account_id
  where sm.squad_id = p_squad_id;
$$;
grant execute on function public.squad_roster_xp(uuid) to anon, authenticated;

-- Enrol a squad. Pro: a captain/officer of the squad (or admin). Company: admin only.
create or replace function public.enroll_squad_in_ladder(p_ladder_key text, p_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); lid uuid; nextpos integer;
begin
  select id into lid from public.ladders where key = p_ladder_key and is_active;
  if lid is null then raise exception 'Ladder not found.'; end if;
  if p_ladder_key = 'company' and not public.is_admin() then
    raise exception 'The Company Ladder is invite-only.';
  end if;
  if p_ladder_key <> 'company'
     and not public.is_admin()
     and not exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = acct and role in ('captain', 'officer')) then
    raise exception 'Only a captain or officer can enrol the squad.';
  end if;
  if exists (select 1 from public.ladder_squads where ladder_id = lid and squad_id = p_squad_id) then
    return;
  end if;
  select coalesce(max(position), 0) + 1 into nextpos from public.ladder_squads where ladder_id = lid;
  insert into public.ladder_squads (ladder_id, squad_id, position) values (lid, p_squad_id, nextpos);
end;
$$;
grant execute on function public.enroll_squad_in_ladder(text, uuid) to authenticated;

-- Reseed the whole ladder by squad-roster total XP (admin — season start).
create or replace function public.reseed_ladder(p_ladder_key text)
returns void language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id into lid from public.ladders where key = p_ladder_key;
  if lid is null then raise exception 'Ladder not found.'; end if;
  with ranked as (
    select ls.id, row_number() over (order by public.squad_roster_xp(ls.squad_id) desc, ls.joined_at) as rn
    from public.ladder_squads ls where ls.ladder_id = lid
  )
  update public.ladder_squads ls set position = ranked.rn from ranked where ls.id = ranked.id;
end;
$$;
grant execute on function public.reseed_ladder(text) to authenticated;

-- Standings (public).
create or replace function public.ladder_standings(p_ladder_key text)
returns table (pos integer, squad_id uuid, name text, badge_url text, member_count integer, roster_xp numeric, last_match_at timestamptz)
language sql stable security definer set search_path = public as $$
  select ls.position, s.id, s.name, s.badge_url, s.member_count, public.squad_roster_xp(s.id), ls.last_match_at
  from public.ladder_squads ls
  join public.squads s on s.id = ls.squad_id
  join public.ladders l on l.id = ls.ladder_id
  where l.key = p_ladder_key
  order by ls.position;
$$;
grant execute on function public.ladder_standings(text) to anon, authenticated;
