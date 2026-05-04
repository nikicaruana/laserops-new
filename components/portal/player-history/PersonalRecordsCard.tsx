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
 */

type Props = {
  records: PersonalRecord[];
};

export function PersonalRecordsCard({ records }: Props) {
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
          <RecordTile key={record.metric} record={record} />
        ))}
      </div>
    </section>
  );
}

function RecordTile({ record }: { record: PersonalRecord }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-sm border border-accent/40 bg-bg p-3 text-center sm:p-4">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent sm:text-xs">
        {record.label}
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums text-text sm:text-3xl">
        {record.formatted}
      </p>
      {record.matchId !== "" && (
        <p className="text-[0.6rem] font-mono uppercase tracking-[0.1em] text-text-subtle sm:text-[0.65rem]">
          {record.matchId}
        </p>
      )}
    </div>
  );
}
