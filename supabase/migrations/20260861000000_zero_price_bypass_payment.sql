-- =============================================================================
-- Zero-price places (family & friends / comp, €0) should bypass the payment
-- system entirely: no money ledger row, and never flagged for a refund on
-- cancellation. Previously a €0 place was marked paid (paid_at set) with a €0
-- ledger entry, so it (a) cluttered "Last transactions" with €0.00 "Payment ·
-- Game" rows and (b) got flagged "refund needed" when the game was cancelled,
-- even though nothing was ever paid.
--
-- This migration:
--   1. admin_cancel_match: only flag a refund / tell the player "you'll be
--      refunded" when they actually paid money or spent tokens.
--   2. Clears stale refund flags on existing €0 comp places (dismisses the
--      "refund needed" admin alert via the admin_refund_alert trigger).
--   3. Deletes the €0 "Payment · Game" ledger rows (no money moved).
-- (The €0 ledger row is also no longer created going forward - see
--  lib/payments/apply.ts, which now skips the ledger + notification at €0.)
-- =============================================================================

create or replace function public.admin_cancel_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select id, status, title into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Match not found.'; end if;
  if m.status in ('completed', 'cancelled') then return; end if;

  update public.matches set status = 'cancelled' where id = p_match_id;

  -- Only players who actually paid money or spent tokens are owed a refund. A
  -- zero-price place (paid_amount_eur 0 and no tokens spent) has nothing to
  -- refund, so it is never flagged for one.
  update public.match_signups s set refund_status = 'pending'
    where s.match_id = p_match_id and s.status = 'registered'
      and s.paid_at is not null and s.refund_status is null
      and (coalesce(s.paid_amount_eur, 0) > 0
           or exists (select 1 from public.token_transactions tt
                        where tt.match_id = p_match_id and tt.account_id = s.account_id and tt.kind = 'spend'));

  -- Notify each registered player; the refund variant only for those actually owed one.
  insert into public.notifications (account_id, type_key, priority, title, body, href, data)
  select s.account_id,
         case when owed.yes then 'match_cancelled_refund' else 'match_cancelled' end,
         nt.priority,
         coalesce(m.title, 'Your game') || ' was cancelled',
         case when owed.yes then 'This game was cancelled. You will be refunded.' else 'This game was cancelled.' end,
         '/player-portal/games/' || p_match_id::text,
         jsonb_build_object('matchLabel', coalesce(m.title, 'Your game'))
  from public.match_signups s
  cross join lateral (
    select (s.paid_at is not null
            and (coalesce(s.paid_amount_eur, 0) > 0
                 or exists (select 1 from public.token_transactions tt
                              where tt.match_id = p_match_id and tt.account_id = s.account_id and tt.kind = 'spend'))) as yes
  ) owed
  join public.notification_types nt
    on nt.key = (case when owed.yes then 'match_cancelled_refund' else 'match_cancelled' end)
   and nt.is_active
  where s.match_id = p_match_id and s.status = 'registered';
end;
$$;
grant execute on function public.admin_cancel_match(uuid) to authenticated;

-- Cleanup 2: clear stale refund flags on zero-price comp places (nothing was
-- ever owed). Moving refund_status off 'pending' fires admin_refund_alert, which
-- dismisses the "refund needed" admin notification.
update public.match_signups
   set refund_status = null
 where payment_provider = 'comp'
   and coalesce(paid_amount_eur, 0) = 0
   and refund_status is not null;

-- Cleanup 3: remove the €0 "Payment · Game" ledger rows (pure clutter, no money).
delete from public.financial_entries
 where category = 'game' and coalesce(amount_eur, 0) = 0;
