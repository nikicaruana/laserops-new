import type { StatCard as StatCardData } from "@/lib/player-stats/summary-stats";

/**
 * StatCard
 * --------------------------------------------------------------------
 * One stat tile in the Player Summary's stats grid.
 *
 * Layout:
 *   - Small uppercase label at the top
 *   - Big primary number (yellow, the visual centerpiece)
 *   - Optional secondary line. Two flavours:
 *       - "stat":        muted prefix + bold value, e.g. "WIN RATE 75%"
 *       - "description": small italic-ish description text giving context
 *                        for unit-less metrics (e.g. Avg Match Rating).
 *     Neither: card has only label + primary, with the rating pill below.
 *   - Rating pill straddling the card's bottom edge (same overhang
 *     treatment as the profile rating overlay). Pill midpoint sits
 *     exactly on the edge.
 *
 * Empty-state: if ratingImageUrl is empty, the pill is omitted. Other
 * content still renders normally.
 */

type StatCardProps = {
  card: StatCardData;
};

export function StatCard({ card }: StatCardProps) {
  const showPill = card.ratingImageUrl !== "";
  const sec = card.secondary;

  return (
    // relative is required so the absolutely-positioned pill can be
    // placed against the card's bottom edge.
    <div className="relative flex flex-col items-center gap-2 border border-border bg-bg-elevated p-4 text-center sm:gap-3 sm:p-5">
      {/* Top label — small, muted, uppercase. */}
      <span className="text-[0.6rem] font-bold uppercase leading-tight tracking-[0.14em] text-text-muted sm:text-[0.7rem]">
        {card.label}
      </span>

      {/* Primary number — accent yellow, bold, monospace + tabular-nums. */}
      <span className="font-mono text-3xl font-extrabold leading-none tabular-nums text-accent sm:text-4xl">
        {card.primaryValue}
      </span>

      {/* Secondary content — three variants depending on the card type. */}
      {sec.kind === "stat" && (
        <div className="mt-1 flex items-baseline gap-1.5">
          {sec.prefix !== "" && (
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted sm:text-xs">
              {sec.prefix}
            </span>
          )}
          {/* Value: full text colour and bold so the rate carries weight
              equal to or greater than the primary count — appropriate
              because the rating measures this number, not the count. */}
          <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">
            {sec.value}
          </span>
        </div>
      )}

      {sec.kind === "description" && (
        // Description: small, muted, max-width-constrained so it wraps
        // tidily inside the card's available width on phones.
        <p className="mt-1 max-w-[20ch] text-balance text-[0.65rem] leading-snug text-text-subtle sm:text-xs">
          {sec.text}
        </p>
      )}

      {/* Bottom spacer — reserves vertical space so the overhanging pill
          has card content to half-cover. Without this the secondary line
          (or primary, for "none" cards) sits flush against the card
          bottom and the pill has no card surface to overlap with. */}
      {showPill && <div aria-hidden className="h-1 sm:h-2" />}

      {/* Rating pill, overhanging the card's bottom edge.
          bottom-0 + translate-y-1/2 → pill midpoint sits exactly on edge.
          Same translucent dark treatment as the profile rating overlay
          for UI consistency. */}
      {showPill && (
        <div
          className={[
            "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
            "rounded-full bg-bg/85 backdrop-blur-sm",
            "px-3 py-1.5",
            "z-10",
          ].join(" ")}
        >
          <img
            src={card.ratingImageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="block h-7 w-auto sm:h-8"
          />
        </div>
      )}
    </div>
  );
}
