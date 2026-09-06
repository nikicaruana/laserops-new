-- =============================================================================
-- When a game ends (completed or cancelled), the "your game is live — join!"
-- notification is stale and misleading. Auto-mark those game_live alerts seen
-- for that match whenever its status moves to completed/cancelled — a trigger,
-- so it fires no matter how the status changed (publish, admin action, cron).
-- Notifications carry no match_id, so match on the href (which embeds the id).
-- =============================================================================
create or replace function public.dismiss_match_live_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('completed', 'cancelled') and new.status is distinct from old.status then
    update public.notifications
       set seen_at = now()
     where type_key = 'game_live'
       and seen_at is null
       and href like '/player-portal/games/' || new.id::text || '%';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dismiss_live_notifs on public.matches;
create trigger trg_dismiss_live_notifs
  after update of status on public.matches
  for each row execute function public.dismiss_match_live_notifications();
