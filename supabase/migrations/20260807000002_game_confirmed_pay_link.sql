-- Re-persist game_confirmed_pay: both CTAs now use {{link}} (the game page).
update public.notification_types set email_html = '<!DOCTYPE html>
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
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Game Confirmed</div>
          </td></tr>
          <tr><td style="padding:32px 28px 12px 28px; color:#ffffff;">
                <h1 style="margin:0 0 18px 0; font-size:26px; line-height:1.2; font-weight:800; color:#ffffff;">You&rsquo;re in, {{nickname}}.</h1>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">Your LaserOps game is <strong style="color:#ffffff;">confirmed</strong>. Full payment is required prior to the match to confirm your spot.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 26px 0; background:#181818; border:1px solid #333333; border-radius:12px;">
                  <tr><td style="padding:20px 22px;">
                    <p style="margin:0 0 8px 0; font-size:13px; line-height:1.4; color:#ffde00; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Game Date</p>
                    <p style="margin:0 0 18px 0; font-size:22px; line-height:1.3; color:#ffffff; font-weight:800;">{{matchDate}}</p>
                    <p style="margin:0 0 8px 0; font-size:13px; line-height:1.4; color:#ffde00; font-weight:800; text-transform:uppercase; letter-spacing:0.4px;">Game Time</p>
                    <p style="margin:0; font-size:22px; line-height:1.3; color:#ffffff; font-weight:800;">{{matchTimeRange}}</p>
                  </td></tr>
                </table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Pay for my spot</a>
                </td></tr></table>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 14px 0;"><tr><td align="center">
                  <a href="{{matchLocationUrl}}" style="display:block; background:#111111; color:#ffde00; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">View game location</a>
                </td></tr></table>
                <div style="height:1px; background:#2a2a2a; margin:0 0 26px 0;"></div>
                <p style="margin:0 0 18px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">Plans changed? You can manage your spot or back out any time from your match screen.</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px 0;"><tr><td align="center">
                  <a href="{{link}}" style="display:block; background:#222222; color:#ffffff; text-decoration:none; font-size:16px; font-weight:800; padding:15px 22px; border-radius:10px; border:1px solid #3a3a3a; text-transform:uppercase; letter-spacing:0.4px;">Go to match</a>
                </td></tr></table>
          </td></tr>
          <tr><td align="center" style="padding:10px 24px 28px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="padding:0 8px;"><a href="{{instagramUrl}}"><img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;"></a></td>
              <td style="padding:0 8px;"><a href="{{facebookUrl}}"><img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;"></a></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
            <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">You received this because you signed up for a LaserOps Malta game.</p>
            <p style="margin:0;"><a href="https://www.laseropsmalta.com" style="font-size:12px; line-height:1.5; color:#ffde00; font-weight:700; text-decoration:none;">www.laseropsmalta.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>' where key = 'game_confirmed_pay';
