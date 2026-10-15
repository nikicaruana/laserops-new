/**
 * app/welbees-offer/page.tsx
 * --------------------------------------------------------------------
 * Welbee's x LaserOps promotion landing page (QR-code target from the in-store
 * voucher). Pay for your first game, get your second free. Mobile-first, over
 * the site's ember-bokeh background with frosted portal-card boxes.
 *
 * Live data: next upcoming open games (3rd slot pinned to the next Double XP
 * event, beginners-only game split into its own highlight) + the current
 * featured gallery photos (rotating). Chrome is hidden on this route (see
 * ChromeGate) so it reads as a focused landing page.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { createPublicClient } from "@/lib/supabase/public";
import { cldImage } from "@/lib/cld";
import { FeaturedPhotoRotator } from "@/components/welbees/FeaturedPhotoRotator";

export const metadata: Metadata = {
  title: "Welbee's Offer | LaserOps Malta",
  alternates: { canonical: "/welbees-offer" },
  description:
    "Outdoor laser tag in Malta: pay for your first LaserOps game and get your second free. A Welbee's exclusive for first-timers.",
};

// Games and featured photos change over time; keep fresh without going dynamic.
export const revalidate = 300;

const LOGO_URL = "https://res.cloudinary.com/dqud5b7pa/image/upload/v1781471617/LaserOps_Logo_PNG_600px_yellow_kxsfpc.png";
const TOKEN_URL = "https://res.cloudinary.com/dqud5b7pa/image/upload/v1790604661/laseropsmalta.com/reward-images/ldr2xsdshxlzedzcesfi.png";
const VIDEO_SRC = "https://res.cloudinary.com/dqud5b7pa/video/upload/q_auto/v1782764970/LaserOps_Ad_1_v2_ykknax.mp4";
const VIDEO_POSTER = "https://res.cloudinary.com/dqud5b7pa/video/upload/so_2/v1782764970/LaserOps_Ad_1_v2_ykknax.jpg";
const INSTAGRAM = "https://www.instagram.com/laserops.mt/";
const FACEBOOK = "https://www.facebook.com/laserops.mt";
const LOCATION = "LaserOps Malta";

type GameRow = {
  id: string;
  match_code: string | null;
  title: string | null;
  scheduled_at: string | null;
  is_beginner: boolean | null;
  beginner_max_level: number | null;
  is_double_xp: boolean | null;
  price_eur: number | null;
  duration_minutes: number | null;
};

type Slip = {
  id: string;
  day: string;
  range: string;
  label: string;
  price: number | null;
  doubleXp: boolean;
  beginner: boolean;
  cap: number | null;
};

function fmtDay(iso: string | null): string {
  if (!iso) return "Date TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBC";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Malta" }).format(d);
}
function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Malta" }).format(d);
}
function fmtRange(iso: string | null, dur: number | null): string {
  if (!iso) return "";
  const s = new Date(iso);
  if (Number.isNaN(s.getTime())) return "";
  const e = new Date(s.getTime() + (dur ?? 180) * 60_000);
  return `${fmtTime(s)} - ${fmtTime(e)}`;
}

function toSlip(g: GameRow): Slip {
  return {
    id: g.id,
    day: fmtDay(g.scheduled_at),
    range: fmtRange(g.scheduled_at, g.duration_minutes),
    label: g.is_beginner ? "Beginners-Only Game" : g.is_double_xp ? "Double XP Event" : "Open Match",
    price: g.price_eur == null ? null : Number(g.price_eur),
    doubleXp: Boolean(g.is_double_xp),
    beginner: Boolean(g.is_beginner),
    cap: g.beginner_max_level == null ? null : Number(g.beginner_max_level),
  };
}

const isTest = (m: GameRow) => String(m.match_code ?? "").toUpperCase().startsWith("LO-TEST");

/** Next upcoming open games: [next, next, next-double-XP] + the soonest beginner game. */
async function getGames(): Promise<{ slips: Slip[]; beginner: Slip | null }> {
  try {
    const sb = createPublicClient();
    const now = new Date().toISOString();
    const { data } = await sb
      .from("matches")
      .select("id, match_code, title, scheduled_at, is_beginner, beginner_max_level, is_double_xp, price_eur, duration_minutes")
      .eq("is_private", false)
      .in("status", ["tentative", "awaiting_confirm", "confirmed"])
      .gte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(40);
    const rows = ((data ?? []) as GameRow[]).filter((m) => !isTest(m));
    const beginners = rows.filter((m) => m.is_beginner);
    const regular = rows.filter((m) => !m.is_beginner);
    const doubleXp = regular.find((m) => m.is_double_xp) ?? null;
    let chosen: GameRow[];
    if (doubleXp) {
      const firstTwo = regular.filter((m) => m.id !== doubleXp.id).slice(0, 2);
      chosen = [...firstTwo, doubleXp];
    } else {
      chosen = regular.slice(0, 3);
    }
    return { slips: chosen.map(toSlip), beginner: beginners[0] ? toSlip(beginners[0]) : null };
  } catch {
    return { slips: [], beginner: null };
  }
}

async function getFeaturedPhotos(): Promise<string[]> {
  try {
    const sb = createPublicClient();
    let { data } = await sb.from("match_photos").select("secure_url, featured_home, created_at").eq("featured_home", true).order("created_at", { ascending: false }).limit(18);
    if (!data || data.length < 3) {
      const r = await sb.from("match_photos").select("secure_url, featured_home, created_at").order("created_at", { ascending: false }).limit(15);
      data = r.data ?? [];
    }
    return ((data ?? []) as { secure_url: string | null }[])
      .map((x) => x.secure_url)
      .filter((u): u is string => Boolean(u))
      .slice(0, 18)
      .map((u) => cldImage(u, { w: 400 }));
  } catch {
    return [];
  }
}

const eur = (n: number | null) => (n == null ? "" : `€${Number.isInteger(n) ? n : n.toFixed(2)}`);

function DownArrow() {
  return (
    <div className="flex justify-center py-4">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-accent opacity-80" aria-hidden="true">
        <path d="M12 4v15M6 13l6 6 6-6" />
      </svg>
    </div>
  );
}

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-[2px] bg-accent text-2xl font-extrabold leading-none text-bg">{n}</span>
      <h2 className="text-[22px] font-extrabold uppercase leading-tight tracking-tight">{title}</h2>
    </div>
  );
}

export default async function WelbeesOfferPage() {
  const [{ slips, beginner }, photos] = await Promise.all([getGames(), getFeaturedPhotos()]);

  return (
    <div className="pb-10">
      {/* co-brand banner */}
      <header className="relative overflow-hidden bg-accent py-4">
        <div className="dimple-texture-dark pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
        <Container size="narrow" className="relative flex flex-wrap items-center justify-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cldImage(LOGO_URL, { w: 200, trim: true })} alt="LaserOps Malta" className="h-[34px] w-auto brightness-0" />
          <span className="text-2xl font-extrabold text-bg opacity-50">✕</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/welbees-supermarket.png" alt="Welbee's Supermarket" className="h-[54px] w-auto mix-blend-multiply" />
        </Container>
      </header>

      <Container size="narrow" className="relative max-w-[640px]">
        {/* hero */}
        <section className="pt-12 pb-2 text-center">
          <span className="mb-4 inline-block rounded-[2px] border border-accent/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.26em] text-accent">
            Limited time offer
          </span>
          <h1 className="text-balance text-[clamp(33px,8.6vw,52px)] font-extrabold uppercase leading-[1.05]">
            <span className="mb-2.5 block text-[clamp(14px,3.6vw,18px)] tracking-[0.22em] text-accent">Outdoor Laser Tag</span>
            Play your 1st game,
            <br />
            get your 2nd <span className="text-accent">free</span>
          </h1>
          <div className="mx-auto mt-5 flex max-w-[40ch] flex-wrap items-center justify-center gap-x-2.5 gap-y-2">
            <span className="rounded-[2px] border border-border bg-bg-elevated/50 px-2.5 py-1.5 text-[13.5px] font-semibold">
              Spend at <b className="font-extrabold text-accent">Welbee&rsquo;s</b>
            </span>
            <span className="text-[15px] font-extrabold text-accent">→</span>
            <span className="rounded-[2px] border border-border bg-bg-elevated/50 px-2.5 py-1.5 text-[13.5px] font-semibold">Bring your voucher</span>
            <span className="text-[15px] font-extrabold text-accent">→</span>
            <span className="rounded-[2px] border border-border bg-bg-elevated/50 px-2.5 py-1.5 text-[13.5px] font-semibold">Pay for your 1st game with us</span>
            <span className="text-[15px] font-extrabold text-accent">→</span>
            <span className="rounded-[2px] border border-accent/50 bg-bg-elevated/50 px-2.5 py-1.5 text-[13.5px] font-semibold text-accent">2nd game free</span>
          </div>
        </section>

        <DownArrow />

        {/* step 1 */}
        <section className="portal-card rounded-[4px] p-[22px]">
          <StepHead n={1} title="Create your free account" />
          <p className="mt-3 text-[14.5px] text-text-muted">Takes under a minute. Your account tracks your games, stats and ranks, and holds the free game we drop into your profile.</p>
          <p className="mt-2 text-[12.5px] text-text-subtle">No payment to sign up. You only pay when you play your first game.</p>
        </section>

        <DownArrow />

        {/* step 2 */}
        <section className="portal-card rounded-[4px] p-[22px]">
          <StepHead n={2} title="Find a game to join" />
          <p className="mt-3 text-[14.5px] text-text-muted">Browse upcoming open games on our portal and grab a spot.</p>
          <div className="mt-3.5 flex items-center gap-3 rounded-[4px] border border-accent/45 bg-accent/[0.09] p-3.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-accent" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
            <span className="text-[13px] text-text">
              This is your <b className="font-bold text-accent">paid first game</b> - book and pay for it as normal. Your second game is the free one.
            </span>
          </div>

          {slips.length > 0 && (
            <>
              <p className="mt-[18px] text-[11px] font-bold uppercase tracking-[0.16em] text-text-subtle">Next upcoming games</p>
              <div className="-mx-1 mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto p-1">
                {slips.map((s) => (
                  <Link
                    key={s.id}
                    href={`/player-portal/games/${s.id}`}
                    className="w-[198px] flex-none snap-start rounded-[4px] border border-border bg-bg-overlay/55 p-3.5 transition-colors hover:border-accent"
                  >
                    <div className="text-[19px] font-extrabold uppercase leading-tight">{s.day}</div>
                    <div className="mt-0.5 text-[11.5px] text-text-muted">{s.range}{s.range ? " · " : ""}{LOCATION}</div>
                    <div className="mt-2.5 text-[14.5px] font-bold">{s.label}</div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {s.doubleXp ? (
                        <span className="rounded-[2px] border border-accent/40 px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-wider text-accent">Double XP</span>
                      ) : (
                        <span className="rounded-[2px] border border-border-strong px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-wider text-text-muted">Open</span>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end border-t border-border pt-2.5">
                      <span className="text-[18px] font-extrabold">{eur(s.price)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {beginner && (
            <div className="mt-[18px] overflow-hidden rounded-[4px] border border-emerald-500/40 bg-emerald-500/[0.06]">
              <div className="flex items-center gap-1.5 bg-emerald-500/[0.16] px-3.5 py-[7px] text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6 4.3 2.3 7.3L12 16.7 5.7 21l2.3-7.3-6-4.3h7.6z" /></svg>
                Brand new? Start here
              </div>
              <Link href={`/player-portal/games/${beginner.id}`} className="flex flex-wrap items-center gap-3.5 p-3.5">
                <div className="min-w-0">
                  <div className="text-[19px] font-extrabold uppercase leading-tight">{beginner.day}</div>
                  <div className="mt-0.5 text-[12.5px] text-text-muted">
                    {beginner.range}{beginner.range ? " · " : ""}
                    <span className="font-extrabold text-emerald-400">Beginners-Only Game</span>
                  </div>
                  <div className="mt-[7px] max-w-[42ch] text-[12.5px] text-text-muted">
                    {beginner.cap != null ? `Capped at level ${beginner.cap} so ` : ""}you are matched with other newcomers, not seasoned veterans. The friendliest first game.
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[20px] font-extrabold">{eur(beginner.price)}</div>
                </div>
              </Link>
            </div>
          )}
        </section>

        <DownArrow />

        {/* step 3 */}
        <section className="portal-card rounded-[4px] p-[22px]">
          <StepHead n={3} title="Your free game lands in your profile" />
          <p className="mt-3 text-[14.5px] text-text-muted">After your first game, we assign a <b className="font-bold text-text">LaserOps Game Token</b> to your account. One token equals one free game.</p>
          <div className="mt-[18px] flex flex-col items-center">
            <div className="relative w-[168px] max-w-[60%]">
              <div className="absolute -inset-[16%] animate-pulse rounded-full blur-[6px]" style={{ background: "radial-gradient(circle, rgba(255,222,0,0.32), transparent 62%)" }} aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cldImage(TOKEN_URL, { w: 400 })} alt="LaserOps Game Token" className="relative z-[1] block h-auto w-full" />
            </div>
            <div>
              <span className="mt-2.5 inline-flex items-center gap-2 rounded-[2px] border border-border-strong bg-bg-overlay/60 px-[15px] py-[7px] text-[14px] font-extrabold uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-accent" />1 free game
              </span>
            </div>
          </div>
          <p className="mt-2 text-center text-[12.5px] text-text-subtle">*Valid for 60 days from the date it is assigned.</p>
        </section>

        <DownArrow />

        {/* step 4 */}
        <section className="portal-card rounded-[4px] p-[22px]">
          <StepHead n={4} title="Join your 2nd game, free" />
          <p className="mt-3 text-[14.5px] text-text-muted">Pick your next game, join it, and pay with your token at checkout. No card needed. Same arena, more targets, zero cost.</p>
        </section>

        <DownArrow />

        {/* CTA */}
        <section className="pb-1 pt-1.5 text-center">
          <Link
            href="/player-portal/login"
            className="inline-flex w-full max-w-[360px] items-center justify-center rounded-[2px] bg-accent px-[30px] py-4 text-[18px] font-bold uppercase tracking-wide text-bg shadow-[0_12px_34px_-14px_rgba(255,222,0,0.55)] transition-colors hover:bg-accent-soft"
          >
            Create your free account
          </Link>
          <div>
            <Link href="/booking" className="mt-3 inline-flex items-center justify-center rounded-[2px] border border-border-strong px-5 py-[11px] text-[13.5px] font-bold uppercase tracking-wide text-text transition-colors hover:border-accent hover:text-accent">
              Browse upcoming games
            </Link>
          </div>
          <p className="mt-[15px] text-[12.5px] text-text-subtle">Redeem before the offer ends. One free game per new player.</p>
        </section>

        {/* media */}
        <section className="mt-[30px]">
          <p className="mb-3.5 text-center text-[13px] font-extrabold uppercase tracking-[0.2em] text-text-subtle">See it in action</p>
          <video
            controls
            playsInline
            preload="metadata"
            poster={VIDEO_POSTER}
            className="mx-auto block aspect-[9/16] w-full max-w-[300px] rounded-[4px] border border-border bg-black object-cover"
          >
            <source src={VIDEO_SRC} type="video/mp4" />
          </video>
          {photos.length > 0 && <FeaturedPhotoRotator photos={photos} />}
        </section>

        {/* terms */}
        <section className="mt-[28px]">
          <div className="portal-card rounded-[4px] px-[22px] py-5">
            <h3 className="mb-3 text-[14px] font-extrabold uppercase tracking-[0.16em] text-text-muted">Terms &amp; Conditions</h3>
            <ol className="list-decimal space-y-[5px] pl-[18px] text-[12.5px] leading-[1.7] text-text-subtle">
              <li>Offer open to new LaserOps Malta players only (first visit), redeemed against a valid Welbee&rsquo;s promotional voucher.</li>
              <li>Each voucher is earned per qualifying spend at participating Welbee&rsquo;s stores, as stated on the voucher.</li>
              <li>The free second game is issued as one LaserOps Game Token after the first paid game is played.</li>
              <li>One free game per new player. Tokens are non-transferable and hold no cash value.</li>
              <li>The free game is subject to game availability and must be booked through the LaserOps portal.</li>
              <li>Token valid for 60 days from the date it is assigned, unless stated otherwise on the voucher.</li>
              <li>LaserOps Malta reserves the right to amend or withdraw this promotion at any time.</li>
            </ol>
          </div>
        </section>

        {/* footer */}
        <footer className="pb-11 pt-[30px] text-center text-[12px] text-text-subtle">
          <div>
            LaserOps Malta &middot;{" "}
            <a href="https://www.laseropsmalta.com" target="_blank" rel="noopener" className="font-semibold text-accent">www.laseropsmalta.com</a>
          </div>
          <div className="mt-2">
            <a href={INSTAGRAM} target="_blank" rel="noopener" className="text-text-muted transition-colors hover:text-accent">Instagram</a>
            {" · "}
            <a href={FACEBOOK} target="_blank" rel="noopener" className="text-text-muted transition-colors hover:text-accent">Facebook</a>
          </div>
        </footer>
      </Container>
    </div>
  );
}
