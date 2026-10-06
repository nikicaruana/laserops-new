-- =============================================================================
-- weapon_mastery -- per-gun Bronze/Silver/Gold/Platinum mastery badges + enable
-- =============================================================================
-- One row per gun. Holds the admin-managed badge art (uploaded to Cloudinary
-- laseropsmalta.com/mastery-badges) and whether mastery is live for that gun.
-- The REQUIREMENTS themselves are not stored here: they are computed in code
-- from the existing streak_definitions.tier + accolade tiers (Bronze = all
-- tier-1 streaks with the gun, Silver = all tier-2, Gold = all tier-3 + a
-- Specialist accolade, Platinum = all tier-4 + every tier-3 accolade). Guns
-- without an enabled row show "Mastery coming soon".
-- =============================================================================

create table if not exists public.weapon_mastery (
  id                 uuid primary key default gen_random_uuid(),
  operator_id        uuid not null default '00000000-0000-0000-0000-000000000001'
                       references public.operators(id) on delete cascade,
  gun_name           text not null,                 -- -> guns.name / match_player_aggregate.gun_used
  enabled            boolean not null default true,
  sort_order         integer,
  bronze_badge_url   text,
  silver_badge_url   text,
  gold_badge_url     text,
  platinum_badge_url text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (operator_id, gun_name)
);

create trigger trg_weapon_mastery_updated_at before update on public.weapon_mastery
  for each row execute function public.set_updated_at();

alter table public.weapon_mastery enable row level security;
drop policy if exists weapon_mastery_public_read on public.weapon_mastery;
create policy weapon_mastery_public_read on public.weapon_mastery
  for select to anon, authenticated using (true);
drop policy if exists weapon_mastery_admin_write on public.weapon_mastery;
create policy weapon_mastery_admin_write on public.weapon_mastery
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.weapon_mastery to anon, authenticated;
grant insert, update, delete on public.weapon_mastery to authenticated;
grant select, insert, update, delete on public.weapon_mastery to service_role;

-- Audit trigger (log_admin_change from the audit-log migration).
drop trigger if exists trg_audit_weapon_mastery on public.weapon_mastery;
create trigger trg_audit_weapon_mastery after insert or update or delete on public.weapon_mastery
  for each row execute function public.log_admin_change();

-- Seed the 8 guns that ship with mastery badge art.
insert into public.weapon_mastery (gun_name, enabled, sort_order, bronze_badge_url, silver_badge_url, gold_badge_url, platinum_badge_url)
values
  ('AR-15 Ranger', true, 1, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284416/laseropsmalta.com/mastery-badges/AR15_Ranger_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284418/laseropsmalta.com/mastery-badges/AR15_Ranger_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284417/laseropsmalta.com/mastery-badges/AR15_Ranger_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284417/laseropsmalta.com/mastery-badges/AR15_Ranger_Platinum.png'),
  ('AK-25 Predator', true, 2, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284413/laseropsmalta.com/mastery-badges/AK25_Predator_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284415/laseropsmalta.com/mastery-badges/AK25_Predator_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284414/laseropsmalta.com/mastery-badges/AK25_Predator_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284414/laseropsmalta.com/mastery-badges/AK25_Predator_Platinum.png'),
  ('M4 Gastat', true, 3, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284419/laseropsmalta.com/mastery-badges/M4_Gastat_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284421/laseropsmalta.com/mastery-badges/M4_Gastat_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284420/laseropsmalta.com/mastery-badges/M4_Gastat_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284420/laseropsmalta.com/mastery-badges/M4_Gastat_Platinum.png'),
  ('MG21 Berserk', true, 4, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284422/laseropsmalta.com/mastery-badges/MG21_Berserk_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284424/laseropsmalta.com/mastery-badges/MG21_Berserk_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284423/laseropsmalta.com/mastery-badges/MG21_Berserk_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284423/laseropsmalta.com/mastery-badges/MG21_Berserk_Platinum.png'),
  ('MG25 Berserk', true, 5, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284425/laseropsmalta.com/mastery-badges/MG25_Berserk_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284427/laseropsmalta.com/mastery-badges/MG25_Berserk_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284425/laseropsmalta.com/mastery-badges/MG25_Berserk_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284426/laseropsmalta.com/mastery-badges/MG25_Berserk_Platinum.png'),
  ('MP9LT Phoenix', true, 6, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284427/laseropsmalta.com/mastery-badges/MP9LT_Phoenix_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284430/laseropsmalta.com/mastery-badges/MP9LT_Phoenix_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284429/laseropsmalta.com/mastery-badges/MP9LT_Phoenix_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284429/laseropsmalta.com/mastery-badges/MP9LT_Phoenix_Platinum.png'),
  ('MR-512 Sniper', true, 7, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284431/laseropsmalta.com/mastery-badges/MR512_Sniper_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284434/laseropsmalta.com/mastery-badges/MR512_Sniper_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284431/laseropsmalta.com/mastery-badges/MR512_Sniper_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284433/laseropsmalta.com/mastery-badges/MR512_Sniper_Platinum.png'),
  ('SR-21 Ghost', true, 8, 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284435/laseropsmalta.com/mastery-badges/SR21_Ghost_Bronze.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284437/laseropsmalta.com/mastery-badges/SR21_Ghost_Silver.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284435/laseropsmalta.com/mastery-badges/SR21_Ghost_Gold.png', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1791284436/laseropsmalta.com/mastery-badges/SR21_Ghost_Platinum.png')
on conflict (operator_id, gun_name) do update set
  enabled            = excluded.enabled,
  sort_order         = excluded.sort_order,
  bronze_badge_url   = excluded.bronze_badge_url,
  silver_badge_url   = excluded.silver_badge_url,
  gold_badge_url     = excluded.gold_badge_url,
  platinum_badge_url = excluded.platinum_badge_url;
