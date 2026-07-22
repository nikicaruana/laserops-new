-- =============================================================================
-- Seed · rating_config + rating_brackets (§4.12) — from the Ratings sheet
-- =============================================================================
-- Four sub-tables in one sheet; the Test/Output scratch area and the TOTAL
-- checksum row are intentionally NOT seeded.
--   rating_brackets: 5 star bands (note: no 1-star; 0 = default/unrated).
--   rating_config:   3 gates + 8 component weights (weights sum to 1.0).
-- Star badge image URLs from the sheet are NOT seeded — the site renders ratings
-- via a custom animation (local assets keyed by star count), not those URLs.
-- Idempotent upserts.
-- =============================================================================

insert into public.rating_brackets (stars, min_percentile, max_percentile, sort_order) values
  (0, null, null, 0),
  (2, 0, 0.35, 2),
  (3, 0.35, 0.75, 3),
  (4, 0.75, 0.9, 4),
  (5, 0.9, 1, 5)
on conflict (operator_id, stars) do update
  set min_percentile = excluded.min_percentile, max_percentile = excluded.max_percentile,
      sort_order = excluded.sort_order, updated_at = now();

insert into public.rating_config (key, value, note) values
  ('Min_Level', 4, 'Rating eligibility gate'),
  ('Min_Matches', 2, 'Rating eligibility gate'),
  ('Min_Eligible_Pool', 10, 'Rating eligibility gate'),
  ('Match_Win_Rating', 0.05, 'Overall-rating component weight (weights sum to 1)'),
  ('Rounds_WL_Rating', 0.08, 'Overall-rating component weight (weights sum to 1)'),
  ('Kills_Per_Match_Rating', 0.12, 'Overall-rating component weight (weights sum to 1)'),
  ('Damage_Rating', 0.1, 'Overall-rating component weight (weights sum to 1)'),
  ('Score_Rating', 0.2, 'Overall-rating component weight (weights sum to 1)'),
  ('Accuracy_Rating', 0.13, 'Overall-rating component weight (weights sum to 1)'),
  ('KD_Rating', 0.17, 'Overall-rating component weight (weights sum to 1)'),
  ('Match_Rating_Rating', 0.15, 'Overall-rating component weight (weights sum to 1)')
on conflict (operator_id, key) do update
  set value = excluded.value, note = excluded.note, updated_at = now();
