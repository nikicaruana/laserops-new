-- =============================================================================
-- gun_classes + gun_tree_branches — canonical taxonomy for the gun editor
-- =============================================================================
-- guns.class / guns.tree_branch stay free-text (the armory/weapons UI groups
-- by those strings). These tables define the CANONICAL set so the admin gun
-- form can offer dropdowns instead of free text, keeping values consistent.
-- Renames cascade to guns in the app layer. Public-read + admin-write, matching
-- the other config tables. Seeded from the distinct values already in guns.
-- =============================================================================

create table if not exists public.gun_classes (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, name)
);

create table if not exists public.gun_tree_branches (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, name)
);

create trigger trg_gun_classes_updated_at before update on public.gun_classes
  for each row execute function public.set_updated_at();
create trigger trg_gun_tree_branches_updated_at before update on public.gun_tree_branches
  for each row execute function public.set_updated_at();

-- RLS: public read, admin write (same pattern as the other config tables).
do $$
declare t text;
begin
  foreach t in array array['gun_classes','gun_tree_branches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_public_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_write', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Seed from the distinct values already present in guns, ordered by where they
-- first appear in the gun sort order.
insert into public.gun_classes (name, sort_order)
select class, row_number() over (order by min(sort_order), class)
from public.guns
where class is not null and btrim(class) <> ''
group by class
on conflict (operator_id, name) do nothing;

insert into public.gun_tree_branches (name, sort_order)
select tree_branch, row_number() over (order by min(sort_order), tree_branch)
from public.guns
where tree_branch is not null and btrim(tree_branch) <> ''
group by tree_branch
on conflict (operator_id, name) do nothing;
