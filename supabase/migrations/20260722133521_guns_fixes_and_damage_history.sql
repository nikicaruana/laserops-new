-- =============================================================================
-- guns — schema fixes to match real sheet data + effective-dated damage history
-- =============================================================================
-- Runs BEFORE the guns seed. The guns table is still empty, so these column
-- changes are free. Adds the damage-versioning subsystem so re-tuning a gun's
-- damage never rewrites past games (only games from the change date onward use
-- the new value), and stays correct even if a past game is recomputed.
-- =============================================================================

-- 1. fire_rate holds text: most guns are numeric, but DMR/Sniper/Shotgun read
--    "Semi Auto" in the sheet. Text covers both.
alter table public.guns alter column fire_rate type text using fire_rate::text;

-- 2. unlock_type uses the sheet's actual values (Default / Class). 'Gun' is
--    reserved for a future gun-prerequisite unlock (schema already has the
--    prerequisite columns), so it's allowed too.
alter table public.guns drop constraint if exists guns_unlock_type_check;
alter table public.guns add constraint guns_unlock_type_check
  check (unlock_type in ('Default','Class','Gun'));

-- 3. Visibility flag: system/fallback guns (Unknown Gun) stay out of the
--    weapons page, armory, and every player-facing surface.
alter table public.guns add column is_visible boolean not null default true;

-- 4. Effective-dated damage history -----------------------------------------
-- One row per gun per damage value, with a validity window. Scoring resolves
-- the damage that applied on a game's date, so history is reproducible.
create table public.gun_damage_history (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null default '00000000-0000-0000-0000-000000000001'
                   references public.operators(id) on delete cascade,
  gun_id         uuid not null references public.guns(id) on delete cascade,
  damage         numeric,
  effective_from timestamptz not null,   -- '-infinity' for the seed = "always"
  effective_to   timestamptz,            -- null = currently in effect
  note           text,
  created_at     timestamptz not null default now()
);
create index gun_damage_history_gun_effective_idx
  on public.gun_damage_history (gun_id, effective_from desc);

-- Keep the history in sync automatically. Admins still just edit guns.damage;
-- the trigger records the timeline:
--   * new gun         -> one entry, effective since the beginning of time
--   * damage changed  -> close the open entry (as of now), open a new one
create or replace function public.record_gun_damage_history()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.gun_damage_history
      (operator_id, gun_id, damage, effective_from, effective_to, note)
    values (new.operator_id, new.id, new.damage, '-infinity', null, 'seed');
  elsif (tg_op = 'UPDATE' and new.damage is distinct from old.damage) then
    update public.gun_damage_history
      set effective_to = now()
      where gun_id = new.id and effective_to is null;
    insert into public.gun_damage_history
      (operator_id, gun_id, damage, effective_from, effective_to, note)
    values (new.operator_id, new.id, new.damage, now(), null, 'damage change');
  end if;
  return new;
end;
$$;

create trigger trg_guns_damage_history
  after insert or update of damage on public.guns
  for each row execute function public.record_gun_damage_history();

-- Helper for scoring / recomputation: the damage that applied to a gun at a
-- given moment. Returns the effective-dated row covering that timestamp.
create or replace function public.gun_damage_at(p_gun_id uuid, p_at timestamptz)
returns numeric
language sql
stable
as $$
  select damage
  from public.gun_damage_history
  where gun_id = p_gun_id
    and effective_from <= p_at
    and (effective_to is null or p_at < effective_to)
  order by effective_from desc
  limit 1;
$$;
