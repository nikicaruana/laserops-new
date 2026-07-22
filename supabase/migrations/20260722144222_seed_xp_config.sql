-- =============================================================================
-- Seed · xp_config (§4) — win-XP bonuses from the XP_Config sheet
-- =============================================================================
-- The sheet holds only the win bonuses (values are authoritative; notes are
-- added here for the admin panel). Other XP sources live elsewhere: per-accolade
-- and per-streak XP on their definition tables, level XP via rank_levels.
-- Idempotent upsert on (operator_id, key).
-- =============================================================================

insert into public.xp_config (key, value, note) values
  ('Round_Win_XP', 750, 'XP awarded for winning a round'),
  ('Match_Win_XP', 500, 'XP awarded for winning a match')
on conflict (operator_id, key) do update
  set value = excluded.value, note = excluded.note, updated_at = now();
