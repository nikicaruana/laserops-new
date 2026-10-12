-- =============================================================================
-- Pay-after-game: fold the settle-up CTA into the match-report email to cut email
-- volume. The report email now carries (a) a per-recipient {{settleBlock}} (the
-- publish route fills it with a Settle-up button for per-player players who have
-- not paid; empty for everyone else) and (b) a Leave-a-review button. The
-- standalone game_settle_up email is retired to an IN-APP bell only (sends_email
-- = false) - it still links to the same pay page, so a player who paid via the
-- email sees "already settled" when they open it from the bell.
-- =============================================================================

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
                {{settleBlock}}
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

-- Settle-up is now an in-app bell only (the email lives inside the report email).
update public.notification_types set sends_email = false where key = 'game_settle_up';
