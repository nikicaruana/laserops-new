-- =============================================================================
-- Phase 0 · Build step 1 — CONFIG TABLES (structure only)
-- =============================================================================
-- Creates the admin-editable config tables from §4 of the Phase 0 spec, plus
-- the `operators` tenant root they all hang off (§3 / principle 6:
-- "operator_id everywhere"). No downstream tables (accounts, matches, rounds,
-- awards ledgers, etc.) and NO config VALUES are seeded here — seeding from the
-- Google Sheets happens in the next step so the numbers can be verified.
--
-- Conventions (§3):
--   * UUID primary keys (gen_random_uuid()).
--   * operator_id on every table, defaulting to the single-tenant operator so
--     seed rows don't have to specify it.
--   * created_at everywhere; updated_at + trigger on every (mutable) config table.
--
-- RLS ("config world-readable, admin-writable", §5) is deliberately NOT set up
-- here — it's build-order step 10, and needs the auth/admin layer first. On the
-- staging DB these tables will show an "RLS disabled" advisor notice; that's
-- expected for now and harmless (staging is not publicly wired up).
-- =============================================================================

-- Shared trigger: keep updated_at current on any row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- operators — tenant root (single row for the current single-operator build)
-- ---------------------------------------------------------------------------
create table public.operators (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_operators_updated_at before update on public.operators
  for each row execute function public.set_updated_at();

-- The single tenant. Fixed id so every config table can default operator_id to
-- it and re-running this seed stays idempotent.
insert into public.operators (id, name)
values ('00000000-0000-0000-0000-000000000001', 'LaserOps Malta')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- teams (§4.8) — Green included at seed time; team count never hardcoded
-- ---------------------------------------------------------------------------
create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null default '00000000-0000-0000-0000-000000000001'
                 references public.operators(id) on delete cascade,
  colour       text not null,
  display_name text,
  badge_url    text,
  sort_order   integer,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (operator_id, colour)
);
create trigger trg_teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- guns (§4.7) — from Gun_Damage; duplicate Damage column collapsed on seed
-- ---------------------------------------------------------------------------
create table public.guns (
  id                          uuid primary key default gen_random_uuid(),
  operator_id                 uuid not null default '00000000-0000-0000-0000-000000000001'
                                references public.operators(id) on delete cascade,
  name                        text not null,
  damage                      numeric,
  image_url                   text,
  class                       text,
  tree_branch                 text,
  is_default                  boolean not null default false,
  unlock_type                 text check (unlock_type in ('class','gun')),
  unlock_prerequisite_class   text,
  unlock_prerequisite_gun     text,
  unlock_requirement_points   integer,
  unlock_requirement_level    integer,
  unlock_display_text         text,
  sort_order                  integer,
  unlock_tier                 text,
  mag_size                    integer,
  reload                      numeric,
  fire_rate                   numeric,
  difficulty                  text,
  description                 text,
  -- Deprecated legacy stats: migrated for archival, unused by 2.0 (§4.7).
  length                      numeric,
  weight                      numeric,
  gun_range                   numeric,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (operator_id, name)
);
comment on column public.guns.length    is 'Deprecated: legacy Gun sheet, unused by 2.0.';
comment on column public.guns.weight    is 'Deprecated: legacy Gun sheet, unused by 2.0.';
comment on column public.guns.gun_range is 'Deprecated: legacy Gun sheet (range), unused by 2.0.';
create trigger trg_guns_updated_at before update on public.guns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- elo_config (§4.12) — ELO_Setting/ELO_Value key/value pairs
-- ---------------------------------------------------------------------------
create table public.elo_config (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  key         text not null,
  value       numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, key)
);
create trigger trg_elo_config_updated_at before update on public.elo_config
  for each row execute function public.set_updated_at();

-- elo_tiers (§4.12) — the ELO tier bands (Recruit…Elite). Split out from
-- elo_config because a band needs name + range columns, not a single value.
create table public.elo_tiers (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  tier_name   text not null,
  min_elo     numeric,
  max_elo     numeric,
  sort_order  integer,
  badge_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, tier_name)
);
create trigger trg_elo_tiers_updated_at before update on public.elo_tiers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- xp_config (§4) — XP component weights as key/value pairs
-- ---------------------------------------------------------------------------
create table public.xp_config (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  key         text not null,
  value       numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, key)
);
create trigger trg_xp_config_updated_at before update on public.xp_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rank_levels (§4.12) — the 1–50 progression ladder
-- ---------------------------------------------------------------------------
create table public.rank_levels (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null default '00000000-0000-0000-0000-000000000001'
                    references public.operators(id) on delete cascade,
  level           integer not null,
  rank_name       text,
  score_threshold numeric,
  est_games       integer,
  badge_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (operator_id, level)
);
create trigger trg_rank_levels_updated_at before update on public.rank_levels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- rating_config (§4.12) — gates (Min_Level, Min_Matches, Min_Eligible_Pool)
-- and weighted components (sum to 1), as key/value pairs.
-- ---------------------------------------------------------------------------
create table public.rating_config (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  key         text not null,
  value       numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, key)
);
create trigger trg_rating_config_updated_at before update on public.rating_config
  for each row execute function public.set_updated_at();

-- rating_brackets (§4.12) — the 0–5★ percentile bands. Split out from
-- rating_config for the same reason as elo_tiers (a band needs range columns).
create table public.rating_brackets (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null default '00000000-0000-0000-0000-000000000001'
                   references public.operators(id) on delete cascade,
  stars          numeric not null,
  min_percentile numeric,
  max_percentile numeric,
  label          text,
  sort_order     integer,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (operator_id, stars)
);
create trigger trg_rating_brackets_updated_at before update on public.rating_brackets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- score_formula_config (§4.9) — one row per scoring coefficient (key/value)
-- ---------------------------------------------------------------------------
create table public.score_formula_config (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  key         text not null,
  value       numeric,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, key)
);
create trigger trg_score_formula_config_updated_at before update on public.score_formula_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- scoring_eras (§4.10) — the Legacy / 2.0 reset boundary
-- ---------------------------------------------------------------------------
create table public.scoring_eras (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null default '00000000-0000-0000-0000-000000000001'
                    references public.operators(id) on delete cascade,
  name            text not null,
  starts_at       timestamptz,
  ends_at         timestamptz,               -- null = current era
  is_default_view boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (operator_id, name)
);
create trigger trg_scoring_eras_updated_at before update on public.scoring_eras
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- seasons (§4.17) — admin-defined date ranges (not hardcoded quarters)
-- ---------------------------------------------------------------------------
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  starts_on   date,
  ends_on     date,
  is_active   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, name)
);
create trigger trg_seasons_updated_at before update on public.seasons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- spawn_camp_config (§4.11) — one row per operator: protection window +
-- consequence. Typed columns (not key/value) because consequence_mode is text.
-- ---------------------------------------------------------------------------
create table public.spawn_camp_config (
  id                        uuid primary key default gen_random_uuid(),
  operator_id               uuid not null default '00000000-0000-0000-0000-000000000001'
                              references public.operators(id) on delete cascade,
  protection_window_seconds integer,
  consequence_mode          text check (consequence_mode in ('void','penalty')),
  penalty_points            integer,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (operator_id)
);
create trigger trg_spawn_camp_config_updated_at before update on public.spawn_camp_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- accolade_definitions (§4.14) — superlatives/awards, one winner per category
-- per scope. scope = round | match (so round-MVP and match-MVP can coexist).
-- ---------------------------------------------------------------------------
create table public.accolade_definitions (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  description text,
  badge_url   text,
  xp          integer not null default 0,
  points      integer not null default 0,
  scope       text not null check (scope in ('round','match')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, name, scope)
);
create trigger trg_accolade_definitions_updated_at before update on public.accolade_definitions
  for each row execute function public.set_updated_at();

-- accolade_rules (§4.14) — how each accolade is decided.
--   match_superlative → max/min of stat_key (your 15, now scope-aware)
--   threshold         → stat_key comparator threshold_value
--   custom            → params escape hatch
create table public.accolade_rules (
  id                     uuid primary key default gen_random_uuid(),
  operator_id            uuid not null default '00000000-0000-0000-0000-000000000001'
                           references public.operators(id) on delete cascade,
  accolade_definition_id uuid not null references public.accolade_definitions(id) on delete cascade,
  rule_type              text not null check (rule_type in ('match_superlative','threshold','custom')),
  stat_key               text,
  direction              text check (direction in ('max','min')),
  comparator             text,
  threshold_value        numeric,
  params                 jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger trg_accolade_rules_updated_at before update on public.accolade_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- streak_definitions (§4.14) — event-level, fire multiple times per round,
-- each grants points. (5-kill-streak, Clutch, First Blood, …)
-- ---------------------------------------------------------------------------
create table public.streak_definitions (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  name        text not null,
  description text,
  badge_url   text,
  xp          integer not null default 0,
  points      integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (operator_id, name)
);
create trigger trg_streak_definitions_updated_at before update on public.streak_definitions
  for each row execute function public.set_updated_at();

-- streak_rules (§4.14) — how each streak fires.
--   streak      → N consecutive event_type, breaks_on, min_length
--   time_window → event_types[] within window_seconds, min_count, state_condition
--   first_event → first event_type in the round (First Blood)
--   custom      → params escape hatch
create table public.streak_rules (
  id                   uuid primary key default gen_random_uuid(),
  operator_id          uuid not null default '00000000-0000-0000-0000-000000000001'
                         references public.operators(id) on delete cascade,
  streak_definition_id uuid not null references public.streak_definitions(id) on delete cascade,
  rule_type            text not null check (rule_type in ('streak','time_window','first_event','custom')),
  event_type           text,
  event_types          text[],
  breaks_on            text[],
  min_length           integer,
  window_seconds       integer,
  min_count            integer,
  state_condition      text,
  params               jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_streak_rules_updated_at before update on public.streak_rules
  for each row execute function public.set_updated_at();
