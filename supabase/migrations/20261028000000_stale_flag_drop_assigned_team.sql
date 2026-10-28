-- =============================================================================
-- Drop assigned_team from the "results went stale" check. assigned_team is the
-- Team Balancer's PLANNING-ONLY pre-game assignment: it is read nowhere in
-- scoring, ingestion, publishing, or the match report (only in TeamBalancer.tsx
-- and the /teams page), and actual in-game teams come from the round data, not
-- this column. So re-balancing teams after publishing must NOT mark results
-- stale / prompt a re-publish.
--
-- Everything else is unchanged from 20261026010000: on UPDATE only flag when a
-- genuinely scoring-relevant column changed (headband, merged bands, gun, linked
-- account); INSERT and DELETE still always flag (the roster changed).
-- =============================================================================
create or replace function public.flag_match_results_stale()
returns trigger language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if tg_op = 'UPDATE'
     and new.headset_label   is not distinct from old.headset_label
     and new.extra_headbands is not distinct from old.extra_headbands
     and new.gun_used        is not distinct from old.gun_used
     and new.account_id      is not distinct from old.account_id then
    return new; -- nothing scoring-relevant changed (payment, drinks, or team-balancer plan): leave fresh
  end if;

  mid := coalesce(new.match_id, old.match_id);
  update public.matches
     set results_stale_at = now()
   where id = mid and xp_distributed_at is not null and results_stale_at is null;
  return coalesce(new, old);
end;
$$;
