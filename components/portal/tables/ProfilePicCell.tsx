/**
 * ProfilePicCell — dedicated column for the player's profile photo.
 *
 * Lives in its own column (between # and Ops Tag) so all the photos line up
 * vertically as a uniform stack. Centered within its cell.
 *
 * Responsive sizing:
 *   - Mobile: 36px square — small but readable in the dense 7-column layout
 *   - sm+: 60px square (50% bigger), comfortable on tablet/desktop
 *
 * Plain <img> rather than next/image — sources are external URLs that may
 * change, and these are tiny decorative thumbnails where Next/Image's
 * optimization isn't worth the remote-host config burden.
 */
type ProfilePicCellProps = {
  url: string;
  /** Player's nickname — used as the alt text for screen readers. */
  nickname: string;
};

export function ProfilePicCell({ url, nickname }: ProfilePicCellProps) {
  return (
    <img
      src={url}
      alt={`${nickname} profile photo`}
      loading="lazy"
      decoding="async"
      // Square crop, centered horizontally via mx-auto so the photo aligns
      // with the badge column above and below in the visual stack.
      className="mx-auto h-9 w-9 shrink-0 rounded-sm border border-border-strong object-cover sm:h-[60px] sm:w-[60px]"
    />
  );
}
