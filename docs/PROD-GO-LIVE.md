# v2-rebuild → Production Go-Live Checklist

A running list of everything that must be done to take `v2-rebuild` live on the
main site. Living document — add items as they come up, tick them as they land.
Legend: `[ ]` todo · `[~]` in progress / partial · `[x]` done · `[!]` blocked / waiting.

Last updated: 2026-09-21

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

- [ ] **Launch match-backlog ingestion** — ingest the backlog of past matches at launch.
- [ ] **Player accounts / historical data** — decide/handle any migration from V1 (open question — confirm scope).

## 4. Payments

- [x] **Viva integration** — VALIDATED end-to-end in the Viva DEMO sandbox on 2026-09-28: live test payment + refund both confirmed (webhook marks paid with correct amount; admin refund clears + records). Two bugs found & fixed via the self-test: (1) Basic-auth endpoints (webhook key + refund) must hit `demo.vivapayments.com`/`www.vivapayments.com`, not the `-api` host; (2) Viva refund needs `?amount=` even for a full refund (adapter now resolves it). Diagnostic: `GET /api/admin/viva-check`. Runbook: `docs/VIVA-SANDBOX-SETUP.md`. **For prod:** swap to the production Viva account (`VIVA_ENV=production` + prod credentials + prod webhook at the real domain + Source success/failure = `https://laseropsmalta.com/checkout/complete`). Token-bundle webhook path still untested (no active bundles seeded).
- [ ] **Stripe refund flow** — built; needs one fresh Stripe test payment to verify end-to-end.
- [ ] **Stripe prod keys + webhook** configured in the prod project.

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
