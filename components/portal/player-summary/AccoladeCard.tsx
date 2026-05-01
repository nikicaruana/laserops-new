import type { AccoladeWithCount } from "@/lib/player-stats/summary-accolades";

/**
 * AccoladeCard
 * --------------------------------------------------------------------
 * Single accolade tile in the Accolades section.
 *
 * Layout: dark grey card (matching the StatCard surface) containing a
 * brand-yellow badge silhouette and a count pill below.
 *
 * Visual rationale: yellow art on dark surface reads as a "vintage
 * enamel pin / display case" treatment — calm, premium, lets the badge
 * be the figure rather than competing with the card's own colour.
 * Matches the rest of the portal's dark-surface card chrome.
 *
 * Count pill: lighter elevated grey (bg-bg/85) rather than dark, so it
 * pops against the surrounding card. Reads as a small recessed plaque
 * embedded in the card.
 */

type AccoladeCardProps = {
  data: AccoladeWithCount;
};

export function AccoladeCard({ data }: AccoladeCardProps) {
  const { definition, count } = data;
  return (
    <div className="flex flex-col items-center gap-2 border border-border bg-bg-elevated p-3 sm:gap-3 sm:p-4">
      {/* Badge artwork — brand yellow silhouette on transparent. The
          ribbon name baked into the artwork serves as the label. */}
      <img
        src={definition.iconPath}
        alt={`${definition.name} accolade`}
        loading="lazy"
        decoding="async"
        className="block h-24 w-auto sm:h-32"
      />

      {/* Count pill — lighter elevated grey for contrast against the
          dark card surface. Reads as a small embedded plaque. */}
      <div className="mt-auto rounded-sm border border-border-strong bg-bg-overlay px-3 py-1 sm:px-4 sm:py-1.5">
        <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">
          {count.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}
