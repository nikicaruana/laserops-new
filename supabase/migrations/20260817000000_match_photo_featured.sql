-- Homepage curation flag for match photos.
-- An admin "stars" a photo (MatchPhotosManager) to feature it on the homepage
-- "LaserOps in Action" strip (GalleryPreview reads featured_home). Also part of
-- the gallery rebuild that sources /gallery from match_photos.
alter table public.match_photos
  add column if not exists featured_home boolean not null default false;

create index if not exists match_photos_featured_home_idx
  on public.match_photos (featured_home) where featured_home;
