-- =============================================================================
-- Allow the trusted service role to run the career rollup chain (for the launch
-- full recompute as a script). recompute_match_progression / recompute_read_models
-- / rollup_match_careers now accept service_role in addition to admins; non-admin
-- users are still rejected. Bodies are unchanged except the guard.
-- =============================================================================

create or replace function public.recompute_match_progression()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.role() <> 'service_role' then raise exception 'Admins only.'; end if;

  with ordered as (
    select
      mpa.id,
      coalesce(mpa.account_id, mpa.id) as chain_key,
      coalesce(mpa.xp_total, 0)        as xp,
      coalesce(m.played_on, m.scheduled_at::date, m.created_at::date, date '1970-01-01') as d,
      coalesce(m.sequence_no, 0)       as seq
    from public.match_player_aggregate mpa
    join public.matches m on m.id = mpa.match_id
  ),
  running as (
    select
      id, xp,
      coalesce(sum(xp) over (partition by chain_key order by d, seq
                             rows between unbounded preceding and 1 preceding), 0) as xp_before,
      sum(xp) over (partition by chain_key order by d, seq
                    rows between unbounded preceding and current row)             as xp_after
    from ordered
  ),
  levelled as (
    select
      r.id, r.xp_before, r.xp_after,
      (select max(rl.level) from public.rank_levels rl where rl.score_threshold <= r.xp_before) as lvl_before,
      (select max(rl.level) from public.rank_levels rl where rl.score_threshold <= r.xp_after)  as lvl_after
    from running r
  ),
  computed as (
    select
      l.id, l.xp_before, l.xp_after,
      coalesce(l.lvl_before, 1) as level_before,
      coalesce(l.lvl_after, 1)  as level_after,
      (select rl.score_threshold from public.rank_levels rl where rl.level = coalesce(l.lvl_before, 1)) as min_before,
      (select rl.score_threshold from public.rank_levels rl where rl.level = coalesce(l.lvl_before, 1) + 1) as next_min
    from levelled l
  )
  update public.match_player_aggregate mpa set
    xp_total_before_match         = c.xp_before,
    xp_total_after_match          = c.xp_after,
    level_before                  = c.level_before,
    level_after                   = c.level_after,
    xp_level_min_before_match     = c.min_before,
    xp_next_level_min_before_match = c.next_min,
    xp_level_progress_start = case when c.next_min is null or c.next_min = c.min_before then 1
                                   else least(1, greatest(0, (c.xp_before - c.min_before)::numeric / (c.next_min - c.min_before))) end,
    xp_level_progress_end   = case when c.level_after > c.level_before then 1
                                   when c.next_min is null or c.next_min = c.min_before then 1
                                   else least(1, greatest(0, (c.xp_after - c.min_before)::numeric / (c.next_min - c.min_before))) end,
    xp_level_up_in_match    = (c.level_after > c.level_before)
  from computed c
  where c.id = mpa.id;
end;
$$;

create or replace function public.recompute_read_models()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_life integer; c_period integer; c_gun integer; c_rating integer; c_stand integer;
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

  r := jsonb_build_object(
    'lifetime', c_life, 'period', c_period, 'gun_stats', c_gun,
    'ratings', c_rating, 'standings', c_stand
  );

  update public.read_model_status
    set last_recomputed_at = now(), last_result = r, updated_at = now()
    where operator_id = '00000000-0000-0000-0000-000000000001';

  return r;
end;
$$;

create or replace function public.rollup_match_careers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.role() <> 'service_role' then raise exception 'Admins only.'; end if;
  perform public.recompute_match_progression();
  perform public.recompute_read_models();
end;
$$;
