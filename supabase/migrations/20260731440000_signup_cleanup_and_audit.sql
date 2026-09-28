-- =============================================================================
-- Two fixes:
--  1. Deleting (retiring) an account now pulls the player out of any non-completed
--     game they're signed up to / on the roster of (frees waitlist spots).
--  2. Signups + roster changes are audit-logged (admin_audit_log) so we can
--     troubleshoot who signed up / was removed and when.
-- =============================================================================

-- 1. delete_my_account(): remove active signups/roster before retiring.
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
    -- Pull the player out of any game that hasn't happened yet. Deleting the
    -- signup frees a waitlist spot (promote trigger) and is captured by the
    -- signup audit trigger. Completed games keep their historical rows.
    delete from public.match_signups s using public.matches m
      where s.account_id = acct and m.id = s.match_id and m.status <> 'completed';
    delete from public.match_participants p using public.matches m
      where p.account_id = acct and m.id = p.match_id and m.status <> 'completed';

    code := 'LO-' || upper(encode(extensions.gen_random_bytes(6), 'hex'));
    -- Strip PII, drop the login, retire — but keep ops_tag + linked stat rows.
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

  delete from auth.users where id = uid;

  return code;
end;
$$;

-- 2. Audit-log signup + roster changes (reuses the generic log_admin_change
--    trigger; actor is the player or admin who made the change).
drop trigger if exists trg_audit_match_signups on public.match_signups;
create trigger trg_audit_match_signups
  after insert or update or delete on public.match_signups
  for each row execute function public.log_admin_change();

drop trigger if exists trg_audit_match_participants on public.match_participants;
create trigger trg_audit_match_participants
  after insert or update or delete on public.match_participants
  for each row execute function public.log_admin_change();
