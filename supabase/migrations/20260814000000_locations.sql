-- =============================================================================
-- Venues / locations (2026-10-02): named playing locations, each with a parking
-- and a playing Google Maps link, one marked default. Games reference a location
-- (added in a later migration); match reminders + calendar invites use its links.
-- Community-created open games use the default location.
-- Managed from /admin/locations.
-- =============================================================================
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  parking_url text not null default '',
  playing_url text not null default '',
  is_default  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- At most one default location.
create unique index if not exists locations_one_default on public.locations (is_default) where is_default;

alter table public.locations enable row level security;
drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations for select to anon, authenticated using (true);
drop policy if exists locations_admin on public.locations;
create policy locations_admin on public.locations for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.locations to anon, authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.locations to service_role;

drop trigger if exists locations_touch on public.locations;
create trigger locations_touch before update on public.locations
  for each row execute function public.touch_updated_at();

-- ---- Admin RPCs -------------------------------------------------------------
-- Upsert: p_id null -> insert, else update that row. Returns the id.
create or replace function public.admin_upsert_location(
  p_id uuid, p_name text, p_parking text, p_playing text
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'A location needs a name.'; end if;
  if p_id is null then
    insert into public.locations (name, parking_url, playing_url, sort_order)
      values (btrim(p_name), btrim(coalesce(p_parking, '')), btrim(coalesce(p_playing, '')),
              coalesce((select max(sort_order) + 10 from public.locations), 0))
      returning id into new_id;
    -- First location becomes the default automatically.
    if not exists (select 1 from public.locations where is_default) then
      update public.locations set is_default = true where id = new_id;
    end if;
    return new_id;
  else
    update public.locations
      set name = btrim(p_name), parking_url = btrim(coalesce(p_parking, '')), playing_url = btrim(coalesce(p_playing, ''))
      where id = p_id;
    return p_id;
  end if;
end;
$$;
grant execute on function public.admin_upsert_location(uuid, text, text, text) to authenticated;

-- Make one location the single default.
create or replace function public.admin_set_default_location(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.locations set is_default = false where is_default and id <> p_id;
  update public.locations set is_default = true where id = p_id;
end;
$$;
grant execute on function public.admin_set_default_location(uuid) to authenticated;

-- Delete a location (guarded WHERE). Any games pointing at it fall back to the
-- default at read time (location_id is set null on delete in the later migration).
create or replace function public.admin_delete_location(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare was_default boolean;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select is_default into was_default from public.locations where id = p_id;
  delete from public.locations where id = p_id;
  -- If we removed the default, promote the next one so there is always a default.
  if was_default then
    update public.locations set is_default = true
      where id = (select id from public.locations order by sort_order, created_at limit 1);
  end if;
end;
$$;
grant execute on function public.admin_delete_location(uuid) to authenticated;

-- ---- Seed the known venues --------------------------------------------------
insert into public.locations (name, parking_url, playing_url, is_default, sort_order)
select 'White Rocks', 'https://maps.app.goo.gl/Dq3DhNK51XDTFJZn7', 'https://maps.app.goo.gl/KR8AQsVXJ1jBgyGV9', true, 10
where not exists (select 1 from public.locations where lower(name) = 'white rocks');

insert into public.locations (name, parking_url, playing_url, is_default, sort_order)
select 'Misieb', 'https://maps.app.goo.gl/DjDk7RpGSxo25HGUA', 'https://maps.app.goo.gl/tCgMrsnNG89V1GKq9', false, 20
where not exists (select 1 from public.locations where lower(name) = 'misieb');
