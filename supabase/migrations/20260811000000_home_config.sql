-- =============================================================================
-- Homepage content config (2026-10-02): a single row driving the home hero
-- section (headline, subhead, Google-reviews badge, the two CTAs, and the three
-- stat tiles). Read anon via the cookieless public client so the homepage stays
-- static / ISR; edited from /admin/homepage. First step of moving the homepage
-- off Google Sheets into Supabase (more homepage areas to follow).
-- =============================================================================
create table if not exists public.home_config (
  id                   integer primary key default 1 check (id = 1),
  hero_lead            text not null default 'Malta''s Ultimate Outdoor Laser Tag Experience.',
  hero_highlight       text not null default 'Built for Competition.',
  hero_subhead         text not null default 'Tactical missions, different scenarios, and Malta''s only persistent stat and progressive unlock system. LaserOps is changing the game.',
  hero_rating          text not null default '5.0',
  hero_reviews_label   text not null default 'on Google Reviews',
  hero_reviews_url     text not null default 'https://www.google.com/maps/place/LaserOps+Malta/@35.9351506,14.0734794,11z/data=!4m12!1m2!2m1!1slaserops+malta!3m8!1s0x130e4ddaeadfe003:0xda30f052e79ffef8!8m2!3d35.9351506!4d14.37835!9m1!1b1!15sCg5sYXNlcm9wcyBtYWx0YVoQIg5sYXNlcm9wcyBtYWx0YZIBGm91dGRvb3JfYWN0aXZpdHlfb3JnYW5pemVymgFEQ2k5RFFVbFJRVU52WkVOb2RIbGpSamx2VDJwc2EyUkZSa3haYm1SYVpVaENTbVZHYkZWV1JscHlWVWRXTlZSSVl4QULgAQD6AQQIQBA6!16s%2Fg%2F11z6lk5clw!5m2!1e4!1e1?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D',
  cta_primary_label    text not null default 'Book a Game',
  cta_primary_href     text not null default '/booking',
  cta_secondary_label  text not null default 'Create your free profile',
  cta_secondary_href   text not null default '/player-portal/login',
  stat1_value          text not null default '15+',
  stat1_label          text not null default 'Weapons',
  stat2_value          text not null default '6+',
  stat2_label          text not null default 'Game Modes',
  stat3_value          text not null default 'Outdoor',
  stat3_label          text not null default 'Real Terrain',
  updated_at           timestamptz not null default now()
);
insert into public.home_config (id) values (1) on conflict (id) do nothing;

alter table public.home_config enable row level security;
drop policy if exists home_config_read on public.home_config;
create policy home_config_read on public.home_config for select to anon, authenticated using (true);
drop policy if exists home_config_admin on public.home_config;
create policy home_config_admin on public.home_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.home_config to anon, authenticated;
grant select, insert, update, delete on public.home_config to authenticated;

-- Admin setter: writes the whole hero in one call. Blanks fall back to the
-- column default (keeps the homepage from rendering an empty headline/CTA).
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
  p_stat1_value text, p_stat1_label text,
  p_stat2_value text, p_stat2_label text,
  p_stat3_value text, p_stat3_label text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.home_config set
    hero_lead           = coalesce(nullif(btrim(p_hero_lead), ''), hero_lead),
    hero_highlight      = coalesce(nullif(btrim(p_hero_highlight), ''), hero_highlight),
    hero_subhead        = coalesce(nullif(btrim(p_hero_subhead), ''), hero_subhead),
    hero_rating         = coalesce(nullif(btrim(p_hero_rating), ''), hero_rating),
    hero_reviews_label  = coalesce(nullif(btrim(p_hero_reviews_label), ''), hero_reviews_label),
    hero_reviews_url    = coalesce(nullif(btrim(p_hero_reviews_url), ''), hero_reviews_url),
    cta_primary_label   = coalesce(nullif(btrim(p_cta_primary_label), ''), cta_primary_label),
    cta_primary_href    = coalesce(nullif(btrim(p_cta_primary_href), ''), cta_primary_href),
    cta_secondary_label = coalesce(nullif(btrim(p_cta_secondary_label), ''), cta_secondary_label),
    cta_secondary_href  = coalesce(nullif(btrim(p_cta_secondary_href), ''), cta_secondary_href),
    stat1_value         = coalesce(nullif(btrim(p_stat1_value), ''), stat1_value),
    stat1_label         = coalesce(nullif(btrim(p_stat1_label), ''), stat1_label),
    stat2_value         = coalesce(nullif(btrim(p_stat2_value), ''), stat2_value),
    stat2_label         = coalesce(nullif(btrim(p_stat2_label), ''), stat2_label),
    stat3_value         = coalesce(nullif(btrim(p_stat3_value), ''), stat3_value),
    stat3_label         = coalesce(nullif(btrim(p_stat3_label), ''), stat3_label),
    updated_at          = now()
  where id = 1;
end;
$$;
grant execute on function public.admin_set_home_config(
  text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text
) to authenticated;
