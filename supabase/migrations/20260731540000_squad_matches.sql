-- =============================================================================
-- Squad-vs-squad matches (ladder foundation). A captain/officer challenges
-- another squad: proposes a date/time + team size. Members of either squad sign
-- up (a player in BOTH squads sits out — their squads are facing each other).
-- Members are notified via the bell. Standings/prizes come later.
-- =============================================================================
create table public.squad_matches (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null default '00000000-0000-0000-0000-000000000001' references public.operators(id) on delete cascade,
  home_squad_id uuid not null references public.squads(id) on delete cascade,
  away_squad_id uuid not null references public.squads(id) on delete cascade,
  scheduled_at  timestamptz,
  team_size     integer,
  status        text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'completed')),
  created_by    uuid references public.accounts(id),
  created_at    timestamptz not null default now(),
  constraint squad_match_distinct check (home_squad_id <> away_squad_id)
);
create index squad_matches_home_idx on public.squad_matches (home_squad_id);
create index squad_matches_away_idx on public.squad_matches (away_squad_id);

create table public.squad_match_signups (
  id             uuid primary key default gen_random_uuid(),
  squad_match_id uuid not null references public.squad_matches(id) on delete cascade,
  account_id     uuid not null references public.accounts(id) on delete cascade,
  squad_id       uuid not null references public.squads(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (squad_match_id, account_id)
);

-- Ladder matches are public to read; signups are read-own (lists come via RPC).
alter table public.squad_matches enable row level security;
drop policy if exists squad_matches_select on public.squad_matches;
create policy squad_matches_select on public.squad_matches for select to anon, authenticated using (true);
grant select on public.squad_matches to anon, authenticated;

alter table public.squad_match_signups enable row level security;
drop policy if exists squad_match_signups_select_own on public.squad_match_signups;
create policy squad_match_signups_select_own on public.squad_match_signups for select to authenticated
  using (account_id = public.current_account_id());
grant select on public.squad_match_signups to authenticated;

-- --- RPCs -------------------------------------------------------------------
create or replace function public.create_squad_challenge(
  p_home_squad_id uuid, p_away_squad_id uuid, p_scheduled_at timestamptz, p_team_size integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); new_id uuid;
begin
  if acct is null then raise exception 'You need an account.'; end if;
  if p_home_squad_id = p_away_squad_id then raise exception 'A squad cannot challenge itself.'; end if;
  if not exists (
    select 1 from public.squad_members where squad_id = p_home_squad_id and account_id = acct and role in ('captain', 'officer')
  ) then
    raise exception 'Only a captain or officer can challenge on their squad''s behalf.';
  end if;
  if not exists (select 1 from public.squads where id = p_away_squad_id) then
    raise exception 'That squad no longer exists.';
  end if;
  insert into public.squad_matches (home_squad_id, away_squad_id, scheduled_at, team_size, created_by)
    values (p_home_squad_id, p_away_squad_id, p_scheduled_at, greatest(coalesce(p_team_size, 5), 1), acct)
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.create_squad_challenge(uuid, uuid, timestamptz, integer) to authenticated;

create or replace function public.signup_squad_match(p_squad_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  mh   uuid;
  ma   uuid;
  in_home boolean;
  in_away boolean;
  side uuid;
begin
  select home_squad_id, away_squad_id into mh, ma from public.squad_matches where id = p_squad_match_id;
  if mh is null then raise exception 'Match not found.'; end if;
  in_home := exists (select 1 from public.squad_members where squad_id = mh and account_id = acct);
  in_away := exists (select 1 from public.squad_members where squad_id = ma and account_id = acct);
  if in_home and in_away then raise exception 'Your squads are facing each other — you sit this one out.'; end if;
  if in_home then side := mh; elsif in_away then side := ma; else raise exception 'You are not in either squad.'; end if;
  insert into public.squad_match_signups (squad_match_id, account_id, squad_id)
    values (p_squad_match_id, acct, side)
    on conflict (squad_match_id, account_id) do nothing;
end;
$$;
grant execute on function public.signup_squad_match(uuid) to authenticated;

-- Signup list (visible to members of either squad + admins).
create or replace function public.squad_match_signup_list(p_squad_match_id uuid)
returns table (account_id uuid, ops_tag text, squad_id uuid)
language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); mh uuid; ma uuid;
begin
  select home_squad_id, away_squad_id into mh, ma from public.squad_matches where id = p_squad_match_id;
  if mh is null then raise exception 'Match not found.'; end if;
  if not public.is_admin()
     and not exists (select 1 from public.squad_members where squad_id in (mh, ma) and account_id = acct) then
    raise exception 'Not allowed.';
  end if;
  return query
    select s.account_id, a.ops_tag, s.squad_id
    from public.squad_match_signups s join public.accounts a on a.id = s.account_id
    where s.squad_match_id = p_squad_match_id;
end;
$$;
grant execute on function public.squad_match_signup_list(uuid) to authenticated;

-- Matches involving a squad (for the Upcoming matches tab).
create or replace function public.squad_matches_for_squad(p_squad_id uuid)
returns table (id uuid, home_squad_id uuid, home_name text, away_squad_id uuid, away_name text, scheduled_at timestamptz, team_size integer, status text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_squad(p_squad_id) then raise exception 'Not allowed.'; end if;
  return query
    select m.id, m.home_squad_id, h.name, m.away_squad_id, aw.name, m.scheduled_at, m.team_size, m.status
    from public.squad_matches m
    join public.squads h on h.id = m.home_squad_id
    join public.squads aw on aw.id = m.away_squad_id
    where (m.home_squad_id = p_squad_id or m.away_squad_id = p_squad_id)
      and m.status in ('proposed', 'accepted')
    order by m.scheduled_at nulls last;
end;
$$;
grant execute on function public.squad_matches_for_squad(uuid) to authenticated;

-- Bell: squad matches the caller can still sign up to (member of a side, not yet
-- signed up). opponent_name = the other squad.
create or replace function public.my_squad_match_notifications()
returns table (squad_match_id uuid, opponent_name text, scheduled_at timestamptz)
language sql security definer set search_path = public as $$
  select m.id,
         case when hm.account_id is not null then aw.name else h.name end,
         m.scheduled_at
  from public.squad_matches m
  join public.squads h  on h.id = m.home_squad_id
  join public.squads aw on aw.id = m.away_squad_id
  left join public.squad_members hm on hm.squad_id = m.home_squad_id and hm.account_id = public.current_account_id()
  left join public.squad_members am on am.squad_id = m.away_squad_id and am.account_id = public.current_account_id()
  where m.status in ('proposed', 'accepted')
    and (hm.account_id is not null or am.account_id is not null)
    and not exists (select 1 from public.squad_match_signups s where s.squad_match_id = m.id and s.account_id = public.current_account_id());
$$;
grant execute on function public.my_squad_match_notifications() to authenticated;
