-- =============================================================================
-- Pricing & session config (2026-09-28): one row driving the normal game price,
-- session length, and the enforced break between bookings. Read by the booking
-- gate/availability + open-game creation; edited from /admin/pricing.
-- =============================================================================
create table if not exists public.pricing_config (
  id                     integer primary key default 1 check (id = 1),
  default_price_eur      numeric(10,2) not null default 35,
  session_minutes        integer not null default 180 check (session_minutes > 0),
  booking_buffer_minutes integer not null default 60  check (booking_buffer_minutes >= 0),
  updated_at             timestamptz not null default now()
);
insert into public.pricing_config (id) values (1) on conflict (id) do nothing;

alter table public.pricing_config enable row level security;
drop policy if exists pricing_config_read on public.pricing_config;
create policy pricing_config_read on public.pricing_config for select to anon, authenticated using (true);
drop policy if exists pricing_config_admin on public.pricing_config;
create policy pricing_config_admin on public.pricing_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.pricing_config to anon, authenticated;
grant select, insert, update, delete on public.pricing_config to authenticated;

-- Admin setter (range-checked).
create or replace function public.admin_set_pricing_config(p_price numeric, p_session_minutes integer, p_buffer_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_price is null or p_price < 0 then raise exception 'Price must be 0 or more.'; end if;
  if p_session_minutes is null or p_session_minutes <= 0 then raise exception 'Session length must be positive.'; end if;
  if p_buffer_minutes is null or p_buffer_minutes < 0 then raise exception 'Break must be 0 or more.'; end if;
  update public.pricing_config
     set default_price_eur = p_price, session_minutes = p_session_minutes, booking_buffer_minutes = p_buffer_minutes, updated_at = now()
   where id = 1;
end;
$$;
grant execute on function public.admin_set_pricing_config(numeric, integer, integer) to authenticated;

-- ---- Booking clash gate: use configured session length + break -------------
create or replace function public.has_booking_conflict(p_start timestamptz, p_minutes integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches m
    cross join (select
        coalesce((select session_minutes from public.pricing_config where id = 1), 180)
      + coalesce((select booking_buffer_minutes from public.pricing_config where id = 1), 60) as span
    ) c
    where m.status in ('confirmed', 'live')
      and m.scheduled_at is not null
      and p_start < m.scheduled_at + make_interval(mins => c.span)
      and m.scheduled_at < p_start + make_interval(mins => c.span)
  );
$$;
grant execute on function public.has_booking_conflict(timestamptz, integer) to authenticated;

-- ---- Busy windows for the client picker: configured session length ---------
create or replace function public.busy_slots(p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.scheduled_at,
         m.scheduled_at + make_interval(mins => coalesce((select session_minutes from public.pricing_config where id = 1), 180))
  from public.matches m
  where m.status in ('confirmed', 'live')
    and m.scheduled_at is not null
    and m.scheduled_at >= (p_from - 1)::timestamptz
    and m.scheduled_at < (least(p_to, p_from + 400) + 2)::timestamptz
  order by m.scheduled_at;
$$;
grant execute on function public.busy_slots(date, date) to anon, authenticated;

-- ---- Open-game creation: price + duration from config ----------------------
create or replace function public.create_player_match(
  p_title text, p_scheduled_at timestamptz, p_min_players integer, p_max_players integer, p_price_eur numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); active integer; new_id uuid; tag text;
begin
  if acct is null then raise exception 'You need an account to create a game.'; end if;
  perform public.assert_bookable_account(acct);
  if not public.is_admin() and not public.has_played_game() then
    raise exception 'You can open your own games once you have played at least one. Join an open game to get started.';
  end if;
  if not public.is_admin() and not public.is_booking_open(p_scheduled_at) then
    raise exception 'We are not taking bookings for that time. Check the calendar for available slots.';
  end if;
  if not public.is_admin() and public.has_booking_conflict(p_scheduled_at, 180) then
    raise exception 'Another game is booked around that time. Games need a break between them.';
  end if;
  select count(*) into active from public.matches
    where created_by = acct and status in ('tentative', 'awaiting_confirm', 'confirmed', 'live');
  if active >= 3 then raise exception 'You can have at most 3 active games at a time.'; end if;

  -- Open games are the standard price + session length (from pricing_config), not
  -- a client-supplied value (p_price_eur is kept in the signature for back-compat).
  insert into public.matches (title, scheduled_at, status, min_players, max_players, price_eur, duration_minutes, pricing_mode, is_double_xp, is_private, created_by)
    values (nullif(btrim(p_title), ''), p_scheduled_at, 'tentative', greatest(coalesce(p_min_players, 10), 1), p_max_players,
            coalesce((select default_price_eur from public.pricing_config where id = 1), 35),
            coalesce((select session_minutes from public.pricing_config where id = 1), 180),
            'per_player', false, false, acct)
    returning id into new_id;

  insert into public.match_signups (match_id, account_id, status) values (new_id, acct, 'registered')
    on conflict (match_id, account_id) do nothing;

  select ops_tag into tag from public.accounts where id = acct;
  insert into public.notifications (account_id, type_key, priority, title, body, href)
  select distinct m2.account_id, 'squad_open_game', nt.priority,
         coalesce(tag, 'A squadmate') || ' opened a game',
         coalesce(nullif(btrim(p_title), ''), 'A new open game'),
         '/player-portal/games/' || new_id::text
  from public.squad_members m1
  join public.squad_members m2 on m2.squad_id = m1.squad_id and m2.account_id <> acct
  join public.notification_types nt on nt.key = 'squad_open_game' and nt.is_active
  where m1.account_id = acct;

  return new_id;
end;
$$;
grant execute on function public.create_player_match(text, timestamptz, integer, integer, numeric) to authenticated;
