-- =============================================================================
-- RLS chunk 1: admin role + accounts policies (step 10)
-- =============================================================================
-- Admin marker + helper, RLS policies so a logged-in player reads/edits ONLY
-- their own account and admins manage all, plus a trigger that stops a player
-- from self-promoting or altering protected fields. Owners (Kyle, Kini) are
-- seeded as the first admins. anon gets no access to accounts (PII stays locked).
-- =============================================================================

alter table public.accounts add column if not exists is_admin boolean not null default false;

-- security definer so it can read accounts without tripping the RLS it backs
-- (no recursion — definer bypasses RLS). search_path pinned for safety.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.accounts
    where auth_user_id = auth.uid() and is_admin
  );
$$;

-- accounts policies (RLS already enabled on the table)
drop policy if exists accounts_select_own   on public.accounts;
drop policy if exists accounts_select_admin  on public.accounts;
drop policy if exists accounts_update_own    on public.accounts;
drop policy if exists accounts_admin_write    on public.accounts;

create policy accounts_select_own  on public.accounts
  for select to authenticated using (auth_user_id = auth.uid());

create policy accounts_select_admin on public.accounts
  for select to authenticated using (public.is_admin());

create policy accounts_update_own  on public.accounts
  for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- admins can insert / update / delete any row (merges, claims, moderation)
create policy accounts_admin_write on public.accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Prevent a non-admin from changing protected fields on their own row
-- (RLS is row-level, not column-level — this closes the privilege-escalation gap).
create or replace function public.protect_account_fields()
returns trigger language plpgsql as $$
begin
  -- Only gate real logged-in end users (the "authenticated" API role). The
  -- service role, the postgres/migration role, and admins all pass through —
  -- so seeding admins and backend/admin operations aren't blocked.
  if current_user = 'authenticated' and not public.is_admin() then
    if new.is_admin      is distinct from old.is_admin
    or new.auth_user_id  is distinct from old.auth_user_id
    or new.claim_status  is distinct from old.claim_status
    or new.operator_id   is distinct from old.operator_id then
      raise exception 'Not permitted to modify protected account fields';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_account_fields on public.accounts;
create trigger trg_protect_account_fields
  before update on public.accounts for each row execute function public.protect_account_fields();

-- Seed the first admins (owners). Safe if the accounts don't exist yet.
update public.accounts set is_admin = true
where operator_id = '00000000-0000-0000-0000-000000000001' and lower(ops_tag) in ('kyle','kini');
