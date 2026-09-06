-- =============================================================================
-- Live match feed. The venue tablet (admin) pushes a compact snapshot of the
-- current round (base ownership + timers + events so far) every couple of
-- seconds; players' phones + a public view subscribe via Realtime and render it.
-- One row per match (upserted). Public-readable (there is a public live view);
-- admin-write. Realtime-enabled.
-- =============================================================================
create table if not exists public.match_live_state (
  match_id        uuid primary key references public.matches(id) on delete cascade,
  round_no        integer,
  elapsed_seconds numeric,
  snapshot        jsonb not null,          -- RoundData (lib/live-sim/engine)
  server_ts       timestamptz not null default now(),  -- when this snapshot was built
  updated_at      timestamptz not null default now()
);

alter table public.match_live_state enable row level security;

drop policy if exists match_live_state_public_read on public.match_live_state;
create policy match_live_state_public_read on public.match_live_state
  for select to anon, authenticated using (true);

drop policy if exists match_live_state_admin_write on public.match_live_state;
create policy match_live_state_admin_write on public.match_live_state
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.match_live_state to anon, authenticated;
grant insert, update, delete on public.match_live_state to authenticated;  -- RLS-gated to admins
grant select, insert, update, delete on public.match_live_state to service_role;

drop trigger if exists trg_match_live_state_updated_at on public.match_live_state;
create trigger trg_match_live_state_updated_at before update on public.match_live_state
  for each row execute function public.set_updated_at();

-- Realtime (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_live_state'
  ) then
    alter publication supabase_realtime add table public.match_live_state;
  end if;
end $$;
