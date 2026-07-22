-- =============================================================================
-- accounts.guardian_account_id — family / managed accounts
-- =============================================================================
-- Supports multiple profiles under one parent contact (e.g. kids registered
-- under a parent's email). A child account points at its guardian account;
-- the guardian holds the email, the child can have email = null. Stats attach
-- to each profile independently via NFC/QR + headband mapping, so every family
-- member is tracked separately regardless of who owns the email.
-- =============================================================================

alter table public.accounts
  add column guardian_account_id uuid references public.accounts(id) on delete set null;

create index accounts_guardian_idx
  on public.accounts (guardian_account_id) where guardian_account_id is not null;

comment on column public.accounts.guardian_account_id is
  'Parent/guardian account for a managed (e.g. child) account that shares the guardian''s email/contact. Null for standalone accounts.';
