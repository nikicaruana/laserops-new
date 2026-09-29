-- =============================================================================
-- player_xp_celebrated — which scored matches a player has already seen the
-- first-login XP celebration for. One row per (account, match); absence means
-- the celebration is still pending. Written server-side only (service role).
-- =============================================================================
create table if not exists public.player_xp_celebrated (
  account_id uuid not null references public.accounts(id) on delete cascade,
  match_id   uuid not null references public.matches(id)  on delete cascade,
  seen_at    timestamptz not null default now(),
  primary key (account_id, match_id)
);

alter table public.player_xp_celebrated enable row level security;
-- No anon/authenticated policies: only the server (service role) reads/writes it.
grant select, insert on public.player_xp_celebrated to service_role;
