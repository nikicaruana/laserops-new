-- =============================================================================
-- recompute_read_models() — one admin action to refresh all derived read-models
-- =============================================================================
-- Re-runs the five refresh_* functions in dependency order (lifetime before
-- ratings, which reads it) and records when + what. Used after importing games
-- or editing season/challenge/rating config. Admin-only. Does NOT re-score past
-- games (that's the separate scoring recompute) — it recomputes aggregates,
-- period stats, gun stats, ratings, and season standings from stored match data
-- + current config.
-- =============================================================================

create table if not exists public.read_model_status (
  operator_id        uuid primary key default '00000000-0000-0000-0000-000000000001'
                       references public.operators(id) on delete cascade,
  last_recomputed_at timestamptz,
  last_result        jsonb,
  updated_at         timestamptz not null default now()
);
insert into public.read_model_status (operator_id) values ('00000000-0000-0000-0000-000000000001')
  on conflict (operator_id) do nothing;

alter table public.read_model_status enable row level security;
drop policy if exists read_model_status_admin_read on public.read_model_status;
create policy read_model_status_admin_read on public.read_model_status
  for select to authenticated using (public.is_admin());
grant select on public.read_model_status to authenticated;

create or replace function public.recompute_read_models()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_life integer; c_period integer; c_gun integer; c_rating integer; c_stand integer;
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  -- Order matters: ratings reads player_stats_lifetime.
  c_life   := public.refresh_player_stats_lifetime();
  c_period := public.refresh_leaderboard_period_stats();
  c_gun    := public.refresh_player_gun_stats();
  c_rating := public.refresh_player_ratings();
  c_stand  := public.refresh_season_challenge_standings();

  r := jsonb_build_object(
    'lifetime', c_life, 'period', c_period, 'gun_stats', c_gun,
    'ratings', c_rating, 'standings', c_stand
  );

  update public.read_model_status
    set last_recomputed_at = now(), last_result = r, updated_at = now()
    where operator_id = '00000000-0000-0000-0000-000000000001';

  return r;
end;
$$;

grant execute on function public.recompute_read_models() to authenticated;
