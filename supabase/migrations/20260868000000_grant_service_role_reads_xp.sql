-- Let the backend (service_role) read the XP-boost ledger, the level-reward
-- tracking state, and the read-model status. These are append-only / status
-- tables; service_role already writes some of them, and read access is needed for
-- support tooling and diagnostics (it bypasses RLS but still needs the grant).
grant select on public.xp_boost_ledger             to service_role;
grant select on public.player_level_rewards_state  to service_role;
grant select on public.read_model_status           to service_role;
