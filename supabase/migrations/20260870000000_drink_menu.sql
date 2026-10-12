-- =============================================================================
-- Pay-after-game epic (Phase 1, additive/dormant): admin-managed drinks menu.
-- Players self-report drinks (with quantity) on the post-game pay page; the admin
-- can adjust in the Match Manager. Prices are per unit. Nothing references this on
-- the live site yet, so it is safe to apply ahead of the cutover.
-- =============================================================================
create table if not exists public.drink_menu (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  price_eur   numeric(10,2) not null check (price_eur >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.drink_menu enable row level security;

-- Public can read the active menu (the pay page is player-facing); admins manage.
drop policy if exists drink_menu_read on public.drink_menu;
create policy drink_menu_read on public.drink_menu
  for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists drink_menu_admin on public.drink_menu;
create policy drink_menu_admin on public.drink_menu
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.drink_menu to anon, authenticated;
grant select, insert, update, delete on public.drink_menu to service_role;

drop trigger if exists trg_drink_menu_updated on public.drink_menu;
create trigger trg_drink_menu_updated before update on public.drink_menu
  for each row execute function public.set_updated_at();

-- Seed the starting menu (only if empty, so re-runs don't duplicate).
insert into public.drink_menu (name, price_eur, sort_order)
select * from (values ('Water', 1.50, 1), ('Gatorade', 2.50, 2), ('Beer', 3.00, 3)) as v(name, price_eur, sort_order)
where not exists (select 1 from public.drink_menu);

-- Admin upsert/delete helpers (SECURITY DEFINER, admin-gated) for the editor.
create or replace function public.admin_set_drink(
  p_id uuid, p_name text, p_price numeric, p_sort integer, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'Name is required.'; end if;
  if p_id is null then
    insert into public.drink_menu (name, price_eur, sort_order, is_active)
      values (btrim(p_name), greatest(coalesce(p_price, 0), 0), coalesce(p_sort, 0), coalesce(p_is_active, true))
      returning id into rid;
  else
    update public.drink_menu
      set name = btrim(p_name), price_eur = greatest(coalesce(p_price, 0), 0),
          sort_order = coalesce(p_sort, sort_order), is_active = coalesce(p_is_active, is_active), updated_at = now()
      where id = p_id returning id into rid;
  end if;
  return rid;
end;
$$;
grant execute on function public.admin_set_drink(uuid, text, numeric, integer, boolean) to authenticated;

create or replace function public.admin_delete_drink(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  delete from public.drink_menu where id = p_id;
end;
$$;
grant execute on function public.admin_delete_drink(uuid) to authenticated;
