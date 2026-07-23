-- =============================================================================
-- match_awards (§4.14) — accolades won per match. STRUCTURE ONLY.
-- =============================================================================
-- One row per (player-in-match × accolade won). Accolades grant XP only (not
-- score/ledger points, per the user's model), so we store xp_granted.
-- Linked to the match + player (headset_label, the per-match player key) and
-- the account when resolved. Data is materialized from the verified accolade
-- rules (Accolade_* columns in Game_Data_Lookup).
-- =============================================================================

create table public.match_awards (
  id                     uuid primary key default gen_random_uuid(),
  operator_id            uuid not null default '00000000-0000-0000-0000-000000000001'
                           references public.operators(id) on delete cascade,
  match_id               uuid not null references public.matches(id) on delete cascade,
  account_id             uuid references public.accounts(id),        -- null for unclaimed "Head ##"
  headset_label          text,                                       -- per-match player key
  nickname               text,                                       -- display name at match time
  accolade_definition_id uuid not null references public.accolade_definitions(id) on delete cascade,
  xp_granted             integer,
  awarded_at             timestamptz,                                -- match played_on
  created_at             timestamptz not null default now(),
  unique (match_id, headset_label, accolade_definition_id)
);
create index match_awards_match_idx   on public.match_awards (match_id);
create index match_awards_account_idx on public.match_awards (account_id) where account_id is not null;
create index match_awards_def_idx     on public.match_awards (accolade_definition_id);
