"use client";

import type { Accolade } from "@/lib/cms/accolades";
import { cldImage } from "@/lib/cld";
import { BadgeDetailDialog } from "@/components/portal/BadgeDetailDialog";

/**
 * AccoladeTile
 * --------------------------------------------------------------------
 * One earned accolade in the match-report player stats card. The badge image
 * already includes the accolade name graphically, so we render just the image
 * and the XP label (e.g. "+75 XP"). Tap/click opens the shared BadgeDetailDialog
 * popup (big badge on the left, description on the right) - same component the
 * player-summary accolade cards use, so the "what is this?" popup looks identical
 * everywhere.
 */
export function AccoladeTile({ accolade }: { accolade: Accolade }) {
  return (
    <BadgeDetailDialog
      kind="Accolade"
      name={accolade.name}
      description={accolade.description}
      badgeUrl={accolade.badgeUrl || null}
      footer={accolade.xp > 0 ? `+${accolade.xp} XP awarded` : null}
      ariaLabel={`${accolade.name} - tap for description`}
    >
      {/* Badge artwork sits directly on the dark section background. Mobile uses
          gap-0 (the badge art already includes transparent padding, so extra gap
          floats the XP label too far); desktop gets a small gap. */}
      <span className="flex flex-col items-center gap-0 text-center sm:gap-2">
        {accolade.badgeUrl !== "" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cldImage(accolade.badgeUrl, { w: 336 })}
            alt={accolade.name}
            loading="lazy"
            className="block h-32 w-32 object-contain sm:h-40 sm:w-40"
          />
        ) : (
          <span aria-hidden className="block h-32 w-32 sm:h-40 sm:w-40" />
        )}
        {accolade.xp > 0 && (
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent sm:text-sm">+{accolade.xp} XP</span>
        )}
      </span>
    </BadgeDetailDialog>
  );
}
