# SEO fields — every public page

A reference of the SEO metadata for each public, indexable page (titles, meta
descriptions, canonicals, Open Graph, structured data, H1s). Compiled from the
code on `v2-rebuild`. Update this when you change page metadata.

Legend: **Title** is the final `<title>` as rendered (the site template adds
` | LaserOps Malta` to plain titles; titles marked *absolute* are shown exactly
as written). Values are verbatim from the page's `export const metadata`.

---

## Site-wide defaults (app/layout.tsx)

These apply to every page unless the page overrides them.

- **Title template:** `%s | LaserOps Malta`
- **Default title** (used when a page sets none, e.g. the home page): `LaserOps Malta | Tactical Outdoor Laser Tag`
- **Default description:** `Outdoor tactical laser tag in Malta. Competitive missions, team battles, and live player stats.`
- **Canonical base (metadataBase):** `https://www.laseropsmalta.com` (from `NEXT_PUBLIC_SITE_URL`, falls back to the www URL). All `canonical` values below are relative to this.
- **Default Open Graph:** `type: website`, `locale: en_MT`, `siteName: LaserOps Malta`. (No default og:title/description — each page falls back to its own `<title>` + description; pages that set their own og:title/description are noted.)
- **Twitter card:** `summary_large_image`
- **Robots (default):** `index: true, follow: true` (+ googleBot `max-image-preview: large`, `max-snippet: -1`).
- **Keywords:** laser tag malta, outdoor laser tag malta, tactical laser tag, competitive laser tag, team building malta, things to do in malta, group activities malta.

### Structured data (JSON-LD) — site-wide only
One `application/ld+json` block in the root layout (no per-page schema yet):

- `@type`: **["SportsActivityLocation", "LocalBusiness"]**
- `name`: LaserOps Malta
- `description`: (site default description)
- `url`: https://www.laseropsmalta.com
- `email`: info@laseropsmalta.com
- `telephone`: +356 9999 1053
- `address`: PostalAddress — addressLocality **Malta**, addressCountry **MT** (no street address set)
- `sameAs`: Instagram + Facebook (`https://www.instagram.com/laserops.mt/`, `https://www.facebook.com/laserops.mt`)

### Open Graph images
Each of these routes has its **own** OG card image (`app/<route>/opengraph-image.*`):
`/` (now the action photo), `/play`, `/who-we-are`, `/outdoor-laser-tag-malta`,
`/community`, `/events/corporate`, `/events/open-games`, `/booking`, `/gallery`,
`/weapons`, `/faqs`, `/contact`, `/birthday-parties`, `/stag-and-hen`.
Every other page (`/blog`, `/blog/*`, `/accolades`, `/terms`, `/privacy`,
`/cookies`, `/refund-policy`, `/match-report`) **inherits the home OG image**.

### Sitemap & robots
- **robots.ts:** allows `/`, disallows `/player-portal/player-stats/` and `/api/`. On staging (`STAGING_GATE=1` or a staging/preview host) it disallows everything. Points to `/sitemap.xml`.
- **sitemap.ts** lists: `/`, `/outdoor-laser-tag-malta`, `/booking`, `/weapons`, `/community`, `/events/corporate`, `/stag-and-hen`, `/birthday-parties`, `/events/open-games`, `/gallery`, `/who-we-are`, `/faqs`, `/contact`, `/match-report`, `/privacy`, `/cookies`, `/accolades`, `/blog`, `/terms`, plus every published blog post (`/blog/<slug>`).

---

## Core pages

### / (home)
- **Title:** LaserOps Malta | Tactical Outdoor Laser Tag  *(inherits default)*
- **Description:** Outdoor tactical laser tag in Malta. Competitive missions, team battles, and live player stats.  *(inherits default)*
- **Canonical:** `/`
- **OG image:** own — the new action photo
- **OG override:** none
- **H1:** set in the Homepage CMS (`home_config` headline, /admin/homepage) — currently the hero headline
- **Index:** yes

### /play
- **Title (absolute):** Play Outdoor Laser Tag in Malta | LaserOps Malta
- **Description:** Malta's ultimate outdoor laser tag experience. Join an open game from €35 or book a private session for birthdays, stags, and team building. 13+ for open games, no experience needed.
- **Canonical:** `/play`
- **OG image:** own card
- **OG override:** og:title "Play Outdoor Laser Tag in Malta" · og:description "Join an open game from €35 or book a private session for birthdays, stags, and team building. 13+ for open games, no experience needed."
- **H1:** Malta's Ultimate Outdoor Laser Tag Experience… (hero)
- **Index:** **NO — `robots: index:false, follow:true`** (see observations)

### /outdoor-laser-tag-malta
- **Title (absolute):** Outdoor Laser Tag Malta | What to Expect | LaserOps Malta
- **Description:** Outdoor laser tag in Malta, played in immersive outdoor arenas with latest gen kit. Mission based game modes, real teamwork, and the full breakdown of how it works.
- **Canonical:** `/outdoor-laser-tag-malta`
- **OG image:** own card
- **OG override:** og:title "Outdoor Laser Tag Malta | What to Expect" · og:description "The full breakdown of outdoor laser tag at LaserOps Malta. The kit, the game modes, the respawn mechanic, live match stats, and what makes it different."
- **H1:** What Is Outdoor Laser Tag?
- **Index:** yes

### /who-we-are
- **Title (absolute):** About LaserOps | Outdoor Laser Tag Malta
- **Description:** LaserOps was started by Kyle in 2024. Two friends with over two decades of laser tag between them, building a competitive community in Malta.
- **Canonical:** `/who-we-are`
- **OG image:** own card
- **OG override:** none
- **H1:** Who We Are
- **Index:** yes

### /community
- **Title:** Laser Tag Community Malta | Open Games | LaserOps Malta
- **Description:** Join Malta's outdoor laser tag community. Weekly open games, persistent player stats, leaderboards, and a WhatsApp group of regulars. New players welcome.
- **Canonical:** `/community`
- **OG image:** own card
- **OG override:** og:title "Malta's Outdoor Laser Tag Community" · og:description "A real community of regulars, weekly open games, a stats portal that tracks every match, and a WhatsApp group that's always planning the next session."
- **H1:** A Laser Tag Community Built Around Playing, Improving, and Having a Good Time
- **Index:** yes

### /weapons
- **Title:** Laser Tag Weapons & Loadouts | LaserOps Malta
- **Description:** Explore LaserOps's diverse weapons arsenal. Compare stats across 15+ guns, browse by gun tree, and see unlock paths.
- **Canonical:** `/weapons`
- **OG image:** own card
- **OG override:** none
- **H1:** Weapons.
- **Index:** yes

### /gallery
- **Title:** Outdoor Laser Tag Gallery | LaserOps Malta
- **Description:** Photos from LaserOps Malta matches, events, and behind-the-scenes action.
- **Canonical:** `/gallery`
- **OG image:** own card
- **OG override:** none
- **H1:** LaserOps in Action.
- **Index:** yes

### /accolades
- **Title:** Streaks & Accolades | LaserOps Malta
- **Description:** Every accolade and streak you can earn at LaserOps Malta: what each one is for, its tier, and the XP and ranking points it awards.
- **Canonical:** `/accolades`
- **OG image:** inherits home
- **OG override:** none
- **H1:** Streaks & Accolades
- **Index:** yes

---

## Events & booking

### /events/open-games
- **Title:** Upcoming Outdoor Laser Tag Matches | LaserOps Malta
- **Description:** Sign up for upcoming open laser tag matches at LaserOps Malta. Live match schedule with dates, times, match types, and direct signup links. All skill levels welcome.
- **Canonical:** `/events/open-games`
- **OG image:** own card
- **OG override:** og:title "Upcoming Open Games | LaserOps Malta" · og:description "Check the latest open game schedule at LaserOps Malta. Join a match, earn stats, and climb the leaderboard. Open to all players."
- **H1:** Join an Upcoming Open Match
- **Index:** yes

### /events/corporate
- **Title:** Corporate Events & Team Building | LaserOps Malta
- **Description:** Laser tag corporate team building in Malta. Strategy, teamwork, and the rare chance to shoot your boss. Match photos, drinks, and post-game stats sorted.
- **Canonical:** `/events/corporate`
- **OG image:** own card
- **OG override:** og:title "Corporate Events & Team Building Malta | LaserOps" · og:description "Laser tag corporate events in Malta. Strategy, teamwork, and the rare chance to shoot your boss. Match photos, drinks, and post game stats included."
- **H1:** Corporate Events That People Actually Talk About on Monday
- **Index:** yes

### /birthday-parties
- **Title:** Laser Tag Birthday Parties Malta | LaserOps Malta
- **Description:** Laser tag birthday parties in Malta for kids, teens, and adults. Real game, balanced teams, match stats, and catering sorted. The party they'll talk about for months.
- **Canonical:** `/birthday-parties`
- **OG image:** own card · **OG override:** none
- **H1:** Birthday Parties That Beat the Usual Options
- **Index:** yes

### /stag-and-hen
- **Title:** Stag & Hen Do Activities Malta | Laser Tag | LaserOps Malta
- **Description:** Stag dos and hen parties in Malta that don't end in a kebab and regret. Laser tag, match stats, drinks, catering, and a venue that handles the lot.
- **Canonical:** `/stag-and-hen`
- **OG image:** own card · **OG override:** none
- **H1:** Stag and Hen Dos in Malta That Don't End in a Kebab and Regret
- **Index:** yes

### /booking
- **Title:** Book a Laser Tag Session | LaserOps Malta
- **Description:** Join an upcoming open game or book a private LaserOps Malta session. Outdoor laser tag with persistent stats, progression, and real terrain. Corporate events, birthday parties, and stag & hen groups welcome.  *(≈205 chars — will truncate in search; see observations)*
- **Canonical:** `/booking`
- **OG image:** own card · **OG override:** none
- **H1:** Jump into a game, or book one for your group.
- **Index:** yes

---

## Info & utility

### /faqs
- **Title:** FAQs | LaserOps Malta
- **Description:** Answers to the most common questions about laser tag at LaserOps Malta. Costs, group sizes, what to wear, stats, photography, catering, and how to book.
- **Canonical:** `/faqs`
- **OG image:** own card · **OG override:** none
- **H1:** Frequently Asked Questions
- **JSON-LD:** none yet — a **FAQPage** schema here is a strong rich-snippet candidate (see observations)
- **Index:** yes

### /contact
- **Title:** Contact | Laser Tag Enquiries | LaserOps Malta
- **Description:** Get in touch with LaserOps Malta. Call, WhatsApp, or email us to book a session, ask a question, or find out more about our laser tag events.
- **Canonical:** `/contact`
- **OG image:** own card · **OG override:** none
- **H1:** Get in Touch
- **Index:** yes

### /blog
- **Title:** Blog | LaserOps Malta
- **Description:** News and feature releases from LaserOps Malta. What is new, what is changing, and what is coming next.
- **Canonical:** `/blog`
- **OG image:** inherits home · **OG override:** none
- **H1:** News & updates
- **Index:** yes

### /blog/<slug> (each post, dynamic)
- **Title:** `<post title>` | LaserOps Malta
- **Description:** the post's excerpt
- **Canonical:** `/blog/<slug>`
- **OG image:** inherits home (posts don't set their own yet)
- **Index:** yes · **Note:** a missing post returns title "Post not found"

### /match-report
- **Title:** Match Report | LaserOps Malta
- **Description:** Pull up the full report for any LaserOps Malta match. Team scores, player stats, accolades earned.
- **Canonical:** `/match-report`
- **OG image:** inherits home · **OG override:** none
- **H1:** Match Report
- **Index:** yes (the report content loads client-side from `?match=`)

---

## Legal

| Page | Title | Canonical | Description |
|---|---|---|---|
| /terms | Terms & Conditions \| LaserOps Malta | `/terms` | The terms that govern your LaserOps Malta account, bookings, payments, refunds, gameplay, and how rewards are issued and may be revoked. |
| /privacy | Privacy Policy \| LaserOps Malta | `/privacy` | How LaserOps Malta collects, uses, and protects your personal data. Your GDPR rights explained. |
| /cookies | Cookie Policy \| LaserOps Malta | `/cookies` | What cookies LaserOps Malta uses, why, and how to manage your preferences at any time. |
| /refund-policy | Refund & Cancellation Policy \| LaserOps Malta | `/refund-policy` | How LaserOps Malta handles cancellations and refunds: the refund window, how refunds are paid, cancelled or shortened games, and game tokens. |

All four: OG image inherits home, no OG override, H1 matches the title, indexed.

---

## Not indexed (app surfaces)
`/player-portal/**` (player stats paths are disallowed in robots), `/admin/**`,
`/checkout/**`, `/closed-beta`, `/invite/<code>`, and the auth pages
(login/signup/claim/reset) are internal/app pages — not part of the SEO surface.
They use generic titles and are excluded from the sitemap; `player-stats` and
`/api` are explicitly disallowed in robots.ts.

---

## Observations / optional tweaks
*(none of these are blockers — flagging for your review)*

1. **/play is `noindex`.** It largely duplicates the home funnel, so this may be deliberate (avoid two pages competing for the same intent). Confirm you want it kept out of Google — if not, flip `robots: { index: true }`.
2. **/booking description is ~205 chars** and will get truncated (~160 shown). Worth trimming to one tight sentence.
3. **Home title/description inherit the site default.** That's fine, but you could set a home-specific `title`/`description` if you want different SERP copy from the global default.
4. **OG title/description fallback:** only `/play`, `/outdoor-laser-tag-malta`, `/community`, `/events/corporate`, `/events/open-games` set a distinct og:title/og:description. The rest reuse the page `<title>` + meta description (acceptable).
5. **Per-page OG images are still the text cards.** You just swapped the home one to a photo; the other 13 are still generated text cards. Say the word and I can swap any/all of them to photos the same way.
6. **Structured data is site-wide only.** Good candidates to add post-launch: a **FAQPage** on /faqs, **BlogPosting** on blog posts, **BreadcrumbList** site-wide, and enriching the LocalBusiness block with `geo`, `openingHours`, `priceRange`, and an `image`.
7. **Canonicals** are set on every page (good). Make sure `NEXT_PUBLIC_SITE_URL` in prod is exactly the www (or non-www) host you want to be canonical, and that DNS 301-redirects the other one to it.
