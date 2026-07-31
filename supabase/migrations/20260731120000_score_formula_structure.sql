-- =============================================================================
-- score_formula — configurable match-score formula STRUCTURE (jsonb)
-- =============================================================================
-- The score formula is no longer a fixed shape with tunable weights; admins can
-- reshape it into groups (each group = additive terms × its own multipliers;
-- score = sum of groups). Stored as one jsonb doc per operator. Public-read +
-- admin-write like the other config. Seeded with the original shape (all terms
-- in one group with the accuracy + K/D multipliers), from the current weights.
-- The legacy score_formula_config key/value rows are left in place but the
-- editor + interpreter now use this structure.
-- =============================================================================

create table if not exists public.score_formula (
  operator_id uuid primary key default '00000000-0000-0000-0000-000000000001'
                references public.operators(id) on delete cascade,
  structure   jsonb not null,
  updated_at  timestamptz not null default now()
);

create trigger trg_score_formula_updated_at before update on public.score_formula
  for each row execute function public.set_updated_at();

alter table public.score_formula enable row level security;
drop policy if exists score_formula_public_read on public.score_formula;
create policy score_formula_public_read on public.score_formula
  for select to anon, authenticated using (true);
drop policy if exists score_formula_admin_write on public.score_formula;
create policy score_formula_admin_write on public.score_formula
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.score_formula to anon, authenticated;
grant insert, update, delete on public.score_formula to authenticated;

-- Seed the default structure (original fixed shape) from the current weights.
insert into public.score_formula (operator_id, structure)
values (
  '00000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'groups', jsonb_build_array(
      jsonb_build_object(
        'id', 'g-default',
        'label', 'Match score',
        'baseTerms', jsonb_build_array(
          jsonb_build_object('id','b-frags','stat','frags','weight',
            coalesce((select value from public.score_formula_config where key='KILL_WEIGHT'), 50)),
          jsonb_build_object('id','b-damage','stat','damage','weight',
            coalesce((select value from public.score_formula_config where key='DAMAGE_WEIGHT'), 0.2)),
          jsonb_build_object('id','b-captures','stat','captures','weight',
            coalesce((select value from public.score_formula_config where key='CAPTURE_WEIGHT'), 0)),
          jsonb_build_object('id','b-hold','stat','hold','weight',
            coalesce((select value from public.score_formula_config where key='CAPTURE_TIME_WEIGHT'), 0))
        ),
        'multipliers', jsonb_build_array(
          jsonb_build_object('id','m-accuracy','stat','accuracy','weight',
            coalesce((select value from public.score_formula_config where key='ACCURACY_WEIGHT'), 0.2)),
          jsonb_build_object('id','m-kd','stat','kd','weight',
            coalesce((select value from public.score_formula_config where key='KD_WEIGHT'), 0.12))
        )
      )
    )
  )
)
on conflict (operator_id) do nothing;
