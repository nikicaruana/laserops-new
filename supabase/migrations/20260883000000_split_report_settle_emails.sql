-- =============================================================================
-- Pay-after-game: split the match-report email in two, chosen by game type.
--  * match_report_live   -> report only (NO settle CTA). Sent for flat-rate
--    private games where the organiser pays everything.
--  * match_report_settle -> report + "Settle up" CTA ({{payUrl}}) + review CTA.
--    Sent for per-player games where each player settles their own bill.
-- Both keep a "Leave a review" button. The publish route picks the type by
-- matches.pricing_mode. (Replaces the single {{settleBlock}} approach.)
-- =============================================================================

-- Report-only (flat-rate games): drop the settle block, keep review.
update public.notification_types set
  email_html = '<!DOCTYPE html>
<html>
  <head>
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
  </head>
  <body style="margin:0; padding:0; background:#000000; font-family:Montserrat, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000000; padding:24px 12px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; background:#111111; border:1px solid #2a2a2a; border-radius:16px; overflow:hidden;">
          <tr><td align="center" style="padding:32px 24px 20px 24px; background:#000000;">
            <img src="{{logoUrl}}" width="240" alt="LaserOps Malta" style="display:block; border:0; max-width:240px; height:auto;">
          </td></tr>
          <tr><td style="background:#111111; border-top:1px solid #ffde00; border-bottom:1px solid #ffde00; padding:16px 24px; text-align:center;">
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Match Report</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px 28px; color:#ffffff;">
                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Your match report is live, {{nickname}}.</h1>
                <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">{{matchLabel}} &middot; {{matchDate}} &middot; {{matchTimeRange}}</p>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">{{body}}</p>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">See your kills, captures, accolades and exactly where you ranked in the game.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">View match report</a>
                </td></tr></table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{googleReviewUrl}}" style="display:block; background:#181818; color:#ffde00; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Leave a review</a>
                </td></tr></table>
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 28px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="padding:0 8px;"><a href="{{instagramUrl}}"><img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;"></a></td>
              <td style="padding:0 8px;"><a href="{{facebookUrl}}"><img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;"></a></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
            <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">You received this because you played in a LaserOps Malta game.</p>
            <p style="margin:0;"><a href="https://www.laseropsmalta.com" style="font-size:12px; line-height:1.5; color:#ffde00; font-weight:700; text-decoration:none;">www.laseropsmalta.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>',
  email_subject = 'Your match report is live',
  sends_email = true
  where key = 'match_report_live';

-- Report + settle (per-player games).
insert into public.notification_types
  (key, label, description, priority, is_active, sends_email, sends_push, delay_hours, sort_order,
   email_subject, bell_title, bell_body, email_html)
values (
  'match_report_settle',
  'Match report + settle up',
  'Post-match report email with a settle-up CTA, for per-player games.',
  2, true, true, false, 0, 11,
  'Your match report is live - time to settle up',
  'Your match report is live',
  'The report for {{matchLabel}} is up. See your kills, captures, accolades and where you ranked.',
'<!DOCTYPE html>
<html>
  <head>
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
  </head>
  <body style="margin:0; padding:0; background:#000000; font-family:Montserrat, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000000; padding:24px 12px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; background:#111111; border:1px solid #2a2a2a; border-radius:16px; overflow:hidden;">
          <tr><td align="center" style="padding:32px 24px 20px 24px; background:#000000;">
            <img src="{{logoUrl}}" width="240" alt="LaserOps Malta" style="display:block; border:0; max-width:240px; height:auto;">
          </td></tr>
          <tr><td style="background:#111111; border-top:1px solid #ffde00; border-bottom:1px solid #ffde00; padding:16px 24px; text-align:center;">
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Match Report</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px 28px; color:#ffffff;">
                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Your match report is live, {{nickname}}.</h1>
                <p style="margin:-6px 0 20px 0; font-size:15px; line-height:1.4; color:#ffde00; font-weight:800;">{{matchLabel}} &middot; {{matchDate}} &middot; {{matchTimeRange}}</p>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">{{body}}</p>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">See your kills, captures, accolades and exactly where you ranked in the game.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">View match report</a>
                </td></tr></table>
                <div style="height:1px; background:#2a2a2a; margin:8px 0 18px 0;"></div>
                <p style="margin:0 0 12px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">Time to settle up for the game: use a game token, pay by Revolut, or pay cash on the day.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{payUrl}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Settle up now</a>
                </td></tr></table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{googleReviewUrl}}" style="display:block; background:#181818; color:#ffde00; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Leave a review</a>
                </td></tr></table>
                <p style="margin:0 0 6px 0; font-size:14px; line-height:1.6; color:#9a9a9a;">Already sorted with us in person? You can ignore the settle-up step &ndash; we will mark you paid.</p>
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 28px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="padding:0 8px;"><a href="{{instagramUrl}}"><img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;"></a></td>
              <td style="padding:0 8px;"><a href="{{facebookUrl}}"><img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;"></a></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
            <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">You received this because you played in a LaserOps Malta game.</p>
            <p style="margin:0;"><a href="https://www.laseropsmalta.com" style="font-size:12px; line-height:1.5; color:#ffde00; font-weight:700; text-decoration:none;">www.laseropsmalta.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>'
)
on conflict (key) do update set
  label = excluded.label, description = excluded.description, priority = excluded.priority,
  is_active = excluded.is_active, sends_email = excluded.sends_email, sends_push = excluded.sends_push,
  delay_hours = excluded.delay_hours, sort_order = excluded.sort_order,
  email_subject = excluded.email_subject, bell_title = excluded.bell_title, bell_body = excluded.bell_body,
  email_html = excluded.email_html;
