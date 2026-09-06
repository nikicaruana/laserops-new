-- =============================================================================
-- Publish Scores – Phase 2 (career rollup): back-fill the per-match XP / level
-- progression columns on match_player_aggregate. Level, XP-before/after are
-- SEQUENTIAL across each account's match history, so we recompute the whole
-- chain in chronological order (a running XP total per account → level via the
-- rank_levels thresholds). Re-runnable after every publish / edit; that's what
-- keeps re-published matches and reassigned walk-ins consistent.
--
-- Rows with no account (unassigned walk-ins) are chained individually (each is
-- its own one-match career) so their report card still shows sensible values.
-- ELO (elo_before/change/after) is a fast-follow and slots into this same
-- routine; left untouched here.
-- =============================================================================
create or replace function public.recompute_match_progression()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;

  with ordered as (
    select
      mpa.id,
      -- Chain per account; each unassigned row (null account) is its own chain.
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

grant execute on function public.recompute_match_progression() to authenticated;

-- One call the publish / edit routes use: recompute the progression chain, then
-- rebuild the read models (lifetime stats, ratings, hall of fame) and grant any
-- newly-earned level rewards (idempotent via its own watermark).
create or replace function public.rollup_match_careers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public.recompute_match_progression();
  perform public.recompute_read_models();
end;
$$;

grant execute on function public.rollup_match_careers() to authenticated;
