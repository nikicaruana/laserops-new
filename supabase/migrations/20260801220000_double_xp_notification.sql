-- =============================================================================
-- "Double XP game" player notification. When an OPEN game that carries Double XP
-- becomes available for signup, every player is notified (in-app + push, no
-- delay) with a link to sign up. Fired by a trigger so it works no matter how the
-- game is created (admin insert, RPC), and a stamp column makes it fire once.
-- =============================================================================

-- Push, immediate, no email (a mass email on every drop would be too much).
insert into public.notification_types (key, label, description, priority, is_active, sends_email, sends_push, delay_hours, sort_order)
values ('double_xp_game', 'Double XP game launched', 'Sent to all players when an open Double XP game opens for signup.', 2, true, false, true, 0, 42)
on conflict (key) do nothing;

-- Announce-once stamp.
alter table public.matches add column if not exists double_xp_announced_at timestamptz;

create or replace function public.notify_double_xp_launch()
returns trigger language plpgsql security definer set search_path = public as $$
declare prio integer; active boolean;
begin
  if NEW.is_double_xp
     and not coalesce(NEW.is_private, false)
     and NEW.status in ('tentative', 'awaiting_confirm', 'confirmed')
     and NEW.double_xp_announced_at is null
  then
    select priority, is_active into prio, active from public.notification_types where key = 'double_xp_game';
    -- Respect the type being switched off in the admin notifications panel.
    if not coalesce(active, false) then return NEW; end if;
    insert into public.notifications (account_id, type_key, priority, title, body, href)
      select a.id, 'double_xp_game', coalesce(prio, 2),
             'Double XP game just dropped',
             coalesce(NEW.title, 'A new game') || ' is open for signup with Double XP. Grab your spot.',
             '/player-portal/games/' || NEW.id::text
      from public.accounts a
      where a.auth_user_id is not null;
    -- Stamp on the row itself so it only ever announces once.
    NEW.double_xp_announced_at := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_double_xp on public.matches;
create trigger trg_notify_double_xp
  before insert or update on public.matches
  for each row execute function public.notify_double_xp_launch();
