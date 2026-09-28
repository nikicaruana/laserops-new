-- =============================================================================
-- refund_match_tokens — credit the TOKEN portion of a game refund
-- =============================================================================
-- The refund logic in lib/payments/refund.ts runs server-side with the service
-- role (match cancellation, early-end) or in the player's own drop-out route,
-- neither of which is an admin session — so admin_refund_tokens' is_admin() gate
-- can't be used. This mirrors admin_refund_tokens WITHOUT the admin check: the
-- trusted server-side refund flow is the authority. Credits a 'refund' token lot
-- for p_amount tokens on the player's account (actor = null = system).
-- =============================================================================
create or replace function public.refund_match_tokens(p_acct uuid, p_amount numeric, p_match_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if p_acct is null or p_amount is null or p_amount <= 0 then return null; end if;
  return public._grant_token_lot(
    p_acct, p_amount, 'refund',
    (select default_validity_months from public.token_config where id = 1),
    null, coalesce(nullif(btrim(p_note), ''), 'Token refund'), null, p_match_id);
end;
$$;

grant execute on function public.refund_match_tokens(uuid, numeric, uuid, text) to service_role, authenticated;
