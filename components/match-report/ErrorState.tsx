/**
 * MatchReportErrorState
 * --------------------------------------------------------------------
 * Rendered when the engine returns a non-ok result. Shows different
 * copy depending on which kind of failure happened so the user can
 * actually act on the message.
 */

type Reason = "match-not-found" | "no-players" | "data-fetch-failed";

type Props = {
  reason: Reason;
  matchId: string;
};

export function MatchReportErrorState({ reason, matchId }: Props) {
  const copy = COPY_BY_REASON[reason];
  return (
    <div className="rounded-sm border border-dashed border-border bg-bg-elevated px-6 py-14 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
        {copy.title}
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-text-muted sm:text-base">
        {copy.body(matchId)}
      </p>
    </div>
  );
}

const COPY_BY_REASON: Record<
  Reason,
  { title: string; body: (matchId: string) => string }
> = {
  "match-not-found": {
    title: "Match Not Found",
    body: (matchId) =>
      `No match with ID "${matchId}" exists in the records yet. Double-check the ID — recent matches appear in the search dropdown above.`,
  },
  "no-players": {
    title: "Match Has No Player Data",
    body: (matchId) =>
      `Match "${matchId}" exists but has no player records. The data may not have synced yet — try again in a few minutes.`,
  },
  "data-fetch-failed": {
    title: "Couldn't Load Match Data",
    body: () =>
      "We hit an error fetching the match data. Refresh the page or try again in a moment.",
  },
};
