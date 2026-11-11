-- =============================================================================
-- Printable token vouchers (physical prizes with a QR code).
--
-- A voucher is an admin-minted token_gift with no buyer/recipient: 1 (or N)
-- game tokens, redeemed by scanning a QR that lands on /player-portal/claim?code=.
-- That page already auth-gates (sign up / in first, then claim) and claim is
-- idempotent, so vouchers reuse the whole gift-claim machinery. We only need:
--   * voucher rows (no recipient email),
--   * a mint RPC that generates a batch of unguessable short codes,
--   * void (single + batch) for lost sheets,
--   * claim_token_gift to reject voided codes and label voucher redemptions,
--   * an admin batch summary for the Tokens admin page.
-- =============================================================================
create extension if not exists pgcrypto;

alter table public.token_gifts alter column recipient_email drop not null;
alter table public.token_gifts add column if not exists is_voucher  boolean not null default false;
alter table public.token_gifts add column if not exists batch_label text;
alter table public.token_gifts add column if not exists created_by  uuid references public.accounts(id);
-- Claimable window: a voucher stops being redeemable after this (null = never,
-- which is how the existing email gifts behave).
alter table public.token_gifts add column if not exists expires_at  timestamptz;

-- allow a voucher to be voided (lost / reprinted sheet)
alter table public.token_gifts drop constraint if exists token_gifts_status_check;
alter table public.token_gifts add constraint token_gifts_status_check
  check (status in ('unclaimed', 'claimed', 'void'));

create index if not exists token_gifts_voucher_batch_idx on public.token_gifts (batch_label) where is_voucher;

-- --- short, unguessable, print-friendly code (no 0/O/1/I/L ambiguity) --------
create or replace function public._gen_voucher_code(p_len int default 10)
returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; n int := 30; out text; b bytea; i int;
begin
  loop
    b := gen_random_bytes(p_len);
    out := '';
    for i in 1..p_len loop
      out := out || substr(alphabet, 1 + (get_byte(b, i - 1) % n), 1);
    end loop;
    exit when not exists (select 1 from public.token_gifts where claim_code = out);
  end loop;
  return out;
end;
$$;

-- --- mint a batch of vouchers (admin) ---------------------------------------
create or replace function public.admin_mint_token_vouchers(
  p_count int, p_tokens numeric default 1, p_validity_months int default 12, p_label text default null
) returns table(id uuid, claim_code text)
language plpgsql security definer set search_path = public as $$
declare i int; code text; new_id uuid; actor uuid := public.current_account_id();
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_count is null or p_count < 1 or p_count > 500 then raise exception 'Count must be between 1 and 500.'; end if;
  if p_tokens is null or p_tokens <= 0 then raise exception 'Tokens per voucher must be greater than zero.'; end if;
  for i in 1..p_count loop
    code := public._gen_voucher_code(10);
    insert into public.token_gifts
      (buyer_account_id, recipient_email, tokens, validity_months, message, claim_code, is_voucher, batch_label, created_by, expires_at)
      values (null, null, p_tokens, coalesce(p_validity_months, 12), null, code, true, nullif(btrim(p_label), ''), actor,
              now() + make_interval(months => coalesce(p_validity_months, 12)))
      returning token_gifts.id, token_gifts.claim_code into new_id, code;
    id := new_id; claim_code := code; return next;
  end loop;
end;
$$;
grant execute on function public.admin_mint_token_vouchers(int, numeric, int, text) to authenticated;

-- --- void (single + whole batch) --------------------------------------------
create or replace function public.admin_void_voucher(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.token_gifts set status = 'void'
   where id = p_id and is_voucher and status = 'unclaimed';
end;
$$;
grant execute on function public.admin_void_voucher(uuid) to authenticated;

create or replace function public.admin_void_voucher_batch(p_label text)
returns integer language plpgsql security definer set search_path = public as $$
declare n int; lbl text := nullif(btrim(p_label), '');
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if lbl is null then raise exception 'A batch label is required to void a whole batch.'; end if;
  update public.token_gifts set status = 'void'
   where is_voucher and status = 'unclaimed' and batch_label = lbl;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.admin_void_voucher_batch(text) to authenticated;

-- --- admin batch summary ----------------------------------------------------
create or replace function public.admin_voucher_batches()
returns table(batch_label text, total bigint, unclaimed bigint, claimed bigint, voided bigint, tokens_each numeric, last_created timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return query
    select coalesce(g.batch_label, '(no label)') as batch_label,
           count(*)                                        as total,
           count(*) filter (where g.status = 'unclaimed')  as unclaimed,
           count(*) filter (where g.status = 'claimed')    as claimed,
           count(*) filter (where g.status = 'void')       as voided,
           max(g.tokens)                                   as tokens_each,
           max(g.created_at)                               as last_created
      from public.token_gifts g
     where g.is_voucher
     group by coalesce(g.batch_label, '(no label)')
     order by max(g.created_at) desc;
end;
$$;
grant execute on function public.admin_voucher_batches() to authenticated;

-- --- claim: reject voided codes + label voucher redemptions ------------------
create or replace function public.claim_token_gift(p_code text)
returns numeric language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id(); g public.token_gifts;
begin
  if acct is null then raise exception 'Sign in to claim your tokens.'; end if;
  select * into g from public.token_gifts where claim_code = btrim(p_code) for update;
  if g.id is null then raise exception 'That code is not valid.'; end if;
  if g.status = 'claimed' then raise exception 'This code has already been redeemed.'; end if;
  if g.status = 'void' then raise exception 'This code is no longer valid.'; end if;
  if g.expires_at is not null and g.expires_at < now() then raise exception 'This voucher has expired.'; end if;
  perform public._grant_token_lot(acct, g.tokens, 'gift', g.validity_months, null,
    case when g.is_voucher then 'Voucher redeemed' else 'Gift claimed' end, g.buyer_account_id, null);
  update public.token_gifts set status = 'claimed', claimed_by = acct, claimed_at = now() where id = g.id;
  return g.tokens;
end;
$$;
grant execute on function public.claim_token_gift(text) to authenticated;
