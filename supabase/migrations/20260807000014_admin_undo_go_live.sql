-- =============================================================================
-- admin_undo_go_live — revert an accidentally-started match back to confirmed.
-- =============================================================================
-- Human-error recovery: if an admin starts the WRONG match (or too early), this
-- puts it back to 'confirmed' and clears the join code + went_live_at, so the
-- auto go-live (30 min before start) still runs at the right time.
--
-- Safety: only allowed while the match is 'live' AND nothing has actually been
-- played yet — no ingested rounds and no committed aggregates. A genuinely live
-- game (data already flowing) must be ended with Complete or End early instead.
--
-- Not money-moving, so no 2FA gate (unlike complete/cancel/end-early). The
-- already-sent "game is live" notifications cannot be recalled.
-- =============================================================================

create or replace function public.admin_undo_go_live(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record;
  n_rounds int;
  n_aggs int;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;

  select id, status into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status <> 'live' then raise exception 'Only a live match can be reverted to confirmed.'; end if;

  select count(*) into n_rounds from public.match_ingest_rounds where match_id = p_match_id;
  select count(*) into n_aggs   from public.match_player_aggregate where match_id = p_match_id;
  if n_rounds > 0 or n_aggs > 0 then
    raise exception 'This match already has game data — it cannot be reverted. Use Complete or End early instead.';
  end if;

  update public.matches
    set status = 'confirmed', entry_code = null, went_live_at = null
    where id = p_match_id and status = 'live';
end;
$$;

grant execute on function public.admin_undo_go_live(uuid) to authenticated;
