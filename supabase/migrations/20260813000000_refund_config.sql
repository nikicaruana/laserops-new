-- =============================================================================
-- Refund policy config (2026-10-02): the cancellation refund windows and the
-- player-facing policy text, moved from hardcoded constants (lib/payments/policy.ts
-- AUTO_REFUND_HOURS / NO_REFUND_HOURS / REFUND_POLICY) into an editable admin row.
--   >= auto_refund_hours before start  -> automatic full refund on cancel
--   no_refund_hours .. auto_refund_hours -> refund by request (admin-approved)
--   < no_refund_hours                  -> non-refundable
-- Public anon read (the policy is shown to players before they pay); admin write.
-- Edited from /admin/refunds. Early-end partial % (25/50/75) stays an admin
-- choice at action time in Match Manager, so it is not stored here.
-- =============================================================================
create table if not exists public.refund_config (
  id                integer primary key default 1 check (id = 1),
  auto_refund_hours integer not null default 48 check (auto_refund_hours >= 0),
  no_refund_hours   integer not null default 24 check (no_refund_hours >= 0),
  policy_text       text not null default 'Cancel more than 48 hours before the game for an automatic full refund. Between 48 and 24 hours before, refunds are by request and approved by LaserOps. Within 24 hours of the game, payments are non-refundable. You can pass your spot to another player any time.',
  updated_at        timestamptz not null default now()
);
insert into public.refund_config (id) values (1) on conflict (id) do nothing;

alter table public.refund_config enable row level security;
drop policy if exists refund_config_read on public.refund_config;
create policy refund_config_read on public.refund_config for select to anon, authenticated using (true);
drop policy if exists refund_config_admin on public.refund_config;
create policy refund_config_admin on public.refund_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.refund_config to anon, authenticated;
grant select, insert, update, delete on public.refund_config to authenticated;

-- Admin setter (range-checked: auto window must be >= the no-refund window).
create or replace function public.admin_set_refund_config(p_auto integer, p_no integer, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_auto is null or p_auto < 0 then raise exception 'Auto-refund hours must be 0 or more.'; end if;
  if p_no is null or p_no < 0 then raise exception 'No-refund hours must be 0 or more.'; end if;
  if p_auto < p_no then raise exception 'The automatic-refund window must be at least as large as the no-refund window.'; end if;
  update public.refund_config set
    auto_refund_hours = p_auto,
    no_refund_hours   = p_no,
    policy_text       = coalesce(nullif(btrim(p_text), ''), policy_text),
    updated_at        = now()
  where id = 1;
end;
$$;
grant execute on function public.admin_set_refund_config(integer, integer, text) to authenticated;
