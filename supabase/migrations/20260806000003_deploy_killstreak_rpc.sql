-- =============================================================================
-- deploy_killstreak() — server-side enforced killstreak deploys
-- =============================================================================
-- Direct inserts into killstreak_deployments are now blocked for players; a
-- deploy must go through this SECURITY DEFINER RPC, which enforces:
--   * identity   — by_player is the CALLER's ops_tag (auth.uid() -> accounts),
--                  so a client can't deploy as someone else.
--   * live       — the match must be live with the feed enabled.
--   * earned     — the player must hold an unused charge: earned = count of the
--                  killstreak's unlock streak in this round's snapshot for the
--                  player; used = their deploys of it this round.
--   * anti-spam  — at most one deploy per player per 3 seconds.
-- Team + round + scope + duration are derived server-side (not trusted from the
-- client). The definer runs as owner, so it inserts past RLS; the player insert
-- policy is dropped so the only write path for players is this function.
-- =============================================================================

create or replace function public.deploy_killstreak(
  p_match_id uuid,
  p_killstreak_key text,
  p_base_ids integer[] default '{}'::integer[]
) returns public.killstreak_deployments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ops      text;
  v_team     text;
  v_def      public.killstreak_definitions%rowtype;
  v_round    integer;
  v_snapshot jsonb;
  v_earned   integer;
  v_used     integer;
  v_last     timestamptz;
  v_row      public.killstreak_deployments;
  v_match    record;
begin
  -- Caller identity (never trust a client-supplied player name).
  select ops_tag into v_ops from public.accounts where auth_user_id = auth.uid();
  if v_ops is null or v_ops = '' then raise exception 'Not signed in.'; end if;

  -- Match must be live with the feed on.
  select id, status, live_feed_enabled into v_match from public.matches where id = p_match_id;
  if v_match.id is null or v_match.status <> 'live' or coalesce(v_match.live_feed_enabled, false) = false then
    raise exception 'This match is not live.';
  end if;

  -- Killstreak definition.
  select * into v_def from public.killstreak_definitions where key = p_killstreak_key and is_active = true;
  if v_def.key is null then raise exception 'Unknown killstreak.'; end if;
  if v_def.unlock_streak_key is null then raise exception 'This killstreak has no unlock streak configured.'; end if;

  -- Current live snapshot for the round.
  select round_no, snapshot into v_round, v_snapshot from public.match_live_state where match_id = p_match_id;
  if v_snapshot is null then raise exception 'No live round yet.'; end if;

  -- Player's team from the snapshot (also proves they're in this round).
  select s->>'team' into v_team
  from jsonb_array_elements(coalesce(v_snapshot->'stats', '[]'::jsonb)) s
  where s->>'name' = v_ops
  limit 1;
  if v_team is null then raise exception 'You are not in this round.'; end if;

  -- Earned charges = the unlock streak's occurrences for this player this round.
  select count(*) into v_earned
  from jsonb_array_elements(coalesce(v_snapshot->'streaksByPlayer'->v_ops, '[]'::jsonb)) e
  where e->>'key' = v_def.unlock_streak_key;

  -- Used this round.
  select count(*) into v_used
  from public.killstreak_deployments d
  where d.match_id = p_match_id and d.round_no = v_round and d.by_player = v_ops and d.killstreak_key = p_killstreak_key;

  if v_earned - v_used <= 0 then
    raise exception 'No % charge available.', v_def.name;
  end if;

  -- Anti-spam: one deploy per player per 3 seconds.
  select max(started_at) into v_last from public.killstreak_deployments where match_id = p_match_id and by_player = v_ops;
  if v_last is not null and v_last > now() - interval '3 seconds' then
    raise exception 'Deploying too fast — wait a moment.';
  end if;

  insert into public.killstreak_deployments
    (match_id, round_no, killstreak_key, by_player, by_team, scope, base_ids, started_at, expires_at)
  values
    (p_match_id, v_round, p_killstreak_key, v_ops, v_team, v_def.scope,
     case when v_def.scope = 'all' then '{}'::integer[] else coalesce(p_base_ids, '{}'::integer[]) end,
     now(), now() + make_interval(secs => v_def.duration_seconds))
  returning * into v_row;

  return v_row;
end;
$$;

-- Players call the RPC; only it may write on their behalf.
revoke all on function public.deploy_killstreak(uuid, text, integer[]) from public;
grant execute on function public.deploy_killstreak(uuid, text, integer[]) to authenticated;

-- Remove the open player-insert path: deploys now only go through the RPC (the
-- admin_manage + public_read policies stay for cleanup + reads).
drop policy if exists killstreak_deployments_player_insert on public.killstreak_deployments;
