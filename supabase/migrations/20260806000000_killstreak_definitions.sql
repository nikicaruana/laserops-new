-- =============================================================================
-- killstreak_definitions — deployable abilities unlocked by streaks
-- =============================================================================
-- A killstreak is a streak-unlocked ability a player fires from the live feed to
-- disrupt the ENEMY team's feed (Scrambler jams one base; EMP jams all bases).
-- This is CONFIG (game rules): public read through the anon key so the live feed
-- can list what's available; writes are admin-only (mirrors streak_definitions).
--
--   scope           one | all   -> a single chosen base, or every base
--   duration_seconds            -> how long the enemy feed stays scrambled
--   unlock_streak_key           -> streak_definitions.streak_key that grants a
--                                  charge each time it's earned (1 charge / earn)
--   overlay_text                -> template shown over the jammed feed; {ops} is
--                                  replaced with the deployer's ops tag. Null ->
--                                  "{ops}'s {name}".
-- Follows the config-table pattern: RLS public-read + admin-write, plus explicit
-- table grants (CLI-created tables don't inherit Supabase's default grants).
-- =============================================================================

create table if not exists public.killstreak_definitions (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid not null default '00000000-0000-0000-0000-000000000001'
                      references public.operators(id) on delete cascade,
  key               text not null,
  name              text not null,
  description       text,
  icon              text,
  badge_url         text,
  scope             text not null default 'one' check (scope in ('one', 'all')),
  duration_seconds  integer not null default 30 check (duration_seconds > 0 and duration_seconds <= 600),
  unlock_streak_key text,
  overlay_text      text,
  arm_instructions  text,
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (operator_id, key),
  unique (operator_id, name)
);

create trigger trg_killstreak_definitions_updated_at before update on public.killstreak_definitions
  for each row execute function public.set_updated_at();

-- RLS: public read, admin write ----------------------------------------------
alter table public.killstreak_definitions enable row level security;

drop policy if exists killstreak_definitions_public_read on public.killstreak_definitions;
create policy killstreak_definitions_public_read on public.killstreak_definitions
  for select to anon, authenticated using (true);

drop policy if exists killstreak_definitions_admin_write on public.killstreak_definitions;
create policy killstreak_definitions_admin_write on public.killstreak_definitions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Table grants (RLS still filters the rows/ops) ------------------------------
grant select on public.killstreak_definitions to anon, authenticated;
grant insert, update, delete on public.killstreak_definitions to authenticated;

-- Seed the first two killstreaks (from the LiveSim prototype) -----------------
insert into public.killstreak_definitions
  (key, name, description, icon, scope, duration_seconds, unlock_streak_key, overlay_text, arm_instructions, sort_order)
values
  ('scrambler', 'Scrambler', 'Jam ONE enemy base on their live feed with pixel static.',
    '🌀', 'one', 30, 'kill_streak_5', E'{ops}''s Scrambler',
    'Choose base to scramble or tap here to cancel', 10),
  ('emp', 'EMP', 'Jam ALL enemy bases on their live feed with pixel static.',
    '📡', 'all', 90, 'kill_streak_10', E'{ops}''s EMP',
    'Tap bases to launch EMP or tap here to cancel', 20)
on conflict (operator_id, key) do nothing;
