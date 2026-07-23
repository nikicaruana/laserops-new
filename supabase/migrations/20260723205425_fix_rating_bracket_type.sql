-- =============================================================================
-- Fix: rating_bracket must accept double precision (percent_rank() returns float8)
-- =============================================================================
-- The original signature took numeric; Postgres won't implicitly cast the
-- double-precision output of percent_rank() to numeric during function
-- resolution, so refresh_player_ratings() couldn't find it. Swap to float8.
-- =============================================================================

drop function if exists public.rating_bracket(numeric);

create or replace function public.rating_bracket(pr double precision)
returns integer language sql stable as $$
  select stars::int from public.rating_brackets
  where operator_id = '00000000-0000-0000-0000-000000000001'
    and min_percentile is not null and min_percentile <= pr
  order by min_percentile desc limit 1;
$$;
