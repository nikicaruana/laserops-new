-- =============================================================================
-- Player-created match refinements:
--   1. The creator is auto-signed-up to their own game.
--   2. Organizers (and admins) can see the ops tags of who signed up.
-- =============================================================================

-- 1. Recreate create_player_match to also register the creator.
create or replace function public.create_player_match(
  p_title        text,
  p_scheduled_at timestamptz,
  p_min_players  integer,
  p_max_players  integer,
  p_price_eur    numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  acct   uuid := public.current_account_id();
  active integer;
  new_id uuid;
begin
  if acct is null then
    raise exception 'You need an account to create a game.';
  end if;

  select count(*) into active from public.matches
    where created_by = acct
      and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then
    raise exception 'You can have at most 3 active games at a time.';
  end if;

  insert into public.matches (
    title, scheduled_at, status, min_players, max_players,
    price_eur, pricing_mode, is_double_xp, is_private, created_by
  ) values (
    nullif(btrim(p_title), ''), p_scheduled_at, 'tentative',
    greatest(coalesce(p_min_players, 10), 1), p_max_players,
    p_price_eur, 'per_player', false, false, acct
  )
  returning id into new_id;

  -- The organizer is playing too: sign them up automatically.
  insert into public.match_signups (match_id, account_id, status)
    values (new_id, acct, 'registered')
    on conflict (match_id, account_id) do nothing;

  return new_id;
end;
$$;

-- 2. Organizer view of who signed up (ops tag + status). Definer because a player
--    can't read other players' signups under RLS; guarded to the match creator or
--    an admin. Registered first, then the waitlist, each oldest-first.
create or replace function public.match_signups_for_organizer(p_match_id uuid)
returns table (ops_tag text, status text, signed_up_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  acct  uuid := public.current_account_id();
  owner uuid;
begin
  select created_by into owner from public.matches where id = p_match_id;
  if owner is distinct from acct and not public.is_admin() then
    raise exception 'Not allowed.';
  end if;

  return query
    select a.ops_tag, s.status, s.created_at
    from public.match_signups s
    join public.accounts a on a.id = s.account_id
    where s.match_id = p_match_id and s.status in ('registered', 'waitlisted')
    order by (s.status = 'waitlisted'), s.created_at;
end;
$$;
grant execute on function public.match_signups_for_organizer(uuid) to authenticated;
