import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Laser Tag Community Malta — Open Games & Player Portal",
  description:
    "Join Malta's outdoor laser tag community. Weekly open games, persistent player stats, leaderboards, and a WhatsApp group of regulars. New players welcome.",
  openGraph: {
    title: "Malta's Outdoor Laser Tag Community",
    description:
      "A real community of regulars, weekly open games, a stats portal that tracks every match, and a WhatsApp group that's always planning the next session.",
  },
};

/**
 * WhatsApp community invite link.
 * Replace the placeholder with the real invite URL when available.
 * Format: https://chat.whatsapp.com/<invite_code>
 */
const WHATSAPP_URL = "https://chat.whatsapp.com/PLACEHOLDER";

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------
const faqs: { q: string; a: string }[] = [
  {
    q: "How much does it cost to join an open game?",
    a: "Open games are pay as you play, priced at €30 per 3-hour session.",
  },
  {
    q: "Do I need to bring a team or friends with me?",
    a: "Not at all. Most people turn up solo or in pairs. Teams get assembled on the night using our ELO ratings, so you'll be playing with and against a mix of people every time.",
  },
  {
    q: "I've never played proper laser tag before. Will I be out of my depth?",
    a: "No. New players join nearly every week, and the regulars are good about showing the ropes. The team balancing system means you won't get stuck carrying a side or facing off against the room's best player on your first match. Come in, watch a round if you want, then jump in.",
  },
  {
    q: "What's the youngest age you allow?",
    a: "Ten and up. Younger kids are welcome at private bookings and parties, but open games tend to run at a competitive pace that suits 10+.",
  },
  {
    q: "How often do open games happen?",
    a: "Weekly, with extra sessions added when demand picks up. The schedule shifts to fit the community, so check the WhatsApp group for the next one.",
  },
  {
    q: "What should I wear?",
    a: "Anything you can move in. Closed shoes, layers you don't mind getting sweaty, and nothing too bright if you want to stay hidden in the arena. We provide all the kit you need on the equipment side.",
  },
  {
    q: "How does the ELO system actually affect me?",
    a: "You don't need to think about it. Show up, play, and the system handles the maths in the background to keep teams even. Over time you'll see your rating climb as you win matches, and the persistent stats give you a fuller picture of how you're playing.",
  },
  {
    q: "Can I just come and watch first?",
    a: "Yes. Plenty of people do exactly that for their first visit. Drop a message in the WhatsApp group and someone will let you know when to come down.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CommunityPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20 lg:py-24">
          <span className="eyebrow">Community</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            A Laser Tag Community Built Around Playing, Improving, and Having a
            Laugh
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-muted sm:text-lg">
            Laser Ops is more than a venue you book once for a birthday. We&apos;ve
            built a proper laser tag community in Malta, with over 100 players who
            turn up week after week because they genuinely enjoy the game and the
            people they play it with.
          </p>

          {/* Quick stats strip */}
          <div className="mt-10 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            <CommunityStat value="100+" label="Active players" />
            <CommunityStat value="Weekly" label="Open games" />
            <CommunityStat value="ELO" label="Skill-balanced teams" />
            <CommunityStat value="Every" label="Match tracked" />
          </div>
        </Container>
      </section>

      {/* ── Open Games ───────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Open Games</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Weekly Open Games for Players Who Want More Than a One-Off
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Our open games run every week, and they&apos;re the heartbeat of what
              we do. Anyone in the community can show up, get slotted into balanced
              teams, and play competitive matches against familiar faces and new
              ones. No need to bring a full group of friends or organise anything
              yourself. You rock up, you get matched, you play.
            </p>
            <p className="leading-relaxed">
              Open games are where casual players turn into regulars, where
              regulars sharpen up, and where new people figure out pretty quickly
              that laser tag is a real sport once you take it seriously. Days and
              times shift around to suit the community, so the easiest way to stay
              in the loop is our WhatsApp group, where every session gets posted in
              advance.
            </p>
          </div>
          <div className="mt-8">
            <WhatsAppButton>
              Join the LaserOps Malta WhatsApp Community
            </WhatsAppButton>
          </div>
        </Container>
      </section>

      {/* ── Beginners Welcome ────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>All Levels</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ages 10 and Up, Beginners Genuinely Welcome
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              The community runs from kids aged 10 right through to adults, and we
              mean it when we say beginners are welcome. Plenty of people who now
              play every week walked in for their first open game knowing nothing
              about positioning, comms, or objective play. The regulars are quick
              to share tips, the format gets explained on the spot, and the
              matchmaking system makes sure nobody gets thrown to the wolves on day
              one.
            </p>
            <p className="leading-relaxed">
              If you&apos;ve only ever played laser tag at a birthday party, an open
              game will show you what the sport actually looks like when people care
              about it.
            </p>
          </div>
        </Container>
      </section>

      {/* ── ELO System ───────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Fair Matchmaking</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Balanced Teams Through Our ELO Rating System
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              One of the biggest problems with pickup laser tag games is lopsided
              teams. Nobody enjoys a 20 to 2 stomping, on either side of it. We use
              an ELO rating system — the same kind of skill rating used in chess and
              competitive video games — to keep matches close.
            </p>
            <p className="leading-relaxed">
              Every player has a rating that goes up when they win and down when
              they lose, with bigger swings when an upset happens. Before each open
              game, the system uses those ratings to split the room into teams that
              should, on paper, play an even match. The result is games that come
              down to the wire far more often than they don&apos;t, which is exactly
              what makes people want to come back next week.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Persistent Stats ─────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>Player Portal</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Persistent Stats That Reward Showing Up
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              Every shot you take, tag you score, objective you complete, and match
              you play gets tracked. Your stats follow you from session to session,
              building a real record of how you&apos;re developing as a player.
            </p>
            <p className="leading-relaxed">
              It sounds small, but it changes the experience. You can see your
              accuracy creeping up over a month. You can watch your win rate climb
              as you start reading the game better. You get personal bests to chase,
              milestones to hit, and a clear answer to the question &ldquo;am I
              actually getting better at this.&rdquo; For a community built around
              progression and friendly competition, persistent stats turn every
              match into something that counts.
            </p>
          </div>
          <div className="mt-8">
            <Button href="/player-portal" variant="secondary" size="md">
              Explore the Player Portal →
            </Button>
          </div>
        </Container>
      </section>

      {/* ── The People ───────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>The People</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            A Community That Pushes Each Other to Improve
          </h2>
          <div className="mt-5 space-y-4 text-text-muted">
            <p className="leading-relaxed">
              What ties all of this together is the people. The regulars at Laser
              Ops want to win, but they also want the players around them to get
              better, because better opponents mean better games. After matches
              you&apos;ll hear postmortems on what worked, advice traded between
              teams, and the kind of light ribbing that comes with any group that
              takes its sport half seriously and itself not seriously at all.
            </p>
            <p className="leading-relaxed">
              Whether you&apos;re chasing the top of the leaderboard or just looking
              for a weekly thing to do that isn&apos;t another night at the same bar,
              there&apos;s a spot for you.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Get Involved CTA ─────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="narrow" className="py-16 sm:py-20">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Get Involved
              </h2>
              <p className="mt-2 max-w-md text-text-muted">
                The fastest way in is the WhatsApp community. That&apos;s where open
                games are announced, teams get organised, banter gets thrown around,
                and new players get welcomed.
              </p>
            </div>
            <div className="shrink-0">
              <WhatsAppButton size="lg">Join the WhatsApp Community</WhatsAppButton>
            </div>
          </div>
        </Container>
      </section>

      {/*
       * ── Testimonials ─────────────────────────────────────────
       * Placeholder — content to be added once decided.
       * Uncomment and populate this section when ready.
       *
       * <section className="border-b border-border bg-bg-elevated">
       *   <Container size="narrow" className="py-14 sm:py-16">
       *     <SectionLabel>What Players Say</SectionLabel>
       *     <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
       *       From the Community
       *     </h2>
       *     <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
       *       {/* Testimonial cards go here *}
       *     </div>
       *   </Container>
       * </section>
       */}

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 divide-y divide-border">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

function CommunityStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 bg-bg px-5 py-5">
      <span className="font-mono text-2xl font-extrabold tabular-nums text-accent sm:text-3xl">
        {value}
      </span>
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>
    </div>
  );
}

type WhatsAppButtonProps = {
  children: React.ReactNode;
  size?: "md" | "lg";
};

function WhatsAppButton({ children, size = "md" }: WhatsAppButtonProps) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        size === "lg"
          ? "inline-flex items-center gap-2.5 rounded-none bg-[#25D366] px-8 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          : "inline-flex items-center gap-2.5 rounded-none bg-[#25D366] px-6 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
      }
    >
      {/* WhatsApp logo mark */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0 fill-current"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      {children}
    </a>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold uppercase tracking-[0.06em] text-text sm:text-base">
        {q}
        {/* Chevron — rotates open */}
        <svg
          aria-hidden
          viewBox="0 0 10 6"
          className="h-3 w-3 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">
        {a}
      </p>
    </details>
  );
}
