-- =============================================================================
-- delete_my_account() — self-service, irreversible account deletion
-- =============================================================================
-- Lets a signed-in player delete their OWN account, following Phase 0 §8:
--   * unlink (null) their match_player_aggregate + match_awards rows so the
--     games/rounds stay intact but anonymised (no PII, no attribution);
--   * hard-delete the accounts row (its PII), which cascades the derived
--     read-models (lifetime/leaderboard/gun/ratings/challenge standings);
--   * delete the auth.users row (cascades auth identities/sessions and
--     invalidates the session).
-- guardian_account_id is ON DELETE SET NULL, so deleting a parent leaves any
-- managed kid accounts intact (just unlinked).
--
-- SECURITY DEFINER so it can null match rows (NO ACTION FK) and delete from
-- auth.users. It only ever touches the CALLER's own account (auth.uid()), and
-- execute is granted to authenticated only.
-- =============================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  acct uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into acct from public.accounts where auth_user_id = uid;

  if acct is not null then
    -- Preserve game integrity: unlink rather than delete the match rows.
    update public.match_player_aggregate set account_id = null where account_id = acct;
    update public.match_awards            set account_id = null where account_id = acct;
    -- Hard-delete PII; cascades the derived per-account read-models.
    delete from public.accounts where id = acct;
  end if;

  -- Remove the auth user (cascades auth-side rows; ends the session).
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
