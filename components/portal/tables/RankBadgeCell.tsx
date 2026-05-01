/**
 * RankBadgeCell — renders the player's current rank/level badge image.
 *
 * Responsive sizing matches ProfilePicCell so badges and photos read in
 * proportion across columns:
 *   - Mobile: 36px tall
 *   - sm+: 60px tall (50% bigger)
 *
 * Allows null / empty url and renders a placeholder dash in that case
 * (defensive — newly-created players might not have a badge URL yet).
 */
type RankBadgeCellProps = {
  badgeUrl: string;
  /** Accessible label, e.g. "Operative ★ ★ ★" */
  ariaLabel?: string;
};

export function RankBadgeCell({ badgeUrl, ariaLabel }: RankBadgeCellProps) {
  if (!badgeUrl) {
    return <span aria-hidden className="text-text-subtle">—</span>;
  }
  return (
    <img
      src={badgeUrl}
      alt={ariaLabel ?? ""}
      loading="lazy"
      decoding="async"
      // Height-based sizing — width auto so non-square badges render at correct
      // aspect ratio. Centered horizontally within the cell via mx-auto.
      // Heights match ProfilePicCell so the photo and badge columns align.
      className="mx-auto h-9 w-auto sm:h-[60px]"
    />
  );
}
