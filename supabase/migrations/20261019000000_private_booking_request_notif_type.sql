-- 20261019000000_private_booking_request_notif_type.sql
-- Private bookings are now an enquiry, not an instant self-service game: a
-- logged-in player's "Request booking" emails us and raises an admin alert, and
-- we create the game for them. Register the alert kind so emit_admin_notification
-- accepts it and the bell / dashboard panel show it. (The email itself is sent
-- from the API route; this only adds the notification type.)
insert into public.admin_notification_types (key, label, description, priority, sort_order) values
  ('private_booking_request', 'Private booking request', 'A player requested a private booking. Create the game and send them the invite.', 2, 9)
on conflict (key) do nothing;
