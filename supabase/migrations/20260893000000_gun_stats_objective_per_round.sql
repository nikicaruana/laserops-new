-- =============================================================================
-- Per-gun objective per-round stats: add captures + hold time per round to
-- player_gun_stats (the per-round read-model the armory merges onto its rows).
-- =============================================================================
alter table public.player_gun_stats
  add column if not exists total_captures      integer,
  add column if not exists total_hold_seconds  numeric,
  add column if not exists captures_per_round   numeric,
  add column if not exists hold_per_round       numeric;

create or replace function public.refresh_player_gun_stats()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_gun_stats where true;
  insert into public.player_gun_stats (
    account_id, nickname, profile_pic_url, gun_name, games, rounds, total_kills, total_deaths, total_hits,
    total_shots, total_damage, kills_per_round, damage_per_round, avg_accuracy, avg_kd,
    total_captures, total_hold_seconds, captures_per_round, hold_per_round, updated_at)
  select
    mpa.account_id, a.ops_tag, a.profile_pic_url, mpa.gun_used,
    count(*), sum(m.round_count),
    sum(mpa.frags), sum(mpa.deaths), sum(mpa.hits), sum(mpa.shots), sum(mpa.damage),
    round(sum(mpa.frags)::numeric / nullif(sum(m.round_count),0), 3),
    round(sum(mpa.damage)         / nullif(sum(m.round_count),0), 2),
    round(avg(mpa.accuracy), 4), round(avg(mpa.kd), 3),
    sum(coalesce(mpa.captures,0)), sum(coalesce(mpa.hold_seconds,0)),
    round(sum(coalesce(mpa.captures,0))::numeric / nullif(sum(m.round_count),0), 3),
    round(sum(coalesce(mpa.hold_seconds,0))      / nullif(sum(m.round_count),0), 2),
    now()
  from public.match_player_aggregate mpa
  join public.matches m on mpa.match_id = m.id
  join public.accounts a on a.id = mpa.account_id
  where mpa.account_id is not null and coalesce(trim(mpa.gun_used),'') <> ''
  group by mpa.account_id, a.ops_tag, a.profile_pic_url, mpa.gun_used;
  get diagnostics n = row_count; return n;
end;
$$;

select public.refresh_player_gun_stats();
