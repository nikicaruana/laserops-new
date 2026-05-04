import type { GameInfo } from "@/lib/cms/game-id-map";
import { cn } from "@/lib/cn";

/**
 * MatchOverview
 * --------------------------------------------------------------------
 * Top card of a match report. Shows:
 *   - Match ID + date (top row)
 *   - Round wins per team — large central display, winner highlighted yellow
 *   - Team rating scores — winner highlighted yellow
 *   - Winning + losing team badges (the badges already include team
 *     color labels, so we don't repeat them as text)
 *
 * Handles both 2-team and 3-team matches:
 *   - 2-team: typical "winner | : | loser" hero layout
 *   - 3-team: shows all three teams in a triangle/list
 */

type Props = {
  game: GameInfo;
  matchDate: string;
};

export function MatchOverview({ game, matchDate }: Props) {
  const teams = activeTeams(game);

  return (
    <div className="rounded-sm border border-border bg-bg-elevated p-5 sm:p-7">
      {/* Top meta row: match id + date + flags */}
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4 sm:mb-6 sm:pb-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
              Match
            </p>
            <p className="font-mono text-lg font-bold tabular-nums text-text sm:text-xl">
              {game.matchId}
            </p>
          </div>
          {matchDate !== "" && (
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-text-subtle">
                Date
              </p>
              <p className="font-mono text-sm font-bold tabular-nums text-text-muted sm:text-base">
                {matchDate}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {game.isDoubleXp && <Flag label="Double XP" tone="accent" />}
          {game.isPrivate && <Flag label="Private" tone="muted" />}
        </div>
      </div>

      {/* Hero layout: scores big, badges to the side */}
      {teams.length === 2 ? (
        <TwoTeamLayout game={game} />
      ) : (
        <MultiTeamLayout game={game} teams={teams} />
      )}
    </div>
  );
}

/* ---------- 2-team hero layout ---------- */

function TwoTeamLayout({ game }: { game: GameInfo }) {
  // Convention: winning team on left, losing team on right, : in the middle.
  const hasOutcome =
    game.winningTeam !== "" && game.losingTeam !== "" && game.winningTeam !== game.losingTeam;

  if (hasOutcome) {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
        <TeamColumn
          rounds={game.winningTeamRounds}
          rating={game.winningTeamRating}
          badgeUrl={game.winningTeamBadge}
          isWinner
        />
        <ScoreDivider />
        <TeamColumn
          rounds={game.losingTeamRounds}
          rating={game.losingTeamRating}
          badgeUrl={game.losingTeamBadge}
        />
      </div>
    );
  }

  // Fallback: just two teams without a clean winner (rare, but defend).
  const active = activeTeams(game);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
      <TeamColumn
        rounds={active[0]?.roundWins ?? 0}
        rating={active[0]?.rating ?? 0}
        badgeUrl=""
      />
      <ScoreDivider />
      <TeamColumn
        rounds={active[1]?.roundWins ?? 0}
        rating={active[1]?.rating ?? 0}
        badgeUrl=""
      />
    </div>
  );
}

/**
 * Just a colon between the two team columns. Replaces the previous
 * "ROUNDS" label + colon — the colon alone is enough to read as a
 * versus indicator and the surrounding context (rounds being the
 * primary number) makes it obvious what's being divided.
 */
function ScoreDivider() {
  return (
    <div className="flex flex-col items-center">
      <span aria-hidden className="text-3xl font-bold text-text-subtle sm:text-5xl">
        :
      </span>
    </div>
  );
}

function TeamColumn({
  rounds,
  rating,
  badgeUrl,
  isWinner = false,
}: {
  rounds: number;
  rating: number;
  badgeUrl: string;
  isWinner?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      {/* Badge — already includes the team color label graphically, so
          we don't render a redundant text label below it. */}
      {badgeUrl !== "" && (
        <img
          src={badgeUrl}
          alt={isWinner ? "Winning team badge" : "Losing team badge"}
          loading="lazy"
          className="block h-16 w-auto sm:h-20"
        />
      )}
      {/* Rounds number — yellow when this team is the winner. */}
      <p
        className={cn(
          "font-mono text-4xl font-bold tabular-nums sm:text-5xl",
          isWinner ? "text-accent" : "text-text",
        )}
      >
        {rounds}
      </p>
      {/* Rating — bumped up a step in size, also yellow on the winner. */}
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle sm:text-sm">
        Rating:{" "}
        <span
          className={cn(
            "font-mono text-sm sm:text-base",
            isWinner ? "text-accent" : "text-text-muted",
          )}
        >
          {rating.toLocaleString("en-US")}
        </span>
      </p>
    </div>
  );
}

/* ---------- 3-team layout (unchanged shape, minor color tweaks) ---------- */

function MultiTeamLayout({ game, teams }: { game: GameInfo; teams: ActiveTeam[] }) {
  // Determine which team color won (highest round count). All winning
  // team highlights flow from this.
  const maxRounds = Math.max(...teams.map((t) => t.roundWins));
  void game;
  return (
    <div className={cn("grid gap-4 sm:gap-6", `sm:grid-cols-${teams.length}`)}>
      {teams.map((t) => {
        const isWinner = t.roundWins === maxRounds;
        return (
          <div
            key={t.color}
            className="flex flex-col items-center gap-2 border border-border/60 bg-bg p-4"
          >
            <p
              className={cn(
                "font-mono text-3xl font-bold tabular-nums sm:text-4xl",
                isWinner ? "text-accent" : "text-text",
              )}
            >
              {t.roundWins}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-subtle sm:text-sm">
              Rating:{" "}
              <span
                className={cn(
                  "font-mono text-sm sm:text-base",
                  isWinner ? "text-accent" : "text-text-muted",
                )}
              >
                {t.rating.toLocaleString("en-US")}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Helpers ---------- */

type ActiveTeam = {
  color: TeamColor;
  roundWins: number;
  rating: number;
};

type TeamColor = "Red" | "Blue" | "Yellow";

function activeTeams(game: GameInfo): ActiveTeam[] {
  const candidates: ActiveTeam[] = [
    { color: "Red", roundWins: game.teams.red.roundWins, rating: game.teams.red.rating },
    { color: "Blue", roundWins: game.teams.blue.roundWins, rating: game.teams.blue.rating },
    { color: "Yellow", roundWins: game.teams.yellow.roundWins, rating: game.teams.yellow.rating },
  ];
  return candidates.filter((t) => t.roundWins > 0 || t.rating > 0);
}

function Flag({ label, tone }: { label: string; tone: "accent" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-1",
        "text-[0.6rem] font-bold uppercase tracking-[0.14em]",
        tone === "accent" ? "bg-accent text-bg" : "border border-border-strong text-text-muted",
      )}
    >
      {label}
    </span>
  );
}
