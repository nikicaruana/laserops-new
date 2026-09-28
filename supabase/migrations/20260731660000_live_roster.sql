-- =============================================================================
-- Live-join phase: let a registered player of a LIVE match see the whole roster
-- (who else has joined), not just their own row.
--   * An additive SELECT policy on match_participants — OR'd with the existing
--     read-own/admin policies — so a registered player of a live match can read
--     every participant row for that match. Powers realtime roster delivery and
--     the "taken headbands" hint on the join form. References matches +
--     match_signups only (never match_participants), so no RLS recursion.
--   * live_match_roster(match_id) — a clean, PII-safe roster for the player live
--     view: headband, display name (ops tag), gun, and whether the row is you.
--     Definer, but gated to registered players of the live match.
-- =============================================================================

drop policy if exists match_participants_live_roster on public.match_participants;
create policy match_participants_live_roster on public.match_participants
  for select to authenticated
  using (
    exists (
      select 1
      from public.matches mm
      join public.match_signups ms on ms.match_id = mm.id
      where mm.id = match_participants.match_id
        and mm.status = 'live'
        and ms.account_id = public.current_account_id()
        and ms.status = 'registered'
    )
  );

create or replace function public.live_match_roster(p_match_id uuid)
returns table (headset_label text, name text, gun_used text, is_self boolean)
language sql stable security definer set search_path = public as $$
  select p.headset_label,
         coalesce(a.ops_tag, p.display_name, 'Player'),
         p.gun_used,
         (p.account_id is not null and p.account_id = public.current_account_id())
  from public.match_participants p
  left join public.accounts a on a.id = p.account_id
  where p.match_id = p_match_id
    and exists (
      select 1
      from public.matches mm
      join public.match_signups ms on ms.match_id = mm.id
      where mm.id = p_match_id
        and mm.status = 'live'
        and ms.account_id = public.current_account_id()
        and ms.status = 'registered'
    )
  order by p.headset_label nulls last, p.joined_at;
$$;
grant execute on function public.live_match_roster(uuid) to authenticated;
