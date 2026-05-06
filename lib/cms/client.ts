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
  // Accolades — authoritative metadata for each accolade. Lives on the
  // DATA spreadsheet (same spreadsheet as Game_Data_Lookup, ranking
  // system, and game ID map), NOT the CMS spreadsheet — important when
  // editing this URL. Maps an accolade name (matching the suffix of
  // Accolade_<Name> columns in Game_Data_Lookup) to its display name,
  // description, badge image, and XP awarded for earning it.
  accolades:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=1530769203&single=true&output=csv",
  // Ranking system — level → score threshold + rank name + badge image.
  // Used for the XP card's level transition animation (we need badge
  // images for any intermediate levels a player passes through during
  // a single match's XP gain).
  rankingSystem:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=1047880912&single=true&output=csv",
  // Game ID map — match-level metadata: round wins per team, team
  // ratings, winning/losing team designations, badge images.
  gameIdMap:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=489613415&single=true&output=csv",
  // Weapons — one row per gun with display name, image, stats
  // (mag size / damage / reload / fire rate / etc.), unlock metadata,
  // and tree-branch grouping. Lives on the DATA spreadsheet (same as
  // accolades, ranking, gameIdMap) — important when editing this URL.
  // Consumed by /weapons (the gallery page).
  weapons:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=924946993&single=true&output=csv",
  // Player Armory — one row per (player, gun). Carries per-player stats
  // with each gun PLUS precomputed unlock state (Gun_Is_Unlocked,
  // Unlock_Progress_Pct, Unlock_Progress_Text, Has_Used_Gun,
  // Gun_Player_Image). Lives on the same DATA spreadsheet as `weapons`,
  // `accolades`, `rankingSystem`, `gameIdMap`. Consumed by the player-
  // portal Armory tab to render gun cards grouped by Gun_Tree_Branch.
  playerArmory:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTTLlM4fIfh52DiovbJT2b9A6UyqoiQtoG0c2HoVRCG_OCtLPZvz-uBSC6y1voM8d4jBVCNcpCGctco/pub?gid=583760029&single=true&output=csv",
} as const;
