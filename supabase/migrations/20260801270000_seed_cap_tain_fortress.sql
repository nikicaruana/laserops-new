-- =============================================================================
-- Seed · CAP-Tain + Fortress accolades (objective superlatives) into the v2
-- accolade config so they appear in the admin Accolades panel and feed the
-- ingestion. scope='match', points=0 (accolades grant XP, not score).
--   CAP-Tain = most base captures (tie-break by hold time)
--   Fortress = most capture/hold time
-- Idempotent: definitions upsert on (operator_id, name, scope); their rules are
-- replaced. Badges match the CMS Accolades sheet.
-- =============================================================================

insert into public.accolade_definitions (name, description, badge_url, xp, points, scope, is_active) values
  ('CAP-Tain', 'The Most Base Captures', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1788638338/LaserOps-Accolade-CAPTain_zhxukh.png', 100, 0, 'match', true),
  ('Fortress', 'The Most Capture Time', 'https://res.cloudinary.com/dqud5b7pa/image/upload/v1788638338/LaserOps-Accolade-Fortress_wzx9jb.png', 100, 0, 'match', true)
on conflict (operator_id, name, scope) do update
  set description = excluded.description, badge_url = excluded.badge_url,
      xp = excluded.xp, points = excluded.points, is_active = excluded.is_active, updated_at = now();

delete from public.accolade_rules
  where accolade_definition_id in (
    select id from public.accolade_definitions where scope = 'match' and name in ('CAP-Tain', 'Fortress')
  );

insert into public.accolade_rules (accolade_definition_id, rule_type, stat_key, direction, params)
select d.id, 'match_superlative', v.stat, v.dir, v.params::jsonb
from (values
  ('CAP-Tain', 'captures', 'max', '{"tiebreak":"hold"}'),
  ('Fortress', 'hold', 'max', '{}')
) as v(name, stat, dir, params)
join public.accolade_definitions d on d.name = v.name and d.scope = 'match';
