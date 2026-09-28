-- =============================================================================
-- Organiser handoff must pick a REACHABLE successor. A booking requires a phone,
-- but a remaining player could still lack one (legacy signup from before that
-- rule, or they removed their number afterwards). Prefer the earliest remaining
-- registered player WITH a phone. If players remain but none have a phone, keep
-- the game alive (everyone still wants to play) but flag admins to reach the new
-- organiser another way. Only cancel if nobody is left at all.
-- =============================================================================

-- Admin alert type for a phone-less organiser.
insert into public.admin_notification_types (key, label, description, priority, sort_order)
values ('organiser_no_phone', 'New organiser has no phone', 'A game was handed to a player with no phone on file - may need manual contact.', 2, 9)
on conflict (key) do nothing;

create or replace function public.handle_organiser_departure()
returns trigger language plpgsql security definer set search_path = public as $$
declare m record; newcreator uuid; any_remaining uuid;
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

  -- Prefer the earliest remaining registered player WITH a phone (reachable).
  select s.account_id into newcreator
    from public.match_signups s
    join public.accounts a on a.id = s.account_id
    where s.match_id = m.id and s.status = 'registered'
      and s.account_id is distinct from old.account_id
      and a.phone_e164 is not null and btrim(a.phone_e164) <> ''
    order by s.created_at asc limit 1;

  -- Fallback: any remaining registered player (phone or not).
  if newcreator is null then
    select s.account_id into any_remaining
      from public.match_signups s
      where s.match_id = m.id and s.status = 'registered'
        and s.account_id is distinct from old.account_id
      order by s.created_at asc limit 1;
  end if;

  if newcreator is not null then
    update public.matches set created_by = newcreator where id = m.id;
    insert into public.notifications (account_id, type_key, priority, title, body, href)
    select newcreator, 'game_organiser_transferred', nt.priority,
           'You are now organising ' || coalesce(m.title, 'a game'),
           'The previous organiser backed out. The game carries on - you can manage it from your games.',
           '/player-portal/games/' || m.id::text
    from public.notification_types nt where nt.key = 'game_organiser_transferred' and nt.is_active;
  elsif any_remaining is not null then
    -- Players remain but none have a phone: keep the game, flag admins.
    update public.matches set created_by = any_remaining where id = m.id;
    insert into public.notifications (account_id, type_key, priority, title, body, href)
    select any_remaining, 'game_organiser_transferred', nt.priority,
           'You are now organising ' || coalesce(m.title, 'a game'),
           'The previous organiser backed out. The game carries on - you can manage it from your games.',
           '/player-portal/games/' || m.id::text
    from public.notification_types nt where nt.key = 'game_organiser_transferred' and nt.is_active;
    perform public.emit_admin_notification('organiser_no_phone',
      coalesce(m.title, 'A game') || ': new organiser has no phone',
      'The organiser backed out and the next player in line has no phone on file. Reach out another way if the game needs coordinating.',
      '/admin/matches/' || m.id::text, 'match', m.id, 'nophone:' || m.id::text);
  else
    -- No one left: cancel the game.
    update public.matches set status = 'cancelled' where id = m.id;
  end if;

  return null;
end;
$$;
