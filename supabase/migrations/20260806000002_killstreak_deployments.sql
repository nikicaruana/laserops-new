-- =============================================================================
-- killstreak_deployments — live, in-progress killstreak jams
-- =============================================================================
-- When a player deploys a killstreak from the live feed, a row is inserted here
-- and the enemy team's phones render the jam until expires_at. Persisting the
-- deploy (rather than a fire-and-forget broadcast) means a phone that reloads
-- mid-jam re-reads the active rows and keeps showing it — so pull-to-refresh
-- can't clear an incoming scrambler. Rows are transient: the publish route wipes
-- a match's deployments when scores are published, and reads only ever select
-- unexpired rows, so stale data never renders.
--
-- On delete of the match (cascade) the rows go too.
-- =============================================================================

create table if not exists public.killstreak_deployments (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches(id) on delete cascade,
  round_no       integer,
  killstreak_key text not null,
  by_player      text not null,          -- deployer ops tag / nickname
  by_team        text not null,          -- deployer team colour
  scope          text not null default 'one' check (scope in ('one', 'all')),
  base_ids       integer[] not null default '{}',  -- targeted base ids; empty for 'all'
  started_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

create index if not exists killstreak_deployments_match_active_idx
  on public.killstreak_deployments (match_id, expires_at);

-- RLS: public read (everyone in the match sees active jams), any signed-in
-- player may insert a deploy, admins manage/clean up.
alter table public.killstreak_deployments enable row level security;

drop policy if exists killstreak_deployments_public_read on public.killstreak_deployments;
create policy killstreak_deployments_public_read on public.killstreak_deployments
  for select to anon, authenticated using (true);

drop policy if exists killstreak_deployments_player_insert on public.killstreak_deployments;
create policy killstreak_deployments_player_insert on public.killstreak_deployments
  for insert to authenticated with check (true);

drop policy if exists killstreak_deployments_admin_manage on public.killstreak_deployments;
create policy killstreak_deployments_admin_manage on public.killstreak_deployments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Table grants. service_role needs them explicitly here (CLI-created table) so
-- the publish-route cleanup + any future server job can write.
grant select on public.killstreak_deployments to anon, authenticated;
grant insert, update, delete on public.killstreak_deployments to authenticated;
grant select, insert, update, delete on public.killstreak_deployments to service_role;

-- Realtime: publish so phones get INSERTs over postgres_changes (like match_live_state).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'killstreak_deployments'
  ) then
    alter publication supabase_realtime add table public.killstreak_deployments;
  end if;
end $$;
