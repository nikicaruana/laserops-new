-- Allow players to sign up to a game that is already LIVE (e.g. latecomers).
-- Pay-after-game means there's no payment gate at sign-up, so there's no reason
-- to close booking the moment a game goes live. The waitlist gate still applies
-- (a full live game waitlists the new signup); completed/cancelled stay closed.
-- Mirrors the previous policy (20260731400000), adding 'live'.
drop policy if exists match_signups_insert_own on public.match_signups;
create policy match_signups_insert_own on public.match_signups
  for insert to authenticated with check (
    account_id = public.current_account_id()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status in ('tentative', 'awaiting_confirm', 'confirmed', 'live')
    )
  );
