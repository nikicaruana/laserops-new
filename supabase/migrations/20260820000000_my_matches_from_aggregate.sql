-- "Only my matches" (gallery + tagged photos) read the player's participation
-- from match_participants, which is only populated for app-booked games - so the
-- toggle was empty for the whole ingested backlog. Source it from the authoritative
-- per-match stat record (match_player_aggregate) instead: a player "played" a
-- match if they have an aggregate row in it.
create or replace function public.my_participated_match_codes()
returns text[] language sql security definer set search_path = public stable as $$
  select coalesce(array_agg(distinct m.match_code), '{}')
  from public.match_player_aggregate mpa
  join public.matches m on m.id = mpa.match_id
  where mpa.account_id = public.current_account_id()
    and m.match_code is not null;
$$;
grant execute on function public.my_participated_match_codes() to authenticated;
