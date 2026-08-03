-- =============================================================================
-- Keep signups open until a game actually starts.
-- Signups were only allowed while tentative / awaiting_confirm, which closed
-- them at 'confirmed' — and private bookings are created confirmed, so nobody
-- could sign up to a private game via its invite link. A private game is just
-- an unlisted game (kept off the public calendar); it still takes signups.
-- Allow inserts while tentative / awaiting_confirm / confirmed (capacity-checked);
-- live / completed / cancelled remain closed.
-- =============================================================================

drop policy if exists match_signups_insert_own on public.match_signups;
create policy match_signups_insert_own on public.match_signups
  for insert to authenticated with check (
    account_id = public.current_account_id()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status in ('tentative', 'awaiting_confirm', 'confirmed')
        and (m.max_players is null or m.registered_count < m.max_players)
    )
  );
