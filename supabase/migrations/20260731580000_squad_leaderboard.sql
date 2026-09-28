-- Per-member lifetime stats for the squad Leaderboard tab (the same items as the
-- player summary). Definer + can_view_squad guard; stats join player_stats_lifetime
-- and player_ratings (null for members with no games yet).
create or replace function public.squad_leaderboard(p_squad_id uuid)
returns table (
  account_id uuid,
  ops_tag    text,
  level      integer,
  stars      integer,
  games      integer,
  win_rate   numeric,
  kills      integer,
  kd         numeric,
  accuracy   numeric,
  damage     numeric,
  score      numeric,
  xp         integer,
  elo        numeric
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_view_squad(p_squad_id) then
    raise exception 'Not allowed.';
  end if;
  return query
    select sm.account_id, a.ops_tag, s.current_level, pr.rating_overall,
           s.games, s.win_rate, s.total_kills, s.avg_kd, s.avg_accuracy,
           s.total_damage, s.total_score, s.total_xp, s.current_elo
    from public.squad_members sm
    join public.accounts a on a.id = sm.account_id
    left join public.player_stats_lifetime s on s.account_id = sm.account_id
    left join public.player_ratings pr on pr.account_id = sm.account_id
    where sm.squad_id = p_squad_id
    order by s.total_score desc nulls last;
end;
$$;
grant execute on function public.squad_leaderboard(uuid) to authenticated;
