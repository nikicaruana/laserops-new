-- =============================================================================
-- Waitlist promotion notification. When a spot frees and a waitlisted player is
-- promoted to registered, emit an in-app notification prompting them to open the
-- game and (if it's confirmed) pay to lock in their place. The existing
-- waitlist-notify cron still sends the email; this adds the instant bell alert.
-- =============================================================================

insert into public.notification_types (key, label, description, priority, sends_email, sends_push, delay_hours, sort_order)
values ('waitlist_promoted', 'A waitlist spot opened up', 'You were moved off a game waitlist - open it to confirm (and pay).', 2, false, true, 0, 15)
on conflict (key) do nothing;

-- Recreate promote_waitlist to also notify each promoted player.
create or replace function public.promote_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mid uuid := coalesce(new.match_id, old.match_id);
  maxp integer; reg integer; nextid uuid; promoted_acct uuid;
  m_title text; m_status text;
begin
  select max_players, title, status into maxp, m_title, m_status from public.matches where id = mid;
  if maxp is null then return null; end if;
  loop
    select count(*) into reg from public.match_signups where match_id = mid and status = 'registered';
    exit when reg >= maxp;
    select id into nextid from public.match_signups
      where match_id = mid and status = 'waitlisted'
      order by created_at asc limit 1;
    exit when nextid is null;
    update public.match_signups set status = 'registered', promoted_at = now() where id = nextid
      returning account_id into promoted_acct;
    if promoted_acct is not null then
      insert into public.notifications (account_id, type_key, priority, title, body, href)
      select promoted_acct, 'waitlist_promoted', nt.priority,
             coalesce(m_title, 'A game') || ': a spot opened up',
             case when m_status = 'confirmed'
                  then 'You are off the waitlist and in. Open the game to pay and confirm your place.'
                  else 'You are off the waitlist and in. Open the game to see the details.' end,
             '/player-portal/games/' || mid::text
      from public.notification_types nt where nt.key = 'waitlist_promoted' and nt.is_active;
    end if;
  end loop;
  return null;
end;
$$;
