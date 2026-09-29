import { cn } from "@/lib/cn";

/**
 * Placing – a compact medal for a ranked placement. Gold/silver/bronze for the
 * podium, muted #N for 4th onward. Shared by the achievements list rows and the
 * weapon-mastery accordion.
 */
export function Placing({ rank, className }: { rank: number; className?: string }) {
  const label = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `#${rank}`;
  const styles =
    rank === 1
      ? "border-accent bg-accent/15 text-accent"
      : rank === 2
        ? "border-slate-400/50 bg-slate-400/10 text-slate-300"
        : rank === 3
          ? "border-amber-600/50 bg-amber-600/10 text-amber-500"
          : "border-border bg-bg-elevated text-text-muted";
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border font-mono text-[0.7rem] font-bold tabular-nums sm:h-10 sm:w-10 sm:text-xs",
        styles,
        className,
      )}
      aria-label={`Placed ${label}`}
    >
      {label}
    </span>
  );
}
