-- =============================================================================
-- Launch announcement email: a dedicated rich template for the go-live sendout
-- to the opted-in mailing list, plus a type_key on email_campaigns so the blast
-- can choose which template to use (default stays the plain admin_broadcast).
-- Self-contained template: {{nickname}} + {{siteUrl}} + brand tokens; the body
-- text is baked in (not {{body}}), so the campaign only needs a subject.
-- =============================================================================

alter table public.email_campaigns
  add column if not exists type_key text not null default 'admin_broadcast';

insert into public.notification_types
  (key, label, description, priority, is_active, sends_email, email_subject, email_html, sends_push, delay_hours, sort_order)
values (
  'launch_announcement',
  'Launch announcement (mailing list)',
  'The go-live announcement emailed to the opted-in mailing list. Fixed rich template; edit the copy here.',
  2, true, true,
  'We rebuilt LaserOps - and your whole battle record is inside',
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
            <div style="font-size:18px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">We&rsquo;ve Leveled Up</div>
          </td></tr>
          <tr><td style="padding:32px 28px 8px 28px; color:#ffffff;">
            <h1 style="margin:0 0 16px 0; font-size:27px; line-height:1.2; font-weight:800; color:#ffffff;">The all-new LaserOps is here, {{nickname}}.</h1>
            <p style="margin:0 0 10px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">We&rsquo;ve been working hard on taking LaserOps to the next level, and our updated platform has just been launched &ndash; and the best part? <strong style="color:#ffffff;">Every game you&rsquo;ve ever played with us is already inside, waiting for you.</strong></p>
            <p style="margin:0 0 4px 0; font-size:16px; line-height:1.6; color:#d8d8d8;">Here&rsquo;s (some of) what&rsquo;s new, and why you&rsquo;ll want to jump in:</p>
          </td></tr>
          <tr><td style="padding:18px 28px 0 28px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#181818; border:1px solid #333333; border-radius:12px;"><tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px 0; font-size:12px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Claim your profile</p>
            <p style="margin:0; font-size:15px; line-height:1.55; color:#e4e4e4;">Sign in or create your free account to <strong style="color:#ffffff;">reclaim your full stats</strong> &ndash; your kills, wins, accolades and rank across every match you&rsquo;ve played.</p>
          </td></tr></table></td></tr>
          <tr><td style="padding:12px 28px 0 28px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#181818; border:1px solid #333333; border-radius:12px;"><tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px 0; font-size:12px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Your rewards are waiting</p>
            <p style="margin:0; font-size:15px; line-height:1.55; color:#e4e4e4;">The <strong style="color:#ffffff;">XP, levels and weapon unlocks</strong> you&rsquo;ve earned from past games are ready to claim the moment you log in. On top of that, you now unlock <strong style="color:#ffffff;">usable rewards</strong> for leveling up &ndash; already waiting for you from your previously played games.</p>
          </td></tr></table></td></tr>
          <tr><td style="padding:12px 28px 0 28px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#181818; border:1px solid #333333; border-radius:12px;"><tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px 0; font-size:12px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">A whole new game portal</p>
            <p style="margin:0; font-size:15px; line-height:1.55; color:#e4e4e4;">Book and join games online, <strong style="color:#ffffff;">create open matches</strong> for anyone to join, get a full match report after every session, and track kills, captures, accolades and ratings &ndash; match by match.</p>
          </td></tr></table></td></tr>
          <tr><td style="padding:12px 28px 0 28px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#181818; border:1px solid #333333; border-radius:12px;"><tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px 0; font-size:12px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">New, detailed scoring and stats</p>
            <p style="margin:0; font-size:15px; line-height:1.55; color:#e4e4e4;">We&rsquo;ve now fully launched our updated scoring system, with a range of in-game <strong style="color:#ffffff;">streaks, nemesis lists and achievements</strong>.</p>
          </td></tr></table></td></tr>
          <tr><td style="padding:12px 28px 0 28px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#181818; border:1px solid #333333; border-radius:12px;"><tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px 0; font-size:12px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">Form your squad</p>
            <p style="margin:0; font-size:15px; line-height:1.55; color:#e4e4e4;">Team up with your crew &ndash; <strong style="color:#ffffff;">create or join a squad</strong> and climb the new competitive ladders together.</p>
          </td></tr></table></td></tr>
          <tr><td style="padding:12px 28px 4px 28px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#181818; border:1px solid #333333; border-radius:12px;"><tr><td style="padding:18px 20px;">
            <p style="margin:0 0 6px 0; font-size:12px; font-weight:800; letter-spacing:0.5px; color:#ffde00; text-transform:uppercase;">And plenty more</p>
            <p style="margin:0; font-size:15px; line-height:1.55; color:#e4e4e4;">Leaderboards and a Hall of Fame, match photo galleries from every session, and shareable stat-overlay stories you can post straight to your socials.</p>
          </td></tr></table></td></tr>
          <tr><td style="padding:26px 28px 6px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
              <a href="{{siteUrl}}/player-portal/login" style="display:block; background:#ffde00; color:#111111; text-decoration:none; font-size:16px; font-weight:800; padding:16px 22px; border-radius:10px; border:2px solid #ffde00; text-transform:uppercase; letter-spacing:0.4px;">Claim your profile</a>
            </td></tr></table>
            <p style="margin:14px 0 0 0; font-size:13px; line-height:1.5; color:#9a9a9a; text-align:center;">It takes under a minute, and your stats are waiting on the other side.</p>
          </td></tr>
          <tr><td style="padding:26px 28px 4px 28px;">
            <p style="margin:0; font-size:16px; line-height:1.6; color:#d8d8d8;">See you on the field.<br><strong style="color:#ffffff;">The LaserOps Malta crew</strong></p>
          </td></tr>
          <tr><td align="center" style="padding:18px 24px 24px 24px;">
            <table cellpadding="0" cellspacing="0" role="presentation"><tr>
              <td style="padding:0 8px;"><a href="{{instagramUrl}}"><img src="{{instagramIconUrl}}" width="28" height="28" alt="Instagram" style="display:block; border:0;"></a></td>
              <td style="padding:0 8px;"><a href="{{facebookUrl}}"><img src="{{facebookIconUrl}}" width="28" height="28" alt="Facebook" style="display:block; border:0;"></a></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px; background:#080808; text-align:center;">
            <p style="margin:0 0 8px 0; font-size:12px; line-height:1.5; color:#777777;">You received this because you have a LaserOps Malta account and opted in to email updates.</p>
            <p style="margin:0;"><a href="{{siteUrl}}" style="font-size:12px; line-height:1.5; color:#ffde00; font-weight:700; text-decoration:none;">www.laseropsmalta.com</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>',
  false, 0, 42)
on conflict (key) do update set email_html = excluded.email_html, email_subject = excluded.email_subject, label = excluded.label, description = excluded.description;
