-- =============================================================================
-- Pay-after-game cutover: buying a token PACK becomes a REQUEST (no online pay).
-- A logged-in player requests a bundle -> admins are notified -> player sees
-- "we'll be in touch" -> an admin fulfils (grants the tokens, optionally records
-- the cash/Revolut money) or declines. Viva/online checkout is retired for packs.
-- =============================================================================

-- Admin alert type for a new request.
insert into public.admin_notification_types (key, label, description, priority, sort_order) values
  ('token_pack_request', 'Token pack requested', 'A player asked to buy a token pack (settle + grant manually).', 2, 9)
on conflict (key) do nothing;

create table if not exists public.token_pack_requests (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts(id) on delete cascade,
  bundle_id        uuid references public.token_bundles(id) on delete set null,
  bundle_name      text not null,
  tokens           numeric(12,4) not null,
  price_eur        numeric(10,2) not null,
  validity_months  integer,
  status           text not null default 'pending' check (status in ('pending','fulfilled','declined')),
  note             text,
  created_at       timestamptz not null default now(),
  handled_at       timestamptz,
  handled_by       uuid references public.accounts(id)
);
create index if not exists token_pack_requests_status_idx on public.token_pack_requests (status, created_at desc);

alter table public.token_pack_requests enable row level security;
drop policy if exists token_pack_requests_own on public.token_pack_requests;
create policy token_pack_requests_own on public.token_pack_requests
  for select to authenticated using (account_id = public.current_account_id() or public.is_admin());
drop policy if exists token_pack_requests_admin on public.token_pack_requests;
create policy token_pack_requests_admin on public.token_pack_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.token_pack_requests to authenticated;
grant select, insert, update, delete on public.token_pack_requests to service_role;

-- Player requests a pack (no payment). Snapshots the bundle + alerts admins.
create or replace function public.request_token_pack(p_bundle_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); b record; a record; rid uuid;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  select id, name, tokens, price_eur, validity_months, is_active into b from public.token_bundles where id = p_bundle_id;
  if b.id is null or not b.is_active then raise exception 'That bundle is not available.'; end if;

  -- One open request per bundle per player (avoid accidental double taps).
  if exists (select 1 from public.token_pack_requests where account_id = acct and bundle_id = p_bundle_id and status = 'pending') then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select full_name, ops_tag into a from public.accounts where id = acct;
  insert into public.token_pack_requests (account_id, bundle_id, bundle_name, tokens, price_eur, validity_months)
    values (acct, b.id, b.name, b.tokens, b.price_eur, b.validity_months)
    returning id into rid;

  perform public.emit_admin_notification(
    'token_pack_request',
    coalesce(a.full_name, a.ops_tag, 'A player') || ' wants the ' || b.name || ' pack',
    coalesce(a.ops_tag, 'player') || ' requested ' || trim(to_char(b.tokens, 'FM990.##')) || ' tokens (EUR '
      || trim(to_char(b.price_eur, 'FM990.00')) || '). Settle the payment, then grant the tokens.',
    '/admin/tokens', 'token_pack_request', rid, 'token_pack_request:' || rid::text, null
  );
  return jsonb_build_object('ok', true, 'requestId', rid);
end;
$$;
grant execute on function public.request_token_pack(uuid) to authenticated;

-- Admin fulfils a request: grants the tokens, optionally records the money.
create or replace function public.admin_fulfil_token_pack_request(p_request_id uuid, p_method text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; actor uuid := public.current_account_id(); meth text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
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

-- Admin declines a request (no grant).
create or replace function public.admin_decline_token_pack_request(p_request_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; actor uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into r from public.token_pack_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  update public.token_pack_requests
     set status = 'declined', note = nullif(btrim(coalesce(p_note, '')), ''), handled_at = now(), handled_by = actor
   where id = r.id and status = 'pending';
  delete from public.admin_notifications where dedupe_key = 'token_pack_request:' || r.id::text;
end;
$$;
grant execute on function public.admin_decline_token_pack_request(uuid, text) to authenticated;
