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

- [ ] **Homepage revamp** — visual/content overhaul.
- [ ] **Homepage CMS in admin** — admin picks featured social posts / reviews / homepage areas from Supabase; migrate homepage content **off Google Sheets** (same pattern as the rest of the portal).
- [x] **HTML email templates for all notifications** — 9 branded templates built + persisted (admin-editable at /admin/notifications/<key>), per-type sender overrides, Reward images CMS for the token/XP art, matches.duration_minutes (default 180=3h) drives the time range, emit tokens wired (matchDate/matchTimeRange/matchLabel/old dates). Remaining: match_report_live isn't emitted yet (future ingestion flow); an admin field to set duration_minutes per match (e.g. 210 for double-XP); the combined refund body depends on the refund system.
- [ ] **Set email config values in admin** — `matchLocationUrl` + `parkingUrl` are empty (feed the reminder location buttons); set per-type senders as wanted (e.g. reminders from info@). At /admin/notifications/email-settings + each type editor.
- [~] **Refund system** — BUILT 2026-09-28 (typechecked; live end-to-end test pending). Shared `lib/payments/refund.ts` (cash-first cash+token split): auto full refund on match cancellation (`/api/matches/[id]/cancel` now actually pays out) + player drop-out (>=48h) + admin single refund; admin partial early-end refunds 25/50/75% from Match Manager (`MatchAdminActions` live-state control -> `/api/matches/[id]/end-early`). New `refund_match_tokens` RPC credits the token portion. The `refunded` email body states both €X and N tokens.
- [ ] **Admin section to tune refund logic** — surface refund tiers/thresholds (currently constants `AUTO_REFUND_HOURS` / `NO_REFUND_HOURS`) as editable admin config.

## 3. Data

- [ ] **Build the prod DB on staging, then PROMOTE it in place (not a copy-migrate).** Stand up ONE Supabase project that becomes prod: apply all migrations, seed every config table, carry over the agreed match set, recompute everything (below). The closed group tests against it; before launch delete only the test-generated rows (test accounts, signups, payments, token ledger, test matches) and repoint the prod domain + env at this same project. Avoids a risky dump-and-restore into a second project.
- [ ] **Finalise scoring/XP inputs BEFORE the recompute (hard gate).** Lock the scoring formula, exploit controls, XP progression + rewards, and the rating system, and decide exactly which matches carry over. THEN recompute XP/stats/ratings for every carried match. XP for all past games will change - expected.
- [ ] **Retrospective unlocks on account create/claim.** When a player creates or claims their account, grant the level-based unlocks their recomputed XP/level earns, so they immediately see the right guns/perks unlocked.
- [ ] **Launch match-backlog ingestion** — ingest the backlog of past matches at launch.
- [ ] **Player accounts / historical data** — decide/handle any migration from V1 (open question — confirm scope).

## 4. Payments

- [x] **Viva integration** — VALIDATED end-to-end in the Viva DEMO sandbox on 2026-09-28: live test payment + refund both confirmed (webhook marks paid with correct amount; admin refund clears + records). Two bugs found & fixed via the self-test: (1) Basic-auth endpoints (webhook key + refund) must hit `demo.vivapayments.com`/`www.vivapayments.com`, not the `-api` host; (2) Viva refund needs `?amount=` even for a full refund (adapter now resolves it). Diagnostic: `GET /api/admin/viva-check`. Runbook: `docs/VIVA-SANDBOX-SETUP.md`. **For prod:** swap to the production Viva account (`VIVA_ENV=production` + prod credentials + prod webhook at the real domain + Source success/failure = `https://laseropsmalta.com/checkout/complete`). Token-bundle webhook path still untested (no active bundles seeded).
- [x] ~~Stripe refund flow / prod keys + webhook~~ **DROPPED** - we went with Viva, not Stripe. Residual Stripe code/keys are legacy and can be removed.

## 5. Verify / QA after cutover

- [ ] **Killstreaks** — never runtime-tested in a live match (Scrambler/EMP deploy, enemy overlay, reload-persistence, charge enforcement). Verify during the first real live game.
- [ ] Google + email sign-in on the prod domain.
- [ ] Live feed (`match_live_state` realtime), booking + calendar invites, notifications.
- [ ] Match report v2 renders; force-refresh works.

## 6. Dev-only — must NOT ship to prod (keep uncommitted or dev-gate)

- [ ] `/scoring-lab` page.
- [ ] Progression Calibrator's legacy old-vs-new + games-to-level planner additions.
- [ ] Any throwaway routes / preview reports left in `lib/match-report-v2/reports` if not intended for the live report page.

## 7. Post-launch audits (once V2 is live)

- [ ] **Site performance audit** — full pass once V2 is live: Lighthouse / Core Web Vitals, JS bundle + image sizes, caching coverage, and DB query hotspots. Already done: HoF/leaderboard/achievements boards cached (`lib/leaderboards/hall-of-fame-cached.ts`, 30-min + refresh-on-publish); Cloudinary images optimized via `cldImage`. Candidates flagged during the build: cache the Compare page's `getAllPlayerSummaryRows` (reads all players); add DB indexes for the match-report / match_player_aggregate lookups.
- [ ] **SEO audit of all new V2 pages** — for every new page: `<title>` + meta description, canonical URL, OG/Twitter cards, sitemap coverage, structured data where relevant, and heading hierarchy. Cover the pages created during the V2 build (Blog + posts, Streaks & Accolades, Player Stats → Achievements, and any further content pages).

## 8. Pre-staging build items (added 2026-10-01)

These should land before the closed-group staging test.

- [ ] **Beginner-only open games.** Admin "create open game" gets a *Beginner game* switch; turning it on reveals an **XP cap** input. Beginner games are clearly labelled in the open-games list with the cap visible to players browsing. Add a **beginner filter** to the open-games list. A player above the cap who tries to sign up is shown a "your XP is too high for this match" notice and blocked. TBD: cap by raw lifetime XP number vs by level (wording reads as raw XP - confirm).
- [ ] **Token T&Cs shown everywhere needed.** Surface the token terms (incl. expiry: lots carry `expires_at`, oldest-expiry-first drawdown, expired = unusable/non-refundable) consistently in four places: (1) prominently on the store/product page before checkout; (2) in the Terms & Conditions; (3) in the purchase confirmation; (4) alongside the wallet balance/expiry. Partly present already (store validity copy, /terms clauses, TokenWallet expiry line) - this is a placement/consistency pass, especially the pre-checkout and confirmation spots.
- [ ] **Gallery rework (match-tied photos).** Every upload tied to a specific match; start the photo library from scratch in a new, clearly-labelled Cloudinary folder. Goal: enable stat-overlay story images for ALL past games. Player gallery gets a "games I took part in" filter slider; the match-name filter becomes a dropdown (the current flat setup clutters at scale). Lives in components/gallery (GalleryGrid.tsx) + the upload flow. **Timing: build the mechanism now; backfill/populate the new folder during staging once the carryover match set is locked.**
- [ ] **"Match photos uploaded" notification + email.** New notification type fired when photos are added to a match, with a branded HTML email (same system as the existing 9 templates).
- [ ] **Mixed online/offline match report.** When a game mixes online and offline rounds, keep the ONLINE report format (do NOT fall back to the offline-only layout). Show the streaks + "you killed" / "killed by" tables from the online rounds, and label which rounds were online vs offline (e.g. "Rounds 1-2 online, 3-5 offline"). Fix per-round averaging so online-only stats divide by the ONLINE round count, not total: e.g. 2 online + 3 offline, 10 caps (online-only) -> caps/round = 5, not 2. Same for cap-time/round and any other online-only per-round stat. TBD: the exact online-only vs dual (also-offline) stat list for the denominators.

## 9. Closed-group staging test (Vercel) - extra steps

A staging test is a parallel copy of prod infra config pointed at a staging URL, plus the data decision in section 3. Extra steps beyond a straight prod deploy:

- [ ] **Stable staging domain** (e.g. `staging.laseropsmalta.com` aliased to the v2-rebuild branch) - NOT the per-commit preview URL, which changes every push and breaks the OAuth/Supabase allowlists.
- [ ] **Second OAuth + Supabase allowlist entry** for the staging origin (Google JS origins + Supabase redirect URLs). Consent screen already published; email/profile/openid only, so no tester cap.
- [ ] **Env vars scoped to staging** in Vercel (Supabase / Cloudinary / Resend / Viva / NEXT_PUBLIC_SITE_URL / REVALIDATE_SECRET). Cloudinary renders fine on any Vercel deploy.
- [ ] **Gate the group:** app-level email allowlist in middleware.ts (preferred - does not block webhooks) OR Vercel Deployment Protection (needs a bypass token for the Viva webhook, /api/revalidate, crons).
- [ ] **noindex on staging** - robots.ts currently allows "/" based on NEXT_PUBLIC_SITE_URL; guard it to disallow-all when the host is staging (custom aliases are not auto-noindexed the way random preview URLs are).
- [ ] **Crons** run only on Production deployments, not previews. On a preview-based staging the 5 crons (notifications-dispatch, match-reminders, go-live, waitlist-notify, ladder-idle-drop) will NOT auto-fire - trigger manually, or run staging as its own prod project (then they WILL send real mail to testers).
- [ ] **Viva stays in DEMO** on staging: demo keys + a demo Source whose success/failure URLs + webhook point at the staging domain. Needs the partner present to create/reverify (parked constraint).
- [ ] **Resend sends real email** to testers during staging (notifications, .ics invites, refunds). Verify the sending domain and warn the group.
