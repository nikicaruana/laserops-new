-- 20260801010000_match_photos_grants.sql
-- --------------------------------------------------------------------
-- The initial match_photos migration granted only service_role, so authenticated
-- inserts/reads hit "permission denied for table" (this project grants base
-- table privileges explicitly; RLS still gates the rows). Add the standard
-- anon/authenticated grants. Idempotent.

grant select on public.match_photos to anon, authenticated;
grant insert, update, delete on public.match_photos to authenticated;

grant select on public.match_photo_tags to anon, authenticated;
grant insert, update, delete on public.match_photo_tags to authenticated;
