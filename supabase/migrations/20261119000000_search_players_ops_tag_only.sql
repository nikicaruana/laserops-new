-- =============================================================================
-- Privacy fix: the gift-recipient search must NOT expose real names.
--
-- search_players (20261118000000) matched on and returned full_name, which lets
-- any signed-in user enumerate players' real names from their public ops tag -
-- a PII leak. Lock it to the ops tag only: match ops_tag, return ops_tag (the
-- public handle) + avatar, never full_name. Recipients are identified by ops tag
-- end to end; the admin panel (full account access) still shows names.
-- =============================================================================

-- Return signature changes (drops full_name), so drop before recreating.
drop function if exists public.search_players(text);

create or replace function public.search_players(p_query text)
returns table (id uuid, ops_tag text, profile_pic_url text)
language sql stable security definer set search_path = public as $$
  select a.id, a.ops_tag, a.profile_pic_url
  from public.accounts a
  where a.id <> coalesce(public.current_account_id(), '00000000-0000-0000-0000-000000000000'::uuid)
    and a.ops_tag is not null
    and length(btrim(coalesce(p_query, ''))) >= 2
    and a.ops_tag ilike '%' || btrim(p_query) || '%'
  order by
    (lower(a.ops_tag) = lower(btrim(p_query))) desc,
    (a.ops_tag ilike btrim(p_query) || '%') desc,
    a.ops_tag asc
  limit 8;
$$;
revoke execute on function public.search_players(text) from public, anon;
grant execute on function public.search_players(text) to authenticated;
