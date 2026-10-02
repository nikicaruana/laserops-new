-- =============================================================================
-- Login-aware hero CTAs (2026-10-02): the hero shows one pair of buttons to
-- signed-out visitors and a different pair to signed-in players. The existing
-- cta_* columns are the signed-out pair; add a signed-in pair, defaulting to
-- "Join a Game" / "View Stats". admin_set_home_config grows to write all four.
-- =============================================================================
alter table public.home_config
  add column if not exists cta_in_primary_label   text not null default 'Join a Game',
  add column if not exists cta_in_primary_href    text not null default '/player-portal/games',
  add column if not exists cta_in_secondary_label text not null default 'View Stats',
  add column if not exists cta_in_secondary_href  text not null default '/player-portal/player-stats';

-- Replace the setter with the 20-arg version (drop the old 16-arg signature so
-- there is no ambiguous overload).
drop function if exists public.admin_set_home_config(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text
);

create or replace function public.admin_set_home_config(
  p_hero_lead text,
  p_hero_highlight text,
  p_hero_subhead text,
  p_hero_rating text,
  p_hero_reviews_label text,
  p_hero_reviews_url text,
  p_cta_primary_label text,
  p_cta_primary_href text,
  p_cta_secondary_label text,
  p_cta_secondary_href text,
  p_cta_in_primary_label text,
  p_cta_in_primary_href text,
  p_cta_in_secondary_label text,
  p_cta_in_secondary_href text,
  p_stat1_value text, p_stat1_label text,
  p_stat2_value text, p_stat2_label text,
  p_stat3_value text, p_stat3_label text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.home_config set
    hero_lead              = coalesce(nullif(btrim(p_hero_lead), ''), hero_lead),
    hero_highlight         = coalesce(nullif(btrim(p_hero_highlight), ''), hero_highlight),
    hero_subhead           = coalesce(nullif(btrim(p_hero_subhead), ''), hero_subhead),
    hero_rating            = coalesce(nullif(btrim(p_hero_rating), ''), hero_rating),
    hero_reviews_label     = coalesce(nullif(btrim(p_hero_reviews_label), ''), hero_reviews_label),
    hero_reviews_url       = coalesce(nullif(btrim(p_hero_reviews_url), ''), hero_reviews_url),
    cta_primary_label      = coalesce(nullif(btrim(p_cta_primary_label), ''), cta_primary_label),
    cta_primary_href       = coalesce(nullif(btrim(p_cta_primary_href), ''), cta_primary_href),
    cta_secondary_label    = coalesce(nullif(btrim(p_cta_secondary_label), ''), cta_secondary_label),
    cta_secondary_href     = coalesce(nullif(btrim(p_cta_secondary_href), ''), cta_secondary_href),
    cta_in_primary_label   = coalesce(nullif(btrim(p_cta_in_primary_label), ''), cta_in_primary_label),
    cta_in_primary_href    = coalesce(nullif(btrim(p_cta_in_primary_href), ''), cta_in_primary_href),
    cta_in_secondary_label = coalesce(nullif(btrim(p_cta_in_secondary_label), ''), cta_in_secondary_label),
    cta_in_secondary_href  = coalesce(nullif(btrim(p_cta_in_secondary_href), ''), cta_in_secondary_href),
    stat1_value            = coalesce(nullif(btrim(p_stat1_value), ''), stat1_value),
    stat1_label            = coalesce(nullif(btrim(p_stat1_label), ''), stat1_label),
    stat2_value            = coalesce(nullif(btrim(p_stat2_value), ''), stat2_value),
    stat2_label            = coalesce(nullif(btrim(p_stat2_label), ''), stat2_label),
    stat3_value            = coalesce(nullif(btrim(p_stat3_value), ''), stat3_value),
    stat3_label            = coalesce(nullif(btrim(p_stat3_label), ''), stat3_label),
    updated_at             = now()
  where id = 1;
end;
$$;
grant execute on function public.admin_set_home_config(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text
) to authenticated;
