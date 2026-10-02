-- =============================================================================
-- Homepage featured photos CMS (2026-10-02): admin-selected photos for the
-- homepage "LaserOps in Action" strip (GalleryPreview), replacing the Cloudinary
-- `featured` tag. Each row is a Cloudinary image URL (pasted from the match /
-- gallery library, or uploaded) + optional caption + order. Public anon read via
-- the cookieless client (homepage stays static / ISR); admin write. When this
-- table is empty the homepage falls back to the old `featured` tag, so the switch
-- is safe and the tag is retired only once photos are chosen here.
-- =============================================================================
create table if not exists public.home_featured_photos (
  id            uuid primary key default gen_random_uuid(),
  image_url     text not null default '',
  caption       text not null default '',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.home_featured_photos enable row level security;
drop policy if exists home_featured_photos_read on public.home_featured_photos;
create policy home_featured_photos_read on public.home_featured_photos for select to anon, authenticated using (true);
drop policy if exists home_featured_photos_admin on public.home_featured_photos;
create policy home_featured_photos_admin on public.home_featured_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.home_featured_photos to anon, authenticated;
grant select, insert, update, delete on public.home_featured_photos to authenticated;
grant select, insert, update, delete on public.home_featured_photos to service_role;

drop trigger if exists home_featured_photos_touch on public.home_featured_photos;
create trigger home_featured_photos_touch before update on public.home_featured_photos
  for each row execute function public.touch_updated_at();
