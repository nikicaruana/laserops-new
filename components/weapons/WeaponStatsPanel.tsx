import type { Weapon } from "@/lib/cms/weapons";
import { formatFireRate } from "@/lib/cms/weapons";

/**
 * WeaponStatsPanel
 * --------------------------------------------------------------------
 * Displays the stats for whichever gun is currently centred in its
 * gallery.
 *
 * Default layout (top-down):
 *   [ GUN NAME, big, top centred                                  ]
 *   [ MAG SIZE | DAMAGE | RELOAD | FIRE RATE  ]   ← 1x4 all viewports
 *   [ UNLOCK TIER       | DIFFICULTY          ]   ← 2 across (hidden in compare)
 *
 * Inverted layout (bottom-up — used by gallery B in compare mode):
 *   [ MAG SIZE | DAMAGE | RELOAD | FIRE RATE  ]
 *   [ GUN NAME                                ]
 * The gun image card sits BELOW this in the inverted gallery, so the
 * visual reads as a true mirror of the top gallery.
 *
 * --------------------------------------------------------------------
 * NEW IN PASS 15
 *   - 4 primary stats now render as a single row (1x4) on every
 *     viewport, including mobile. Was 2x2 on mobile. Tighter tiles
 *     so each fits within ~22% of viewport width.
 *   - Inverted layout flips internal order: tiles on top, name below.
 *     Used by gallery B in compare mode for true mirror.
 *   - Ties now highlight BOTH sides instead of neither — the parent
 *     can pass "win" or "tie" and the tile lights up in either case.
 * --------------------------------------------------------------------
 */

/**
 * Per-stat winner flags. `null` for the panel when not in compare
 * mode or when no other gun to compare against.
 *
 * Each entry's value:
 *   - "win"  → highlight (this gun wins this stat)
 *   - "tie"  → highlight (both sides tied — show on both)
 *   - "lose" → render normal
 *
 * Ties highlighting both panels reflects the comparison reality:
 * neither gun loses, so neither tile should look "lost." Visual
 * treatment for tie is identical to win.
 */
export type StatWinner = "win" | "tie" | "lose";
export type StatWinners = {
  magSize: StatWinner;
  damage: StatWinner;
  reload: StatWinner;
  fireRate: StatWinner;
};

type Props = {
  weapon: Weapon | null;
  ariaLabel?: string;
  /** When true, hides the Unlock Tier / Difficulty secondary row. */
  hideSecondary?: boolean;
  /** When true, internal order flips — tiles on top, name below.
   *  Used by gallery B in compare mode for mirror layout. */
  inverted?: boolean;
  winners?: StatWinners | null;
};

export function WeaponStatsPanel({
  weapon,
  ariaLabel,
  hideSecondary,
  inverted,
  winners,
}: Props) {
  // Pre-build the building blocks so we can flip their order based
  // on the `inverted` prop without duplicating the JSX.
  const nameBlock = (
    <h3 className="text-center text-xl font-extrabold tracking-tight text-text sm:text-2xl lg:text-3xl">
      {weapon?.name ?? "—"}
    </h3>
  );

  const primaryStatsBlock = (
    // 1x4 on every viewport now (was 2x2 on mobile). Each tile gets
    // ~22% of viewport width minus gaps, plenty for typical 2-3 digit
    // stat values at our font size.
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      <StatTile
        label="Mag Size"
        value={fmtNum(weapon?.magSize)}
        winner={winners?.magSize}
      />
      <StatTile
        label="Damage"
        value={fmtNum(weapon?.damage)}
        winner={winners?.damage}
      />
      <StatTile
        label="Reload"
        value={
          weapon && weapon.reloadSeconds > 0
            ? `${formatNumberShort(weapon.reloadSeconds)}s`
            : "—"
        }
        winner={winners?.reload}
      />
      <StatTile
        label="Fire Rate"
        value={weapon ? formatFireRate(weapon.fireRate) : "—"}
        winner={winners?.fireRate}
      />
    </div>
  );

  const secondaryBlock = !hideSecondary && (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <SecondaryTile
        label="Unlock Tier"
        value={
          weapon?.unlockTier && weapon.unlockTier !== ""
            ? weapon.unlockTier
            : "—"
        }
      />
      <SecondaryTile
        label="Difficulty"
        value={
          weapon?.difficulty && weapon.difficulty !== ""
            ? weapon.difficulty
            : "—"
        }
        valueColorClass={getDifficultyColorClass(weapon?.difficulty)}
      />
    </div>
  );

  return (
    <div
      aria-live="polite"
      aria-label={ariaLabel ?? "Selected weapon stats"}
      className="flex flex-col items-stretch gap-2 sm:gap-3"
    >
      {inverted ? (
        // Mirror order: tiles → name → secondary (if shown).
        // The card image lives outside this panel — gallery component
        // arranges it below this whole block in inverted mode.
        <>
          {primaryStatsBlock}
          {nameBlock}
          {secondaryBlock}
        </>
      ) : (
        <>
          {nameBlock}
          {primaryStatsBlock}
          {secondaryBlock}
        </>
      )}
    </div>
  );
}

/* ---------- Primary stat tile ---------- */

/**
 * Big numeric stat tile. Highlight states:
 *   - "win" or "tie": full yellow border, tinted bg, glow
 *   - "lose" or undefined: default left-stripe + dark bg
 *
 * Tighter padding than pass 14 (px-1 py-2 vs px-2 py-2) since a 1x4
 * row on mobile means each tile is narrower; we need every pixel for
 * the value text. Value font size also reduced one step on mobile.
 */
function StatTile({
  label,
  value,
  winner,
}: {
  label: string;
  value: string;
  winner?: StatWinner;
}) {
  // "win" and "tie" both visually highlight — they represent
  // "this stat is at least as good as the other gun's." Only "lose"
  // and undefined render in default state.
  const isHighlighted = winner === "win" || winner === "tie";

  return (
    <div
      className={[
        "px-1 py-2 text-center transition-colors sm:px-2 sm:py-3",
        isHighlighted
          ? "border-2 border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,222,0,0.3)]"
          : "border-l-4 border-l-accent bg-bg-elevated",
      ].join(" ")}
    >
      {/* Smaller label font on mobile (text-[0.55rem]) so longer labels
          like "Fire Rate" wrap onto two lines without overflowing the
          narrow tile. tracking-[0.1em] also tightened from 0.14em to
          buy a few more pixels of horizontal room. */}
      <p className="text-[0.55rem] font-bold uppercase tracking-[0.1em] text-text-muted sm:text-[0.7rem] sm:tracking-[0.14em]">
        {label}
      </p>
      {/* text-xl on mobile (was text-2xl) — smaller tiles need smaller
          numbers. text-3xl on sm+ keeps the headline feel on tablets
          and desktop. */}
      <p className="mt-1 font-mono text-xl font-extrabold tabular-nums text-accent sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

/* ---------- Secondary metadata tile ---------- */

function SecondaryTile({
  label,
  value,
  valueColorClass,
}: {
  label: string;
  value: string;
  valueColorClass?: string;
}) {
  return (
    <div className="border border-border bg-bg-elevated/60 px-2 py-2 text-center sm:px-3 sm:py-3">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted sm:text-[0.7rem]">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-base font-bold sm:text-lg",
          valueColorClass ?? "text-text",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

/* ---------- Difficulty colour mapping ---------- */

function getDifficultyColorClass(difficulty: string | undefined): string | undefined {
  if (!difficulty) return undefined;
  const norm = difficulty.trim().toLowerCase();
  switch (norm) {
    case "beginner":
      return "text-green-400";
    case "intermediate":
      return "text-yellow-300";
    case "advanced":
      return "text-red-400";
    default:
      return undefined;
  }
}

/* ---------- Number formatting ---------- */

function fmtNum(value: number | undefined): string {
  if (value === undefined || value === 0) return "—";
  return formatNumberShort(value);
}

function formatNumberShort(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1).replace(/\.0$/, "");
}
