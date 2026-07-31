-- =============================================================================
-- admin_audit_log — change log for admin-edited config (who / when / what)
-- =============================================================================
-- A generic audit trail: an AFTER trigger on each config table records every
-- insert/update/delete with the actor (auth.uid() -> ops_tag), the action, and
-- full old/new jsonb snapshots. The snapshots let the scoring section offer
-- rollback (re-apply an old formula version going forward). Admin-read only;
-- rows are written solely by the SECURITY DEFINER trigger (no user write grant).
-- Existing seed data isn't re-logged — only changes from now on.
-- =============================================================================

create table public.admin_audit_log (
  id            bigint generated always as identity primary key,
  operator_id   uuid not null default '00000000-0000-0000-0000-000000000001',
  actor_uid     uuid,            -- auth.uid() at write time; null = system/migration
  actor_ops_tag text,            -- denormalized display name
  table_name    text not null,
  row_id        text,            -- affected row's id (or operator_id for singletons)
  action        text not null,   -- INSERT | UPDATE | DELETE
  old_data      jsonb,           -- previous row (UPDATE/DELETE)
  new_data      jsonb,           -- new row (INSERT/UPDATE)
  created_at    timestamptz not null default now()
);
create index admin_audit_log_table_idx on public.admin_audit_log (table_name, created_at desc);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
create policy admin_audit_log_admin_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());
grant select on public.admin_audit_log to authenticated;

create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tag text;
  v_rec jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if v_uid is not null then
    select ops_tag into v_tag from public.accounts where auth_user_id = v_uid;
  end if;
  insert into public.admin_audit_log
    (actor_uid, actor_ops_tag, table_name, row_id, action, old_data, new_data)
  values (
    v_uid, v_tag, tg_table_name,
    coalesce(v_rec->>'id', v_rec->>'operator_id'),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Attach to the admin-editable config tables.
do $$
declare t text;
begin
  foreach t in array array[
    'teams','guns','gun_classes','gun_tree_branches','elo_config','elo_tiers',
    'xp_config','rank_levels','rating_config','rating_brackets','score_formula_config',
    'score_formula','scoring_eras','seasons','spawn_camp_config','accolade_definitions',
    'accolade_rules','streak_definitions','streak_rules','challenges','excluded_players'
  ] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.log_admin_change()',
      t, t);
  end loop;
end $$;
