/**
 * lib/cms/client.ts
 * --------------------------------------------------------------------
 * Central registry of LaserOps CMS sheet URLs.
 *
 * The CMS is a separate Google Sheets document from the data sheets.
 * Editorial config (seasons, challenges, posts, reviews) lives here so
 * that:
 *   1. Data sheet edits and content edits don't conflict
 *   2. Permissions can differ between operators (data) and editors (CMS)
 *   3. CMS data can be cached longer than match data
 *
 * Each tab is published independently as CSV; this module just lists the
 * URLs. The typed fetchers in seasons.ts / challenges.ts / etc. import
 * from here and add row parsing on top of fetchSheetAsObjects.
 *
 * Cache: 1800s (30min) for CMS by default. Editorial content changes
 * infrequently; long cache reduces requests to Google. Override on a
 * per-fetcher basis if needed.
 */

export const CMS_REVALIDATE_SECONDS = 1800;

export const CMS_URLS = {
  seasons:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMYVbKQkhZ9zvHdLAL4aryEV-7OggiuDpHh1-kzuVIlbn5tD7d260U3LNee9M86gYFXEkuLCPCwd0/pub?gid=0&single=true&output=csv",
  challenges:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMYVbKQkhZ9zvHdLAL4aryEV-7OggiuDpHh1-kzuVIlbn5tD7d260U3LNee9M86gYFXEkuLCPCwd0/pub?gid=1589505036&single=true&output=csv",
  siteConfig:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMYVbKQkhZ9zvHdLAL4aryEV-7OggiuDpHh1-kzuVIlbn5tD7d260U3LNee9M86gYFXEkuLCPCwd0/pub?gid=2079479226&single=true&output=csv",
  instagramPosts:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMYVbKQkhZ9zvHdLAL4aryEV-7OggiuDpHh1-kzuVIlbn5tD7d260U3LNee9M86gYFXEkuLCPCwd0/pub?gid=616709609&single=true&output=csv",
  googleReviews:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMYVbKQkhZ9zvHdLAL4aryEV-7OggiuDpHh1-kzuVIlbn5tD7d260U3LNee9M86gYFXEkuLCPCwd0/pub?gid=2135585899&single=true&output=csv",
  excludedPlayers:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQPMYVbKQkhZ9zvHdLAL4aryEV-7OggiuDpHh1-kzuVIlbn5tD7d260U3LNee9M86gYFXEkuLCPCwd0/pub?gid=580212816&single=true&output=csv",
} as const;
