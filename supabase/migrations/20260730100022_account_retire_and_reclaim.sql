-- =============================================================================
-- Account deletion -> anonymize-and-retire (keep stats), + reclaim by key
-- =============================================================================
-- Deleting an account no longer hard-deletes it. Instead it:
--   * strips the real PII (email, name, DOB, phone, photo, marketing) — GDPR
--     erasure of personal data;
--   * keeps the gamertag (ops_tag) + all game rows LINKED to the account, so
--     the stats stay together as a dormant "unclaimed" bundle (no cascade to
--     anyone else, nothing lost);
--   * removes the login (auth.users) and stamps a one-time reclaim_code.
-- A returning player re-links their new login to the bundle with the key
-- (reclaim_account); admins can look up the key from the retired row as a
-- backup. delete_my_account() now RETURNS the reclaim code to show the user.
-- =============================================================================

-- New state + reclaim key on accounts.
alter table public.accounts add column if not exists reclaim_code text;
alter table public.accounts add column if not exists retired_at   timestamptz;
create unique index if not exists accounts_reclaim_code_uniq
  on public.accounts (reclaim_code) where reclaim_code is not null;

-- Allow the new 'retired' claim status.
alter table public.accounts drop constraint if exists accounts_claim_status_check;
alter table public.accounts add constraint accounts_claim_status_check
  check (claim_status in ('migrated_unclaimed', 'claimed', 'native', 'retired'));

-- ---- delete_my_account(): anonymize + retire, return the reclaim key -------
create or replace function public.delete_my_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  acct uuid;
  code text := null;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into acct from public.accounts where auth_user_id = uid;

  if acct is not null then
    code := 'LO-' || upper(encode(extensions.gen_random_bytes(6), 'hex'));
    -- Strip PII, drop the login, retire — but keep ops_tag + linked game rows.
    update public.accounts
       set email            = null,
           full_name        = null,
           date_of_birth    = null,
           phone_e164       = null,
           profile_pic_url  = null,
           marketing_opt_in = false,
           auth_user_id     = null,
           claim_status     = 'retired',
           reclaim_code     = code,
           retired_at       = now(),
           updated_at       = now()
     where id = acct;
  end if;

  -- Remove the login regardless (ends the session, cascades auth rows).
  delete from auth.users where id = uid;

  return code;
end;
$$;

-- ---- reclaim_account(): re-link the caller to a retired bundle by key ------
create or replace function public.reclaim_account(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  dormant uuid;
  current_acct uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into dormant
    from public.accounts
   where reclaim_code = p_code and auth_user_id is null and claim_status = 'retired';
  if dormant is null then
    raise exception 'That reclaim key is invalid or has already been used.';
  end if;

  -- The account auto-created for this returning login (from the signup trigger).
  select id into current_acct from public.accounts where auth_user_id = uid;

  if current_acct is not null and current_acct <> dormant then
    if not exists (select 1 from public.match_player_aggregate where account_id = current_acct) then
      delete from public.accounts where id = current_acct;  -- empty native account
    else
      update public.accounts set auth_user_id = null where id = current_acct;  -- safety: detach
    end if;
  end if;

  -- Adopt the dormant bundle: it becomes the caller's claimed account.
  update public.accounts
     set auth_user_id = uid,
         claim_status = 'claimed',
         reclaim_code = null,
         retired_at   = null,
         updated_at   = now()
   where id = dormant;
end;
$$;

revoke all on function public.reclaim_account(text) from public, anon;
grant execute on function public.reclaim_account(text) to authenticated;
