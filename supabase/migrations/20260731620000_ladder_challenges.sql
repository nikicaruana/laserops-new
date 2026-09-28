-- =============================================================================
-- Ladder challenges: a captain challenges an eligible squad (within ±challenge_range
-- positions), proposes a date/time; the other captain accepts, counters (new
-- date/time), or declines — repeating until settled. On accept a REAL ladder
-- match is booked (matches row flagged with home/away squad + ladder_id) that
-- ingests/scores like any other match. Default 6v6.
-- =============================================================================

-- Squad/ladder fields on matches (a ladder match is a normal match with these set).
alter table public.matches
  add column if not exists home_squad_id uuid references public.squads(id),
  add column if not exists away_squad_id uuid references public.squads(id),
  add column if not exists ladder_id     uuid references public.ladders(id),
  add column if not exists team_size     integer;

create table public.ladder_challenges (
  id                 uuid primary key default gen_random_uuid(),
  ladder_id          uuid not null references public.ladders(id) on delete cascade,
  challenger_squad_id uuid not null references public.squads(id) on delete cascade,
  opponent_squad_id   uuid not null references public.squads(id) on delete cascade,
  team_size          integer not null default 6,
  proposed_at        timestamptz,
  proposed_by_squad  uuid not null references public.squads(id),
  status             text not null default 'negotiating' check (status in ('negotiating', 'accepted', 'declined', 'cancelled')),
  match_id           uuid references public.matches(id) on delete set null,
  created_by         uuid references public.accounts(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint ladder_challenge_distinct check (challenger_squad_id <> opponent_squad_id)
);
create index ladder_challenges_squads_idx on public.ladder_challenges (challenger_squad_id, opponent_squad_id);
create trigger trg_ladder_challenges_updated_at before update on public.ladder_challenges
  for each row execute function public.set_updated_at();

alter table public.ladder_challenges enable row level security;
-- Readable by members of either squad (or admin).
drop policy if exists ladder_challenges_select on public.ladder_challenges;
create policy ladder_challenges_select on public.ladder_challenges for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.squad_members m where m.account_id = public.current_account_id()
             and m.squad_id in (challenger_squad_id, opponent_squad_id))
);
grant select on public.ladder_challenges to authenticated;

-- Helper: is `acct` a captain/officer of `sq`?
create or replace function public.is_squad_manager(p_squad_id uuid, p_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.squad_members where squad_id = p_squad_id and account_id = p_account_id and role in ('captain', 'officer'));
$$;

-- Create a challenge (manager of challenger; opponent within ±challenge_range).
create or replace function public.create_ladder_challenge(
  p_ladder_key text, p_challenger_squad_id uuid, p_opponent_squad_id uuid, p_scheduled_at timestamptz, p_team_size integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id(); lid uuid; rng integer; cpos integer; opos integer; new_id uuid;
begin
  select id, challenge_range into lid, rng from public.ladders where key = p_ladder_key and is_active;
  if lid is null then raise exception 'Ladder not found.'; end if;
  if not public.is_squad_manager(p_challenger_squad_id, acct) then raise exception 'Only a captain or officer can challenge.'; end if;
  select position into cpos from public.ladder_squads where ladder_id = lid and squad_id = p_challenger_squad_id;
  select position into opos from public.ladder_squads where ladder_id = lid and squad_id = p_opponent_squad_id;
  if cpos is null or opos is null then raise exception 'Both squads must be on the ladder.'; end if;
  if abs(cpos - opos) > coalesce(rng, 2) then raise exception 'That squad is outside your challenge range.'; end if;

  insert into public.ladder_challenges (ladder_id, challenger_squad_id, opponent_squad_id, team_size, proposed_at, proposed_by_squad, created_by)
    values (lid, p_challenger_squad_id, p_opponent_squad_id, greatest(coalesce(p_team_size, 6), 6), p_scheduled_at, p_challenger_squad_id, acct)
    returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.create_ladder_challenge(text, uuid, uuid, timestamptz, integer) to authenticated;

-- Respond: 'accept' | 'counter' (with new time) | 'decline' | 'cancel'.
create or replace function public.respond_ladder_challenge(p_challenge_id uuid, p_action text, p_scheduled_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id(); c record; responder uuid; hname text; aname text; new_match uuid;
begin
  select * into c from public.ladder_challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found.'; end if;
  if c.status <> 'negotiating' then raise exception 'This challenge is already settled.'; end if;
  -- The squad whose turn it is = the one that did NOT propose the current time.
  responder := case when c.proposed_by_squad = c.challenger_squad_id then c.opponent_squad_id else c.challenger_squad_id end;

  if p_action = 'cancel' then
    if not public.is_squad_manager(c.challenger_squad_id, acct) then raise exception 'Only the challenger can cancel.'; end if;
    update public.ladder_challenges set status = 'cancelled' where id = p_challenge_id;
    return null;
  end if;

  if not public.is_squad_manager(responder, acct) then raise exception 'It is the other squad''s turn to respond.'; end if;

  if p_action = 'decline' then
    update public.ladder_challenges set status = 'declined' where id = p_challenge_id;
    return null;
  elsif p_action = 'counter' then
    if p_scheduled_at is null then raise exception 'Pick a new date and time.'; end if;
    update public.ladder_challenges set proposed_at = p_scheduled_at, proposed_by_squad = responder where id = p_challenge_id;
    return null;
  elsif p_action = 'accept' then
    select name into hname from public.squads where id = c.challenger_squad_id;
    select name into aname from public.squads where id = c.opponent_squad_id;
    insert into public.matches (title, scheduled_at, status, is_private, min_players, home_squad_id, away_squad_id, ladder_id, team_size, created_by)
      values ('Ladder: ' || hname || ' vs ' || aname, c.proposed_at, 'confirmed', true, c.team_size, c.challenger_squad_id, c.opponent_squad_id, c.ladder_id, c.team_size, acct)
      returning id into new_match;
    update public.ladder_challenges set status = 'accepted', match_id = new_match where id = p_challenge_id;
    return new_match;
  else
    raise exception 'Unknown action.';
  end if;
end;
$$;
grant execute on function public.respond_ladder_challenge(uuid, text, timestamptz) to authenticated;

-- Bell: challenges awaiting the caller's squad's response.
create or replace function public.my_ladder_challenges()
returns table (challenge_id uuid, opponent_name text, proposed_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id,
         case when c.proposed_by_squad = c.challenger_squad_id then h.name else o.name end,
         c.proposed_at
  from public.ladder_challenges c
  join public.squads h on h.id = c.challenger_squad_id
  join public.squads o on o.id = c.opponent_squad_id
  where c.status = 'negotiating'
    and public.is_squad_manager(
      case when c.proposed_by_squad = c.challenger_squad_id then c.opponent_squad_id else c.challenger_squad_id end,
      public.current_account_id());
$$;
grant execute on function public.my_ladder_challenges() to authenticated;
