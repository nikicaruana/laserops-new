-- Publish the squad + ladder notification tables on supabase_realtime so the
-- player notification bell reacts instantly (no 60s poll wait) to new join
-- requests, squad-match challenges, squad invites and ladder challenges — the
-- same pattern as 20260731380000 for the match tables. REPLICA IDENTITY FULL so
-- UPDATE/DELETE events carry the columns clients filter/derive on. Idempotent.
do $$
declare
  t text;
begin
  foreach t in array array['squad_join_requests', 'squad_matches', 'squad_match_signups', 'squad_invites', 'ladder_challenges']
  loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
