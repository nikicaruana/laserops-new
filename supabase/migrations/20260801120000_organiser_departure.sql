-- =============================================================================
-- Organiser backs out of their own game. A player-created game shouldn't die just
-- because the organiser can't make it - if others are still signed up, the game
-- carries on with a new organiser (the earliest remaining registered player).
-- Only if nobody is left does the game get cancelled.
-- =============================================================================

insert into public.notification_types (key, label, description, priority, sends_email, sends_push, delay_hours, sort_order)
values ('game_organiser_transferred', 'You are now a game organiser', 'The previous organiser backed out; you now manage the game.', 3, false, true, 0, 16)
on conflict (key) do nothing;

create or replace function public.handle_organiser_departure()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; newcreator uuid;
begin
  -- Only act when a REGISTERED signup leaves (status moves off registered, or the
  -- row is deleted).
  if tg_op = 'UPDATE' and not (old.status = 'registered' and new.status is distinct from 'registered') then
    return null;
  end if;
  if tg_op = 'DELETE' and old.status is distinct from 'registered' then
    return null;
  end if;

  select id, created_by, status, title into m from public.matches where id = old.match_id;
  if m.id is null or m.status not in ('tentative', 'awaiting_confirm', 'confirmed') then return null; end if;
  -- Only when the person leaving is the organiser.
  if m.created_by is distinct from old.account_id then return null; end if;

  -- Hand off to the earliest remaining registered player, if any.
  select account_id into newcreator
    from public.match_signups
    where match_id = m.id and status = 'registered' and account_id is distinct from old.account_id
    order by created_at asc limit 1;

  if newcreator is not null then
    update public.matches set created_by = newcreator where id = m.id;
    insert into public.notifications (account_id, type_key, priority, title, body, href)
    select newcreator, 'game_organiser_transferred', nt.priority,
           'You are now organising ' || coalesce(m.title, 'a game'),
           'The previous organiser backed out. The game carries on - you can manage it from your games.',
           '/player-portal/games/' || m.id::text
    from public.notification_types nt where nt.key = 'game_organiser_transferred' and nt.is_active;
  else
    -- No one left: cancel the game.
    update public.matches set status = 'cancelled' where id = m.id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_organiser_departure on public.match_signups;
create trigger trg_organiser_departure
  after update or delete on public.match_signups
  for each row execute function public.handle_organiser_departure();
