-- Payment on the roster entry itself, for hand-added walk-ins (private-booking
-- guests, kids without an account) who have no match_signups row. Signed-up
-- players still get their payment from their signup; this is the fallback the
-- roster reads when a participant has no linked signup. Admin adds default to
-- paying on the day.
alter table public.match_participants
  add column if not exists payment_intent text check (payment_intent in ('on_day', 'online')),
  add column if not exists paid_at timestamptz;
