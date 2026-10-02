-- =============================================================================
-- Homepage social proof CMS (2026-10-02): the Instagram posts + Google reviews
-- shown in the bottom GallerySection, moved off the Google Sheets CMS into
-- Supabase so admins can add / edit / reorder / remove them from /admin/homepage.
-- Public anon read (published rows only) via the cookieless client, so the
-- homepage stays static / ISR. Admin write via RLS (is_admin).
--
-- image_url holds whatever an <img src> accepts: a Cloudinary secure_url (new
-- admin uploads) OR a legacy local /public path (seeded from the old sheet).
-- =============================================================================

-- ---- Instagram / social posts ----------------------------------------------
create table if not exists public.home_social_posts (
  id            uuid primary key default gen_random_uuid(),
  post_url      text not null default '',
  image_url     text not null default '',
  caption       text not null default '',
  display_order integer not null default 0,
  status        text not null default 'published' check (status in ('published', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.home_social_posts enable row level security;
drop policy if exists home_social_posts_read on public.home_social_posts;
create policy home_social_posts_read on public.home_social_posts
  for select to anon, authenticated using (status = 'published');
drop policy if exists home_social_posts_admin on public.home_social_posts;
create policy home_social_posts_admin on public.home_social_posts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.home_social_posts to anon, authenticated;
grant select, insert, update, delete on public.home_social_posts to authenticated;

-- ---- Google reviews ---------------------------------------------------------
create table if not exists public.home_reviews (
  id            uuid primary key default gen_random_uuid(),
  reviewer_name text not null default '',
  rating        integer not null default 5 check (rating between 1 and 5),
  review_text   text not null default '',
  review_date   date,
  display_order integer not null default 0,
  status        text not null default 'published' check (status in ('published', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.home_reviews enable row level security;
drop policy if exists home_reviews_read on public.home_reviews;
create policy home_reviews_read on public.home_reviews
  for select to anon, authenticated using (status = 'published');
drop policy if exists home_reviews_admin on public.home_reviews;
create policy home_reviews_admin on public.home_reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.home_reviews to anon, authenticated;
grant select, insert, update, delete on public.home_reviews to authenticated;

-- Keep updated_at fresh on edits (both tables share one trigger function).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists home_social_posts_touch on public.home_social_posts;
create trigger home_social_posts_touch before update on public.home_social_posts
  for each row execute function public.touch_updated_at();
drop trigger if exists home_reviews_touch on public.home_reviews;
create trigger home_reviews_touch before update on public.home_reviews
  for each row execute function public.touch_updated_at();
