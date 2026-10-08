import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { BookingForm } from "@/components/booking/BookingForm";
import { getUpcomingOpenGames, type OpenGameTeaser } from "@/lib/booking/open-games";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = {
  title: "Book a Laser Tag Session",
  alternates: { canonical: "/booking" },
  description:
    "Book an open game or a private LaserOps Malta session. Outdoor laser tag with persistent stats and real terrain, for corporate, birthday, and stag & hen groups.",
};

// Open games change often (spots fill, new games added) – keep the page fresh
// without making it fully dynamic.
export const revalidate = 120;

/** "Sat 12 Oct · 18:00" in Malta time. */
function fmtWhen(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Malta" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Malta" }).format(d);
  return `${day} · ${time}`;
}

function OpenGameCard({ g }: { g: OpenGameTeaser }) {
  const spotsLeft = g.maxPlayers != null ? Math.max(0, g.maxPlayers - g.registeredCount) : null;
  return (
    <Link
      href={`/player-portal/games/${g.id}`}
      className="group flex flex-col justify-between border border-border bg-bg-elevated p-5 transition-colors hover:border-accent"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {g.isBeginner && (
            <span className="border border-emerald-500/50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-emerald-400">
              Beginners{g.beginnerMaxLevel != null ? ` · ≤ Lv ${g.beginnerMaxLevel}` : ""}
            </span>
          )}
          {g.isDoubleXp && (
            <span className="border border-accent/50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent">
              Double XP
            </span>
          )}
        </div>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.08em] text-accent">{fmtWhen(g.scheduledAt)}</p>
        <h3 className="mt-1 text-lg font-extrabold leading-tight text-text">{g.title}</h3>
      </div>
      <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
        <div className="text-xs text-text-muted">
          <span className="font-semibold text-text">{g.registeredCount}</span> joined
          {spotsLeft != null && (
            <>
              {" · "}
              <span className="font-semibold text-text">{spotsLeft}</span> spot{spotsLeft === 1 ? "" : "s"} left
            </>
          )}
          {g.priceEur != null && (
            <div className="mt-0.5">
              <span className="font-mono font-semibold tabular-nums text-text">€{g.priceEur}</span> per player
            </div>
          )}
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-accent transition-transform group-hover:translate-x-0.5">
          Reserve →
        </span>
      </div>
    </Link>
  );
}

/** "3-hour" / "3.5-hour" from a minute count. */
function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  const rounded = Math.round(h * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}-hour`;
}

export default async function BookingPage() {
  const sb = createPublicClient();
  const [openGames, { data: cfg }] = await Promise.all([
    getUpcomingOpenGames(6),
    sb.from("pricing_config").select("default_price_eur, session_minutes").eq("id", 1).maybeSingle(),
  ]);
  const price = Number(cfg?.default_price_eur ?? 35);
  const sessionMinutes = Number(cfg?.session_minutes ?? 180);

  return (
    <>
      {/* ── Header + pricing ─────────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="wide" className="py-14 sm:py-20">
          <span className="eyebrow">Play LaserOps</span>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Jump into a game, or book one for your group.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
            Playing solo or with a few mates? Grab a spot in an upcoming open game below. Organising a corporate day,
            birthday, or stag &amp; hen? Book a private session and we&apos;ll build it around you.
          </p>

          <div className="mt-8 inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 border border-accent bg-bg-elevated px-6 py-4">
            <span className="font-mono text-3xl font-extrabold tabular-nums text-accent sm:text-4xl">€{price}</span>
            <span className="text-sm font-semibold uppercase tracking-[0.1em] text-text-muted">
              per person · {hoursLabel(sessionMinutes)} session · outdoor
            </span>
          </div>
        </Container>
      </section>

      {/* ── Path A: open games ───────────────────────────────── */}
      <section className="border-b border-border">
        <Container size="wide" className="py-14 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Want to play now?</span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-text sm:text-3xl">Upcoming open games</h2>
              <p className="mt-2 max-w-xl text-sm text-text-muted">
                Public games anyone can join. Reserve a spot, show up, play. Your stats, XP, and unlocks carry over every
                game.
              </p>
            </div>
            <Button href="/player-portal/games" variant="secondary" size="md">
              See all open games →
            </Button>
          </div>

          {openGames.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {openGames.map((g) => (
                <OpenGameCard key={g.id} g={g} />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-border bg-bg-elevated p-8 text-center">
              <p className="text-sm text-text-muted">
                No open games on the calendar right now.{" "}
                <Link href="/player-portal/login" className="font-semibold text-accent hover:text-accent-soft">
                  Create a free profile
                </Link>{" "}
                to get notified when the next one drops, or book a private session below.
              </p>
            </div>
          )}

          <p className="mt-5 text-xs text-text-subtle">
            New here? You&apos;ll create a free player profile when you reserve your first spot. That&apos;s what tracks
            your stats and unlocks.
          </p>
        </Container>
      </section>

      {/* ── Path B: private / group bookings ─────────────────── */}
      <section className="border-b border-border portal-surface">
        <Container size="wide" className="py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <span className="eyebrow">Booking for a group?</span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
                Private &amp; event bookings
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
                Corporate team-building, birthday parties, stag &amp; hen dos, or just a private game with your own crew.
                Tell us what you have in mind and we&apos;ll get back within 24 hours to sort dates, group size, and the
                details.
              </p>
              <ul className="mt-6 flex flex-col gap-2 text-sm">
                {[
                  { label: "Corporate events", href: "/events/corporate" },
                  { label: "Birthday parties", href: "/birthday-parties" },
                  { label: "Stag & hen dos", href: "/stag-and-hen" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-flex items-center gap-2 text-text-muted transition-colors hover:text-accent">
                      <span aria-hidden className="text-accent">→</span> {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-border bg-bg p-6 sm:p-8">
              <BookingForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
