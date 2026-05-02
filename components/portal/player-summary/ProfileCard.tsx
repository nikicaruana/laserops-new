import { BracketFrame } from "@/components/portal/BracketFrame";
import {
  RATING_UNLOCK_MIN_MATCHES,
  RATING_UNLOCK_MIN_LEVEL,
} from "@/lib/player-stats/summary-top";

/**
 * ProfileCard — top-left card of the Player Summary.
 *
 * Layout (vertical):
 *   - Player nickname (top, centered)
 *   - Profile photo with yellow corner-bracket frame.
 *   - Rating image straddling the photo's bottom edge — its midpoint
 *     sits exactly on the edge so the top half overlaps the photo and the
 *     bottom half hangs into the card's space below.
 *   - Bottom band:
 *       - When the player's rating is unlocked: empty spacer giving the
 *         overhanging rating image room to breathe.
 *       - When the rating is locked: an explainer line telling the user
 *         how to unlock their rating. The 0-stars image (with a lock
 *         symbol) still renders normally — the text is supporting copy,
 *         not a replacement.
 *
 * Whether the rating is unlocked is computed in the projection layer
 * (lib/player-stats/summary-top.ts) using the unlock thresholds. The
 * thresholds are imported from there so the explainer text and the
 * unlock check can never drift out of sync.
 */

type ProfileCardProps = {
  nickname: string;
  profilePicUrl: string;
  /** URL to the rating image (5-stars / lock-icon variant / etc). */
  overallRatingImageUrl: string;
  /**
   * True when the player has met the rating unlock criteria. The rating
   * image is shown either way — the source already provides a "locked"
   * variant — but we add explainer copy underneath when locked.
   */
  ratingUnlocked: boolean;
};

export function ProfileCard({
  nickname,
  profilePicUrl,
  overallRatingImageUrl,
  ratingUnlocked,
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
                "px-3 py-1",
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

      {/* Bottom band.
          The rating pill overhangs the photo's bottom edge by ~half its
          height. Anything in this band needs to clear that overhang.
          When unlocked: empty space, just reserves room for the pill.
          When locked: the explainer text gets explicit top margin equal
          to the pill's lower-half height so it sits cleanly BELOW the
          pill rather than rendering behind it. */}
      {ratingUnlocked ? (
        <div aria-hidden className="h-7 sm:h-8" />
      ) : (
        <div className="flex flex-col items-center">
          {/* Spacer = pill's lower-half height. Lives outside the text
              so the text's own line-height isn't compressed. */}
          <div aria-hidden className="h-7 sm:h-8" />
          <p className="text-balance px-2 text-center text-[0.65rem] leading-snug text-text-subtle sm:text-xs">
            Ratings unlock after {RATING_UNLOCK_MIN_MATCHES} matches and
            reaching Level {RATING_UNLOCK_MIN_LEVEL}.
          </p>
        </div>
      )}
    </div>
  );
}
