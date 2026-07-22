-- =============================================================================
-- Seed · seasons (§4.17) — from the site CMS Seasons tab
-- =============================================================================
-- 3 seasons. CMS is richer than the base table, so we add:
--   season_number (the CMS key), status (upcoming/active/completed), and
--   terms_and_conditions. Year-month values become dates: start -> first of
--   month, end -> last of month. is_active is derived (status = 'active').
-- Idempotent upsert on (operator_id, season_number).
-- =============================================================================

alter table public.seasons add column if not exists season_number integer;
alter table public.seasons add column if not exists status text;
alter table public.seasons add column if not exists terms_and_conditions text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'seasons_status_check') then
    alter table public.seasons add constraint seasons_status_check
      check (status in ('upcoming','active','completed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seasons_operator_number_uniq') then
    alter table public.seasons add constraint seasons_operator_number_uniq
      unique (operator_id, season_number);
  end if;
end $$;

insert into public.seasons (season_number, name, starts_on, ends_on, status, is_active, terms_and_conditions) values
  (1, 'Season 1', '2026-04-01', '2026-06-30', 'completed', false, 'Prizes awarded are limited to a maximum of 2 free games per season per player, and one per merchandise item per player. If a player wins more than 2 free games per season or 1 unique merchandise item, prizes will be resolved in order of challenge priority and given to the next-placing player in the lower priority challenge. LaserOps maintains full rights to distribute prizes at their own discretion at all times.'),
  (2, 'Season 2', '2026-07-01', '2026-12-31', 'active', true, 'Prizes awarded are limited to a maximum of 2 free games per season per player, and one per merchandise item per player. If a player wins more than 2 free games per season or 1 unique merchandise item, prizes will be resolved in order of challenge priority and given to the next-placing player in the lower priority challenge. LaserOps maintains full rights to distribute prizes at their own discretion at all times.'),
  (3, 'Season 3', '2026-01-01', '2027-06-30', 'upcoming', false, 'Prizes awarded are limited to a maximum of 2 free games per season per player, and one per merchandise item per player. If a player wins more than 2 free games per season or 1 unique merchandise item, prizes will be resolved in order of challenge priority and given to the next-placing player in the lower priority challenge. LaserOps maintains full rights to distribute prizes at their own discretion at all times.')
on conflict (operator_id, season_number) do update
  set name = excluded.name, starts_on = excluded.starts_on, ends_on = excluded.ends_on,
      status = excluded.status, is_active = excluded.is_active,
      terms_and_conditions = excluded.terms_and_conditions, updated_at = now();
