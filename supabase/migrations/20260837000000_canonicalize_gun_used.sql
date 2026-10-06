-- =============================================================================
-- Canonicalize match_player_aggregate.gun_used against guns.name
-- =============================================================================
-- BUG: gun_used is written verbatim from the ingest source with no mapping to
-- the canonical gun name, so a case/spelling variant becomes a separate "gun".
-- e.g. one row held "AKM Legend" while the catalogue name is "Akm Legend" -> the
-- Weapon Meta chart (and player_gun_stats / mastery / armory) showed TWO Akm
-- Legend entries.
--
-- Fix: a BEFORE INSERT/UPDATE trigger snaps gun_used to the matching guns.name
-- (case-insensitive) on every write path, one-time backfill of existing rows,
-- then rebuild the read-models the chart + armory read from.
-- =============================================================================

create or replace function public.canonicalize_mpa_gun_used()
returns trigger
language plpgsql
set search_path = public
as $$
declare canon text;
begin
  if new.gun_used is not null and trim(new.gun_used) <> '' then
    select g.name into canon
    from public.guns g
    where lower(trim(g.name)) = lower(trim(new.gun_used))
    limit 1;
    if canon is not null and canon <> new.gun_used then
      new.gun_used := canon;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mpa_canon_gun on public.match_player_aggregate;
create trigger trg_mpa_canon_gun
  before insert or update on public.match_player_aggregate
  for each row execute function public.canonicalize_mpa_gun_used();

-- Backfill existing case/spelling variants to the canonical catalogue name.
update public.match_player_aggregate mpa
set gun_used = g.name
from public.guns g
where mpa.gun_used is not null
  and lower(trim(mpa.gun_used)) = lower(trim(g.name))
  and mpa.gun_used <> g.name;

-- Rebuild the read-models that key on gun name so the fix is visible now.
select public.refresh_player_gun_stats();
select public.refresh_player_armory();
