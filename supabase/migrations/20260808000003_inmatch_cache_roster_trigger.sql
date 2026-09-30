-- Keep the in-match scoreboard correct when the roster changes.
-- Admins fix a mistyped headband, add a mid-game swap headband, change a gun, or
-- reassign a walk-in to a profile by editing match_participants directly. Those
-- edits change how round-JSON headbands resolve to players, so the cached
-- per-round scoreboards (match_ingest_rounds.report) must be rebuilt. This
-- trigger clears that cache for the affected match on any roster change; the next
-- player load rebuilds it from the fresh roster. (The live feed already
-- re-resolves on each ingest push; the published report re-resolves at publish.)
--
-- SECURITY DEFINER so it also fires cleanly when a PLAYER joins (join_live_match
-- runs as the player, who has no write access to match_ingest_rounds).

create or replace function public.invalidate_inmatch_cache_on_roster_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.match_ingest_rounds
     set report = null, report_built_at = null
   where match_id = coalesce(new.match_id, old.match_id)
     and report_built_at is not null;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_inmatch_cache_roster on public.match_participants;
create trigger trg_inmatch_cache_roster
  after insert or update or delete on public.match_participants
  for each row execute function public.invalidate_inmatch_cache_on_roster_change();
