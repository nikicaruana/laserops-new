-- =============================================================================
-- Token pack requests: contact + safeguards.
--  * accounts.phone - a contact number on the account (needed to action a pack
--    request). request_token_pack now REQUIRES it (raises PHONE_REQUIRED so the
--    UI can send the player to add one).
--  * admin_fulfil_token_pack_request now requires 2FA (aal2), like other token
--    grants, since fulfilling credits tokens (a money action).
-- =============================================================================

alter table public.accounts add column if not exists phone text;

-- Players may set their own phone (profile page). Admins can read it.
-- (accounts already has owner-update RLS; phone rides along with it.)

create or replace function public.request_token_pack(p_bundle_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); b record; a record; rid uuid;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  select full_name, ops_tag, phone into a from public.accounts where id = acct;
  if a.phone is null or btrim(a.phone) = '' then
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
      || trim(to_char(b.price_eur, 'FM990.00')) || '). Call ' || a.phone || ' to settle, then grant the tokens.',
    '/admin/tokens', 'token_pack_request', rid, 'token_pack_request:' || rid::text, null
  );
  return jsonb_build_object('ok', true, 'requestId', rid);
end;
$$;
grant execute on function public.request_token_pack(uuid) to authenticated;

create or replace function public.admin_fulfil_token_pack_request(p_request_id uuid, p_method text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; actor uuid := public.current_account_id(); meth text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Two-factor authentication is required to grant tokens.';
  end if;
  select * into r from public.token_pack_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request is already %.', r.status; end if;

  perform public._grant_token_lot(
    r.account_id, r.tokens, 'purchase', coalesce(r.validity_months, 6), null,
    'Token pack: ' || r.bundle_name, actor, null
  );

  meth := nullif(btrim(coalesce(p_method, '')), '');
  if meth is not null and meth in ('cash','revolut','card','bank') then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'tokens', r.price_eur, meth, r.account_id, null, 'token_manual',
              'Token pack (' || r.bundle_name || ', ' || meth || ')');
  end if;

  update public.token_pack_requests set status = 'fulfilled', handled_at = now(), handled_by = actor where id = r.id;
  delete from public.admin_notifications where dedupe_key = 'token_pack_request:' || r.id::text;
  return jsonb_build_object('ok', true, 'tokens', r.tokens);
end;
$$;
grant execute on function public.admin_fulfil_token_pack_request(uuid, text) to authenticated;
