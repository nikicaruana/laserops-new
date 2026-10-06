"use client";

import type { MatchStreak } from "@/lib/match-report/engine";
import { cldImage } from "@/lib/cld";
import { BadgeDetailDialog } from "@/components/portal/BadgeDetailDialog";

/**
 * StreakTile
 * --------------------------------------------------------------------
 * One streak a player earned in the match. Shows the streak badge (+ a ×N count
 * pill and its point value); tap/click opens the shared BadgeDetailDialog popup
 * describing what it is - same component the player-summary cards use.
 */
export function StreakTile({ streak }: { streak: MatchStreak }) {
  return (
    <BadgeDetailDialog
      kind="Streak"
      name={streak.name}
      description={streak.description}
      badgeUrl={streak.badgeUrl || null}
      footer={streak.points > 0 ? `+${streak.points} points each` : null}
      ariaLabel={`${streak.name} - tap for description`}
    >
      <span className="flex flex-col items-center gap-0 text-center sm:gap-1.5">
        <span className="relative">
          {streak.badgeUrl !== "" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cldImage(streak.badgeUrl, { w: 240 })} alt={streak.name} loading="lazy" className="block h-24 w-24 object-contain sm:h-28 sm:w-28" />
          ) : (
            <span aria-hidden className="flex h-24 w-24 items-center justify-center border border-border text-[0.6rem] uppercase text-text-subtle sm:h-28 sm:w-28">{streak.name}</span>
          )}
          {streak.count > 1 && (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border border-bg bg-accent px-1.5 text-[0.65rem] font-extrabold text-bg">
              ×{streak.count}
            </span>
          )}
        </span>
        {streak.points > 0 && <span className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-accent">+{streak.points * streak.count}</span>}
      </span>
    </BadgeDetailDialog>
  );
}
