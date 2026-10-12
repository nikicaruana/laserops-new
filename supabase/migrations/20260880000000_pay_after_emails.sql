-- =============================================================================
-- Pay-after-game cutover: email + notification copy.
--  1. Reword game_confirmed_pay (confirmation email) - no "pay now" at sign-up;
--     spot is confirmed, pick your gun, settle AFTER the game.
--  2. New game_settle_up type (email + bell): post-game "settle up" nudge with a
--     CTA to the login-gated pay page (token / Revolut / cash). Emitted from the
--     publish route to per-player games, to players who have not paid yet.
-- =============================================================================

-- 1) Reword the confirmation email in place (targeted, keeps the branded shell).
update public.notification_types
set email_html = replace(
      replace(email_html,
        'Your LaserOps game is <strong style="color:#ffffff;">confirmed</strong>. Full payment is required prior to the match to confirm your spot.',
        'Your LaserOps game is <strong style="color:#ffffff;">confirmed</strong>. Your spot is locked in &ndash; pick your gun now, and settle up after the game (game token, Revolut or cash).'),
      '>Pay for my spot</a>',
      '>Go to my game</a>'),
    email_subject = 'Your LaserOps game is confirmed'
  where key = 'game_confirmed_pay';

-- 2) New post-game settle-up notification + email.
insert into public.notification_types
  (key, label, description, priority, is_active, sends_email, sends_push, delay_hours, sort_order,
   email_subject, bell_title, bell_body, email_html)
values (
  'game_settle_up',
  'Settle up after a game',
  'Post-game nudge to settle the bill (token / Revolut / cash) on the pay page.',
  2, true, true, false, 0, 15,
  'Settle up for your LaserOps game',
  'Time to settle up',
  'Settle up for {{matchLabel}} &ndash; use a game token, Revolut or cash.',
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
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Settle Up</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px 28px; color:#ffffff;">
                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Good game, {{nickname}}.</h1>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">Thanks for playing <strong style="color:#ffffff;">{{matchLabel}}</strong>{{matchDate}}. Time to settle up &ndash; it takes a few taps.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 26px 0; background:#181818; border:1px solid #333333; border-radius:12px;">
                  <tr><td style="padding:20px 22px;">
                    <p style="margin:0 0 8px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">On your settle-up page you can:</p>
                    <p style="margin:0 0 6px 0; font-size:16px; line-height:1.5; color:#ffffff; font-weight:700;">&bull; Use a game token (if you have one)</p>
                    <p style="margin:0 0 6px 0; font-size:16px; line-height:1.5; color:#ffffff; font-weight:700;">&bull; Pay the rest by Revolut</p>
                    <p style="margin:0; font-size:16px; line-height:1.5; color:#ffffff; font-weight:700;">&bull; Or choose to pay cash on the day</p>
                  </td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Settle up now</a>
                </td></tr></table>
                <p style="margin:0 0 6px 0; font-size:14px; line-height:1.6; color:#9a9a9a;">Already sorted with us in person? You can ignore this &ndash; we will mark you paid.</p>
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 28px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="padding:0 8px;"><a href="{{instagramUrl}}"><img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;"></a></td>
              <td style="padding:0 8px;"><a href="{{facebookUrl}}"><img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;"></a></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
            <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">You received this because you played a LaserOps Malta game.</p>
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
