-- =============================================================================
-- player_gun_stats (§4.16) — per-account × gun performance + refresh function
-- =============================================================================
-- Derived from match_player_aggregate (each legacy match aggregate carries one
-- gun_used), grouped by account + gun. Powers the armory / weapon-mastery pages.
-- Per-round metrics via the matches' round_count. Call refresh_player_gun_stats()
-- to (re)compute; re-run after importing new games.
-- =============================================================================

create table public.player_gun_stats (
  account_id       uuid not null references public.accounts(id) on delete cascade,
  operator_id      uuid not null default '00000000-0000-0000-0000-000000000001'
                     references public.operators(id) on delete cascade,
  gun_name         text not null,   -- -> guns.name
  games            integer,
  rounds           integer,
  total_kills      integer,
  total_deaths     integer,
  total_hits       integer,
  total_shots      integer,
  total_damage     numeric,
  kills_per_round  numeric,
  damage_per_round numeric,
  avg_accuracy     numeric,
  avg_kd           numeric,
  updated_at       timestamptz not null default now(),
  primary key (account_id, gun_name)
);
create index pgs_gun_idx     on public.player_gun_stats (gun_name);
create index pgs_account_idx on public.player_gun_stats (account_id);

create or replace function public.refresh_player_gun_stats()
returns integer
language plpgsql
as $$
declare n integer;
begin
  delete from public.player_gun_stats;
  insert into public.player_gun_stats (
    account_id, gun_name, games, rounds, total_kills, total_deaths, total_hits,
    total_shots, total_damage, kills_per_round, damage_per_round, avg_accuracy, avg_kd, updated_at)
  select
    mpa.account_id, mpa.gun_used,
    count(*), sum(m.round_count),
    sum(mpa.frags), sum(mpa.deaths), sum(mpa.hits), sum(mpa.shots), sum(mpa.damage),
    round(sum(mpa.frags)::numeric / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.damage)         / nullif(sum(m.round_count),0), 2),
    round(avg(mpa.accuracy), 4), round(avg(mpa.kd), 3), now()
  from public.match_player_aggregate mpa
  join public.matches m on mpa.match_id = m.id
  where mpa.account_id is not null and coalesce(trim(mpa.gun_used),'') <> ''
  group by mpa.account_id, mpa.gun_used;
  get diagnostics n = row_count;
  return n;
end;
$$;
