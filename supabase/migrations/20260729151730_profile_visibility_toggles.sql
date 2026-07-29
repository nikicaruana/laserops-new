-- =============================================================================
-- Profile visibility toggles: which optional fields a player shares publicly
-- =============================================================================
-- ops_tag and avatar are inherently public (they show on leaderboards). These
-- flags let a player opt IN to showing their real name / birthday on a public
-- profile (the public-profile VIEW is built later; these store the preference
-- now). Default false = private. Neither field is protected by
-- protect_account_fields(), so the "update own row" RLS policy lets a player
-- toggle their own.
-- =============================================================================

alter table public.accounts
  add column if not exists show_full_name      boolean not null default false;
alter table public.accounts
  add column if not exists show_date_of_birth  boolean not null default false;

-- Does the current user already have a password set? Lets the profile page
-- show "Change password" vs "Set a password" (Google/magic-link users have
-- none yet) and lets the password route enforce the current-password check
-- only when there is one. security definer so it can read auth.users.
create or replace function public.current_user_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(encrypted_password, '') <> ''
  from auth.users
  where id = auth.uid();
$$;
grant execute on function public.current_user_has_password() to authenticated;
