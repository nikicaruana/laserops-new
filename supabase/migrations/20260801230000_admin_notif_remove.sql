-- =============================================================================
-- Per-admin REMOVE for admin notifications. Read state is already per-admin
-- (admin_notification_reads.account_id); this adds a per-admin "removed" flag so
-- one admin removing an alert from their own feed doesn't affect other admins.
-- The shared admin_notifications row stays; only the current admin stops seeing it.
-- =============================================================================

alter table public.admin_notification_reads add column if not exists removed_at timestamptz;

-- Feed: exclude the current admin's removed rows. seen = a (non-removed) read row exists.
create or replace function public.admin_notification_feed()
returns table (id uuid, priority integer, title text, body text, href text, seen boolean, created_at timestamptz)
language sql security definer set search_path = public as $$
  select n.id, n.priority, n.title, n.body, n.href,
         (r.notification_id is not null) as seen, n.created_at
  from public.admin_notifications n
  left join public.admin_notification_reads r
    on r.notification_id = n.id and r.account_id = public.current_account_id()
  where public.is_admin() and r.removed_at is null
  order by (r.notification_id is not null), n.priority, n.created_at desc
  limit 100;
$$;
grant execute on function public.admin_notification_feed() to authenticated;

-- Remove one alert from the current admin's feed (per-user; upserts the read row).
create or replace function public.remove_admin_notification(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  insert into public.admin_notification_reads (notification_id, account_id, removed_at)
    values (p_id, acct, now())
    on conflict (notification_id, account_id) do update set removed_at = now();
end;
$$;
grant execute on function public.remove_admin_notification(uuid) to authenticated;
