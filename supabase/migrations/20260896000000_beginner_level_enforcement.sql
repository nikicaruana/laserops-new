-- =============================================================================
-- Beginner-only games: enforce the level cap server-side.
--  1. Block a player from signing up (match_signups) to a beginner game when
--     their current level exceeds beginner_max_level - the UI check was advisory
--     only (and skipped admins), so the write itself needs the gate.
--  2. When a player levels up past the cap, drop their existing sign-ups to
--     future beginner games they're no longer eligible for (fires on level
--     change via a statement trigger on player_stats_lifetime).
-- Admins can still add anyone to a roster via the Match Manager (that writes
-- match_participants, not match_signups).
-- =============================================================================

-- 1) Gate sign-up / waitlist on the level cap.
create or replace function public.enforce_beginner_signup_level()
returns trigger language plpgsql security definer set search_path = public as $$
declare lvl integer; maxlvl integer; beg boolean;
begin
  if new.status not in ('registered', 'waitlisted') then return new; end if;
  select m.is_beginner, m.beginner_max_level into beg, maxlvl from public.matches m where m.id = new.match_id;
  if not coalesce(beg, false) or maxlvl is null then return new; end if;
  select coalesce(current_level, 1) into lvl from public.player_stats_lifetime where account_id = new.account_id;
  lvl := coalesce(lvl, 1);
  if lvl > maxlvl then
    raise exception 'This is a beginners-only game (max level %). Your level (%) is above the cap.', maxlvl, lvl
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_match_signups_beginner_level on public.match_signups;
create trigger trg_match_signups_beginner_level
  before insert or update of status, account_id on public.match_signups
  for each row execute function public.enforce_beginner_signup_level();

-- 2) Drop over-cap sign-ups from future beginner games.
create or replace function public.drop_overcap_beginner_signups()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.match_signups s
     set status = 'cancelled'
    from public.matches m, public.player_stats_lifetime l
   where s.match_id = m.id
     and l.account_id = s.account_id
     and s.status in ('registered', 'waitlisted')
     and m.is_beginner = true
     and m.beginner_max_level is not null
     and m.status in ('tentative', 'awaiting_confirm', 'confirmed')
     and coalesce(m.scheduled_at, now()) > now()
     and coalesce(l.current_level, 1) > m.beginner_max_level;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.trg_drop_overcap_beginner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.drop_overcap_beginner_signups();
  return null;
end;
$$;
drop trigger if exists trg_lifetime_overcap_beginner on public.player_stats_lifetime;
create trigger trg_lifetime_overcap_beginner
  after update of current_level on public.player_stats_lifetime
  for each statement execute function public.trg_drop_overcap_beginner();

-- Clean up any existing over-cap sign-ups (e.g. the level-10 test signup).
select public.drop_overcap_beginner_signups();
