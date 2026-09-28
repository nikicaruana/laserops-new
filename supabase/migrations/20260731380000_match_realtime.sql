-- Live match management: publish the match tables on the supabase_realtime
-- publication so the admin detail page updates as players sign in and rounds
-- are ingested. REPLICA IDENTITY FULL so DELETE/UPDATE events still carry the
-- match_id the client filters on. Idempotent (guards against re-adding).
do $$
declare
  t text;
begin
  foreach t in array array['matches', 'match_signups', 'match_participants', 'match_ingest_rounds']
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
