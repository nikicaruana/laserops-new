-- 20260912000000_free_expired_ops_tag.sql
-- Ops tags are RESERVED for 2 years after an account is retired (deleted), so a
-- departed player can still reclaim their callsign + stats. After 2 years the tag
-- is released and a new player may take it.
--
-- Enforcement: ops_tag uniqueness is a unique index (can't express a time window),
-- so this SECURITY DEFINER helper releases an EXPIRED holder on demand. The profile
-- save (app/api/profile) calls it just before claiming a tag; if it frees the old
-- holder the claim then succeeds, otherwise the unique index still rejects (the tag
-- is held by a live account or a retired one still inside its 2-year window).
--
-- Safety: it only ever renames an account that is `retired` AND retired >= 2 years
-- ago - never a live or recently-retired account - so granting it to authenticated
-- players can't free an active/ reserved name.

create or replace function public.free_expired_ops_tag(p_ops_tag text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if p_ops_tag is null or btrim(p_ops_tag) = '' then
    return false;
  end if;

  select id into rid
    from public.accounts
   where lower(ops_tag) = lower(btrim(p_ops_tag))
     and claim_status = 'retired'
     and retired_at is not null
     and retired_at < now() - interval '2 years'
   order by retired_at asc
   limit 1;

  if rid is null then
    return false;
  end if;

  -- Release the tag (rename to a unique placeholder; ops_tag is NOT-NULL-propagated
  -- to denormalized nickname columns, so it can't be nulled) and end any reclaim.
  update public.accounts
     set ops_tag      = 'freed-' || left(replace(id::text, '-', ''), 10),
         reclaim_code = null,
         updated_at   = now()
   where id = rid;

  return true;
end;
$$;

grant execute on function public.free_expired_ops_tag(text) to authenticated;
