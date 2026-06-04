import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { OpenGamesTable } from "@/components/events/OpenGamesTable";
import { fetchOpenGames } from "@/lib/cms/open-games";
import { brand } from "@/lib/brand";

/* ─── SEO ──────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Upcoming Outdoor Laser Tag Matches Malta | Join an Open Match | LaserOps",
  description:
    "Sign up for upcoming open laser tag matches at LaserOps Malta. Live match schedule with dates, times, match types, and direct signup links. All skill levels welcome.",
  openGraph: {
    title: "Upcoming Open Games — LaserOps Malta",
    description:
      "Check the latest open game schedule at LaserOps Malta. Join a match, earn stats, and climb the leaderboard. Open to all players.",
  },
};

/* ─── Helper ────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */

export default async function OpenGamesPage() {
  const games = await fetchOpenGames();

  /* ── JSON-LD Event schema (Google rich results) ─────────────────────
     One schema.org/Event per upcoming game so Google can show a rich
     result with date, location, and event status in search.
     Only emit non-cancelled events — no point indexing cancelled games. */
  const upcomingForSchema = games.filter(
    (g) => g.status.toLowerCase() !== "cancelled",
  );

  const eventSchema =
    upcomingForSchema.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: upcomingForSchema.map((g, i) => {
            // startDate: assemble ISO 8601 from date + time, assume Malta time (UTC+2 in summer)
            const startDate =
              g.time
                ? `${g.date}T${g.time}:00+02:00`
                : `${g.date}T00:00:00+02:00`;

            const eventStatus =
              g.status.toLowerCase() === "completed"
                ? "https://schema.org/EventPostponed"
                : "https://schema.org/EventScheduled";

            return {
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "Event",
                name: `LaserOps Open Game${g.type ? ` — ${g.type}` : ""}`,
                startDate,
                eventStatus,
                eventAttendanceMode:
                  "https://schema.org/OfflineEventAttendanceMode",
                location: {
                  "@type": "Place",
                  name: "LaserOps Malta",
                  address: {
                    "@type": "PostalAddress",
                    addressCountry: "MT",
                    addressLocality: "Malta",
                  },
                },
                organizer: {
                  "@type": "Organization",
                  name: "LaserOps Malta",
                  url: brand.siteUrl,
                },
                ...(g.signupLink ? { url: g.signupLink } : {}),
              },
            };
          }),
        }
      : null;

  return (
    <>
      {/* ── JSON-LD ──────────────────────────────────────────────────── */}
      {eventSchema && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
        />
      )}

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Open Games</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Join an Upcoming Open Match
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            Open games are public matches anyone can join — no team required, no
            prior experience needed. Just sign up, show up, and get placed on a
            balanced team on the day. Every match is tracked in our live stats
            system, so your kills, ratings, and ELO all count toward your
            permanent player profile and the season leaderboard.
          </p>
          <p className="mt-4 text-base leading-relaxed text-text-muted sm:text-lg">
            Check the schedule below, grab a spot via the sign-up link, and keep
            an eye out for <span className="font-semibold text-red-400">Double XP</span>{" "}
            events — matches where all XP earned counts double toward your rank.
            These fill up fast.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/player-portal/leaderboards" variant="secondary" size="lg">
              View Leaderboards →
            </Button>
            <Button href="/player-portal/player-stats" variant="secondary" size="lg">
              Check Your Stats →
            </Button>
          </div>
        </Container>
      </section>

      {/* ── Schedule table ───────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Match Schedule</SectionLabel>
          <h2 className="mb-6 mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Upcoming &amp; Recent Open Games
          </h2>
          <OpenGamesTable games={games} />
        </Container>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>How It Works</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            What to Expect at an Open Game
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Open games run on the same format as private bookings. Players are
              split into balanced teams based on available numbers, briefed on
              the rules, and then let loose for a series of rounds in our
              outdoor laser tag arena. Equipment is provided — just show up
              ready to play.
            </p>
            <p className="leading-relaxed">
              Every match is logged in the LaserOps system. After the game you
              can find your match report on this site with a full breakdown:
              score, kills, damage, accuracy, K/D ratio, ELO change, and more.
              Consistent performance across open games builds your ranking on
              the seasonal leaderboard, which resets at the start of each new
              season.
            </p>
            <p className="leading-relaxed">
              Players of all experience levels are welcome. Veterans and first-timers
              get mixed into balanced teams so the match stays competitive
              regardless of experience. If you want to get a head start on stats
              before your first game, you can browse the{" "}
              <a
                href="/player-portal/leaderboards"
                className="font-semibold text-accent underline underline-offset-4 hover:opacity-80"
              >
                leaderboards
              </a>{" "}
              to see how regulars stack up.
            </p>
          </div>
        </Container>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Private Bookings</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Want the Whole Arena to Yourself?
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Open games are great for individuals and small groups, but if you
              want a private session — for a birthday, a corporate day, a stag
              or hen do, or just a friends group — you can book the full arena.
              Private bookings get their own dedicated game time, custom team
              setups, and all the same stat tracking as open games.
            </p>
          </div>
          <div className="mt-8">
            <Button href="/booking" variant="primary" size="lg">
              Book a Private Session →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
