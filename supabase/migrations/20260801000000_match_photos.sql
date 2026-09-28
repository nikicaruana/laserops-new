-- 20260801000000_match_photos.sql
-- --------------------------------------------------------------------
-- Gallery photos linked to a match. Photos still live on Cloudinary; this
-- table stores the link (Cloudinary id/url + match) plus caption/dimensions.
-- A companion tags table records which players are "in" a photo (simple
-- membership, no coordinates): players tag themselves, admins can tag anyone.
--
-- Both tables are publicly readable (the gallery and match report are public).
-- match_photos is admin-write. match_photo_tags lets a player add/remove their
-- own tag; admins can manage any tag.

create table if not exists public.match_photos (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  public_id text not null,
  secure_url text not null,
  width int,
  height int,
  caption text,
  uploaded_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (match_id, public_id)
);
create index if not exists match_photos_match_id_idx on public.match_photos (match_id);

alter table public.match_photos enable row level security;

drop policy if exists match_photos_public_read on public.match_photos;
create policy match_photos_public_read on public.match_photos
  for select using (true);

drop policy if exists match_photos_admin_write on public.match_photos;
create policy match_photos_admin_write on public.match_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


create table if not exists public.match_photo_tags (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.match_photos(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_by uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (photo_id, account_id)
);
create index if not exists match_photo_tags_photo_id_idx on public.match_photo_tags (photo_id);
create index if not exists match_photo_tags_account_id_idx on public.match_photo_tags (account_id);

alter table public.match_photo_tags enable row level security;

drop policy if exists match_photo_tags_public_read on public.match_photo_tags;
create policy match_photo_tags_public_read on public.match_photo_tags
  for select using (true);

-- Players may add a tag only for THEMSELVES; admins may tag anyone.
drop policy if exists match_photo_tags_insert on public.match_photo_tags;
create policy match_photo_tags_insert on public.match_photo_tags
  for insert to authenticated
  with check (
    public.is_admin()
    or account_id = (select a.id from public.accounts a where a.auth_user_id = auth.uid())
  );

-- Players may remove their own tag; admins may remove any tag.
drop policy if exists match_photo_tags_delete on public.match_photo_tags;
create policy match_photo_tags_delete on public.match_photo_tags
  for delete to authenticated
  using (
    public.is_admin()
    or account_id = (select a.id from public.accounts a where a.auth_user_id = auth.uid())
  );

-- This project grants base table privileges explicitly (RLS still gates the
-- rows). Without these, authenticated inserts/reads hit "permission denied".
grant select on public.match_photos to anon, authenticated;
grant insert, update, delete on public.match_photos to authenticated;
grant select on public.match_photo_tags to anon, authenticated;
grant insert, update, delete on public.match_photo_tags to authenticated;
grant select, insert, update, delete on public.match_photos to service_role;
grant select, insert, update, delete on public.match_photo_tags to service_role;
