/**
 * components/admin/MatchStatusBadge.tsx
 * --------------------------------------------------------------------
 * Small coloured pill for a match's lifecycle status. Server-safe (no client
 * hooks). Shared by the Match Manager list and detail views.
 */
const STYLES: Record<string, string> = {
  scheduled: "border-sky-700 bg-sky-950/40 text-sky-300",
  confirmed: "border-violet-700 bg-violet-950/40 text-violet-300",
  live: "border-accent bg-accent/15 text-accent",
  completed: "border-border-strong bg-bg-elevated text-text-muted",
  cancelled: "border-red-800 bg-red-950/40 text-red-400",
};

export function MatchStatusBadge({ status }: { status: string | null }) {
  const s = status ?? "scheduled";
  return (
    <span
      className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] ${
        STYLES[s] ?? STYLES.completed
      }`}
    >
      {s === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      {s}
    </span>
  );
}
