-- =============================================================================
-- Change log: remove ingestion noise, cover every admin config surface.
--
-- The roster (match_participants) and signup (match_signups) tables were bulk-
-- updated during match ingestion, flooding the log with meaningless "Roster
-- entry updated" rows. Those are operational data, not admin config changes, so
-- their triggers are dropped and the existing noise purged. Every admin CONFIG
-- table is now audited instead (pricing, discounts, notifications, email,
-- refunds, homepage, locations, tokens, reward images, killstreaks, level
-- rewards), so the change log records what admins actually change.
-- =============================================================================

-- 1) Stop auditing the operational / ingestion data tables.
drop trigger if exists trg_audit_match_signups      on public.match_signups;
drop trigger if exists trg_audit_match_participants  on public.match_participants;

-- 2) Purge the existing noise so the log reads meaningfully.
delete from public.admin_audit_log where table_name in ('match_signups', 'match_participants');

-- 3) Audit every admin config table (generic log_admin_change trigger).
do $$
declare t text;
begin
  foreach t in array array[
    'pricing_config','refund_config','token_config','token_bundles','reward_images',
    'email_config','notification_types','locations','killstreak_definitions','level_unlocks',
    'home_config','home_social_posts','home_reviews','home_featured_photos'
  ] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.log_admin_change()',
      t, t);
  end loop;
end $$;

-- 4) Per-account fixed price / discount: audit ONLY when it changes, so ordinary
--    profile edits don't flood the log.
drop trigger if exists trg_audit_account_discount on public.accounts;
create trigger trg_audit_account_discount
  after update on public.accounts
  for each row
  when (old.discount_price_eur is distinct from new.discount_price_eur)
  execute function public.log_admin_change();
