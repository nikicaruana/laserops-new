-- =============================================================================
-- refresh_player_armory() -- recompute the Personal Armory per-gun stat columns
-- =============================================================================
-- BUG: player_armory was populated by a ONE-TIME sheet import (2026-07-30) and
-- was never recomputed, while matches + player_gun_stats kept ingesting. So the
-- Armory page (which reads player_armory) showed stale per-gun stats and missed
-- guns/games played after that snapshot (e.g. JRilez: SR-21 Ghost + AK-25
-- Predator rendered as never-used, MG21 undercounted).
--
-- Fix: recompute the per-gun PERFORMANCE columns from match_player_aggregate
-- (the source of truth, which has every field), preserving the catalogue /
-- unlock / image / display columns that came from the import. Wired into
-- recompute_read_models() so it refreshes on every publish/recompute like the
-- other read-models, and run once here to fix the current data.
--
-- Note: this UPDATES existing rows only. A gun that has no player_armory row at
-- all (e.g. added to the catalogue after the import) still needs the armory
-- import regenerated - tracked separately.
-- =============================================================================

create or replace function public.refresh_player_armory()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  -- Zero the per-gun performance columns first so guns no longer backed by data
  -- don't keep stale non-zero numbers. Only touch account-linked rows (unlinked
  -- rows can't be matched to aggregates).
  update public.player_armory
  set matches_used = 0, kills_total = 0, avg_kills = 0, deaths_total = 0,
      hits_total = 0, shots_total = 0, damage_total = 0, avg_damage = 0,
      score_total = 0, avg_score = 0, avg_accuracy = 0, kd_ratio = 0,
      wins_using_gun = 0, rounds_won_using_gun = 0, avg_match_rating = 0,
      has_used_gun = false
  where account_id is not null;

  with agg as (
    select mpa.account_id,
           lower(trim(mpa.gun_used)) as gun_key,
           count(*)                                   as matches_used,
           sum(coalesce(mpa.frags,0))                 as kills_total,
           sum(coalesce(mpa.deaths,0))                as deaths_total,
           sum(coalesce(mpa.hits,0))                  as hits_total,
           sum(coalesce(mpa.shots,0))                 as shots_total,
           sum(coalesce(mpa.damage,0))                as damage_total,
           sum(coalesce(mpa.score,0))                 as score_total,
           count(*) filter (where mpa.was_winner)     as wins_using_gun,
           sum(coalesce(mpa.rounds_won,0))            as rounds_won_using_gun,
           avg(mpa.match_rating)                      as avg_match_rating
    from public.match_player_aggregate mpa
    where mpa.account_id is not null and coalesce(trim(mpa.gun_used),'') <> ''
    group by mpa.account_id, lower(trim(mpa.gun_used))
  )
  update public.player_armory pa
  set matches_used         = a.matches_used,
      kills_total          = a.kills_total,
      deaths_total         = a.deaths_total,
      hits_total           = a.hits_total,
      shots_total          = a.shots_total,
      damage_total         = a.damage_total,
      score_total          = a.score_total,
      avg_kills            = a.kills_total::numeric  / nullif(a.matches_used,0),
      avg_damage           = a.damage_total          / nullif(a.matches_used,0),
      avg_score            = a.score_total           / nullif(a.matches_used,0),
      avg_accuracy         = a.hits_total::numeric   / nullif(a.shots_total,0),
      kd_ratio             = a.kills_total::numeric  / nullif(a.deaths_total,0),
      wins_using_gun       = a.wins_using_gun,
      rounds_won_using_gun = a.rounds_won_using_gun,
      avg_match_rating     = coalesce(a.avg_match_rating, 0),
      has_used_gun         = true,
      updated_at           = now()
  from agg a
  where pa.account_id = a.account_id
    and lower(trim(pa.gun_name)) = a.gun_key;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.refresh_player_armory() to authenticated, service_role;

-- Wire it into the standard recompute so the Armory stays fresh going forward.
create or replace function public.recompute_read_models()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_life integer; c_period integer; c_gun integer; c_rating integer; c_stand integer; c_armory integer;
  r jsonb;
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  c_life   := public.refresh_player_stats_lifetime();
  c_period := public.refresh_leaderboard_period_stats();
  c_gun    := public.refresh_player_gun_stats();
  c_rating := public.refresh_player_ratings();
  c_stand  := public.refresh_season_challenge_standings();
  c_armory := public.refresh_player_armory();

  r := jsonb_build_object(
    'lifetime', c_life, 'period', c_period, 'gun_stats', c_gun,
    'ratings', c_rating, 'standings', c_stand, 'armory', c_armory
  );

  update public.read_model_status
    set last_recomputed_at = now(), last_result = r, updated_at = now()
    where operator_id = '00000000-0000-0000-0000-000000000001';

  return r;
end;
$$;

-- Fix the current data immediately.
select public.refresh_player_armory();
