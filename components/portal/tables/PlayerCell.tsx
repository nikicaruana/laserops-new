import { cn } from "@/lib/cn";

/**
 * PlayerCell — profile picture + nickname pairing used across leaderboards.
 *
 * Responsive image sizing:
 *   - Mobile: 40px square — fits the cramped 6-column mobile layout
 *   - sm+: 60px square (50% bigger), comfortable on tablet/desktop
 *
 * The image uses a plain <img> rather than next/image because:
 *   - Source URLs are external and may change as the source sheet updates
 *   - These are small decorative thumbnails — Next/Image's optimization
 *     overhead isn't worth it for sub-2KB rendered sizes
 *   - Lazy loading via the loading="lazy" attribute is sufficient
 *
 * Layout: image + nickname centered as a horizontal group. Group can be
 * left-aligned or centered within its grid cell via the `centered` prop.
 */
type PlayerCellProps = {
  profilePicUrl: string;
  nickname: string;
  /**
   * Center the image+nickname group within its cell. Default true to match
   * the centered Ops Tag column requirement; set false for layouts where
   * the player should hug the left edge.
   */
  centered?: boolean;
};

export function PlayerCell({ profilePicUrl, nickname, centered = true }: PlayerCellProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 min-w-0 sm:gap-3",
        centered ? "justify-center" : "justify-start",
      )}
    >
      <img
        src={profilePicUrl}
        alt=""
        loading="lazy"
        decoding="async"
        // Square crop. Border keeps the photo distinct from the row background.
        // Sizes intentionally restrained on mobile to leave nickname room.
        className="h-10 w-10 shrink-0 rounded-sm border border-border-strong object-cover sm:h-[60px] sm:w-[60px]"
        aria-hidden
      />
      <span className="min-w-0 truncate text-xs font-semibold text-text sm:text-base">
        {nickname}
      </span>
    </div>
  );
}
