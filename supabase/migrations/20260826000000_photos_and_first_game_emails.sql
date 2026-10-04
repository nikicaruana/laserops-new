-- =============================================================================
-- Two email templates fleshed out, in the shared branded house style
-- (logo header / yellow section band / card body / social footer):
--
-- 1) match_photos_added - restyled to match the rest of the emails, and now
--    spells out what players can do with their photos: tag themselves, set one
--    as their profile picture, and build a custom story with match-stat overlays
--    for their socials.
--
-- 2) first_game_followup (NEW type) - a congratulations email for players who
--    just completed their FIRST game: encouragement, a big Google-review CTA,
--    and a nudge to log in and see what they unlocked. Emitted from the Publish
--    Scores step (when the report goes live) only to genuine first-timers; see
--    app/api/matches/[id]/publish/route.ts.
-- =============================================================================

-- 1) Match photos -------------------------------------------------------------
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
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Match Photos</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px 28px; color:#ffffff;">
                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Your photos are up, {{nickname}}.</h1>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">{{body}}</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px 0; background:#181818; border:1px solid #333333; border-radius:12px;">
                  <tr><td style="padding:20px 22px;">
                    <p style="margin:0 0 14px 0; font-size:13px; line-height:1.4; color:#ffde00; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Make them yours</p>
                    <p style="margin:0 0 12px 0; font-size:15px; line-height:1.5; color:#e4e4e4;"><span style="color:#ffde00; font-weight:800;">Tag yourself</span> in any shot you are in, so it shows up on your profile.</p>
                    <p style="margin:0 0 12px 0; font-size:15px; line-height:1.5; color:#e4e4e4;"><span style="color:#ffde00; font-weight:800;">Set your favourite</span> as your profile picture in a couple of taps.</p>
                    <p style="margin:0; font-size:15px; line-height:1.5; color:#e4e4e4;"><span style="color:#ffde00; font-weight:800;">Build a custom story</span> with your match stats overlaid, ready to post straight to your socials.</p>
                  </td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">View &amp; tag your photos</a>
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
  email_subject = 'Your match photos are up',
  sends_email = true
  where key = 'match_photos_added';

-- 2) First-game follow-up (new type) -----------------------------------------
do $$
declare tpl text := '<!DOCTYPE html>
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
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Mission Complete</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px 28px; color:#ffffff;">
                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">Great first game, {{nickname}}!</h1>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">You made it through your first LaserOps mission, and this is only the start. Every game you play earns XP, unlocks new weapons and gear, and climbs you up the ranks against the rest of the squad.</p>
                <div style="height:1px; background:#2a2a2a; margin:0 0 24px 0;"></div>
                <h2 style="margin:0 0 10px 0; font-size:20px; line-height:1.3; font-weight:800; color:#ffffff;">Enjoyed the battle?</h2>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">A quick Google review helps more players find us and means a huge amount to a small local crew. It takes less than a minute.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 26px 0;"><tr><td align="center">
                  <a href="{{googleReviewUrl}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Leave a Google review</a>
                </td></tr></table>
                <div style="height:1px; background:#2a2a2a; margin:0 0 24px 0;"></div>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">Then jump back in and see what your first game unlocked: your stats, your accolades, and how far you are from your next rank.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#111111; color:#ffde00; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">See what I unlocked</a>
                </td></tr></table>
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 28px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="padding:0 8px;"><a href="{{instagramUrl}}"><img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;"></a></td>
              <td style="padding:0 8px;"><a href="{{facebookUrl}}"><img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;"></a></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
            <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">You received this because you played your first game at LaserOps Malta.</p>
            <p style="margin:0;"><a href="https://www.laseropsmalta.com" style="font-size:12px; line-height:1.5; color:#ffde00; font-weight:700; text-decoration:none;">www.laseropsmalta.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>';
begin
  insert into public.notification_types
    (key, label, description, priority, is_active, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order)
  values
    ('first_game_followup', 'Welcome after first game',
     'Sent to a player after the report for their first-ever game goes live: encouragement, a Google-review ask, and a nudge to see their unlocks.',
     2, true, true, 'Nice first game, soldier', tpl, true, 0, 15)
  on conflict (key) do update set
    label = excluded.label, description = excluded.description, sends_email = true,
    email_subject = excluded.email_subject, email_html = excluded.email_html;
end $$;
