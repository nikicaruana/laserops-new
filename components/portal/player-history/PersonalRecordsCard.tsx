import Link from "next/link";
import type { PersonalRecord } from "@/lib/player-history/engine";

/**
 * PersonalRecordsCard
 * --------------------------------------------------------------------
 * Player's all-time best in each tracked metric, with the match ID
 * where it was achieved. Mirrors the Looker dashboard's "Personal
 * Records" section: a yellow header, then a row of dark tiles each
 * with metric label + value + the match ID for traceability.
 *
 * Layout: 3 cols on mobile (2 rows of 3), 6 on desktop (1 row).
 *
 * Tied values: the engine takes the FIRST match in chronological order
 * with that value (i.e. the earliest achievement). Subsequent equal or
 * lower scores don't displace it.
 *
 * Niki feedback after pass 1:
 *   - Each tile should LINK to the match report for that record's
 *     match ID, scoped to this player. Whole tile is the link target,
 *     not just the match ID text — bigger hit area, more discoverable.
 *   - Match ID font got bumped up so the link target is more visually
 *     prominent (it was almost a footnote before).
 *
 * If a record has no matchId (shouldn't happen in practice but the
 * type allows it), the tile renders as a non-interactive div instead
 * — broken links are worse than non-links.
 */

type Props = {
  records: PersonalRecord[];
  /** Player's Ops Tag — passed through to the match report URL so
   *  the linked report opens with this player's stats expanded. */
  ops: string;
};

export function PersonalRecordsCard({ records, ops }: Props) {
  return (
    <section
      aria-label="Personal Records"
      className="overflow-hidden rounded-sm border border-border bg-bg-elevated"
    >
      <header className="bg-accent px-5 py-3 text-center sm:px-6 sm:py-4">
        <h2 className="text-lg font-extrabold uppercase tracking-tight text-bg sm:text-xl">
          Personal Records
        </h2>
      </header>
      <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4 lg:grid-cols-6">
        {records.map((record) => (
          <RecordTile key={record.metric} record={record} ops={ops} />
        ))}
      </div>
    </section>
  );
}

function RecordTile({ record, ops }: { record: PersonalRecord; ops: string }) {
  const tileContent = (
    <>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent sm:text-xs">
        {record.label}
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums text-text sm:text-3xl">
        {record.formatted}
      </p>
      {record.matchId !== "" && (
        // Match ID size bump: was text-[0.6rem]/0.65rem, now
        // text-xs/sm. Reads as a "go to this match" affordance rather
        // than a tiny annotation. Stays mono+tracked so it still
        // visually parses as an ID, not body copy.
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted sm:text-sm">
          {record.matchId}
        </p>
      )}
    </>
  );

  // Common card chrome — kept identical between link and non-link
  // branches so the visual is the same; only the wrapper element
  // changes.
  const cardClass =
    "flex h-full flex-col items-center gap-1 rounded-sm border border-accent/40 bg-bg p-3 text-center sm:p-4";

  if (record.matchId === "") {
    return <div className={cardClass}>{tileContent}</div>;
  }

  // URL-encoding the ops tag is defensive — most are plain ASCII but
  // a player with spaces or special chars in their nickname would
  // otherwise break the URL.
  const href = `/match-report?match=${encodeURIComponent(
    record.matchId,
  )}&player=${encodeURIComponent(ops)}`;

  return (
    <Link
      href={href}
      // Visual feedback on hover/focus tells users the tile is
      // interactive. Yellow border-darken + subtle bg-lift is the
      // same "interactive accent" pattern used in the Match Report
      // table rows for consistency.
      className={`${cardClass} transition-colors hover:border-accent hover:bg-bg-elevated focus-visible:border-accent focus-visible:bg-bg-elevated focus-visible:outline-none`}
      aria-label={`View match report for ${record.label} record (${record.formatted}) in match ${record.matchId}`}
    >
      {tileContent}
    </Link>
  );
}
