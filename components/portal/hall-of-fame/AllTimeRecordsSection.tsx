import type { RecordCategory } from "@/lib/leaderboards/hall-of-fame";
import { RecordList } from "./RecordList";

/**
 * All-Time Records — single-game (one-off) bests across every match,
 * top 3 per metric. Two-column grid on desktop.
 */
export function AllTimeRecordsSection({
  categories,
}: {
  categories: RecordCategory[];
}) {
  if (categories.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-muted">
        All-time records will appear here once match data is available.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-5 text-center text-sm text-text-muted">
        The best single-game performances across every match played.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <RecordList key={c.key} label={c.label} note={c.note} entries={c.entries} />
        ))}
      </div>
    </div>
  );
}
