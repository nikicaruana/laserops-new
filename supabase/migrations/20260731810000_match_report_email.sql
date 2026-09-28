-- =============================================================================
-- Install the full match-report-live email template + turn email on for it.
-- Tokens ({{matchId}}, {{nickname}}, {{matchReportUrl}}, {{playerProfileUrl}},
-- brand links) are filled at send time by the token engine. Still only fires
-- once the ingestion step emits match_report_live with data:{ matchId }.
-- Dollar-quoted so apostrophes in the copy need no escaping.
-- =============================================================================
update public.notification_types
set sends_email   = true,
    email_subject = 'Your Match Report Is Live',
    email_html    = $html$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark light">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <title>Your Match Report Is Live</title>
    <style type="text/css">
      :root {
        color-scheme: dark light;
        supported-color-schemes: dark light;
      }

      /* Clients honouring prefers-color-scheme: re-pin the dark palette so
         the brand colours can't be shifted. */
      @media (prefers-color-scheme: dark) {
        .lo-bg-black    { background-color:#000000 !important; }
        .lo-bg-card     { background-color:#111111 !important; }
        .lo-bg-btn      { background-color:#1c1c1c !important; }
        .lo-bg-footer   { background-color:#080808 !important; }
        .lo-divider     { background-color:#2a2a2a !important; }

        .lo-text-white  { color:#ffffff !important; }
        .lo-text-d8     { color:#d8d8d8 !important; }
        .lo-text-bd     { color:#bdbdbd !important; }
        .lo-text-77     { color:#777777 !important; }
        .lo-text-yellow { color:#ffde00 !important; }
        .lo-text-green  { color:#25D366 !important; }

        .lo-btn-yellow  { border-color:#ffde00 !important; color:#ffde00 !important; }
        .lo-btn-green   { border-color:#25D366 !important; color:#25D366 !important; }
        .lo-btn-neutral { border-color:#555555 !important; color:#ffffff !important; }
      }

      /* Gmail app dark mode (Android + iOS). Gmail ignores the media query
         and tags recoloured elements with data-ogsb / data-ogsc. Re-pin both
         the same-element and ancestor forms. */
      [data-ogsb].lo-bg-black,  [data-ogsb] .lo-bg-black  { background-color:#000000 !important; }
      [data-ogsb].lo-bg-card,   [data-ogsb] .lo-bg-card   { background-color:#111111 !important; }
      [data-ogsb].lo-bg-btn,    [data-ogsb] .lo-bg-btn    { background-color:#1c1c1c !important; }
      [data-ogsb].lo-bg-footer, [data-ogsb] .lo-bg-footer { background-color:#080808 !important; }
      [data-ogsb].lo-divider,   [data-ogsb] .lo-divider   { background-color:#2a2a2a !important; }

      [data-ogsc].lo-text-white,  [data-ogsc] .lo-text-white  { color:#ffffff !important; }
      [data-ogsc].lo-text-d8,     [data-ogsc] .lo-text-d8     { color:#d8d8d8 !important; }
      [data-ogsc].lo-text-bd,     [data-ogsc] .lo-text-bd     { color:#bdbdbd !important; }
      [data-ogsc].lo-text-77,     [data-ogsc] .lo-text-77     { color:#777777 !important; }
      [data-ogsc].lo-text-yellow, [data-ogsc] .lo-text-yellow { color:#ffde00 !important; }
      [data-ogsc].lo-text-green,  [data-ogsc] .lo-text-green  { color:#25D366 !important; }

      [data-ogsc].lo-btn-yellow,  [data-ogsc] .lo-btn-yellow  { border-color:#ffde00 !important; color:#ffde00 !important; }
      [data-ogsc].lo-btn-green,   [data-ogsc] .lo-btn-green   { border-color:#25D366 !important; color:#25D366 !important; }
      [data-ogsc].lo-btn-neutral, [data-ogsc] .lo-btn-neutral { border-color:#555555 !important; color:#ffffff !important; }
    </style>
  </head>

  <body class="lo-body lo-bg-black" style="margin:0; padding:0; background:#000000; font-family:Montserrat, Arial, sans-serif;">

    <!-- Preheader: inbox preview text -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#000000; opacity:0;">
      Your match report for {{matchId}} is live. Check your stats and the leaderboard.
      &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="lo-bg-black" style="background:#000000; padding:24px 12px;">
      <tr>
        <td align="center">

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="lo-bg-card" style="max-width:600px; background:#111111; border:1px solid #2a2a2a; border-radius:16px; overflow:hidden;">

            <!-- Header / Logo  (NOTE: use the YELLOW or WHITE logo here, not the black one) -->
            <tr>
              <td align="center" class="lo-bg-card" style="padding:32px 24px 16px 24px; background:#111111;">
                <img src="{{logoUrl}}"
                    width="240"
                    alt="LaserOps Malta"
                    style="display:block; border:0; max-width:240px; height:auto;">
              </td>
            </tr>

            <!-- Title strip (yellow text, no fill) -->
            <tr>
              <td class="lo-bg-card" style="background:#111111; padding:4px 24px 22px 24px; text-align:center;">
                <div class="lo-text-yellow" style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">
                  Your Match Report Is Live
                </div>
              </td>
            </tr>

            <!-- Yellow accent divider -->
            <tr>
              <td class="lo-bg-card" style="background:#111111; padding:0 28px;">
                <div class="lo-divider" style="height:1px; background:#2a2a2a; margin:0;"></div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td class="lo-bg-card lo-text-white" style="padding:30px 28px 12px 28px; background:#111111; color:#ffffff;">

                <h1 class="lo-text-white" style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">
                  Nice game, {{nickname}}.
                </h1>

                <p class="lo-text-d8" style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">
                  Your LaserOps match report for <strong class="lo-text-yellow" style="color:#ffde00;">{{matchId}}</strong> is now live.
                </p>

                <p class="lo-text-d8" style="margin:0 0 26px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">
                  Check the leaderboard, see your personal stats, and check your full online profile.
                </p>

                <!-- Match Report Button (yellow outline) -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{matchReportUrl}}" class="lo-bg-btn lo-btn-yellow"
                         style="display:block; background:#1c1c1c; color:#ffde00; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">
                        View Match Report
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Player Profile Button (neutral outline) -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{playerProfileUrl}}" class="lo-bg-btn lo-btn-neutral"
                         style="display:block; background:#1c1c1c; color:#ffffff; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:1px solid #555555; text-transform:uppercase; letter-spacing:0.4px;">
                        View Your Profile
                      </a>
                    </td>
                  </tr>
                </table>

                <div class="lo-divider" style="height:1px; background:#2a2a2a; margin:0 0 26px 0;"></div>

                <!-- Review Section -->
                <h2 class="lo-text-white" style="margin:0 0 12px 0; font-size:20px; line-height:1.3; font-weight:800; color:#ffffff;">
                  Had a good time?
                </h2>

                <p class="lo-text-bd" style="margin:0 0 22px 0; font-size:15px; line-height:1.6; color:#bdbdbd;">
                  Please consider leaving us a Review! It really helps us grow our community and reach more people.
                </p>

                <!-- Review Button (neutral outline) -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{googleReviewUrl}}" class="lo-bg-btn lo-btn-neutral"
                         style="display:block; background:#1c1c1c; color:#ffffff; text-decoration:none; font-size:15px; font-weight:800; padding:14px 20px; border-radius:10px; border:1px solid #555555;">
                        Leave a Google Review
                      </a>
                    </td>
                  </tr>
                </table>

                <div class="lo-divider" style="height:1px; background:#2a2a2a; margin:0 0 26px 0;"></div>

                <!-- Open Games Section -->
                <h2 class="lo-text-white" style="margin:0 0 12px 0; font-size:20px; line-height:1.3; font-weight:800; color:#ffffff;">
                  We run open games, open to everyone, every week!
                </h2>

                <!-- Match Calendar Button (yellow outline) -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{gameCalendarUrl}}" class="lo-bg-btn lo-btn-yellow"
                         style="display:block; background:#1c1c1c; color:#ffde00; text-decoration:none; font-size:15px; font-weight:800; padding:14px 20px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">
                        See Our Match Calendar
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- WhatsApp Community Button (green outline) -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{whatsappCommunityUrl}}" class="lo-bg-btn lo-btn-green"
                         style="display:block; background:#1c1c1c; color:#25D366; text-decoration:none; font-size:15px; font-weight:800; padding:14px 20px; border-radius:10px; border:2px solid #25D366; text-transform:uppercase; letter-spacing:0.4px;">
                        Join Our WhatsApp Community
                      </a>
                    </td>
                  </tr>
                </table>

                <div class="lo-divider" style="height:1px; background:#2a2a2a; margin:0 0 26px 0;"></div>

                <!-- Booking Section -->
                <p class="lo-text-bd" style="margin:0 0 12px 0; font-size:15px; line-height:1.6; color:#bdbdbd; text-align:center;">
                  Ready to play again?
                </p>

                <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; text-align:center;">
                  <a href="{{bookingUrl}}" class="lo-text-yellow" style="color:#ffde00; font-weight:800; text-decoration:none;">
                    Book your next match
                  </a>
                </p>

              </td>
            </tr>

            <!-- Socials -->
            <tr>
              <td align="center" class="lo-bg-card" style="padding:10px 24px 28px 24px; background:#111111;">
                <table cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="padding:0 8px;">
                      <a href="{{instagramUrl}}">
                        <img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;">
                      </a>
                    </td>
                    <td style="padding:0 8px;">
                      <a href="{{facebookUrl}}">
                        <img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;">
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="lo-bg-footer" style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
                <p class="lo-text-77" style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">
                  You received this because you played a LaserOps Malta match and submitted your player details.
                </p>

                <p class="lo-text-77" style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">
                  Don't want post-match emails? Reply "unsubscribe" and we'll remove you from future match emails.
                </p>

                <p class="lo-text-77" style="margin:0; font-size:12px; line-height:1.5; color:#777777;">
                  LaserOps · Outdoor tactical laser tag in Malta
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>$html$
where key = 'match_report_live';
