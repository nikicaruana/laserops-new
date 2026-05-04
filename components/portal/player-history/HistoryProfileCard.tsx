import { BracketFrame } from "@/components/portal/BracketFrame";

/**
 * HistoryProfileCard
 * --------------------------------------------------------------------
 * Photo + nickname + current rank badge, wrapped in a yellow
 * corner-bracket frame. Mirrors the Looker dashboard's profile area:
 * photo on the left, rank badge on the right, nickname above.
 *
 * "Current" rank = the rank in the player's most recent match. As the
 * player levels up over time this badge updates to reflect their
 * latest level.
 */

type Props = {
  nickname: string;
  profilePicUrl: string;
  rankBadgeUrl: string;
  rankName: string;
};

export function HistoryProfileCard({
  nickname,
  profilePicUrl,
  rankBadgeUrl,
  rankName,
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
                alt={rankName}
                loading="lazy"
                className="block h-32 w-auto sm:h-40"
              />
              {rankName !== "" && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted sm:text-sm">
                  {rankName}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </BracketFrame>
  );
}
