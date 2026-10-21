-- =============================================================================
-- Fix: removed admin notifications kept coming back.
--
-- "Remove" (the X on the admin notification pane / bell) was a PER-ADMIN flag
-- (admin_notification_reads.removed_at). In practice removed alerts reappeared:
-- the per-admin flag did not reliably persist, so a stable alert row -- e.g. a
-- "game cancelled" or "overlapping games" notice that is emitted once and never
-- re-created -- came straight back on the next feed reload.
--
-- admin_notifications is "one row per event, shared across all admins" (not
-- duplicated per admin). For these operational alerts a global remove is the
-- right model: once any admin clears "overlapping games detected", the overlap
-- has been looked at and the alert is handled for everyone. So "remove" now
-- hard-deletes the shared row (the on-delete-cascade on admin_notification_reads
-- cleans up any per-admin seen/removed rows). "Seen"/"Read" stays per-admin.
--
-- Re-emission is unaffected: a state that is still true (e.g. a game still at
-- capacity) will raise its alert again on the next change, which is intended.
-- =============================================================================

create or replace function public.remove_admin_notification(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  delete from public.admin_notifications where id = p_id;
end;
$$;
grant execute on function public.remove_admin_notification(uuid) to authenticated;
