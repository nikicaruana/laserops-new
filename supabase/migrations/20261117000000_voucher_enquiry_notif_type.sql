-- 20261117000000_voucher_enquiry_notif_type.sql
-- Store visitors (logged in or not) can enquire about buying LaserOps Game Token
-- gift vouchers in bulk. The enquiry emails info@ and raises an admin alert so it
-- isn't missed. Register the alert kind so emit_admin_notification accepts it and
-- the bell / dashboard panel show it. (The email itself is sent from the API
-- route; this only adds the notification type.)
insert into public.admin_notification_types (key, label, description, priority, sort_order) values
  ('voucher_enquiry', 'Voucher enquiry', 'Someone asked about buying game-token gift vouchers. Get back to them to arrange it.', 2, 10)
on conflict (key) do nothing;
