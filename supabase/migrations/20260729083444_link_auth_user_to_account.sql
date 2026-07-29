-- =============================================================================
-- Account claim: link a new auth.users row to its accounts row on signup
-- =============================================================================
-- When a player signs in for the first time (magic link or Google), Supabase
-- creates a row in auth.users. This trigger fires right then and:
--   * If an unclaimed account already exists with the same email (one of the
--     280 migrated players), it links auth_user_id and flips claim_status to
--     'claimed' — so their whole history is attached the instant they log in.
--   * Otherwise it creates a fresh native account for the new email.
--
-- SECURITY DEFINER (owned by postgres): runs with full rights, so it writes to
-- accounts regardless of RLS, and current_user becomes postgres (not
-- 'authenticated') — which means the protect_account_fields() guard lets the
-- auth_user_id / claim_status writes through (that guard only blocks the
-- 'authenticated' end-user role).
--
-- Email match is case-insensitive to mirror the accounts lower(email) unique
-- index. Kids without their own email (guardian model) simply never match and
-- are unaffected.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_id uuid;
begin
  -- Try to claim an existing, unclaimed migrated account by email.
  update public.accounts
     set auth_user_id = new.id,
         claim_status = 'claimed',
         updated_at   = now()
   where auth_user_id is null
     and email is not null
     and lower(email) = lower(new.email)
  returning id into linked_id;

  -- No match -> brand-new player: create a native account.
  if linked_id is null then
    insert into public.accounts (auth_user_id, email, full_name, claim_status)
    values (
      new.id,
      new.email,
      nullif(coalesce(new.raw_user_meta_data ->> 'full_name',
                      new.raw_user_meta_data ->> 'name'), ''),
      'native'
    )
    on conflict do nothing;   -- guard against a race / retried signup
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
