import { BracketFrame } from "@/components/portal/BracketFrame";

/**
 * ProfileCard — top-left card of the Player Summary.
 *
 * Layout (vertical):
 *   - Player nickname (top, centered)
 *   - Profile photo with yellow corner-bracket frame. Photo flexes vertically
 *     to absorb the card's height, so when this card is alongside a taller
 *     right column the photo wrapper grows to match. Keeps both columns the
 *     same overall height on desktop without JS.
 *   - 5-star rating image straddling the photo's bottom edge — its midpoint
 *     sits exactly on the edge so the top half overlaps the photo and the
 *     bottom half hangs into the card's space below. No border, slightly
 *     translucent dark background, tight padding so the rating itself
 *     dominates and the backdrop reads as integrated rather than "a separate
 *     element."
 */

type ProfileCardProps = {
  nickname: string;
  profilePicUrl: string;
  /** URL to the 5-star rating image. Empty if not yet earned. */
  overallRatingImageUrl: string;
};

export function ProfileCard({
  nickname,
  profilePicUrl,
  overallRatingImageUrl,
}: ProfileCardProps) {
  return (
    <div className="flex h-full flex-col items-center gap-4 border border-border bg-bg-elevated p-4 sm:p-6">
      <h3 className="break-words text-center text-xl font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-2xl">
        {nickname}
      </h3>

      {/* Photo wrapper — flex-1 means "absorb available height" so this
          card matches the height of a taller right column on desktop.
          On mobile (no right neighbour), the photo sizes naturally. */}
      <div className="relative flex w-full flex-1 items-center justify-center">
        <BracketFrame
          cornerSize="1.5rem"
          thickness="3px"
          inset="-6px"
          className="w-full max-w-[320px]"
        >
          <img
            src={profilePicUrl}
            alt={`${nickname} profile photo`}
            loading="lazy"
            decoding="async"
            className="block aspect-square w-full object-cover"
          />

          {/* Rating overhang.
              Positioning math: bottom-0 sets the pill's BOTTOM edge to align
              with the photo's bottom edge → pill is fully INSIDE the photo.
              translate-y-1/2 shifts down by 50% of pill height → pill's
              MIDPOINT now sits exactly on the photo's bottom edge.

              Visual treatment is tight on purpose:
                - No border (was reading as a separate UI element)
                - bg-bg/85 — partially translucent dark, integrates with the
                  photo where it overlaps rather than blocking it entirely
                - Tight padding so the rating image itself fills the pill
                - Subtle backdrop blur for legibility against busy photos */}
          {overallRatingImageUrl !== "" && (
            <div
              className={[
                "absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
                "rounded-full bg-bg/85 backdrop-blur-sm",
                // Tight horizontal padding, minimal vertical padding —
                // the rating image's height defines the pill's height.
                "px-3 py-1",
                // Above the bracket overlay
                "z-10",
              ].join(" ")}
            >
              <img
                src={overallRatingImageUrl}
                alt={`Overall rating for ${nickname}`}
                loading="lazy"
                decoding="async"
                className="block h-12 w-auto sm:h-14"
              />
            </div>
          )}
        </BracketFrame>
      </div>

      {/* Bottom spacer so the overhanging rating's lower half has room.
          Roughly half the rating image's height + the pill's vertical padding. */}
      <div aria-hidden className="h-7 sm:h-8" />
    </div>
  );
}
