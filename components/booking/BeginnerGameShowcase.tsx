/**
 * components/booking/BeginnerGameShowcase.tsx
 * --------------------------------------------------------------------
 * A prominent "Next beginner-only open game" banner, used below the homepage
 * hero and on the booking page under the upcoming open games. Renders nothing
 * when no beginner-only open game is scheduled, so callers can drop it in
 * unconditionally. Links through to the game's sign-up page.
 */
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionAmbient } from "@/components/layout/SectionAmbient";
import type { OpenGameTeaser } from "@/lib/booking/open-games";

/** "Sat 12 Oct · 18:00" in Malta time. */
function fmtWhen(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Malta" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Malta" }).format(d);
  return `${day} · ${time}`;
}

export function BeginnerGameShowcase({ game }: { game: OpenGameTeaser | null }) {
  if (!game) return null;
  const spotsLeft = game.maxPlayers != null ? Math.max(0, game.maxPlayers - game.registeredCount) : null;
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      <SectionAmbient tone="dark" />
      <Container size="wide" className="relative py-12 sm:py-16">
        <Link
          href={`/player-portal/games/${game.id}`}
          className="group block border-2 border-emerald-500/60 bg-emerald-500/[0.06] p-6 transition-colors hover:border-emerald-400 sm:p-10"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden /> Next beginner-only open game
              </span>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-text sm:text-4xl">{game.title}</h2>
              <p className="mt-3 text-base font-semibold uppercase tracking-[0.08em] text-emerald-300 sm:text-lg">{fmtWhen(game.scheduledAt)}</p>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                New to laser tag? This one&apos;s for you
                {game.beginnerMaxLevel != null
                  ? `, capped at level ${game.beginnerMaxLevel} so you're matched with other newcomers rather than seasoned veterans`
                  : ""}
                .
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-muted">
                <span>
                  <span className="font-semibold text-text">{game.registeredCount}</span> joined
                </span>
                {spotsLeft != null && (
                  <span>
                    <span className="font-semibold text-text">{spotsLeft}</span> spot{spotsLeft === 1 ? "" : "s"} left
                  </span>
                )}
                {game.priceEur != null && (
                  <span>
                    <span className="font-mono font-semibold tabular-nums text-text">€{game.priceEur}</span> per player
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 border-2 border-emerald-500 bg-emerald-500 px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-transform group-hover:translate-x-0.5">
                Reserve your spot →
              </span>
            </div>
          </div>
        </Link>
      </Container>
    </section>
  );
}
