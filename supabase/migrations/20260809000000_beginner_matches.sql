-- =============================================================================
-- Beginner-only open games.
-- Admins can flag an open match as "beginners only" with a max level. Players
-- at or below that level can sign up; higher-level players are blocked. The cap
-- is enforced in the DB (signups are written client-side under RLS, so a client
-- check alone is not authoritative). Admins are exempt (testing / running games).
-- Level source = player_stats_lifetime.current_level (null -> treated as 1), the
-- same source the signup list + player summary use.
-- =============================================================================

alter table public.matches
  add column if not exists is_beginner        boolean not null default false,
  add column if not exists beginner_max_level integer;

create or replace function public.match_signup_beginner_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_beg  boolean;
  max_lvl integer;
  plvl    integer;
  admin   boolean;
begin
  -- Only when a row becomes 'registered' (fresh insert or a status change into it).
  if new.status = 'registered' and (tg_op = 'INSERT' or old.status is distinct from 'registered') then
    select m.is_beginner, m.beginner_max_level
      into is_beg, max_lvl
      from public.matches m where m.id = new.match_id;

    if coalesce(is_beg, false) and max_lvl is not null then
      select coalesce(a.is_admin, false) into admin
        from public.accounts a where a.id = new.account_id;

      if not coalesce(admin, false) then
        select coalesce(psl.current_level, 1) into plvl
          from public.player_stats_lifetime psl where psl.account_id = new.account_id;

        if coalesce(plvl, 1) > max_lvl then
          raise exception 'Your level (%) is too high for this beginners game (max level %).',
            coalesce(plvl, 1), max_lvl
            using errcode = 'check_violation';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_match_signups_beginner_gate on public.match_signups;
create trigger trg_match_signups_beginner_gate
  before insert or update on public.match_signups
  for each row execute function public.match_signup_beginner_gate();
