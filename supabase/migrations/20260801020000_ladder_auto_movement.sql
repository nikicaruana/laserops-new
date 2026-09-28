-- 20260801020000_ladder_auto_movement.sql
-- --------------------------------------------------------------------
-- Ladder positions now move AUTOMATICALLY from a ladder match's winning team
-- colour. When a ladder match gets a winning_team_colour (set by an admin
-- recording the result, or by the future ingestion commit), a trigger maps that
-- colour to the winning squad (via the per-match squad colours) and runs the
-- Stage B movement - no manual "who won" pick, and ingestion moves ladders with
-- zero admin input.
--
-- Movement core is factored out (_apply_ladder_movement, no admin gate) so both
-- the admin RPC and the trigger share one implementation.

-- Core swap logic (no admin gate; internal). Idempotent: no-op once a winner is
-- already recorded, or if either squad has left the ladder.
create or replace function public._apply_ladder_movement(p_match_id uuid, p_winner_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m record; loser uuid; wpos int; lpos int;
begin
  select id, ladder_id, home_squad_id, away_squad_id, winner_squad_id into m
    from public.matches where id = p_match_id;
  if m.id is null or m.ladder_id is null or m.home_squad_id is null or m.away_squad_id is null then return; end if;
  if m.winner_squad_id is not null then return; end if; -- already applied
  if p_winner_squad_id not in (m.home_squad_id, m.away_squad_id) then return; end if;
  loser := case when p_winner_squad_id = m.home_squad_id then m.away_squad_id else m.home_squad_id end;

  update public.matches
    set winner_squad_id = p_winner_squad_id,
        status = 'completed',
        played_on = coalesce(played_on, current_date)
    where id = p_match_id;

  update public.ladder_squads set last_match_at = now()
    where ladder_id = m.ladder_id and squad_id in (p_winner_squad_id, loser);

  select position into wpos from public.ladder_squads where ladder_id = m.ladder_id and squad_id = p_winner_squad_id;
  select position into lpos from public.ladder_squads where ladder_id = m.ladder_id and squad_id = loser;
  if wpos is null or lpos is null then return; end if;

  if wpos > lpos then -- lower squad beat a higher one: swap up
    update public.ladder_squads
      set position = case squad_id when p_winner_squad_id then lpos else wpos end
      where ladder_id = m.ladder_id and squad_id in (p_winner_squad_id, loser);
  end if;
end;
$$;

-- Admin RPC by squad id (unchanged external behaviour; now delegates to the core).
create or replace function public.apply_ladder_match_result(p_match_id uuid, p_winner_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public._apply_ladder_movement(p_match_id, p_winner_squad_id);
end;
$$;
grant execute on function public.apply_ladder_match_result(uuid, uuid) to authenticated;

-- Admin records the result as the winning TEAM COLOUR; the trigger derives the
-- squad and moves. Requires the per-match squad colours to be assigned.
create or replace function public.record_ladder_result(p_match_id uuid, p_winning_colour text)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id, ladder_id, home_squad_colour, away_squad_colour into m from public.matches where id = p_match_id;
  if m.id is null or m.ladder_id is null then raise exception 'This is not a ladder match.'; end if;
  if m.home_squad_colour is null or m.away_squad_colour is null then
    raise exception 'Assign both squads a team colour before recording the result.';
  end if;
  if lower(p_winning_colour) not in (lower(m.home_squad_colour), lower(m.away_squad_colour)) then
    raise exception 'The winning colour must be one of the two squads'' colours.';
  end if;
  update public.matches set winning_team_colour = p_winning_colour where id = p_match_id; -- fires the trigger
end;
$$;
grant execute on function public.record_ladder_result(uuid, text) to authenticated;

-- Trigger: on any ladder match that has a winning_team_colour but no winner yet,
-- map the colour to a squad (via the assigned squad colours) and apply movement.
create or replace function public.trg_ladder_auto_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare winner uuid;
begin
  if new.winning_team_colour is null or new.winner_squad_id is not null or new.ladder_id is null then return new; end if;
  if new.home_squad_id is null or new.away_squad_id is null or new.home_squad_colour is null or new.away_squad_colour is null then return new; end if;
  if lower(new.winning_team_colour) = lower(new.home_squad_colour) then
    winner := new.home_squad_id;
  elsif lower(new.winning_team_colour) = lower(new.away_squad_colour) then
    winner := new.away_squad_id;
  else
    return new; -- colour doesn't match either squad; leave for a correction
  end if;
  perform public._apply_ladder_movement(new.id, winner);
  return new;
end;
$$;

drop trigger if exists ladder_auto_movement on public.matches;
create trigger ladder_auto_movement
  after update on public.matches
  for each row
  when (new.winning_team_colour is not null and new.winner_squad_id is null and new.ladder_id is not null)
  execute function public.trg_ladder_auto_movement();
