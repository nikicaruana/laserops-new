-- Fix: voucher code generation failed with "function gen_random_bytes(integer)
-- does not exist". pgcrypto is installed in the `extensions` schema on Supabase,
-- but _gen_voucher_code had no search_path of its own, so when called from the
-- SECURITY DEFINER minting function (search_path = public) it could only see
-- `public` and could not resolve gen_random_bytes. Give it a search_path that
-- includes `extensions` so the function resolves regardless of which schema
-- pgcrypto lives in.

create extension if not exists pgcrypto with schema extensions;

create or replace function public._gen_voucher_code(p_len int default 10)
returns text
language plpgsql
set search_path = public, extensions
as $$
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
