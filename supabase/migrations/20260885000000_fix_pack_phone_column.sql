-- =============================================================================
-- Correction: the account contact number is accounts.phone_e164 (existing,
-- captured on the profile page), not a new accounts.phone. Drop the stray column
-- added in 20260884 and point request_token_pack at phone_e164.
-- =============================================================================
alter table public.accounts drop column if exists phone;

create or replace function public.request_token_pack(p_bundle_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); b record; a record; rid uuid;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  select full_name, ops_tag, phone_e164 into a from public.accounts where id = acct;
  if a.phone_e164 is null or btrim(a.phone_e164) = '' then
    raise exception 'PHONE_REQUIRED';
  end if;
  select id, name, tokens, price_eur, validity_months, is_active into b from public.token_bundles where id = p_bundle_id;
  if b.id is null or not b.is_active then raise exception 'That bundle is not available.'; end if;

  if exists (select 1 from public.token_pack_requests where account_id = acct and bundle_id = p_bundle_id and status = 'pending') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  insert into public.token_pack_requests (account_id, bundle_id, bundle_name, tokens, price_eur, validity_months)
    values (acct, b.id, b.name, b.tokens, b.price_eur, b.validity_months)
    returning id into rid;

  perform public.emit_admin_notification(
    'token_pack_request',
    coalesce(a.full_name, a.ops_tag, 'A player') || ' wants the ' || b.name || ' pack',
    coalesce(a.ops_tag, 'player') || ' requested ' || trim(to_char(b.tokens, 'FM990.##')) || ' tokens (EUR '
      || trim(to_char(b.price_eur, 'FM990.00')) || '). Call ' || a.phone_e164 || ' to settle, then grant the tokens.',
    '/admin/tokens', 'token_pack_request', rid, 'token_pack_request:' || rid::text, null
  );
  return jsonb_build_object('ok', true, 'requestId', rid);
end;
$$;
grant execute on function public.request_token_pack(uuid) to authenticated;
