-- =============================================================================
-- Match reminder notification (sent ~24h before a match) + its email template.
-- Adds two venue-wide config tokens (matchLocationUrl, parkingUrl) for admins to
-- fill in Email settings. Per-match tokens ({{matchDate}}, {{matchTime}},
-- {{signupFormUrl}}, {{whatsappShareUrl}}) are supplied in the notification data
-- when the reminder fires (the 24h-before cron, wired separately).
-- =============================================================================

insert into public.email_config (key, value) values
  ('matchLocationUrl', ''),
  ('parkingUrl',       '')
on conflict (key) do nothing;

insert into public.notification_types (key, label, description, priority, is_active, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order)
values (
  'match_reminder',
  'Match reminder (24h before)',
  'Sent to signed-up players about 24 hours before their match.',
  2, true, true, 'Match Reminder',
  $rem$<!DOCTYPE html>
<html>
  <head>
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
  </head>

  <body style="margin:0; padding:0; background:#000000; font-family:Montserrat, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000000; padding:24px 12px;">
      <tr>
        <td align="center">

          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; background:#111111; border:1px solid #2a2a2a; border-radius:16px; overflow:hidden;">

            <!-- Header / Logo -->
            <tr>
              <td align="center" style="padding:32px 24px 20px 24px; background:#000000;">
                <img src="{{logoUrl}}"
                     width="240"
                     alt="LaserOps Malta"
                     style="display:block; border:0; max-width:240px; height:auto;">
              </td>
            </tr>

            <!-- Title Strip -->
            <tr>
              <td style="background:#111111; border-top:1px solid #ffde00; border-bottom:1px solid #ffde00; padding:16px 24px; text-align:center;">
                <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">
                  Match Reminder
                </div>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:32px 28px 12px 28px; color:#ffffff;">

                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">
                  Gear up, {{nickname}}.
                </h1>

                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">
                  This is a reminder that your upcoming LaserOps match is scheduled for:
                </p>

                <!-- Match Details Box -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 26px 0; background:#181818; border:1px solid #333333; border-radius:12px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <p style="margin:0 0 8px 0; font-size:13px; line-height:1.4; color:#ffde00; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">
                        Match Date
                      </p>
                      <p style="margin:0 0 18px 0; font-size:22px; line-height:1.3; color:#ffffff; font-weight:800;">
                        {{matchDate}}
                      </p>

                      <p style="margin:0 0 8px 0; font-size:13px; line-height:1.4; color:#ffde00; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">
                        Match Time
                      </p>
                      <p style="margin:0; font-size:22px; line-height:1.3; color:#ffffff; font-weight:800;">
                        {{matchTime}}
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 26px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">
                  Please arrive a bit before the match time so we can get everyone checked in, briefed, and geared up.
                </p>

                <!-- Match Location Button -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{matchLocationUrl}}"
                         style="display:block; background:#111111; color:#ffde00; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">
                        View Match Location
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Parking Location Button -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{parkingUrl}}"
                         style="display:block; background:#222222; color:#ffffff; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:1px solid #3a3a3a; text-transform:uppercase; letter-spacing:0.4px;">
                        View Parking Location
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="height:1px; background:#2a2a2a; margin:0 0 26px 0;"></div>

                <!-- Invite Friends Section -->
                <h2 style="margin:0 0 12px 0; font-size:20px; line-height:1.3; font-weight:800; color:#ffffff;">
                  Still room for backup.
                </h2>

                <p style="margin:0 0 22px 0; font-size:15px; line-height:1.6; color:#bdbdbd;">
                  We still have empty slots for this match. Send the signup form to a friend if they want to join the battle.
                </p>

                <!-- Signup Form Button -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{signupFormUrl}}"
                         style="display:block; background:#111111; color:#ffde00; text-decoration:none; font-size:15px; font-weight:800; padding:14px 20px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">
                        Share Signup Form
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- WhatsApp Share Button -->
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center">
                      <a href="{{whatsappShareUrl}}"
                         style="display:block; background:#25D366; color:#000000; text-decoration:none; font-size:15px; font-weight:800; padding:14px 20px; border-radius:10px; border:1px solid #1ebe5d; text-transform:uppercase; letter-spacing:0.4px;">
                        Share on WhatsApp
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="height:1px; background:#2a2a2a; margin:0 0 26px 0;"></div>

                <!-- Booking / Calendar Section -->
                <p style="margin:0 0 12px 0; font-size:15px; line-height:1.6; color:#bdbdbd; text-align:center;">
                  Want to see other upcoming games?
                </p>

                <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; text-align:center;">
                  <a href="{{gameCalendarUrl}}" style="color:#ffde00; font-weight:800; text-decoration:none;">
                    See our match calendar
                  </a>
                </p>

              </td>
            </tr>

            <!-- Socials -->
            <tr>
              <td align="center" style="padding:10px 24px 28px 24px;">
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
              <td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
                <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">
                  You received this because you signed up for a LaserOps Malta match.
                </p>

                <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">
                  Can't make it? Please reply to this email and let us know as soon as possible.
                </p>

                <p style="margin:0; font-size:12px; line-height:1.5; color:#777777;">
                  LaserOps · Outdoor tactical laser tag in Malta
                </p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>$rem$,
  true, 0, 14
)
on conflict (key) do nothing;
