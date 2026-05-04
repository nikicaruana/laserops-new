import { BracketFrame } from "@/components/portal/BracketFrame";

/**
 * HistoryProfileCard
 * --------------------------------------------------------------------
 * Photo + nickname + current rank badge + level label, wrapped in a
 * yellow corner-bracket frame. Mirrors the Looker dashboard's profile
 * area: photo on the left, rank badge on the right, nickname above.
 *
 * "Current" rank/level = the rank/level in the player's most recent
 * match. As the player levels up over time this badge and label
 * update to reflect their latest level.
 *
 * Note: previously this card showed the rank NAME under the badge
 * (e.g. "OPERATIVE"). Niki's feedback after pass 1: show the level
 * NUMBER instead, since the rank icon already implies the rank name
 * visually and the number is the more useful data point.
 */

type Props = {
  nickname: string;
  profilePicUrl: string;
  rankBadgeUrl: string;
  rankName: string;
  /** Most recent level — rendered as "Level N" under the badge. */
  currentLevel: number;
};

export function HistoryProfileCard({
  nickname,
  profilePicUrl,
  rankBadgeUrl,
  rankName,
  currentLevel,
}: Props) {
  return (
    <BracketFrame cornerSize="1.25rem" thickness="3px" inset="-0.5rem">
      <div className="flex flex-col items-center gap-3 bg-bg-elevated p-5 sm:p-6">
        <p className="text-2xl font-extrabold tracking-tight text-text [overflow-wrap:anywhere] sm:text-3xl">
          {nickname}
        </p>
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {profilePicUrl !== "" && (
            <img
              src={profilePicUrl}
              alt={`${nickname} profile photo`}
              loading="lazy"
              className="block aspect-square w-32 object-cover sm:w-40"
            />
          )}
          {rankBadgeUrl !== "" && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={rankBadgeUrl}
                // alt still uses the rank name for screen readers — they
                // get the semantic info even though sighted users see
                // the level number below.
                alt={rankName}
                loading="lazy"
                className="block h-32 w-auto sm:h-40"
              />
              {currentLevel > 0 && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted sm:text-sm">
                  Level {currentLevel}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </BracketFrame>
  );
}
