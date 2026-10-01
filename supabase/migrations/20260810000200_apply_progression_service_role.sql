-- =============================================================================
-- Allow the trusted service role (server-only, never a user) to call
-- apply_match_progression, so the launch full recompute can run as a script
-- (recomputeProgression). Admin users still allowed; anon/authenticated non-admins
-- are still rejected. Body unchanged except the guard.
-- =============================================================================
create or replace function public.apply_match_progression(rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    raise exception 'Admins only.';
  end if;
  update public.match_player_aggregate mpa set
    xp_from_points                 = coalesce((r->>'xp_from_points')::integer, mpa.xp_from_points),
    xp_from_wins                   = coalesce((r->>'xp_from_wins')::integer, mpa.xp_from_wins),
    xp_from_accolades              = coalesce((r->>'xp_from_accolades')::integer, mpa.xp_from_accolades),
    xp_total                       = coalesce((r->>'xp_total')::integer, mpa.xp_total),
    match_rating                   = coalesce((r->>'match_rating')::numeric, mpa.match_rating),
    match_average_score            = coalesce((r->>'match_average_score')::numeric, mpa.match_average_score),
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
