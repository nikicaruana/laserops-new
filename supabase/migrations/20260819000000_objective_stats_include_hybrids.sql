-- Objective (capture/hold) stats must include HYBRID matches: a game scored
-- offline can still have online rounds (online_round_count > 0) that carry
-- captures + hold time. The old refresh used is_online = (scoring_mode='online'),
-- which dropped hybrids' objective data (e.g. JRilez's captures in LO-2026-28/32).
-- Fix: is_online = online_round_count > 0, and scope online rounds + the
-- objective-per-round divisor to online_round_count (the online portion).
create or replace function public.refresh_player_stats_lifetime()
returns integer language plpgsql
security definer set search_path = public as $$
declare n integer;
begin
  delete from public.player_stats_lifetime where true;
  insert into public.player_stats_lifetime (
    account_id, nickname, profile_pic_url, games, rounds, wins, losses, win_rate,
    total_kills, total_deaths, total_hits, total_shots, total_wounds, total_damage, total_score,
    kills_per_round, deaths_per_round, damage_per_round, score_per_round,
    avg_accuracy, avg_kd, avg_match_rating, current_elo, current_level, total_xp,
    rounds_won, rounds_lost,
    online_games, online_rounds, total_captures, total_hold_seconds, obj1_per_round, obj2_per_round,
    updated_at)
  select
    x.account_id, x.ops_tag, x.profile_pic_url, count(*), sum(x.round_count),
    count(*) filter (where x.was_winner), count(*) filter (where x.was_winner is not true),
    round(count(*) filter (where x.was_winner)::numeric / nullif(count(*),0), 4),
    sum(x.frags), sum(x.deaths), sum(x.hits), sum(x.shots), sum(x.wounds), sum(x.damage), sum(x.score),
    round(sum(x.frags)::numeric  / nullif(sum(x.round_count),0), 3),
    round(sum(x.deaths)::numeric / nullif(sum(x.round_count),0), 3),
    round(sum(x.damage)          / nullif(sum(x.round_count),0), 2),
    round(sum(x.score)           / nullif(sum(x.round_count),0), 2),
    round(avg(x.accuracy), 4), round(avg(x.kd), 3), round(avg(x.match_rating), 2),
    (array_agg(x.elo_after   order by x.played_on desc nulls last, x.sequence_no desc))[1],
    (array_agg(x.level_after order by x.played_on desc nulls last, x.sequence_no desc))[1],
    sum(x.xp_total), sum(x.rounds_won), sum(x.rounds_lost),
    count(*) filter (where x.is_online),
    coalesce(sum(x.online_round_count) filter (where x.is_online), 0),
    sum(x.captures)     filter (where x.is_online),
    sum(x.hold_seconds) filter (where x.is_online),
    round(sum(x.slot1_value) filter (where x.is_online) / nullif(sum(x.online_round_count) filter (where x.is_online), 0), 3),
    round(sum(x.slot2_value) filter (where x.is_online) / nullif(sum(x.online_round_count) filter (where x.is_online), 0), 3),
    now()
  from (
    select mpa.account_id, a.ops_tag, a.profile_pic_url,
           mpa.was_winner, mpa.frags, mpa.deaths, mpa.hits, mpa.shots, mpa.wounds, mpa.damage, mpa.score,
           mpa.accuracy, mpa.kd, mpa.match_rating, mpa.elo_after, mpa.level_after, mpa.xp_total,
           mpa.rounds_won, mpa.rounds_lost, mpa.captures, mpa.hold_seconds,
           m.round_count, m.played_on, m.sequence_no,
           coalesce(m.online_round_count, 0) as online_round_count,
           (coalesce(m.online_round_count, 0) > 0) as is_online,
           case gm.obj_slot1_stat
             when 'captures'     then coalesce(mpa.captures, 0)::numeric
             when 'hold_seconds' then coalesce(mpa.hold_seconds, 0)
             else 0 end as slot1_value,
           case gm.obj_slot2_stat
             when 'captures'     then coalesce(mpa.captures, 0)::numeric
             when 'hold_seconds' then coalesce(mpa.hold_seconds, 0)
             else 0 end as slot2_value
    from public.match_player_aggregate mpa
    join public.matches m on mpa.match_id = m.id
    join public.accounts a on a.id = mpa.account_id
    left join public.game_modes gm on gm.slug = m.mode_slug
    where mpa.account_id is not null
  ) x
  group by x.account_id, x.ops_tag, x.profile_pic_url;
  get diagnostics n = row_count; return n;
end;
$$;
