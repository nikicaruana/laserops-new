-- =============================================================================
-- Phase 2b: player-created matches (capped) + waitlist auto-management.
-- =============================================================================

-- --- 1. Player-created matches ---------------------------------------------
-- Players open their own OPEN match via a SECURITY DEFINER RPC. The cap (max 3
-- active games per creator) is enforced here, so matches needs no broad player
-- INSERT policy. Type/flags are forced (public, single XP, no deposit).
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

  return new_id;
end;
$$;
grant execute on function public.create_player_match(text, timestamptz, integer, integer, numeric) to authenticated;

-- --- 2. Waitlist ------------------------------------------------------------
-- promoted_at: when a waitlisted signup was moved up. promotion_notified_at: set
-- by the notify cron once the "you're in" email is sent.
alter table public.match_signups
  add column if not exists promoted_at            timestamptz,
  add column if not exists promotion_notified_at  timestamptz;

-- Gate: a signup only becomes 'registered' if there's room; otherwise it lands
-- on the waitlist. Runs on insert and on a status change into 'registered' (e.g.
-- re-signing after a cancel). Capacity is counted excluding this row.
create or replace function public.match_signup_waitlist_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  maxp integer;
  reg  integer;
begin
  if new.status = 'registered' and (tg_op = 'INSERT' or old.status is distinct from 'registered') then
    select max_players into maxp from public.matches where id = new.match_id;
    if maxp is not null then
      select count(*) into reg from public.match_signups
        where match_id = new.match_id and status = 'registered' and id <> new.id;
      if reg >= maxp then
        new.status := 'waitlisted';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_match_signups_waitlist_gate on public.match_signups;
create trigger trg_match_signups_waitlist_gate
  before insert or update on public.match_signups
  for each row execute function public.match_signup_waitlist_gate();

-- Promote: when a registered spot frees, move the earliest waitlisted signups up
-- to capacity. Bounded by the reg >= maxp guard so it can't over-promote.
create or replace function public.promote_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mid    uuid := coalesce(new.match_id, old.match_id);
  maxp   integer;
  reg    integer;
  nextid uuid;
begin
  select max_players into maxp from public.matches where id = mid;
  if maxp is null then return null; end if;
  loop
    select count(*) into reg from public.match_signups where match_id = mid and status = 'registered';
    exit when reg >= maxp;
    select id into nextid from public.match_signups
      where match_id = mid and status = 'waitlisted'
      order by created_at asc limit 1;
    exit when nextid is null;
    update public.match_signups set status = 'registered', promoted_at = now() where id = nextid;
  end loop;
  return null;
end;
$$;
drop trigger if exists trg_match_signups_promote on public.match_signups;
create trigger trg_match_signups_promote
  after update or delete on public.match_signups
  for each row execute function public.promote_waitlist();

-- The current account's 1-based position among the waitlist, per match. Runs as
-- definer because a player can't read other players' signups under RLS.
create or replace function public.my_waitlist_positions()
returns table (match_id uuid, wl_position integer)
language sql security definer set search_path = public as $$
  with mine as (
    select s.match_id, s.created_at
    from public.match_signups s
    where s.account_id = public.current_account_id() and s.status = 'waitlisted'
  )
  select m.match_id,
         (select count(*) + 1 from public.match_signups w
            where w.match_id = m.match_id and w.status = 'waitlisted' and w.created_at < m.created_at)::int
  from mine m;
$$;
grant execute on function public.my_waitlist_positions() to authenticated;

-- --- 3. Relax the signup insert policy --------------------------------------
-- Players may now always sign up to an open game; the waitlist gate decides
-- registered vs waitlisted, so the hard capacity block is removed.
drop policy if exists match_signups_insert_own on public.match_signups;
create policy match_signups_insert_own on public.match_signups
  for insert to authenticated with check (
    account_id = public.current_account_id()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status in ('tentative', 'awaiting_confirm', 'confirmed')
    )
  );
