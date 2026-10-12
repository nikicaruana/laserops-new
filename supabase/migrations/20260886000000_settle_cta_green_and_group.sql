-- =============================================================================
-- Pay-after-game polish:
--  * match_report_settle: rename the settle CTA to "Pay for Game" and make it
--    green so it stands out from the (yellow) report + review buttons.
--  * Group the three report/settle notification types together in the admin
--    list by giving them consecutive sort_order values.
-- =============================================================================
update public.notification_types
set email_html = replace(email_html,
  'background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Settle up now</a>',
  'background:#22c55e; color:#06240f; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #22c55e; text-transform:uppercase; letter-spacing:0.4px;">Pay for Game</a>')
where key = 'match_report_settle';

update public.notification_types set sort_order = 40 where key = 'match_report_live';
update public.notification_types set sort_order = 41 where key = 'match_report_settle';
update public.notification_types set sort_order = 42 where key = 'game_settle_up';
