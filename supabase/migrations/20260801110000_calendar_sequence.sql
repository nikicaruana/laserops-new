-- Calendar invite SEQUENCE per match. iCalendar requires SEQUENCE to increase
-- each time an event is updated (reschedule) so clients treat it as an update to
-- the same event rather than a new one. Bumped when invites are re-sent.
alter table public.matches add column if not exists calendar_sequence integer not null default 0;
