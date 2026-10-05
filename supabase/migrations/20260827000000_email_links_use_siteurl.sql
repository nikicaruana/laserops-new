-- =============================================================================
-- Make every app/action link in emails derive from {{siteUrl}} (which resolves
-- to NEXT_PUBLIC_SITE_URL, else the brand default). Before this, four email_config
-- URLs and the footer link in every template were hard-coded to
-- www.laseropsmalta.com, so they did NOT follow the environment: on staging they
-- pointed at the live prod site, and at prod cutover they were only correct by
-- coincidence. After this, one env var switches all email links at once, and
-- staging emails correctly link to staging.
--
-- Pairs with lib/email-tokens.ts, which now expands {{siteUrl}} inside any config
-- value that references it (gameCalendarUrl / bookingUrl), on top of the existing
-- render pass for the *UrlTemplate values.
-- =============================================================================

update public.email_config set value = '{{siteUrl}}/events/open-games'                                   where key = 'gameCalendarUrl';
update public.email_config set value = '{{siteUrl}}/booking'                                              where key = 'bookingUrl';
update public.email_config set value = '{{siteUrl}}/match-report?match={{matchId}}'                       where key = 'matchReportUrlTemplate';
update public.email_config set value = '{{siteUrl}}/player-portal/player-stats/summary?ops={{nickname}}'  where key = 'playerProfileUrlTemplate';

-- Footer "visit our site" link in every email template -> {{siteUrl}}
-- (the visible www.laseropsmalta.com text is left as the brand label).
update public.notification_types
  set email_html = replace(email_html, 'href="https://www.laseropsmalta.com"', 'href="{{siteUrl}}"')
  where email_html like '%href="https://www.laseropsmalta.com"%';
