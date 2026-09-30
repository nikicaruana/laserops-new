/**
 * components/portal/PlayerBar.tsx
 * --------------------------------------------------------------------
 * Player-fill bar shared by the games list, the view-game page and the admin
 * manage-game screen. The full width is the game's MAX capacity; a tick marks
 * the MINIMUM needed to confirm. Fill colour is status-coded: red below the
 * minimum, yellow once the minimum is met but the game isn't confirmed yet,
 * green once it's confirmed (or live).
 */
export function PlayerBar({ reg, min, max, status }: { reg: number; min: number; max: number | null; status: string | null }) {
  const confirmed = status === "confirmed" || status === "live";
  const cap = max && max > 0 ? max : Math.max(min, reg);
  const clampPct = (n: number) => Math.max(0, Math.min(100, n));
  const fillPct = clampPct((reg / Math.max(1, cap)) * 100);
  const minPct = clampPct((min / Math.max(1, cap)) * 100);
  const state = confirmed ? "confirmed" : reg >= min ? "quorum" : "below";
  const fill = state === "confirmed" ? "bg-success" : state === "quorum" ? "bg-accent" : "bg-danger";
  const rightColor = state === "confirmed" ? "text-success" : state === "quorum" ? "text-accent" : "text-danger";
  const rightLabel =
    state === "confirmed" ? "Confirmed" : state === "quorum" ? "Quorum met" : `${Math.max(0, min - reg)} more to confirm`;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        <span>
          {reg}/{min} players <span className="font-normal opacity-70">(minimum)</span>
          {max ? ` · max ${max}` : ""}
        </span>
        <span className={rightColor}>{rightLabel}</span>
      </div>
      <div className="relative mt-1 h-1.5 w-full bg-bg-overlay">
        <div className={`h-full ${fill} transition-[width] duration-300`} style={{ width: `${fillPct}%` }} />
        {minPct > 0 && minPct < 100 && (
          <span
            className="absolute top-[-2px] bottom-[-2px] w-px bg-[rgba(245,245,245,0.8)]"
            style={{ left: `${minPct}%` }}
            title={`Minimum to confirm: ${min}`}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
