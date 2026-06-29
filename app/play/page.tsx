import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BracketFrame } from "@/components/portal/BracketFrame";
import { fetchGoogleReviews } from "@/lib/cms/google-reviews";

/* ─── Destinations ─────────────────────────────────────────────────── */
const OPEN_GAMES_HREF = "/events/open-games";
const BOOKING_HREF = "/booking";
/* WhatsApp community invite — same link used on /community + /outdoor-laser-tag-malta */
const WHATSAPP_URL = "https://chat.whatsapp.com/Duox9CiCmasKsv8tcuQScZ";

/* ─── Campaign video (Cloudinary) ──────────────────────────────────────
   Single known asset, so we reference the delivery URL directly rather
   than fetching by tag. q_auto lets Cloudinary pick the best quality;
   the poster is the first frame (so_0) served as a still image. */
const CAMPAIGN_VIDEO =
  "https://res.cloudinary.com/dqud5b7pa/video/upload/q_auto/v1782764970/LaserOps_Ad_1_v2_ykknax.mp4";
const CAMPAIGN_POSTER =
  "https://res.cloudinary.com/dqud5b7pa/video/upload/so_0/v1782764970/LaserOps_Ad_1_v2_ykknax.jpg";

/* ─── SEO ──────────────────────────────────────────────────────────────
   Campaign landing page for paid traffic. `index: false` keeps it out of
   Google so it doesn't compete with the homepage for the same terms — flip
   to `true` if you ever want it discoverable organically. */
export const metadata: Metadata = {
  title: {
    absolute: "Play Outdoor Laser Tag in Malta | LaserOps Malta",
  },
  description:
    "Malta's ultimate outdoor laser tag experience. Join an open game from €30 or book a private session for birthdays, stags, and team building. Ages 10+, no experience needed.",
  alternates: { canonical: "/play" },
  robots: { index: false, follow: true },
  openGraph: {
    type: "website",
    locale: "en_MT",
    siteName: "LaserOps Malta",
    title: "Play Outdoor Laser Tag in Malta",
    description:
      "Join an open game from €30 or book a private session for birthdays, stags, and team building. Ages 10+, no experience needed.",
  },
};

/* ─── Helpers ──────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-accent">
      {children}
    </span>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 fill-current"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-sm leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-yellow-400" : "text-border-strong"}>
          ★
        </span>
      ))}
    </span>
  );
}

const PROOF_POINTS = [
  "€30/player",
  "3-hour sessions",
  "Ages 10+",
  "No experience needed",
  "Stats after every match",
  "Level up your online profile",
];

const PLAY_OPTIONS = [
  {
    label: "Open Games",
    points: [
      "No team needed",
      "Balanced teams",
      "Great for solo players and small groups",
    ],
    cta: { label: "See Upcoming Open Games →", href: OPEN_GAMES_HREF },
  },
  {
    label: "Private Games",
    points: [
      "Your own group",
      "Birthdays, stags, corporate, friends",
      "Hosted session, kit included, multiple game modes",
    ],
    cta: { label: "Request a Private Booking →", href: BOOKING_HREF },
  },
];

const DIFFERENTIATORS = [
  {
    title: "Immersive outdoor arenas",
    body: "Real terrain, natural cover, and proper sightlines. Outdoor arenas built for tactical play, not a dark room with neon walls.",
  },
  {
    title: "Online post-match stats",
    body: "Every shot, tag, and objective is recorded. Check your full match report online the moment you finish playing.",
  },
  {
    title: "XP, leaderboards, challenges and unlockable weapons",
    body: "Build a persistent profile, climb the leaderboards, take on seasonal challenges, and unlock new weapons as you level up.",
  },
];

const SCOUTING_LINKS = [
  { label: "Learn about outdoor laser tag", href: "/outdoor-laser-tag-malta" },
  { label: "View weapons", href: "/weapons" },
  { label: "View leaderboards", href: "/player-portal/leaderboards" },
  { label: "See match reports", href: "/match-report" },
];

/* ─── Page ─────────────────────────────────────────────────────────── */

export default async function PlayPage() {
  const reviews = (await fetchGoogleReviews()).slice(0, 3);

  return (
    <>
      {/* ── Hero (fits the first viewport) ───────────────────── */}
      <section className="relative isolate flex min-h-[calc(100svh-72px)] flex-col overflow-hidden bg-bg xl:bg-[#ffde00]">
        {/* Background — same textured hero art as the homepage */}
        <div className="absolute inset-0 xl:hidden" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero/hero-mobile-bg.png"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 hidden xl:block" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero/desktop-hero-01-bg.png"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        {/* Figure — right-anchored on desktop (room beside the text) */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden items-end xl:flex"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero/desktop-hero-01-figure-color.png"
            alt=""
            className="block h-full w-auto max-w-none"
          />
        </div>

        {/* Figure — bottom-anchored on mobile (sits behind the content). */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center xl:hidden"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero/hero-mobile-figure-color.png"
            alt=""
            className="block h-auto w-[125%] max-w-none"
          />
        </div>

        {/* Scrim for text legibility — dark behind the top text, lighter over
            the figure's midsection so he reads, then grounded at the bottom. */}
        <div
          className="pointer-events-none absolute inset-0 xl:hidden"
          aria-hidden
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.8) 22%, rgba(10,10,10,0.55) 44%, rgba(10,10,10,0.34) 62%, rgba(10,10,10,0.46) 82%, rgba(10,10,10,0.82) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden xl:block"
          aria-hidden
          style={{
            background:
              "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.78) 30%, rgba(10,10,10,0.25) 55%, rgba(10,10,10,0) 75%)",
          }}
        />

        {/* Content — top-aligned on mobile (above the figure), centred on desktop. */}
        <Container size="wide" className="relative z-10 flex flex-1 flex-col">
          <div className="w-full pt-6 pb-10 xl:my-auto xl:py-10">
            <span className="eyebrow">Outdoor Laser Tag · Malta</span>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] sm:text-5xl xl:text-6xl">
              Malta&rsquo;s Ultimate{" "}
              <span className="text-accent">Outdoor Laser Tag</span> Experience
            </h1>

            <div className="mt-8 grid max-w-2xl gap-x-6 gap-y-6 sm:grid-cols-2">
              {/* CTA 1 — Open game (primary) + WhatsApp underneath */}
              <div className="flex flex-col gap-4">
                <div>
                  <Button
                    href={OPEN_GAMES_HREF}
                    variant="primary"
                    size="lg"
                    className="w-full text-sm sm:text-base"
                  >
                    Join an Open Game →
                  </Button>
                  <p className="mt-2.5 text-base font-medium leading-snug text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
                    Open to everyone ages 10+. €30 for 3-hour session.
                  </p>
                </div>
                <Button
                  href={WHATSAPP_URL}
                  size="lg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full gap-2.5 bg-[#25D366] text-sm text-white shadow-[0_0_0_1px_#25D366] hover:bg-[#1fb457] hover:text-white sm:text-base"
                >
                  <WhatsAppIcon />
                  Join our WhatsApp Community →
                </Button>
              </div>

              {/* CTA 2 — Private game (high-contrast outline) */}
              <div>
                <Button
                  href={BOOKING_HREF}
                  variant="secondary"
                  size="lg"
                  className="w-full border-2 border-white bg-black/45 text-sm text-white backdrop-blur-sm hover:border-accent hover:bg-black/45 hover:text-accent sm:text-base"
                >
                  Book a Private Game →
                </Button>
                <p className="mt-2.5 text-base font-medium leading-snug text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
                  Team Building, Birthdays, Stag Dos, Group Bookings.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Campaign video ───────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 text-center sm:py-16">
          <SectionLabel>See It In Action</SectionLabel>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            30 Seconds of LaserOps
          </h2>
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-[360px]">
              <BracketFrame cornerSize="1.5rem" thickness="2px" inset="-6px">
                <video
                  className="block aspect-[9/16] w-full bg-black object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  poster={CAMPAIGN_POSTER}
                >
                  <source src={CAMPAIGN_VIDEO} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </BracketFrame>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Proof strip ──────────────────────────────────────── */}
      <section className="border-b border-border bg-accent">
        <Container size="wide" className="py-4">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs font-bold uppercase tracking-[0.1em] text-bg sm:text-sm">
            {PROOF_POINTS.map((point, i) => (
              <li key={point} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="text-bg/40">·</span>}
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── Choose how you play ──────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="default" className="py-14 sm:py-16">
          <div className="text-center">
            <SectionLabel>Two Ways In</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Choose How You Play
            </h2>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {PLAY_OPTIONS.map((option) => (
              <div
                key={option.label}
                className="flex flex-col border border-border bg-bg-elevated p-6 sm:p-8"
              >
                <h3 className="text-xl font-extrabold tracking-tight text-text">
                  {option.label}
                </h3>
                <ul className="mt-5 space-y-3 text-text-muted">
                  {option.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 leading-relaxed">
                      <span aria-hidden className="mt-0.5 shrink-0 text-accent">
                        ▸
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <Button href={option.cta.href} variant="primary" size="md">
                    {option.cta.label}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Why LaserOps is different ────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="default" className="py-14 sm:py-16">
          <div className="text-center">
            <SectionLabel>Why LaserOps</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Why LaserOps Is Different
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {DIFFERENTIATORS.map((item) => (
              <div key={item.title} className="border-l-2 border-accent/60 pl-5">
                <h3 className="text-lg font-extrabold leading-snug tracking-tight text-text">
                  {item.title}
                </h3>
                <p className="mt-2 leading-relaxed text-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Reviews ──────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <section className="border-b border-border">
          <Container size="default" className="py-14 sm:py-16">
            <div className="text-center">
              <SectionLabel>What Players Say</SectionLabel>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Rated 5.0 on Google
              </h2>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {reviews.map((review, i) => (
                <figure
                  key={`${review.reviewerName}-${i}`}
                  className="flex flex-col border border-border bg-bg-elevated p-6"
                >
                  <Stars rating={review.rating} />
                  <blockquote className="mt-4 flex-1 leading-relaxed text-text-muted">
                    &ldquo;{review.reviewText}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 text-sm font-bold uppercase tracking-[0.1em] text-text">
                    {review.reviewerName}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ── Still scouting? ──────────────────────────────────── */}
      <section className="border-b border-border bg-bg-elevated">
        <Container size="narrow" className="py-14 sm:py-16">
          <div className="text-center">
            <SectionLabel>Still Scouting?</SectionLabel>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Take a Closer Look
            </h2>
          </div>
          <ul className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            {SCOUTING_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="flex items-center justify-between gap-3 border border-border bg-bg px-5 py-4 text-sm font-bold uppercase tracking-[0.08em] text-text transition-colors hover:border-accent hover:text-accent"
                >
                  <span>{link.label}</span>
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="bg-accent">
        <Container size="narrow" className="py-16 text-center sm:py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-bg sm:text-4xl">
            Ready to play?
          </h2>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-bg/80">
            Jump into an open game with the community, or put together a private
            session for your group.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href={OPEN_GAMES_HREF} variant="dark" size="lg">
              Join an Open Game →
            </Button>
            <Button href={BOOKING_HREF} variant="outline-dark" size="lg">
              Book a Private Game →
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
