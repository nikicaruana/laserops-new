-- Squad leaderboard, revised: profile thumbnail + rank badge, per-round metrics,
-- ROUND win rate (not match), and no star rating. Return type changes -> drop.
drop function if exists public.squad_leaderboard(uuid);
create or replace function public.squad_leaderboard(p_squad_id uuid)
returns table (
  account_id       uuid,
  ops_tag          text,
  profile_pic_url  text,
  level            integer,
  rank_badge_url   text,
  games            integer,
  round_win_rate   numeric,
  kills_per_round  numeric,
  kd               numeric,
  accuracy         numeric,
  damage_per_round numeric,
  score_per_round  numeric,
  elo              numeric,
  xp               integer
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_squad(p_squad_id) then
    raise exception 'Not allowed.';
  end if;
  return query
    select sm.account_id, a.ops_tag, a.profile_pic_url, s.current_level, rl.badge_url,
           s.games,
           case when coalesce(s.rounds_won, 0) + coalesce(s.rounds_lost, 0) > 0
                then s.rounds_won::numeric / (s.rounds_won + s.rounds_lost) end,
           s.kills_per_round, s.avg_kd, s.avg_accuracy, s.damage_per_round, s.score_per_round,
           s.current_elo, s.total_xp
    from public.squad_members sm
    join public.accounts a on a.id = sm.account_id
    left join public.player_stats_lifetime s on s.account_id = sm.account_id
    left join public.rank_levels rl on rl.level = s.current_level
    where sm.squad_id = p_squad_id
    order by s.score_per_round desc nulls last;
end;
$$;
grant execute on function public.squad_leaderboard(uuid) to authenticated;
