# v2-rebuild → Production Go-Live Checklist

A running list of everything that must be done to take `v2-rebuild` live on the
main site. Living document — add items as they come up, tick them as they land.
Legend: `[ ]` todo · `[~]` in progress / partial · `[x]` done · `[!]` blocked / waiting.

Last updated: 2026-10-01

---

## 1. Infra & configuration (dashboards, not code)

- [ ] **Google OAuth — prod URLs.** Add the prod domain (`laseropsmalta.com`, `www.laseropsmalta.com`) to:
  - Google Cloud OAuth client → **Authorized JavaScript origins** (the redirect URI itself stays Supabase's `.../auth/v1/callback`).
  - Supabase → Authentication → **URL Configuration** → Site URL + Redirect URLs (`https://laseropsmalta.com/**`).
  - Common cause of Google login breaking in prod even when the consent screen is published.
- [x] **Google consent screen published.** Verified In production / External (2026-09-21). No 100-user-cap concern — app uses only email/profile/openid.
- [x] **`REVALIDATE_SECRET`** set in Vercel (force-refresh `/api/revalidate` works).
- [ ] **Vercel prod env vars — confirm all present** in the production project:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET`
  - `RESEND_*` (notification emails + .ics invites)
  - `ANTHROPIC_API_KEY` (player match narratives — feature is inert without it)
  - `STRIPE_*` (payments) · `VIVA_*` (only when Viva goes live — see §4)
  - `REVALIDATE_SECRET`
- [ ] **Supabase: confirm prod = dev project, or migrate.** If prod points at a different Supabase project than dev, run `supabase db push` against it so all migrations (incl. the killstreak tables + RPC) apply. If it's the same project, they're already live.
- [ ] **Confirm all config tables are seeded in prod** (teams, guns, rank_levels, scoring config, streaks, killstreaks, etc.). See config-seeding notes.
- [ ] **Domain / DNS.** Point `laseropsmalta.com` (+ `www`) at the v2 app in Vercel. Confirm what currently serves the apex vs the report site.

## 2. Features to finish before launch

- [x] **Homepage revamp** — visuals updated by user; hero/CTAs/social all now CMS-driven (see Homepage CMS). Booking flow reworked too: /booking is now a two-path page (join an upcoming open game vs private/group enquiry) instead of a bare contact form (commit 0eadf8e).
- [~] **Homepage CMS in admin** — HERO + SOCIAL + REVIEWS DONE 2026-10-02 (commits bfd7141 / e865bef / cda5712). `home_config` drives the hero (headline, subhead, reviews badge, stat tiles, and BOTH a signed-out and signed-in CTA pair — login-aware via useAccount). `home_social_posts` + `home_reviews` drive the bottom GallerySection (add/edit/reorder/show-hide/delete at /admin/homepage; post images upload to Cloudinary via /api/admin/image "social" kind). Homepage fully off Google Sheets now (hero/social/reviews). Seeded from the old sheet (3 posts, 8 reviews). REMAINING (staging): move the homepage `featured` photo strip + the content-page Cloudinary tags into the CMS (tie to the new match-linked library), see the tag accounting below.
- [x] **HTML email templates for all notifications** — 9 branded templates built + persisted (admin-editable at /admin/notifications/<key>), per-type sender overrides, Reward images CMS for the token/XP art, matches.duration_minutes (default 180=3h) drives the time range, emit tokens wired (matchDate/matchTimeRange/matchLabel/old dates). Remaining: match_report_live isn't emitted yet (future ingestion flow); an admin field to set duration_minutes per match (e.g. 210 for double-XP); the combined refund body depends on the refund system.
- [~] **Set email config values in admin** — SUPERSEDED for location/parking by the new Locations feature (2026-10-02, commits 592260c / 25f399a / f52787b): venues live in a `locations` table (name + parking + playing Google Maps links, one default), managed at /admin/locations and seeded with White Rocks (default) + Misieb. Games carry a location (admin picks in the create form, default pre-selected; community open games use the default); match reminders inject the game location playing/parking links into matchLocationUrl/parkingUrl, and the .ics invite + invite email use the venue + Directions/Parking links. REMAINING: admins set per-type sender addresses in /admin/notifications as wanted (data entry). Receipts: not built - Viva emails its own card receipt + we have booking confirmation; add a branded receipt email later only if wanted.
- [~] **Refund system** — BUILT 2026-09-28 (typechecked; live end-to-end test pending). Shared `lib/payments/refund.ts` (cash-first cash+token split): auto full refund on match cancellation (`/api/matches/[id]/cancel` now actually pays out) + player drop-out (>=48h) + admin single refund; admin partial early-end refunds 25/50/75% from Match Manager (`MatchAdminActions` live-state control -> `/api/matches/[id]/end-early`). New `refund_match_tokens` RPC credits the token portion. The `refunded` email body states both €X and N tokens.
- [x] **Admin section to tune refund logic** — DONE 2026-10-02 (commit 7d23dc7). `refund_config` row + /admin/refunds editor (2FA, Store > Refunds) sets the auto-refund window, no-refund window, and player-facing policy text. getRefundConfig() (fallback to policy.ts constants) feeds the player cancel route, the hosted-checkout policy text, and the in-portal pay panel. Early-end part-refund % stays an admin choice in Match Manager.

## 3. Data

- [ ] **Build the prod DB on staging, then PROMOTE it in place (not a copy-migrate).** Stand up ONE Supabase project that becomes prod: apply all migrations, seed every config table, carry over the agreed match set, recompute everything (below). The closed group tests against it; before launch delete only the test-generated rows (test accounts, signups, payments, token ledger, test matches) and repoint the prod domain + env at this same project. Avoids a risky dump-and-restore into a second project.
- [~] **Finalise scoring/XP inputs BEFORE the recompute (hard gate).** Lock the scoring formula, exploit controls, XP progression + rewards, and the rating system, and decide exactly which matches carry over. THEN recompute XP/stats/ratings for every carried match. XP for all past games will change - expected.
  - [x] **Scoring formula + exploit controls LOCKED & WIRED (2026-10-01).** The admin panels (/admin/scoring + /admin/exploit-control) are now authoritative - commit.ts/buildMatchReportV2 load the per-mode config at publish (was hardcoded). Locked Domination values: Kill = (frags x50 + damage x0.2) x (1+acc x0.2) x (1+kd x0.12); Objective = captures x100 + hold x1.5 + recaptures x75; streaks on top (code + streak config). Exploit: spawn window 4s/void, min hold 3s for a cap, recapture window 20s. One mode. Offline = kill-only. Verified end-to-end.
  - [x] **XP progression + rewards LOCKED (2026-10-01).** Per-match XP (xp_config, admin): points = (base 250 + pool 3000 x min(rating,4)) x boost; wins = (750 x roundsWon + 500 x matchWin) x boost; + accolades x boost (accolades now boosted too, was flat). Level curve: 1000 x (L-1)^2, 50 levels. Rewards ladder (level_unlocks) unchanged. Already config-driven (recompute reads xp_config + rank_levels). FIXED a real bug: service_role lacked write grant on xp_config + rank_levels, so the Calibrator's Publish & recompute always failed silently (saves never persisted) - grants added.
  - [ ] Rating system (step 4).
  - [x] **STEP D DONE (2026-10-02):** full recompute ran (scripts/recompute-all.ts) - 32 matches / 517 rows replayed; XP/level/Elo + careers + leaderboards + ratings rebuilt on the locked config. Season 1 (completed) challenge standings FROZEN (verified Glenn 92,540 unchanged); Season 2 (active) refreshed. Scriptable via service role (guards opened to service_role for prod-launch tooling). RETROSPECTIVE UNLOCKS / ARMORY: PARKED (2026-10-02, user). The gun-unlock system was always deferred; user will REDESIGN the gun trees + switch unlock currency from class-POINTS to class-XP (fairer offline/online + rewards gun variety via double-XP tokens). Build after the redesign: an armory recompute (per-player class XP from match_player_aggregate xp_total+gun class, evaluate each gun's level+XP rule, write gun_is_unlocked+progress) run for everyone post-recompute AND on account create/claim. Current player_armory (5396 rows) is a stale one-time Sheet seed. NOTE: guns table currently has unlock_type Default(9)/Class(10) with unlock_requirement_level + unlock_requirement_points + unlock_prerequisite_class - the points rule is being replaced by XP.
  - [x] **STEP C DONE (2026-10-02):** all games 01-32 ingested on the locked config. Offline (sheet) 01-26 incl. 23 (re-classified offline - the DB's '23' held 27's leftover test data; 23 was never online). Online 27/29/30/31; hybrid 28/32 (scripts/ingest-online-games.ts, validated vs beta reports). NEXT: step D full recompute.
  - [x] **BUILD PROGRESS (2026-10-01):** (A) hybrid scoring + report DONE. (B) offline batch importer DONE - scripts/import-offline-games.ts ran --live: 25 offline games (01-21,22,24,25,26) re-scored on the new formula + written. Season 1 challenge standings FROZEN (refresh skips completed seasons) to preserve original XP/results. NEXT: (C) ingest online/hybrid 23/27-32 from JSON/LWA; (D) full recompute; then retro unlocks.
  - [x] **Carryover match list LOCKED (2026-10-01).** ALL real venue games carry over (LO-2026-01..32) and must appear in the Match Manager (for attaching photos in the gallery rebuild). Re-ingest fresh from the Google Sheet + JSON/LWA so everything is scored on the new formula. Per-game scoring: OFFLINE (sheet/LWA, kill-only) = 01-21, 22, 24, 25, 26; ONLINE (all-round JSON) = 23, 27, 29, 30, 31 (29: all 5 rounds have validated JSON, one offline headband in R1 excluded); HYBRID (JSON rounds + offline rounds) = 28 (R1-2 online, R3-5 offline), 32. Test/incomplete matches (LO-TEST-*, no-code) dropped. Note: in the dev DB only 22/23/24/25 have raw data; 01-21+26 are old-scored aggregates needing re-ingest; 27-32 aren't in the dev DB yet (JSON/LWA files held by user + v2-beta report scripts).
- [ ] **Retrospective unlocks on account create/claim.** When a player creates or claims their account, grant the level-based unlocks their recomputed XP/level earns, so they immediately see the right guns/perks unlocked.
- [~] **Launch match-backlog ingestion** — backlog 01-32 ingested + recomputed on staging (see above). Top-up as new games are played: GAME 33 (online, ~2026-10-03) to ingest from JSONs via scripts/ingest-online-games.ts, seed any new players from a fresh registration export, then recompute. Repeat at final prod cutover for anything played during the staging window.
- [~] **Player accounts / historical data** — RECONCILED 2026-10-02. The staging DB (= future prod DB) only carried the 32-game backlog roster; 39 registered players were missing accounts (orphaned stats, non-claimable). Migrated them from the registration export (Player_Base CSV): 37 new migrated_unclaimed accounts (email-claimable) + 2 unclaimed renames to current in-game handle (Lux->LuXyz, Tom->PT); backfilled 46 aggregate + 16 award rows by nickname; recompute ran. Accounts 284->321; 29 orphans remain = unresolved "Head NN" online opponents (correctly accountless). Grant added: service_role insert/update on accounts (commit 0a7ef09). ONGOING: each new game brings players who may need the same migration from a fresh export before recompute.

## 4. Payments

- [x] **Viva integration** — VALIDATED end-to-end in the Viva DEMO sandbox on 2026-09-28: live test payment + refund both confirmed (webhook marks paid with correct amount; admin refund clears + records). Two bugs found & fixed via the self-test: (1) Basic-auth endpoints (webhook key + refund) must hit `demo.vivapayments.com`/`www.vivapayments.com`, not the `-api` host; (2) Viva refund needs `?amount=` even for a full refund (adapter now resolves it). Diagnostic: `GET /api/admin/viva-check`. Runbook: `docs/VIVA-SANDBOX-SETUP.md`. **For prod:** swap to the production Viva account (`VIVA_ENV=production` + prod credentials + prod webhook at the real domain + Source success/failure = `https://laseropsmalta.com/checkout/complete`). Token-bundle webhook path still untested (no active bundles seeded).
- [x] ~~Stripe refund flow / prod keys + webhook~~ **DROPPED** - we went with Viva, not Stripe. Residual Stripe code/keys are legacy and can be removed.

## 5. Verify / QA after cutover

- [ ] **Killstreaks** — never runtime-tested in a live match (Scrambler/EMP deploy, enemy overlay, reload-persistence, charge enforcement). Verify during the first real live game.
- [ ] Google + email sign-in on the prod domain.
- [ ] Live feed (`match_live_state` realtime), booking + calendar invites, notifications.
- [ ] Match report v2 renders; force-refresh works.

## 6. Dev-only — must NOT ship to prod (keep uncommitted or dev-gate)

- [x] `/scoring-lab` page — DEV-GATED 2026-10-02 (commit 428fa4f): app/scoring-lab/layout.tsx notFound()s the route in production (NODE_ENV), + noindex. Renders in dev only.
- [x] Progression Calibrator legacy old-vs-new + games-to-level planner additions — DEV-GATED 2026-10-02 (commit 428fa4f): both sections wrapped in `process.env.NODE_ENV !== "production"` so they are dead-code-eliminated from prod builds; the real Calibrator (XP formula/level curve/token modeling/publish) stays.
- [x] `lib/match-report-v2/reports` — NO ACTION NEEDED: imported only by dev scripts (scripts/build-live-report*.ts), never by the app, so it is not in the production bundle. Left in place so the report-building scripts keep working.

## 7. Post-launch audits (once V2 is live)

- [ ] **Site performance audit** — full pass once V2 is live: Lighthouse / Core Web Vitals, JS bundle + image sizes, caching coverage, and DB query hotspots. Already done: HoF/leaderboard/achievements boards cached (`lib/leaderboards/hall-of-fame-cached.ts`, 30-min + refresh-on-publish); Cloudinary images optimized via `cldImage`. Candidates flagged during the build: cache the Compare page's `getAllPlayerSummaryRows` (reads all players); add DB indexes for the match-report / match_player_aggregate lookups.
- [ ] **SEO audit of all new V2 pages** — for every new page: `<title>` + meta description, canonical URL, OG/Twitter cards, sitemap coverage, structured data where relevant, and heading hierarchy. Cover the pages created during the V2 build (Blog + posts, Streaks & Accolades, Player Stats → Achievements, and any further content pages).

## 8. Pre-staging build items (added 2026-10-01)

These should land before the closed-group staging test.

- [x] **Beginner-only open games.** BUILT 2026-10-01 (commit c528d5f): CreateMatchForm *Beginners* switch (non-private) -> max-level input; matches.is_beginner + beginner_max_level; DB trigger match_signup_beginner_gate blocks over-cap registrations (admins exempt); player games list + detail show a Beginners badge with the cap, a Beginners-only filter, and a "your level is too high" notice. Not yet: editing the flag post-creation; a Match Manager badge.
- [x] **Token T&Cs shown everywhere needed.** BUILT 2026-10-01: (1) store page - prominent "before you buy" callout above the bundles; (2) /terms - already covered; (3) /checkout/complete - terms line incl. token validity/expiry; (4) TokenWallet - expiry/refund note + link. All link to /terms.
- [~] **Gallery rework (match-tied photos).** MECHANISM BUILT 2026-10-01: match-name filter is now a dropdown (not a pill row); a "My games only" toggle filters to the viewer's games (client-side my_participated_match_codes RPC, keeps /gallery cached). Uploads were already match-tied (folder + match_code tag). STILL TO DO (at staging): start the library in a fresh clearly-labelled Cloudinary folder + backfill past matches, which also unblocks stat-overlay story images for historical games.
- [x] **"Match photos uploaded" notification + email.** BUILT 2026-10-01: match_photos_added notification type + email; admin "Notify players" button in the Photos section emits to everyone who played (service role), once per match (matches.photos_notified_at). Route: /api/admin/match-image/notify.
- [x] **Mixed online/offline match report.** BUILT 2026-10-01 (option B): publish routes hybrid matches (online JSON + offline LWA) through buildMatchReportV2 with offline kill-stat injection - online rounds full (kill+obj+streak), offline kill-only, killScore from merged totals. matches.online/offline_round_count stamped; report uses the ONLINE format for hybrid + shows a "Rounds 1-N online / N+1-M offline" flag. Per-round denominators: caps/hold are only shown as totals (no caps-per-round stat exists), so no denominator bug; the kill/dmg/score per-round career stats are dual and correctly use total rounds. ORIGINAL SPEC: When a game mixes online and offline rounds, keep the ONLINE report format (do NOT fall back to the offline-only layout) and label which rounds were online vs offline (e.g. "Rounds 1-2 online, 3-5 offline"). **Stat split (confirmed):** offline rounds EXCLUDE objective scoring, streaks, nemesis, and the you-killed / killed-by matrices (all ONLINE-ONLY); offline rounds DO include accuracy. So online-only stats (caps, cap/hold time, objective score, streaks, nemesis, kill matrices) average over the ONLINE round count; dual stats (kills, deaths, accuracy, damage, K/D) average over TOTAL rounds. Example: 2 online + 3 offline, 10 caps (online-only) -> caps/round = 5, not 2. **Damage differs by mode:** offline damage = the player signed-in gun x that gun admin damage value (gun_damage_at), online damage = actual JSON PlayerHitEvent damage. **SCORING (decided 2026-10-01, option B):** re-score the online rounds with the FULL online formula (kill + objective + streak) and keep offline rounds killScore, summed per player, so the Score matches what the report shows. This REVISES the earlier "mixed = kill-only whole-match" rule in dual-mode-scoring-design (the online JSON data is present, so objective/streak for the online rounds now count).

## 9. Closed-group staging test (Vercel) - extra steps

A staging test is a parallel copy of prod infra config pointed at a staging URL, plus the data decision in section 3. Extra steps beyond a straight prod deploy:

- [ ] **Stable staging domain** (e.g. `staging.laseropsmalta.com` aliased to the v2-rebuild branch) - NOT the per-commit preview URL, which changes every push and breaks the OAuth/Supabase allowlists.
- [ ] **Second OAuth + Supabase allowlist entry** for the staging origin (Google JS origins + Supabase redirect URLs). Consent screen already published; email/profile/openid only, so no tester cap.
- [ ] **Env vars scoped to staging** in Vercel (Supabase / Cloudinary / Resend / Viva / NEXT_PUBLIC_SITE_URL / REVALIDATE_SECRET). Cloudinary renders fine on any Vercel deploy.
- [x] **Gate the group (CODE DONE 2026-10-02, commit 2d6b864).** App-level email allowlist in middleware.ts, inert unless `STAGING_GATE=1`. Non-allowlisted signed-in users (and anon) are redirected to /closed-beta; auth, login/signup, and all /api/* (webhooks, crons, revalidate) stay reachable. Set on staging: `STAGING_GATE=1` + `STAGING_ALLOWED_EMAILS=a@b.com,@domain` (exact email or whole domain via @domain). Does NOT block webhooks.
- [x] **noindex on staging (CODE DONE 2026-10-02, commit 2d6b864).** robots.ts returns disallow-all when `STAGING_GATE=1` or the host looks like staging/preview (isStagingHost). /closed-beta also sets robots noindex. The live prod host is unaffected.
- [ ] **Crons** run only on Production deployments, not previews. On a preview-based staging the 5 crons (notifications-dispatch, match-reminders, go-live, waitlist-notify, ladder-idle-drop) will NOT auto-fire - trigger manually, or run staging as its own prod project (then they WILL send real mail to testers).
- [ ] **Viva stays in DEMO** on staging: demo keys + a demo Source whose success/failure URLs + webhook point at the staging domain. Needs the partner present to create/reverify (parked constraint).
- [ ] **Resend sends real email** to testers during staging (notifications, .ics invites, refunds). Verify the sending domain and warn the group.

### Cloudinary tag accounting (for the gallery folder changeover at staging)
Every tag-driven Cloudinary call today (all must survive the match-photos folder switch):
- `featured` -> homepage photo strip (GalleryPreview) — MIGRATE into the homepage CMS (pick from the match-linked library; retire the tag).
- `community` -> /community
- `olt-hero`, `olt-arena`, `olt-kit` -> /outdoor-laser-tag-malta (olt-hero also feeds sitemap.ts)
- `stag` -> /stag-and-hen
- (folder, not tag) -> /gallery + homepage preview via fetchGalleryImages(asset_folder)
Corporate-events + birthday-parties pages do NOT pull Cloudinary today (static). Plan: keep match photos (new match-linked folder) and marketing/content images (featured/community/olt-*/stag) in SEPARATE folders so the match-photo switch cannot break content pages; then retire tags into the CMS per-surface, starting with the homepage featured strip.
