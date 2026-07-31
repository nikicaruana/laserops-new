-- =============================================================================
-- game_modes + per-mode score formula
-- =============================================================================
-- Each game mode (scenario) can have its own score formula. game_modes is the
-- canonical list; score_formula gains a mode_slug so there's one formula per
-- (operator, mode). One mode is the default/fallback — used at ingest for games
-- whose mode can't (yet) be identified. Seeds "LaserOps Domination" as default
-- and re-homes the existing single formula to it.
-- =============================================================================

create table if not exists public.game_modes (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  slug        text not null,
  is_default  boolean not null default false,
  sort_order  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, slug)
);

create trigger trg_game_modes_updated_at before update on public.game_modes
  for each row execute function public.set_updated_at();

alter table public.game_modes enable row level security;
drop policy if exists game_modes_public_read on public.game_modes;
create policy game_modes_public_read on public.game_modes
  for select to anon, authenticated using (true);
drop policy if exists game_modes_admin_write on public.game_modes;
create policy game_modes_admin_write on public.game_modes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.game_modes to anon, authenticated;
grant insert, update, delete on public.game_modes to authenticated;

-- Audit trigger (log_admin_change from the audit-log migration).
drop trigger if exists trg_audit_game_modes on public.game_modes;
create trigger trg_audit_game_modes after insert or update or delete on public.game_modes
  for each row execute function public.log_admin_change();

-- Seed the current mode as default.
insert into public.game_modes (name, slug, is_default, sort_order)
values ('LaserOps Domination', 'domination', true, 1)
on conflict (operator_id, slug) do nothing;

-- score_formula: add the mode dimension, re-home the existing row, recompose PK.
alter table public.score_formula add column if not exists mode_slug text;
update public.score_formula set mode_slug = 'domination' where mode_slug is null;
alter table public.score_formula alter column mode_slug set not null;
alter table public.score_formula drop constraint if exists score_formula_pkey;
alter table public.score_formula add primary key (operator_id, mode_slug);
