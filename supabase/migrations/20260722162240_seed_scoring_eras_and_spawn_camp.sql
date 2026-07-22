-- =============================================================================
-- Seed · scoring_eras + spawn_camp_config (§4.10, §4.11) — PLACEHOLDERS
-- =============================================================================
-- Both are new 2.0 concepts with no source sheet. Seeded with sensible starter
-- values to be tuned later (spawn-camp once real JSON event data is available;
-- era dates once the 2.0 cutover is scheduled).
-- =============================================================================

-- scoring_eras: two rows so every migrated match can point at Legacy, and 2.0
-- is the default view. Dates left null — set the boundary at actual cutover.
insert into public.scoring_eras (name, starts_at, ends_at, is_default_view) values
  ('Legacy', null, null, false),
  ('2.0',    null, null, true)
on conflict (operator_id, name) do update
  set starts_at = excluded.starts_at, ends_at = excluded.ends_at,
      is_default_view = excluded.is_default_view, updated_at = now();

-- spawn_camp_config: one placeholder row. Default leans on the spec — a short
-- protection window and 'void' (no death for the victim, no frag for the
-- shooter), which protects K/D and the Ghost accolade. Revisit with event data.
insert into public.spawn_camp_config (protection_window_seconds, consequence_mode, penalty_points) values
  (5, 'void', 0)
on conflict (operator_id) do update
  set protection_window_seconds = excluded.protection_window_seconds,
      consequence_mode = excluded.consequence_mode,
      penalty_points = excluded.penalty_points, updated_at = now();
