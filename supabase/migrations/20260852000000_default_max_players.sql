-- =============================================================================
-- Default max players for OPEN games.
-- A game created without a max showed a "full" fill bar (PlayerBar treats a null
-- cap as reg == cap). Give every open (non-private) game a default cap from
-- pricing_config whenever one is not supplied - settable from /admin/pricing -
-- and backfill the open games that currently have no cap. Private bookings keep
-- an uncapped default (a big party must not be silently capped), so the trigger
-- and backfill both scope to non-private games.
-- =============================================================================
alter table public.pricing_config
  add column if not exists default_max_players integer not null default 30 check (default_max_players > 0);

-- BEFORE INSERT on matches: fill a missing max_players from config for OPEN games
-- (covers every creation path - create_player_match, admin-created games).
create or replace function public.default_match_max_players()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.max_players is null and coalesce(new.is_private, false) = false then
    new.max_players := coalesce((select default_max_players from public.pricing_config where id = 1), 30);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_default_match_max_players on public.matches;
create trigger trg_default_match_max_players
  before insert on public.matches
  for each row execute function public.default_match_max_players();

-- Setter now also takes the default max (replace the 3-arg version).
drop function if exists public.admin_set_pricing_config(numeric, integer, integer);
create or replace function public.admin_set_pricing_config(
  p_price numeric, p_session_minutes integer, p_buffer_minutes integer, p_max_players integer
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_price is null or p_price < 0 then raise exception 'Price must be 0 or more.'; end if;
  if p_session_minutes is null or p_session_minutes <= 0 then raise exception 'Session length must be positive.'; end if;
  if p_buffer_minutes is null or p_buffer_minutes < 0 then raise exception 'Break must be 0 or more.'; end if;
  if p_max_players is null or p_max_players <= 0 then raise exception 'Default max players must be positive.'; end if;
  update public.pricing_config
     set default_price_eur = p_price, session_minutes = p_session_minutes,
         booking_buffer_minutes = p_buffer_minutes, default_max_players = p_max_players, updated_at = now()
   where id = 1;
end;
$$;
grant execute on function public.admin_set_pricing_config(numeric, integer, integer, integer) to authenticated;

-- Default cap = 30 (per the owner).
update public.pricing_config set default_max_players = 30 where id = 1;

-- Backfill existing open (non-private) active games with no cap. greatest() so a
-- game already over 30 is not made to look over-full.
update public.matches
   set max_players = greatest(30, coalesce(registered_count, 0))
 where max_players is null
   and is_private = false
   and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
