-- =============================================================================
-- Seed · teams (§4.8)
-- =============================================================================
-- Source: Teams sheet (Team Colour, Team Badge). The sheet provides colour +
-- badge only; display_name defaults to the colour name, sort_order follows the
-- sheet's row order, and is_active is true for all (Green included and active).
-- Green's badge is blank in the sheet -> left null.
--
-- operator_id is omitted so it takes the single-tenant default. Idempotent:
-- re-running upserts on (operator_id, colour), so this is safe to re-apply.
-- =============================================================================

insert into public.teams (colour, display_name, badge_url, sort_order, is_active)
values
  ('Red',    'Red',    'https://res.cloudinary.com/dqud5b7pa/image/upload/v1778784566/Team_Badges-Red-2_lsflqk.png',    1, true),
  ('Blue',   'Blue',   'https://res.cloudinary.com/dqud5b7pa/image/upload/v1778784566/Team_Badges-Blue-2_xgdmsr.png',   2, true),
  ('Yellow', 'Yellow', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1778784565/Team_Badges-Yellow-2_wzyt3t.png', 3, true),
  ('Green',  'Green',  null,                                                                                            4, true)
on conflict (operator_id, colour) do update
  set display_name = excluded.display_name,
      badge_url    = excluded.badge_url,
      sort_order   = excluded.sort_order,
      is_active    = excluded.is_active,
      updated_at   = now();
