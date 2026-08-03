-- =============================================================================
-- Payment is chosen AFTER a match is confirmed, not at signup. A player signs
-- up first (payment_intent null = not chosen yet); once an admin confirms the
-- match, payment opens and they pick online / on-the-day. Make payment_intent
-- nullable + drop the default. The existing check allows null (null IN (...) is
-- null, not false), so no constraint change is needed.
-- =============================================================================

alter table public.match_signups alter column payment_intent drop default;
alter table public.match_signups alter column payment_intent drop not null;
