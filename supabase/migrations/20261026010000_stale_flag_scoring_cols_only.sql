-- =============================================================================
-- "Line-up changed since publishing" was showing after ANY match_participants
-- update - including payment/settlement edits (marking a player paid) - because
-- flag_match_results_stale fired on every row update. Results only depend on who
-- played and how they're scored, so on UPDATE only flag when a scoring-relevant
-- column actually changed (headband, merged bands, gun, linked account, team).
-- INSERT and DELETE still always flag (a player added/removed changes the roster).
-- =============================================================================
create or replace function public.flag_match_results_stale()
returns trigger language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if tg_op = 'UPDATE'
     and new.headset_label   is not distinct from old.headset_label
     and new.extra_headbands is not distinct from old.extra_headbands
     and new.gun_used        is not distinct from old.gun_used
     and new.account_id      is not distinct from old.account_id
     and new.assigned_team   is not distinct from old.assigned_team then
    return new; -- nothing scoring-relevant changed (e.g. a payment edit): leave fresh
  end if;

  mid := coalesce(new.match_id, old.match_id);
  update public.matches
     set results_stale_at = now()
   where id = mid and xp_distributed_at is not null and results_stale_at is null;
  return coalesce(new, old);
end;
$$;
