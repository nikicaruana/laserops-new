"use client";

/**
 * components/portal/XpCelebration.tsx
 * --------------------------------------------------------------------
 * First-login-after-a-game celebration. On entering the portal, checks for a
 * pending XP celebration (games scored since the player last saw one) and, if
 * any, takes over the screen with an animated XP bar filling through level-ups
 * plus the unlocks earned. Dismissing marks it seen so it won't show again.
 *
 * Mounted once in the player-portal layout. A per-session guard stops it from
 * re-checking on every navigation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cldImage } from "@/lib/cld";
import type { PendingCelebration } from "@/lib/xp/celebration";

const CHECK_THROTTLE_MS = 15000;
const TOTAL_MS = 2800;

type Slice = {
  level: number;
  baselineFill: number;
  endFill: number;
  earned: number;
  durationMs: number;
};

function computeSlices(d: PendingCelebration): Slice[] {
  const thr = new Map(d.levels.map((l) => [l.level, l.threshold]));
  const out: Slice[] = [];
  for (let lvl = d.startLevel; lvl <= d.endLevel; lvl++) {
    const levelMin = thr.get(lvl) ?? 0;
    const nextLevelMin = thr.get(lvl + 1) ?? levelMin + Math.max(1, d.endXp - d.startXp);
    const range = nextLevelMin - levelMin;
    if (range <= 0) continue;
    let baseline: number;
    let earned: number;
    if (lvl === d.startLevel && lvl === d.endLevel) {
      baseline = d.startXp - levelMin;
      earned = d.endXp - d.startXp;
    } else if (lvl === d.startLevel) {
      baseline = d.startXp - levelMin;
      earned = nextLevelMin - d.startXp;
    } else if (lvl === d.endLevel) {
      baseline = 0;
      earned = d.endXp - levelMin;
    } else {
      baseline = 0;
      earned = range;
    }
    baseline = Math.max(0, baseline);
    earned = Math.max(0, earned);
    out.push({
      level: lvl,
      baselineFill: Math.min(1, baseline / range),
      endFill: Math.min(1, (baseline + earned) / range),
      earned,
      durationMs: 0,
    });
  }
  const total = out.reduce((a, s) => a + s.earned, 0);
  if (total > 0) for (const s of out) s.durationMs = Math.max(350, (s.earned / total) * TOTAL_MS);
  else for (const s of out) s.durationMs = TOTAL_MS / Math.max(1, out.length);
  return out;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function XpCelebration() {
  const [data, setData] = useState<PendingCelebration | null>(null);
  const [sliceIdx, setSliceIdx] = useState(0);
  const [sliceProgress, setSliceProgress] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [finished, setFinished] = useState(false);
  const slicesRef = useRef<Slice[]>([]);
  const rafRef = useRef<number | null>(null);
  const previewRef = useRef(false);
  const lastCheckRef = useRef(0);
  const dataRef = useRef<PendingCelebration | null>(null);
  dataRef.current = data;
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Re-check for a pending celebration eagerly (mount, tab focus/visibility, and
  // navigation) rather than once per session, so it also fires right after an
  // account claim or a freshly-scored match while the player is already using the
  // app. The seen ledger prevents showing the same one twice; the onboarding page
  // is skipped so it doesn't interrupt sign-up. Throttled to avoid spamming.
  const check = useCallback(async (force = false) => {
    if (dataRef.current) return; // already showing
    if ((pathnameRef.current ?? "").includes("/onboarding")) return;
    let preview = false;
    try {
      preview = new URLSearchParams(window.location.search).get("xppreview") === "1";
    } catch {
      /* ignore */
    }
    previewRef.current = preview;
    const now = Date.now();
    if (!force && !preview && now - lastCheckRef.current < CHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;
    try {
      const r = await fetch(`/api/xp-celebration${preview ? "?preview=1" : ""}`);
      const j = (await r.json()) as { pending: PendingCelebration | null };
      if (j?.pending && j.pending.matchIds.length > 0) setData(j.pending);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    check(true);
    const onFocus = () => check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [check]);

  // Re-check on navigation (a natural "started using the app" signal), throttled.
  useEffect(() => {
    check();
  }, [pathname, check]);

  // Run the bar animation once data arrives.
  useEffect(() => {
    if (!data) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const slices = computeSlices(data);
    slicesRef.current = slices;
    const totalEarned = Math.max(0, data.endXp - data.startXp);

    if (slices.length === 0 || reduce) {
      setSliceIdx(Math.max(0, slices.length - 1));
      setSliceProgress(1);
      setEarnedXp(totalEarned);
      setFinished(true);
      return;
    }

    setSliceIdx(0);
    setSliceProgress(0);
    setEarnedXp(0);
    let idx = 0;
    let startT = performance.now();
    const t0 = startT;

    const tick = (now: number) => {
      const s = slices[idx];
      if (!s) return;
      const t = Math.min((now - startT) / s.durationMs, 1);
      setSliceProgress(easeOutCubic(t));
      setEarnedXp(Math.round(totalEarned * easeOutCubic(Math.min((now - t0) / TOTAL_MS, 1))));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (idx < slices.length - 1) {
        idx += 1;
        startT = performance.now();
        setSliceIdx(idx);
        setSliceProgress(0);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setEarnedXp(totalEarned);
        setFinished(true);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [data]);

  if (!data) return null;

  const slice = slicesRef.current[sliceIdx];
  const baselineFill = slice?.baselineFill ?? 0;
  const earnedFill = slice ? slice.baselineFill + (slice.endFill - slice.baselineFill) * sliceProgress : 0;
  const displayedLevel = slice?.level ?? data.startLevel;

  const badgeOf = (lvl: number) => data.levels.find((l) => l.level === lvl)?.badgeUrl ?? "";
  const endBadge = badgeOf(data.endLevel) || badgeOf(data.startLevel);

  const unlockImageFor = (u: PendingCelebration["unlocks"][number]) =>
    u.iconUrl ||
    (u.rewardTokens > 0
      ? data.rewardImages.token
      : u.rewardDoubleXp > 0
        ? data.rewardImages.doubleXp
        : u.rewardXp15 > 0
          ? data.rewardImages.xp15
          : "");

  async function dismiss() {
    // In preview mode we never mark it seen, so it stays replayable.
    if (!previewRef.current) {
      try {
        await fetch("/api/xp-celebration/seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchIds: data!.matchIds }),
        });
      } catch {
        /* best effort */
      }
    }
    setData(null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-bg/95 px-4 py-8 backdrop-blur-sm">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 50% at 50% 30%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%)" }} />

      <div className="relative w-full max-w-lg">
        <div className="border border-accent/40 bg-bg-elevated shadow-2xl">
          <div aria-hidden className="h-1 w-full bg-accent" />
          <div className="p-6 text-center sm:p-8">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-accent">Welcome back{data.leveledUp ? " — you leveled up!" : ""}</p>
            <h2 className="mt-1 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">{data.nickname}</h2>
            <p className="mt-1 text-sm text-text-muted">
              Here&apos;s your progress from {data.gamesCount} game{data.gamesCount === 1 ? "" : "s"}.
            </p>

            {/* Player avatar with their current rank badge as an accent. */}
            <div className="mt-6 flex items-center justify-center">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldImage(data.profilePicUrl, { w: 320 })}
                  alt={data.nickname}
                  className={`h-28 w-28 rounded-full border-2 border-accent object-cover transition-shadow sm:h-32 sm:w-32 ${finished ? "shadow-[0_0_28px_color-mix(in_srgb,var(--color-accent)_55%,transparent)]" : ""}`}
                />
                {endBadge ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cldImage(endBadge, { w: 160 })}
                    alt={`Level ${data.endLevel} badge`}
                    className="absolute -bottom-2 -right-2 h-14 w-14 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:h-16 sm:w-16"
                  />
                ) : null}
              </div>
            </div>

            {/* Level + earned */}
            <div className="mt-5">
              <p className="text-lg font-extrabold text-text sm:text-xl">
                {data.leveledUp ? (
                  <>
                    Level {data.startLevel} <span className="text-accent">▸ {displayedLevel}</span>
                  </>
                ) : (
                  <>Level {displayedLevel}</>
                )}
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-accent sm:text-3xl">
                +{earnedXp.toLocaleString("en-US")} <span className="text-sm font-bold text-text-muted sm:text-base">XP</span>
              </p>
            </div>

            {/* Progress bar (baseline black + earned accent) */}
            <div className="relative mt-4 h-4 w-full overflow-hidden rounded-full border border-border-strong bg-bg" role="progressbar" aria-valuenow={Math.round(earnedFill * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
              <div className="absolute inset-y-0 left-0 bg-border-strong" style={{ width: `${baselineFill * 100}%` }} />
              <div className="absolute inset-y-0 bg-accent" style={{ left: `${baselineFill * 100}%`, width: `${Math.max(0, earnedFill - baselineFill) * 100}%` }} />
            </div>

            {/* Unlocks */}
            {data.unlocks.length > 0 && (
              <div className={`mt-6 transition-opacity duration-500 ${finished ? "opacity-100" : "opacity-0"}`}>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">You unlocked</p>
                <ul className="mt-3 space-y-2 text-left">
                  {data.unlocks.map((u) => {
                    const img = unlockImageFor(u);
                    return (
                    <li key={u.level} className="flex items-center gap-3 border border-border bg-bg p-3">
                      {img ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={cldImage(img, { w: 120 })} alt="" className="h-11 w-11 shrink-0 object-contain" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-accent/50 bg-accent/10 font-mono text-xs font-bold text-accent">L{u.level}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-text">{u.title || `Level ${u.level} reward`}</p>
                        {u.description ? <p className="truncate text-xs text-text-muted">{u.description}</p> : null}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {u.rewardTokens > 0 && <RewardChip label={`${u.rewardTokens} LaserOps Token${u.rewardTokens === 1 ? "" : "s"}`} />}
                          {u.rewardDoubleXp > 0 && <RewardChip label={`${u.rewardDoubleXp}× 2× XP boost`} />}
                          {u.rewardXp15 > 0 && <RewardChip label={`${u.rewardXp15}× 1.5× XP boost`} />}
                        </div>
                      </div>
                      <span className="shrink-0 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-text-subtle">Lvl {u.level}</span>
                    </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={dismiss}
              className="mt-7 w-full bg-accent px-6 py-3 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.99]"
            >
              {finished ? "Let's go" : "Skip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RewardChip({ label }: { label: string }) {
  return <span className="rounded-sm border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-accent">{label}</span>;
}
