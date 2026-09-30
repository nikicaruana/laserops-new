-- Admin user stats for the User management page: total players, how many are
-- real (claimed/signed-up) accounts vs migrated-from-Sheets (never claimed), and
-- how many logged in over the last 24h. SECURITY DEFINER so it can read
-- auth.users; is_admin gated.
--   claimed  = accounts.auth_user_id is not null (signed up or claimed a legacy
--              ops tag, which is how stat merges happen)
--   migrated = accounts.auth_user_id is null (imported from Sheets, unclaimed)
create or replace function public.admin_user_stats()
returns table (total_accounts bigint, claimed_accounts bigint, migrated_accounts bigint, logged_in_24h bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query select
    (select count(*)::bigint from public.accounts),
    (select count(*)::bigint from public.accounts where auth_user_id is not null),
    (select count(*)::bigint from public.accounts where auth_user_id is null),
    (select count(*)::bigint from auth.users where last_sign_in_at >= now() - interval '24 hours');
end;
$$;

grant execute on function public.admin_user_stats() to authenticated;
