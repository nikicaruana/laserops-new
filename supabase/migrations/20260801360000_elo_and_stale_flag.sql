-- =============================================================================
-- ELO + "results out of date" flag.
--   * matches.results_stale_at — set whenever a SCORED match's roster changes
--     (a player reassigned/added/removed), because Elo depends on who was in the
--     match. An admin clears it by recomputing.
--   * apply_match_progression(jsonb) — bulk-writes the XP/level/Elo progression
--     columns computed in TS (lib/ingestion/progression.ts).
--   * rollup_match_careers() — now: rebuild read-models, then mark every scored
--     match fresh (clear the stale flag, stamp elo_calculated_at). The XP/level/
--     Elo back-fill itself is applied by apply_match_progression before this.
-- =============================================================================
alter table public.matches add column if not exists results_stale_at timestamptz;

-- Flag a scored match's results stale when its roster changes.
create or replace function public.flag_match_results_stale()
returns trigger language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  mid := coalesce(new.match_id, old.match_id);
  update public.matches
     set results_stale_at = now()
   where id = mid and xp_distributed_at is not null and results_stale_at is null;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_flag_results_stale on public.match_participants;
create trigger trg_flag_results_stale
  after insert or update or delete on public.match_participants
  for each row execute function public.flag_match_results_stale();

-- Bulk-apply the computed progression rows (one round trip).
create or replace function public.apply_match_progression(rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.match_player_aggregate mpa set
    xp_total_before_match          = (r->>'xp_total_before_match')::numeric,
    xp_total_after_match           = (r->>'xp_total_after_match')::numeric,
    level_before                   = (r->>'level_before')::int,
    level_after                    = (r->>'level_after')::int,
    xp_level_min_before_match      = (r->>'xp_level_min_before_match')::numeric,
    xp_next_level_min_before_match = (r->>'xp_next_level_min_before_match')::numeric,
    xp_level_progress_start        = (r->>'xp_level_progress_start')::numeric,
    xp_level_progress_end          = (r->>'xp_level_progress_end')::numeric,
    xp_level_up_in_match           = (r->>'xp_level_up_in_match')::boolean,
    elo_before                     = (r->>'elo_before')::numeric,
    elo_change                     = (r->>'elo_change')::numeric,
    elo_after                      = (r->>'elo_after')::numeric
  from jsonb_array_elements(rows) as r
  where mpa.id = (r->>'id')::uuid;
end;
$$;
grant execute on function public.apply_match_progression(jsonb) to authenticated;

-- Finalize: rebuild read-models (lifetime/ratings/HoF + idempotent level rewards)
-- then mark every scored match's results fresh.
create or replace function public.rollup_match_careers()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public.recompute_read_models();
  update public.matches
     set results_stale_at = null, elo_calculated_at = now()
   where xp_distributed_at is not null;
end;
$$;
grant execute on function public.rollup_match_careers() to authenticated;
