-- =============================================================================
-- Native live-feed watcher: a small program on the venue tablet posts round
-- files to /api/ingest/live, authenticated by a shared token (not a login).
-- Token is admin-managed in-app (view + regenerate). round_no on the ingest
-- rows keeps per-file round numbering stable across the streaming updates.
-- =============================================================================
create table if not exists public.live_ingest_config (
  operator_id uuid primary key default '00000000-0000-0000-0000-000000000001'
    references public.operators(id) on delete cascade,
  token       text not null,
  updated_at  timestamptz not null default now()
);

insert into public.live_ingest_config (operator_id, token)
  values ('00000000-0000-0000-0000-000000000001',
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (operator_id) do nothing;

alter table public.live_ingest_config enable row level security;
drop policy if exists live_ingest_config_admin_read on public.live_ingest_config;
create policy live_ingest_config_admin_read on public.live_ingest_config
  for select to authenticated using (public.is_admin());
grant select on public.live_ingest_config to authenticated;  -- service_role bypasses RLS

-- Admin: rotate the token.
create or replace function public.regenerate_live_ingest_token()
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.live_ingest_config
     set token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), updated_at = now()
   where operator_id = '00000000-0000-0000-0000-000000000001'
   returning token into t;
  return t;
end;
$$;
grant execute on function public.regenerate_live_ingest_token() to authenticated;

-- Stable per-file round number for the streaming ingest.
alter table public.match_ingest_rounds add column if not exists round_no integer;
