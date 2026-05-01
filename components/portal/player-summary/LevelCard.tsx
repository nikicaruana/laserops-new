import { XpProgressBar } from "@/components/portal/player-summary/XpProgressBar";

/**
 * LevelCard — the rank/level/XP card that sits in the top-right of the
 * Player Summary above the Favourite Weapon card.
 *
 * Layout:
 *   Row 1: rank badge image (left) + level display (right of badge)
 *   Row 2: two-up — Matches Played | Total XP, each labelled
 *   Row 3: animated XP progress bar (fills 0→target on mount)
 *
 * The badge image renders against the card's dark background (no extra
 * surface). The level display text is large and centered next to it.
 */

type LevelCardProps = {
  rankBadgeUrl: string;
  /** e.g. "Level 8" — displayed verbatim. */
  levelDisplay: string;
  matchesPlayed: number;
  totalXp: number;
  /** 0-100 progress within the current level. */
  levelProgressPct: number;
};

export function LevelCard({
  rankBadgeUrl,
  levelDisplay,
  matchesPlayed,
  totalXp,
  levelProgressPct,
}: LevelCardProps) {
  return (
    <div className="flex flex-col gap-4 border border-border bg-bg-elevated p-4 sm:gap-5 sm:p-6">
      {/* Row 1: badge + level display */}
      <div className="flex items-center justify-center gap-4">
        {rankBadgeUrl !== "" && (
          <img
            src={rankBadgeUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="h-16 w-auto sm:h-20"
          />
        )}
        <div className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
          {levelDisplay}
        </div>
      </div>

      {/* Row 2: matches played + total XP, two-up.
          Equal-width columns regardless of value length so the labels stay
          aligned. text-center keeps wrapped numerics readable. */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Matches Played" value={matchesPlayed.toLocaleString("en-US")} />
        <Stat label="Total XP" value={totalXp.toLocaleString("en-US")} />
      </div>

      {/* Row 3: progress bar. Caption above shows the numeric percentage so
          users see the value even if they don't grasp the bar's fill ratio
          at a glance. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted">
            Level Progress
          </span>
          <span className="font-mono text-xs tabular-nums text-text">
            {Math.round(levelProgressPct)}%
          </span>
        </div>
        <XpProgressBar pct={levelProgressPct} />
      </div>
    </div>
  );
}

/* ---------- Local helpers ---------- */

/**
 * Single labelled stat: small uppercase eyebrow + large numeric.
 * Used twice in the LevelCard for Matches Played and Total XP.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>
      <span className="font-mono text-lg font-bold tabular-nums text-text sm:text-xl">
        {value}
      </span>
    </div>
  );
}
