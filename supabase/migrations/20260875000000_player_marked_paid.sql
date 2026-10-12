-- Pay-after-game: let a player signal "I've paid" on the pay page after paying by
-- Revolut/cash (closure + a stronger cue for the admin, who still confirms the
-- money landed and marks it truly paid).
alter table public.match_participants add column if not exists player_marked_paid_at timestamptz;

create or replace function public.player_mark_settled(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare acct uuid := public.current_account_id();
begin
  if acct is null then raise exception 'Sign in first.'; end if;
  update public.match_participants
     set player_marked_paid_at = now()
   where match_id = p_match_id and account_id = acct
     and settled_declared_at is not null and paid_at is null;
end;
$$;
grant execute on function public.player_mark_settled(uuid) to authenticated;
