-- =============================================================================
-- accounts (§4.1) — player identity [PII]. STRUCTURE ONLY (no data).
-- =============================================================================
-- Replaces Player_Base. Email is the identity anchor; ops_tag is the public
-- display name. Migrated players come in as 'migrated_unclaimed' with a null
-- auth_user_id; they become 'claimed' when a real person signs up and an admin
-- merges them (Phase 1 flow).
--
-- Case-insensitive uniqueness for email + ops_tag is enforced with functional
-- unique indexes on lower(...) — no citext extension needed.
--
-- auth_user_id is a plain nullable uuid for now (no FK to auth.users); the auth
-- link is wired when the account-claim/login flow is built (Phase 1).
--
-- RLS (player reads own row, admins read all) is build-order step 10 — NOT set
-- up here. This table holds PII, so it must get RLS before any public exposure;
-- staging is not publicly wired up yet.
-- =============================================================================

create table public.accounts (
  id                uuid primary key default gen_random_uuid(),
  operator_id       uuid not null default '00000000-0000-0000-0000-000000000001'
                      references public.operators(id) on delete cascade,
  auth_user_id      uuid,                                  -- → auth.users, null until claimed
  email             text,                                  -- identity anchor
  full_name         text,
  date_of_birth     date,                                  -- 13+ gating
  phone_e164        text,                                  -- standardized from Player_Base
  ops_tag           text,                                  -- public display name
  profile_pic_url   text,
  marketing_opt_in  boolean not null default false,
  photo_consent     boolean not null default false,        -- default false: don't assume consent
  waiver_accepted_at timestamptz,
  waiver_version    text,
  found_us_via      text,
  played_before     boolean,
  claim_status      text not null default 'migrated_unclaimed'
                      check (claim_status in ('migrated_unclaimed','claimed','native')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Case-insensitive uniqueness (partial so multiple NULLs are allowed).
create unique index accounts_operator_email_lower_uniq
  on public.accounts (operator_id, lower(email)) where email is not null;
create unique index accounts_operator_ops_tag_lower_uniq
  on public.accounts (operator_id, lower(ops_tag)) where ops_tag is not null;

-- Fast lookup when a signup links to an account.
create index accounts_auth_user_id_idx
  on public.accounts (auth_user_id) where auth_user_id is not null;

create trigger trg_accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

comment on table public.accounts is 'Player identity [PII]. Needs RLS before public exposure (build-order step 10).';
