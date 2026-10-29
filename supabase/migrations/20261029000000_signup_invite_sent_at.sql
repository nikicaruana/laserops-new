-- Track when each signup was emailed its calendar invite, so a manual re-send
-- (the admin "Send calendar invite" button) and the new-signup / waitlist invite
-- paths never re-email someone who already got one. Reschedule and cancel ignore
-- this flag on purpose - they must reach the whole roster.
alter table public.match_signups
  add column if not exists invite_sent_at timestamptz;

-- Backfill: registered players on games that are already confirmed or live were
-- invited at confirm time, so mark them as already-invited. This stops the first
-- re-send after deploy from duplicating their invite email (e.g. the private
-- bookings whose invites already went out).
update public.match_signups s
set invite_sent_at = now()
from public.matches m
where s.match_id = m.id
  and s.status = 'registered'
  and m.status in ('confirmed', 'live')
  and s.invite_sent_at is null;
