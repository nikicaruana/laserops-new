-- =============================================================================
-- Accuracy rating uses SUM-BASED total_hits/total_shots, not the mean of
-- per-game accuracies (same principle as the K/D fix in 20260853). Only the
-- elig CTE's avg_accuracy expression changes vs 20260853; K/D stays sum-based.
-- =============================================================================
create or replace function public.refresh_player_ratings()
returns integer language plpgsql
security definer set search_path = public as $$
declare op uuid := '00000000-0000-0000-0000-000000000001';
        min_level numeric; min_matches numeric; min_pool numeric; pool int; n int;
begin
  delete from public.player_ratings where true;
  select value into min_level   from public.rating_config where operator_id = op and key = 'Min_Level';
  select value into min_matches from public.rating_config where operator_id = op and key = 'Min_Matches';
  select value into min_pool    from public.rating_config where operator_id = op and key = 'Min_Eligible_Pool';

  select count(*) into pool from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(online_games,0) >= min_matches;
  if pool < min_pool then return 0; end if;

  insert into public.player_ratings
    (account_id, nickname, profile_pic_url, s_match_win, s_rounds_wl, s_kills, s_damage,
     s_accuracy, s_kd, s_match_rating, s_obj1, s_obj2, rating_raw, rating_overall)
  with w as (
    select max(value) filter (where key = 'Match_Win_Rating')       as w_win,
           max(value) filter (where key = 'Rounds_WL_Rating')       as w_rounds,
           max(value) filter (where key = 'Kills_Per_Match_Rating') as w_kills,
           max(value) filter (where key = 'Damage_Rating')          as w_damage,
           max(value) filter (where key = 'Accuracy_Rating')        as w_acc,
           max(value) filter (where key = 'KD_Rating')              as w_kd,
           max(value) filter (where key = 'Match_Rating_Rating')    as w_match,
           max(value) filter (where key = 'Objective_1_Rating')     as w_obj1,
           max(value) filter (where key = 'Objective_2_Rating')     as w_obj2
    from public.rating_config where operator_id = op
  ),
  elig as (
    select account_id, win_rate,
           coalesce(rounds_won,0)::numeric / nullif(coalesce(rounds_won,0)+coalesce(rounds_lost,0),0) as rounds_wl,
           kills_per_round, damage_per_round,
           case when coalesce(total_shots,0) > 0 then coalesce(total_hits,0)::numeric / total_shots else 0 end as avg_accuracy,
           coalesce(total_kills,0)::numeric / greatest(coalesce(total_deaths,0), 1) as avg_kd,
           avg_match_rating,
           obj1_per_round, obj2_per_round
    from public.player_stats_lifetime
    where coalesce(current_level,0) >= min_level and coalesce(online_games,0) >= min_matches
  ),
  ranked as (
    select account_id,
      public.rating_bracket(percent_rank() over (order by win_rate))         as s_win,
      public.rating_bracket(percent_rank() over (order by rounds_wl))        as s_rounds,
      public.rating_bracket(percent_rank() over (order by kills_per_round))  as s_kills,
      public.rating_bracket(percent_rank() over (order by damage_per_round)) as s_damage,
      public.rating_bracket(percent_rank() over (order by avg_accuracy))     as s_acc,
      public.rating_bracket(percent_rank() over (order by avg_kd))           as s_kd,
      public.rating_bracket(percent_rank() over (order by avg_match_rating)) as s_match,
      public.rating_bracket(percent_rank() over (order by obj1_per_round))   as s_obj1,
      public.rating_bracket(percent_rank() over (order by obj2_per_round))   as s_obj2
    from elig
  ),
  scored as (
    select r.account_id,
           r.s_win, r.s_rounds, r.s_kills, r.s_damage, r.s_acc, r.s_kd, r.s_match, r.s_obj1, r.s_obj2,
           (r.s_win*w.w_win + r.s_rounds*w.w_rounds + r.s_kills*w.w_kills + r.s_damage*w.w_damage
          + r.s_acc*w.w_acc + r.s_kd*w.w_kd + r.s_match*w.w_match
          + coalesce(r.s_obj1,0)*coalesce(w.w_obj1,0)
          + coalesce(r.s_obj2,0)*coalesce(w.w_obj2,0)) as raw
    from ranked r cross join w
  )
  select s.account_id, a.ops_tag, a.profile_pic_url,
         s.s_win, s.s_rounds, s.s_kills, s.s_damage, s.s_acc, s.s_kd, s.s_match, s.s_obj1, s.s_obj2,
         round(s.raw, 3),
         public.rating_bracket(percent_rank() over (order by s.raw))
  from scored s
  join public.accounts a on a.id = s.account_id;
  get diagnostics n = row_count; return n;
end;
$$;

select public.refresh_player_ratings();
