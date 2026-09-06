"use client";

/**
 * components/portal/progression/ProgressionLadder.tsx
 * --------------------------------------------------------------------
 * Vertical level ladder for a player's own progression. Each level shows its
 * badge, name, an animated progress bar, and the reward unlocked at it. Levels
 * not yet reached are blurred (a teaser); the reached ones are crisp. The
 * current level is highlighted.
 */
import { XpProgressBar } from "@/components/portal/player-summary/XpProgressBar";
import { cldImage } from "@/lib/cld";
import { cn } from "@/lib/cn";

export type LevelRow = {
  level: number;
  rankName: string;
  badgeUrl: string;
  reached: boolean;
  pct: number;
  prizeTitle: string;
  prizeDescription: string;
  prizeIconUrl: string;
  rewardTokens: number;
  rewardDoubleXp: number;
  rewardXp15: number;
};

function fmtTokens(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

export function ProgressionLadder({ rows, currentLevel }: { rows: LevelRow[]; currentLevel: number }) {
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r) => {
        const isCurrent = r.level === currentLevel;
        const locked = !r.reached;
        // Structured reward chips (game tokens + XP boosts), best-known order.
        const rewardChips: string[] = [];
        if (r.rewardTokens > 0) rewardChips.push(`${fmtTokens(r.rewardTokens)} game token${r.rewardTokens === 1 ? "" : "s"}`);
        if (r.rewardDoubleXp > 0) rewardChips.push(`${r.rewardDoubleXp} × Double XP`);
        if (r.rewardXp15 > 0) rewardChips.push(`${r.rewardXp15} × 1.5x XP`);
        const hasPrize = r.prizeTitle !== "" || rewardChips.length > 0;
        return (
          <li
            key={r.level}
            className={cn(
              "relative border bg-bg-elevated p-4 transition-colors",
              isCurrent ? "border-accent" : r.reached ? "border-border" : "border-border/60",
            )}
          >
            <div className="flex items-center gap-4">
              {/* Badge (blurred when locked) */}
              <div className="relative shrink-0">
                {r.badgeUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cldImage(r.badgeUrl, { w: 384 })}
                    alt=""
                    aria-hidden
                    className={cn("h-14 w-auto sm:h-16", locked && "blur-[3px] opacity-60")}
                  />
                ) : (
                  <span className={cn("flex h-14 w-14 items-center justify-center border border-border text-sm font-bold text-text-subtle", locked && "blur-[2px]")}>
                    {r.level}
                  </span>
                )}
              </div>

              {/* Level + name + progress + prize */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-extrabold uppercase tracking-[0.08em]", isCurrent ? "text-accent" : "text-text")}>
                      Level {r.level}
                    </span>
                    {r.rankName && <span className="truncate text-xs text-text-muted">{r.rankName}</span>}
                  </span>
                  {r.reached ? (
                    <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-emerald-400">Reached</span>
                  ) : (
                    <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle">Locked</span>
                  )}
                </div>

                <div className="mt-2">
                  <XpProgressBar pct={r.pct} ariaLabel={`Level ${r.level} progress: ${Math.round(r.pct)}%`} />
                </div>

                {/* Reward */}
                {hasPrize && (
                  <div className="mt-3 flex items-center gap-2">
                    {r.prizeIconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.prizeIconUrl} alt="" aria-hidden className={cn("h-6 w-6 object-contain", locked && "blur-[3px]")} />
                    )}
                    <div className={cn("min-w-0", locked && "select-none blur-[4px]")}>
                      {r.prizeTitle && <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-accent">{r.prizeTitle}</p>}
                      {rewardChips.length > 0 && (
                        <p className={cn("truncate text-[0.7rem] font-semibold text-accent", r.prizeTitle && "text-text-muted")}>
                          {rewardChips.join(" · ")}
                        </p>
                      )}
                      {r.prizeDescription && <p className="truncate text-[0.7rem] text-text-muted">{r.prizeDescription}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
