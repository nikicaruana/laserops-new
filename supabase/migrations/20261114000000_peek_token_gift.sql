-- Let the claim page show a voucher/gift's state on load (already redeemed,
-- voided, expired, not valid) instead of inviting a claim that then fails.
-- token_gifts isn't directly readable by players (claim goes through the
-- SECURITY DEFINER claim_token_gift), so this is a tiny read-only definer that
-- returns only what the claim screen needs to pick which message to render. It
-- never grants anything.
create or replace function public.peek_token_gift(p_code text)
returns table(found boolean, status text, tokens numeric, expired boolean, is_voucher boolean, claimed_by_me boolean)
language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); g public.token_gifts;
begin
  select * into g from public.token_gifts where claim_code = btrim(p_code);
  if g.id is null then
    return query select false, null::text, null::numeric, false, false, false;
    return;
  end if;
  return query select
    true,
    g.status,
    g.tokens,
    (g.expires_at is not null and g.expires_at < now()),
    g.is_voucher,
    (g.claimed_by is not null and g.claimed_by = acct);
end;
$$;
grant execute on function public.peek_token_gift(text) to authenticated;
