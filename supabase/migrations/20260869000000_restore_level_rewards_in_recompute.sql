-- =============================================================================
-- REGRESSION FIX: level-up XP boosts / token rewards stopped being granted.
--
-- 20260801260000 hooked grant_level_rewards() into recompute_read_models so
-- newly-completed level rewards (XP boosts, milestone tokens) are awarded on each
-- recompute/publish. When 20260836000000 added the armory refresh, it recreated
-- recompute_read_models WITHOUT the grant_level_rewards() call - so since then no
-- one has received their level-up rewards (e.g. Jens: level 11, owed the level-10
-- Double XP boost, last_rewarded_level stuck at 9).
--
-- Restore the call (keeping the armory refresh) and backfill every owed reward
-- now. grant_level_rewards is idempotent: it only grants levels above each
-- player's last_rewarded_level, so re-running never double-grants.
-- =============================================================================
create or replace function public.recompute_read_models()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_life integer; c_period integer; c_gun integer; c_rating integer; c_stand integer; c_armory integer; c_rewards integer;
  r jsonb;
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  c_life    := public.refresh_player_stats_lifetime();
  c_period  := public.refresh_leaderboard_period_stats();
  c_gun     := public.refresh_player_gun_stats();
  c_rating  := public.refresh_player_ratings();
  c_stand   := public.refresh_season_challenge_standings();
  c_armory  := public.refresh_player_armory();
  c_rewards := public.grant_level_rewards();  -- award newly-completed level rewards (was dropped in 20260836000000)

  r := jsonb_build_object(
    'lifetime', c_life, 'period', c_period, 'gun_stats', c_gun,
    'ratings', c_rating, 'standings', c_stand, 'armory', c_armory, 'level_rewards', c_rewards
  );

  update public.read_model_status
    set last_recomputed_at = now(), last_result = r, updated_at = now()
    where operator_id = '00000000-0000-0000-0000-000000000001';

  return r;
end;
$$;
grant execute on function public.recompute_read_models() to authenticated;

-- Backfill all rewards that were owed while the grant step was missing.
select public.grant_level_rewards();
