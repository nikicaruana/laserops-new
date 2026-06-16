import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/* ─── SEO ──────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s | LaserOps Malta" template so we
  // get a clean "… | LaserOps Malta" suffix instead of the doubled
  // "… | LaserOps | LaserOps Malta" the template would otherwise produce.
  title: {
    absolute: "Outdoor Laser Tag Malta | What to Expect | LaserOps Malta",
  },
  description:
    "Outdoor laser tag in Malta, played in immersive outdoor arenas with latest gen kit. Mission based game modes, real teamwork, and the full breakdown of how it works.",
  alternates: {
    canonical: "/outdoor-laser-tag-malta",
  },
  openGraph: {
    title: "Outdoor Laser Tag Malta | What to Expect",
    description:
      "The full breakdown of outdoor laser tag at LaserOps Malta. The kit, the game modes, the respawn mechanic, live match stats, and what makes it different.",
  },
};

/* ─── WhatsApp community invite (same link used on /community) ──────── */
const WHATSAPP_URL = "https://chat.whatsapp.com/Duox9CiCmasKsv8tcuQScZ";

/* ─── Helpers ──────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

function InlineLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="font-semibold text-accent underline underline-offset-4 hover:opacity-80"
    >
      {children}
    </a>
  );
}

const GAME_MODES = [
  "Domination",
  "Capture The Flag",
  "VIP Extraction",
  "Team Deathmatch",
  "Search & Destroy",
  "& More",
];

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function OutdoorLaserTagPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Outdoor Laser Tag</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            What Is Outdoor Laser Tag?
          </h1>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="text-base leading-relaxed sm:text-lg">
              Outdoor laser tag is a fast paced team experience where players
              compete in mission based game modes using our latest gen laser tag
              equipment in immersive outdoor environments. It takes the best
              aspects of indoor laser tag, paintball, and airsoft, and merges
              them into one.
            </p>
            <p className="text-base leading-relaxed sm:text-lg">
              This page is the full breakdown. What the kit does, how a match
              plays out, what the objectives look like, and what makes the
              outdoor version a properly different experience.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/booking" variant="primary" size="lg">
              Book a Session →
            </Button>
            <Button
              href={WHATSAPP_URL}
              variant="secondary"
              size="lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join an Open Game →
            </Button>
          </div>
        </Container>
      </section>

      {/* ── Explained ────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>The Basics</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Outdoor Laser Tag in Malta, Explained
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              At LaserOps, outdoor laser tag is played in the best curated
              outdoor arenas available in Malta. You get natural cover, real
              sight lines, proper distances to work with, and the kind of space
              that lets the game open up into actual tactical decisions. Where
              you move, when you move, who you cover, what you commit to.
            </p>
            <p className="leading-relaxed">
              The result is a game that sits closer to airsoft or paintball than
              to the indoor laser tag most people remember, except without the
              welts, the gear cost, or the cleanup. You get the strategic depth
              of those sports with none of the barriers to actually playing them.
            </p>
          </div>
        </Container>
      </section>

      {/* ── The Kit ──────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>The Equipment</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            The Kit You Play With
          </h2>
          <p className="mt-5 leading-relaxed text-text-muted">
            Every player gets three pieces of equipment when they arrive.
          </p>

          <div className="mt-6 space-y-5">
            <div className="border-l-2 border-accent/50 pl-5">
              <h3 className="text-lg font-extrabold tracking-tight text-text">
                The headband
              </h3>
              <p className="mt-2 leading-relaxed text-text-muted">
                This is the thing you actually shoot at. Sensors built into the
                headband register every hit, which means it doesn&apos;t matter
                whether you tag someone from across the arena or from two metres
                away, what matters is whether your shot lands on the band. All
                shots are tracked and recorded.
              </p>
            </div>

            <div className="border-l-2 border-accent/50 pl-5">
              <h3 className="text-lg font-extrabold tracking-tight text-text">
                The bandana
              </h3>
              <p className="mt-2 leading-relaxed text-text-muted">
                This shows your team colour. Outdoor arenas with real cover mean
                you genuinely need a way to tell teammates from enemies at
                distance, and the bandana solves that fast.
              </p>
            </div>

            <div className="border-l-2 border-accent/50 pl-5">
              <h3 className="text-lg font-extrabold tracking-tight text-text">
                The gun
              </h3>
              <p className="mt-2 leading-relaxed text-text-muted">
                Self explanatory, but worth saying that the kit at LaserOps is
                latest gen, which makes a real difference. Accurate at all
                distances and responsive. LaserOps boasts over 15 different
                weapons for you to choose from and unlock, with different fire
                rates, damage profiles, ammo counts, and reload mechanics.
              </p>
              <p className="mt-3">
                <InlineLink href="/weapons">
                  See our full range of weapons →
                </InlineLink>
              </p>
            </div>
          </div>

          <p className="mt-6 leading-relaxed text-text-muted">
            The whole kit is provided, you don&apos;t need to bring anything.
            Just wear something you can move in and you&apos;re set.
          </p>
        </Container>
      </section>

      {/* ── Respawn / Always in the action ───────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>How a Match Plays Out</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Always In The Action
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              A round starts with both teams at their respective bases (spawn
              points), gets briefed on the objective, and the clock starts. From
              there it depends on the game mode, but the core mechanic to
              understand is the respawn.
            </p>
            <p className="leading-relaxed">
              When you get tagged out, you don&apos;t sit on the sidelines for the
              rest of the match. You head back to your base, respawn, and get
              right back into the action. This is one of the biggest differences
              from how most people imagine the game working. There&apos;s no
              &ldquo;out for the round&rdquo; the way there is in paintball. The
              match keeps moving, you keep moving, and getting tagged is a
              setback rather than an exit.
            </p>
            <p className="leading-relaxed">
              This changes the entire dynamic of how matches play out. You can
              afford to be more aggressive because being tagged isn&apos;t fatal.
              You can attempt risky plays because the worst case is a quick
              reset. And because everyone is constantly cycling back into the
              game, the action never really stops. A 20 minute round is 20
              minutes of actual playing, not waiting on the bench.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Objectives + game modes ──────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Game Modes</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            It&apos;s Not Just Shooting, It&apos;s Objectives
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              This is the part that most surprises new players. Outdoor laser tag
              isn&apos;t a deathmatch where the team with the most tags wins.
              It&apos;s almost always built around objectives that demand
              teamwork, and shooting is the means rather than the end.
            </p>
            <p className="leading-relaxed">
              We have a number of different game modes available, including:
            </p>
          </div>

          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GAME_MODES.map((mode) => (
              <li
                key={mode}
                className="flex items-center gap-2 border border-border bg-bg-elevated px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-text"
              >
                <span className="shrink-0 text-accent">▸</span>
                <span className="min-w-0">{mode}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 leading-relaxed text-text-muted">
            This is what turns the game from a chaotic free for all into
            something closer to a proper sport. Strategy matters. Communication
            matters. Knowing when to push, when to hold, when to sacrifice
            yourself to slow the enemy down so a teammate can complete the
            objective. These are the decisions that decide matches, and
            they&apos;re the reason regular players keep coming back. There&apos;s
            always something new to figure out.
          </p>
        </Container>
      </section>

      {/* ── Scores recorded ──────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Player Portal</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            All Your Scores, Recorded
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              One of the things that sets LaserOps apart from everyone else is
              that we have our own online system for recording everyone&apos;s
              performance and scores, and tying them to your own online profile
              for you to build on from one match to the next. Check out a sample
              of what our match report and stats profiles look like:
            </p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <InlineLink href="/match-report?match=LO-2026-16">
                Check out a match report →
              </InlineLink>
              <InlineLink href="/player-portal/player-stats/summary?ops=Kini">
                See a real stats profile →
              </InlineLink>
            </p>
            <p className="leading-relaxed">
              Compete for prizes in our seasonal challenges and fight for the top
              spot in our all time leaderboards.
            </p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <InlineLink href="/player-portal/leaderboards/challenges">
                Check out our current seasonal challenges →
              </InlineLink>
              <InlineLink href="/player-portal/leaderboards/all-time">
                See our all time leaderboards →
              </InlineLink>
            </p>
          </div>
        </Container>
      </section>

      {/* ── Who plays ────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Who It&apos;s For</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Who Plays Outdoor Laser Tag at LaserOps
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Most players fall into one of a few groups. There&apos;s the
              regular <InlineLink href="/community">community</InlineLink>, a
              growing crowd of 100+ players who turn up weekly for open games.
              There are{" "}
              <InlineLink href="/events/corporate">corporate groups</InlineLink>{" "}
              using it for team building events. There are{" "}
              <InlineLink href="/stag-and-hen">stag and hen groups</InlineLink>{" "}
              who wanted something better than a pub crawl. And there are{" "}
              <InlineLink href="/birthday-parties">birthday parties</InlineLink>{" "}
              for kids, teens, and adults who want a party that people will
              actually talk about afterwards.
            </p>
            <p className="leading-relaxed">
              The sport works for all of them because the game adjusts to
              whoever&apos;s playing it. Casual groups get a fun afternoon.
              Competitive groups get a sport they can sink real time into. Same
              kit, same arena, different intensity.
            </p>
          </div>
        </Container>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Ready to Try It?</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Come and Play
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              The fastest way to actually understand outdoor laser tag is to come
              and play it. If you want to drop into a community open game and try
              it among regulars, the WhatsApp community is the easiest way in. If
              you&apos;re putting together a private booking for a group, get in
              touch and we&apos;ll sort it.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              href={WHATSAPP_URL}
              variant="primary"
              size="lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join the WhatsApp Community →
            </Button>
            <Button href="/booking" variant="secondary" size="lg">
              Get in Touch About a Private Booking →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
