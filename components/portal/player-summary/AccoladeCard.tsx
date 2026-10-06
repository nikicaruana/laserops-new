import type { AccoladeWithCount } from "@/lib/player-stats/summary-accolades";
import { cldImage } from "@/lib/cld";
import { BadgeDetailDialog } from "@/components/portal/BadgeDetailDialog";

/**
 * AccoladeCard
 * --------------------------------------------------------------------
 * Single accolade tile in the Accolades section. Brand-yellow badge on a dark
 * card with a count pill below; unearned accolades are greyed + show "Locked".
 *
 * The whole card is clickable: it opens the shared BadgeDetailDialog popup (big
 * badge on the left, name + description on the right) so players can learn what
 * each accolade is - including the locked ones they haven't earned yet.
 */

type AccoladeCardProps = {
  data: AccoladeWithCount;
};

export function AccoladeCard({ data }: AccoladeCardProps) {
  const { definition, count } = data;
  const locked = count === 0;
  return (
    <BadgeDetailDialog
      kind="Accolade"
      name={definition.name}
      description={definition.description}
      badgeUrl={definition.iconPath || null}
      footer={`Worth ${definition.tier} XP`}
      ariaLabel={`${definition.name} - tap for details`}
      triggerClassName="h-full"
    >
      <div className={`flex h-full flex-col items-center gap-2 portal-card p-3 sm:gap-3 sm:p-4 ${locked ? "opacity-50" : ""}`}>
        {/* Badge artwork - brand yellow silhouette. The ribbon name baked into
            the art serves as the label. Sized by WIDTH so it fills the card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cldImage(definition.iconPath, { w: 320 })}
          alt={`${definition.name} accolade`}
          loading="lazy"
          decoding="async"
          className={`block h-auto w-full max-w-[10rem] ${locked ? "grayscale" : ""}`}
        />

        {/* Count pill - lighter elevated grey for contrast against the card. */}
        <div className="mt-auto rounded-sm border border-border-strong bg-bg-overlay px-3 py-1 sm:px-4 sm:py-1.5">
          {locked ? (
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle sm:text-xs">Locked</span>
          ) : (
            <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">{count.toLocaleString("en-US")}</span>
          )}
        </div>
      </div>
    </BadgeDetailDialog>
  );
}
