-- =============================================================================
-- my_participated_match_codes(): the match codes the current player took part in.
-- Powers the gallery "My games only" filter. Definer so a player can resolve
-- their own participation without a broad read policy; returns [] when signed out
-- (current_account_id() is null). The public gallery page stays statically cached;
-- this is called client-side only for signed-in viewers.
-- =============================================================================
create or replace function public.my_participated_match_codes()
returns text[] language sql security definer set search_path = public stable as $$
  select coalesce(array_agg(distinct m.match_code), '{}')
  from public.match_participants mp
  join public.matches m on m.id = mp.match_id
  where mp.account_id = public.current_account_id()
    and m.match_code is not null;
$$;
grant execute on function public.my_participated_match_codes() to authenticated;
