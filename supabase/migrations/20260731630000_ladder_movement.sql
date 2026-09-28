-- =============================================================================
-- Ladder movement (Stage B): positions move automatically from results.
--   * Swap-on-win — recording a ladder match's winning squad swaps the two squads
--     when the winner sat BELOW the loser (an upset); a higher-ranked win holds.
--     Recording also stamps both squads' idle clock and completes the match.
--   * Idle-drop — a squad that hasn't played a ladder match within the ladder's
--     max_idle_days drops one place (run from a cron route). Dropping resets the
--     clock so the next drop is a full period away, not every cron tick.
-- A ladder match is a normal matches row carrying ladder_id + home/away squad
-- (booked by respond_ladder_challenge). winner_squad_id records the outcome; the
-- future auto-ingest commit can call apply_ladder_match_result once it derives a
-- squad winner from team scores.
-- =============================================================================

alter table public.matches
  add column if not exists winner_squad_id uuid references public.squads(id);

-- Record a ladder match result and move positions. Admin only for now (the same
-- entry point the auto-ingest commit will reuse). No-op movement if either squad
-- has since left the ladder; the result is still recorded.
create or replace function public.apply_ladder_match_result(p_match_id uuid, p_winner_squad_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m record; loser uuid; wpos int; lpos int;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id, ladder_id, home_squad_id, away_squad_id into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.ladder_id is null or m.home_squad_id is null or m.away_squad_id is null then
    raise exception 'This is not a ladder match.';
  end if;
  if p_winner_squad_id not in (m.home_squad_id, m.away_squad_id) then
    raise exception 'The winner must be one of the two squads.';
  end if;
  loser := case when p_winner_squad_id = m.home_squad_id then m.away_squad_id else m.home_squad_id end;

  update public.matches
    set winner_squad_id = p_winner_squad_id,
        status = 'completed',
        played_on = coalesce(played_on, current_date)
    where id = p_match_id;

  -- Both squads just played — resets their idle clock.
  update public.ladder_squads set last_match_at = now()
    where ladder_id = m.ladder_id and squad_id in (p_winner_squad_id, loser);

  select position into wpos from public.ladder_squads where ladder_id = m.ladder_id and squad_id = p_winner_squad_id;
  select position into lpos from public.ladder_squads where ladder_id = m.ladder_id and squad_id = loser;
  if wpos is null or lpos is null then return; end if;

  -- Swap only when the winner was ranked BELOW the loser (lower squad beats higher).
  if wpos > lpos then
    update public.ladder_squads
      set position = case squad_id when p_winner_squad_id then lpos else wpos end
      where ladder_id = m.ladder_id and squad_id in (p_winner_squad_id, loser);
  end if;
end;
$$;
grant execute on function public.apply_ladder_match_result(uuid, uuid) to authenticated;

-- Drop idle squads one place across all active ladders. A single re-rank per
-- ladder: an idle squad's sort key is nudged +1.5 so it falls exactly one place
-- (past the next squad, not two). Squads that actually drop get their clock reset.
create or replace function public.drop_idle_ladder_squads()
returns integer language plpgsql security definer set search_path = public as $$
declare moved int := 0;
begin
  with ranked as (
    select ls.ladder_id, ls.squad_id, ls.position as old_pos,
           row_number() over (
             partition by ls.ladder_id
             order by ls.position
               + case
                   when coalesce(ls.last_match_at, ls.joined_at)
                        < now() - make_interval(days => coalesce(l.max_idle_days, 30))
                   then 1.5 else 0
                 end
           )::int as new_pos
    from public.ladder_squads ls
    join public.ladders l on l.id = ls.ladder_id
    where l.is_active
  ),
  updated as (
    update public.ladder_squads t
       set position = r.new_pos,
           last_match_at = case when r.new_pos > r.old_pos then now() else t.last_match_at end
      from ranked r
     where t.ladder_id = r.ladder_id and t.squad_id = r.squad_id and r.new_pos <> r.old_pos
     returning (r.new_pos > r.old_pos) as dropped
  )
  select count(*) filter (where dropped) into moved from updated;
  return moved;
end;
$$;
grant execute on function public.drop_idle_ladder_squads() to service_role;
