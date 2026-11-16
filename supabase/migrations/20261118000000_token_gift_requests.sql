-- =============================================================================
-- Player-to-player game-token GIFTS (manual payment, like token pack requests).
--
-- An existing player gifts 1 (or 1/2) game token to another existing player with
-- an optional message. There is NO online payment: the gift becomes a REQUEST ->
-- admins are alerted -> an admin collects the money (cash / Revolut) from the
-- buyer and fulfils, which grants the token(s) to the recipient and notifies
-- them. Mirrors token_pack_requests (20260879000000) but the grant lands on the
-- recipient, not the buyer.
-- =============================================================================

-- Admin alert type for a new gift request.
insert into public.admin_notification_types (key, label, description, priority, sort_order) values
  ('token_gift_request', 'Token gift requested', 'A player wants to gift game tokens to another player (settle + grant manually).', 2, 11)
on conflict (key) do nothing;

create table if not exists public.token_gift_requests (
  id                   uuid primary key default gen_random_uuid(),
  buyer_account_id     uuid not null references public.accounts(id) on delete cascade,
  recipient_account_id uuid not null references public.accounts(id) on delete cascade,
  tokens               numeric(12,4) not null check (tokens > 0),
  price_eur            numeric(10,2) not null,
  validity_months      integer,
  message              text,
  status               text not null default 'pending' check (status in ('pending','fulfilled','declined')),
  note                 text,
  created_at           timestamptz not null default now(),
  handled_at           timestamptz,
  handled_by           uuid references public.accounts(id),
  check (buyer_account_id <> recipient_account_id)
);
create index if not exists token_gift_requests_status_idx on public.token_gift_requests (status, created_at desc);

alter table public.token_gift_requests enable row level security;
drop policy if exists token_gift_requests_own on public.token_gift_requests;
create policy token_gift_requests_own on public.token_gift_requests
  for select to authenticated using (
    buyer_account_id = public.current_account_id()
    or recipient_account_id = public.current_account_id()
    or public.is_admin()
  );
drop policy if exists token_gift_requests_admin on public.token_gift_requests;
create policy token_gift_requests_admin on public.token_gift_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.token_gift_requests to authenticated;
grant select, insert, update, delete on public.token_gift_requests to service_role;

-- --- public player search (for picking a gift recipient) --------------------
-- ops_tag + full_name are already public (leaderboards), so searching them is no
-- new disclosure. Returns only public display fields - never email or phone -
-- excludes the caller, and only matches real, named profiles.
create or replace function public.search_players(p_query text)
returns table (id uuid, ops_tag text, full_name text, profile_pic_url text)
language sql stable security definer set search_path = public as $$
  select a.id, a.ops_tag, a.full_name, a.profile_pic_url
  from public.accounts a
  where a.id <> coalesce(public.current_account_id(), '00000000-0000-0000-0000-000000000000'::uuid)
    and a.ops_tag is not null
    and length(btrim(coalesce(p_query, ''))) >= 2
    and (a.ops_tag ilike '%' || btrim(p_query) || '%' or a.full_name ilike '%' || btrim(p_query) || '%')
  order by
    (lower(a.ops_tag) = lower(btrim(p_query))) desc,
    (a.ops_tag ilike btrim(p_query) || '%') desc,
    a.ops_tag asc
  limit 8;
$$;
revoke execute on function public.search_players(text) from public, anon;
grant execute on function public.search_players(text) to authenticated;

-- --- player requests a gift (no payment). Alerts admins. --------------------
create or replace function public.request_token_gift(
  p_recipient_account_id uuid, p_tokens numeric, p_message text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  cfg public.token_config; r record; b record;
  toks numeric; price numeric; vm integer; msg text; rid uuid;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if p_recipient_account_id is null then raise exception 'Choose who the gift is for.'; end if;
  if p_recipient_account_id = acct then raise exception 'You can''t gift a token to yourself.'; end if;

  select id, ops_tag, full_name into r from public.accounts where id = p_recipient_account_id;
  if r.id is null then raise exception 'That player could not be found.'; end if;

  -- Only whole or half game tokens.
  toks := round(coalesce(p_tokens, 0)::numeric, 1);
  if toks not in (0.5, 1) then raise exception 'You can gift 1 token or half a token.'; end if;

  select * into cfg from public.token_config where id = 1;
  price := round(coalesce(cfg.single_token_price_eur, 35) * toks, 2);
  vm := coalesce(cfg.single_token_validity_months, 6);
  msg := nullif(btrim(coalesce(p_message, '')), '');
  if msg is not null and length(msg) > 500 then msg := left(msg, 500); end if;

  select full_name, ops_tag into b from public.accounts where id = acct;

  insert into public.token_gift_requests (buyer_account_id, recipient_account_id, tokens, price_eur, validity_months, message)
    values (acct, r.id, toks, price, vm, msg)
    returning id into rid;

  perform public.emit_admin_notification(
    'token_gift_request',
    coalesce(b.full_name, b.ops_tag, 'A player') || ' wants to gift '
      || trim(to_char(toks, 'FM990.##')) || ' token' || case when toks = 1 then '' else 's' end
      || ' to ' || coalesce(r.ops_tag, r.full_name, 'a player'),
    coalesce(b.ops_tag, 'A player') || ' is gifting ' || trim(to_char(toks, 'FM990.##'))
      || ' token(s) (EUR ' || trim(to_char(price, 'FM990.00')) || ') to '
      || coalesce(r.ops_tag, r.full_name, 'a player') || '. Collect payment from the buyer, then fulfil to grant the tokens.',
    '/admin/tokens', 'token_gift_request', rid, 'token_gift_request:' || rid::text, null
  );
  return jsonb_build_object('ok', true, 'requestId', rid);
end;
$$;
grant execute on function public.request_token_gift(uuid, numeric, text) to authenticated;

-- --- admin fulfils a gift: grants tokens to the recipient, records the money,
--     notifies the recipient. ---------------------------------------------------
create or replace function public.admin_fulfil_token_gift_request(p_request_id uuid, p_method text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; buyer record; actor uuid := public.current_account_id(); meth text;
  title text; body text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into r from public.token_gift_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request is already %.', r.status; end if;

  select full_name, ops_tag into buyer from public.accounts where id = r.buyer_account_id;

  -- Grant the token(s) to the recipient; the ledger records the buyer as gifter.
  perform public._grant_token_lot(
    r.recipient_account_id, r.tokens, 'gift', coalesce(r.validity_months, 6), null,
    'Gift from ' || coalesce(buyer.ops_tag, buyer.full_name, 'a player'), r.buyer_account_id, null
  );

  -- Record the money in (from the buyer) when a method is picked.
  meth := nullif(btrim(coalesce(p_method, '')), '');
  if meth is not null and meth in ('cash','revolut','card','bank') then
    insert into public.financial_entries (direction, category, amount_eur, method, account_id, match_id, source, note)
      values ('payment', 'tokens', r.price_eur, meth, r.buyer_account_id, null, 'token_manual',
              'Game token gift (' || trim(to_char(r.tokens, 'FM990.##')) || ' token, ' || meth || ')');
  end if;

  -- Tell the recipient they've been gifted tokens.
  title := coalesce(buyer.ops_tag, buyer.full_name, 'A player') || ' sent you '
    || trim(to_char(r.tokens, 'FM990.##')) || ' game token' || case when r.tokens = 1 then '' else 's' end;
  body := case
    when r.message is not null then '"' || r.message || '"  -  '
    else ''
  end || 'Enjoy your game, on ' || coalesce(buyer.full_name, buyer.ops_tag, 'a friend') || '.';
  perform public.emit_notification(
    r.recipient_account_id, 'tokens_gifted', title, body, '/player-portal/profile',
    jsonb_build_object('tokens', r.tokens, 'from_account', r.buyer_account_id, 'message', r.message)
  );

  update public.token_gift_requests set status = 'fulfilled', handled_at = now(), handled_by = actor where id = r.id;
  delete from public.admin_notifications where dedupe_key = 'token_gift_request:' || r.id::text;
  return jsonb_build_object('ok', true, 'tokens', r.tokens);
end;
$$;
grant execute on function public.admin_fulfil_token_gift_request(uuid, text) to authenticated;

-- --- admin declines a gift request (no grant) -------------------------------
create or replace function public.admin_decline_token_gift_request(p_request_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; actor uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  select * into r from public.token_gift_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  update public.token_gift_requests
     set status = 'declined', note = nullif(btrim(coalesce(p_note, '')), ''), handled_at = now(), handled_by = actor
   where id = r.id and status = 'pending';
  delete from public.admin_notifications where dedupe_key = 'token_gift_request:' || r.id::text;
end;
$$;
grant execute on function public.admin_decline_token_gift_request(uuid, text) to authenticated;
