-- Idempotent token spends.
-- A network retry (or a duplicated request) of the same spend must not apply a
-- token twice. Each attempt carries a client-supplied idempotency key; the
-- unique key both dedupes AND serializes a concurrent retry (the retry's insert
-- blocks on the winner's uncommitted key, then returns the already-computed
-- result instead of spending again). A failed spend rolls the key back, so a
-- genuine retry after an error can still proceed.

create table if not exists public.token_spend_attempts (
  idempotency_key text primary key,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  match_id        uuid,
  amount          numeric,
  created_at      timestamptz not null default now()
);
alter table public.token_spend_attempts enable row level security;
-- No policies on purpose: only the SECURITY DEFINER spend_tokens (table owner)
-- ever reads/writes this; clients never touch it directly.

-- Replace the 2-arg spend_tokens with a 3-arg version (defaulted key). Drop the
-- old signature first so a 2-arg call isn't ambiguous.
drop function if exists public.spend_tokens(uuid, numeric);

create or replace function public.spend_tokens(p_match_id uuid, p_amount numeric, p_idempotency_key text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  acct uuid := public.current_account_id();
  m record; sg record; bal numeric; applied numeric; lot record; take numeric; todo numeric;
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive.'; end if;

  -- Idempotency guard: if this exact attempt already ran, return its result
  -- without spending again. FOUND is false when the key already exists (conflict).
  if p_idempotency_key is not null and length(p_idempotency_key) > 0 then
    insert into public.token_spend_attempts (idempotency_key, account_id, match_id, amount)
      values (p_idempotency_key, acct, p_match_id, p_amount)
      on conflict (idempotency_key) do nothing;
    if not found then
      select coalesce(-sum(delta), 0) into applied from public.token_transactions
        where account_id = acct and match_id = p_match_id and kind = 'spend';
      return applied;
    end if;
  end if;

  select id, status, price_eur, pricing_mode into m from public.matches where id = p_match_id;
  if m.id is null then raise exception 'Game not found.'; end if;
  if m.status not in ('confirmed', 'live') then raise exception 'This game is not open for payment.'; end if;

  select status, paid_at into sg from public.match_signups where match_id = p_match_id and account_id = acct;
  if sg.status is distinct from 'registered' then raise exception 'You are not signed up to this game.'; end if;
  if sg.paid_at is not null then raise exception 'This game is already paid.'; end if;

  -- tokens already applied by this player to this game (1 token = full game).
  select coalesce(-sum(delta), 0) into applied from public.token_transactions
    where account_id = acct and match_id = p_match_id and kind = 'spend';
  if applied + p_amount > 1 + 1e-6 then
    raise exception 'That is more than the game costs.';
  end if;

  select public.token_balance(acct) into bal;
  if bal < p_amount then raise exception 'Not enough tokens.'; end if;

  todo := p_amount;
  -- FOR UPDATE locks each lot so two concurrent spends can't over-draw the same
  -- lot (the amount_remaining >= 0 check is the final backstop).
  for lot in
    select * from public.token_lots
    where account_id = acct and amount_remaining > 0 and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, granted_at asc
    for update
  loop
    exit when todo <= 0;
    take := least(lot.amount_remaining, todo);
    update public.token_lots set amount_remaining = amount_remaining - take where id = lot.id;
    insert into public.token_transactions (account_id, delta, kind, lot_id, match_id)
      values (acct, -take, 'spend', lot.id, p_match_id);
    todo := todo - take;
  end loop;
  if todo > 1e-6 then raise exception 'Not enough tokens.'; end if;

  applied := applied + p_amount;
  -- Fully covered -> mark paid (record the euro value covered).
  if applied >= 1 - 1e-6 then
    update public.match_signups
      set paid_at = now(), payment_intent = 'token',
          paid_amount_eur = coalesce(m.price_eur, 0)
      where match_id = p_match_id and account_id = acct;
  end if;
  return applied;
end;
$$;

grant execute on function public.spend_tokens(uuid, numeric, text) to authenticated;
