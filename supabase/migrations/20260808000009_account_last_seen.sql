-- Track real site activity, not just fresh logins. auth.users.last_sign_in_at
-- only updates on an actual re-authentication, so a user with a live session who
-- keeps using the site would not count as "active". Record a throttled
-- last_seen_at on the account whenever an authenticated user uses the site.
alter table public.accounts add column if not exists last_seen_at timestamptz;
create index if not exists accounts_last_seen_at_idx
  on public.accounts (last_seen_at) where last_seen_at is not null;

-- Throttled touch: only writes if the last touch is stale (>5 min), so it is
-- cheap even if pinged on every page/focus.
create or replace function public.touch_last_seen()
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if acct is null then return; end if;
  update public.accounts set last_seen_at = now()
   where id = acct and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
end;
$$;
grant execute on function public.touch_last_seen() to authenticated;

-- Active-in-24h now means used the site OR logged in within 24h.
create or replace function public.admin_user_stats()
returns table (total_accounts bigint, claimed_accounts bigint, migrated_accounts bigint, logged_in_24h bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query select
    (select count(*)::bigint from public.accounts),
    (select count(*)::bigint from public.accounts where auth_user_id is not null),
    (select count(*)::bigint from public.accounts where auth_user_id is null),
    (select count(distinct a.id)::bigint
       from public.accounts a
       left join auth.users u on u.id = a.auth_user_id
       where a.last_seen_at >= now() - interval '24 hours'
          or u.last_sign_in_at >= now() - interval '24 hours');
end;
$$;
grant execute on function public.admin_user_stats() to authenticated;
