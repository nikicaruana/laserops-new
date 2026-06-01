"use client";

import { useId, useRef, useState, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  findPlayerByOpsTag,
  type PlayerStatsRaw,
} from "@/lib/player-stats/shared";
import {
  projectComparePlayer,
  computeWinners,
  type ComparePlayerData,
  type StatWinner,
} from "@/lib/player-stats/compare";
import {
  ACCOLADES,
  type AccoladeDefinition,
  type AccoladeTier,
} from "@/lib/player-stats/summary-accolades";
import { RatingPill } from "@/components/portal/player-summary/RatingPill";
import { AnimatedValue } from "@/components/portal/player-summary/AnimatedValue";

/* ============================================================
   Main component
   ============================================================ */

type Props = {
  allRows: PlayerStatsRaw[];
  /** lowercased-nickname → unique-gun-count, computed server-side. */
  uniqueGunsMap: Record<string, number>;
};

export function CompareView({ allRows, uniqueGunsMap }: Props) {
  const searchParams = useSearchParams();
  const opsParam = searchParams.get("ops") ?? "";
  const compareParam = searchParams.get("compare") ?? "";

  // All known nicknames for search autocomplete.
  const knownNicknames = useMemo(
    () =>
      Array.from(
        new Map(
          allRows
            .map((r) => r.Player_Stats_Nickname.trim())
            .filter(Boolean)
            .map((n) => [n.toLowerCase(), n]),
        ).values(),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [allRows],
  );

  // Look up both players from the URL params.
  const rowA = useMemo(
    () => (opsParam ? findPlayerByOpsTag(allRows, opsParam) : undefined),
    [allRows, opsParam],
  );
  const rowB = useMemo(
    () => (compareParam ? findPlayerByOpsTag(allRows, compareParam) : undefined),
    [allRows, compareParam],
  );

  // Project into compare shapes, including unique-guns count.
  const playerA = useMemo(
    () =>
      rowA
        ? projectComparePlayer(
            rowA,
            uniqueGunsMap[rowA.Player_Stats_Nickname.trim().toLowerCase()] ?? 0,
          )
        : null,
    [rowA, uniqueGunsMap],
  );
  const playerB = useMemo(
    () =>
      rowB
        ? projectComparePlayer(
            rowB,
            uniqueGunsMap[rowB.Player_Stats_Nickname.trim().toLowerCase()] ?? 0,
          )
        : null,
    [rowB, uniqueGunsMap],
  );

  // Compute winners only when both players are present.
  const winners = useMemo(
    () => (playerA && playerB ? computeWinners(playerA, playerB) : null),
    [playerA, playerB],
  );

  // ── No main player selected ──────────────────────────────
  if (!opsParam) {
    return (
      <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Select a player to compare
        </p>
        <p className="mt-2 text-sm text-text-subtle">
          Enter your ops tag in the search field above, then choose an
          opponent from the search bar on this page.
        </p>
      </div>
    );
  }

  if (opsParam && !playerA) {
    return (
      <div className="border border-border bg-bg-elevated px-6 py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">
          Player not found
        </p>
        <p className="mt-2 text-sm text-text-subtle">
          No player matches &ldquo;{opsParam}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* ── Compare search bar ─────────────────────────────────
          Always shown. Pre-fills from ?compare= param.
          Main player search is in the shell (above sub-tabs). */}
      <div>
        <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-muted">
          Compare against
        </p>
        <CompareSearch
          knownNicknames={knownNicknames}
          currentCompareTag={compareParam}
        />
      </div>

      {/* ── No compare player yet ──────────────────────────── */}
      {!playerB && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {playerA && (
            <div className="flex flex-col gap-2 sm:gap-3">
              <ProfileCell data={playerA} />
              <LevelCell data={playerA} />
            </div>
          )}
          <div className="flex items-center justify-center border border-dashed border-border bg-bg-elevated/40 px-4 py-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Search for a player above to start comparing
            </p>
          </div>
        </div>
      )}

      {/* ── Full comparison grid ───────────────────────────── */}
      {playerA && playerB && winners && (
        <>
          {/* Profile */}
          <TwoCol>
            <ProfileCell data={playerA} />
            <ProfileCell data={playerB} />
          </TwoCol>

          {/* Level */}
          <TwoCol>
            <LevelCell data={playerA} />
            <LevelCell data={playerB} />
          </TwoCol>

          {/* ── Stats section ──────────────────────────────────── */}
          <SectionHeader title="Stats" />

          <StatRow
            label="Matches Played"
            a={{ primary: playerA.matchesPlayed.toLocaleString("en-US") }}
            b={{ primary: playerB.matchesPlayed.toLocaleString("en-US") }}
            winner={winners.matchesPlayed}
          />

          <StatRow
            label="Guns Used"
            a={{ primary: String(playerA.uniqueGunsUsed) }}
            b={{ primary: String(playerB.uniqueGunsUsed) }}
            winner={winners.uniqueGuns}
          />

          <StatRow
            label="Matches Won"
            a={{
              primary: playerA.matchesWon.toLocaleString("en-US"),
              secondary: `Win Rate ${Math.round(playerA.matchWinRatePct)}%`,
              ratingUrl: playerA.matchWinRatingUrl,
            }}
            b={{
              primary: playerB.matchesWon.toLocaleString("en-US"),
              secondary: `Win Rate ${Math.round(playerB.matchWinRatePct)}%`,
              ratingUrl: playerB.matchWinRatingUrl,
            }}
            // Compare by win rate — that's the rated metric, same as StatCard
            winner={winners.matchWinRate}
          />

          <StatRow
            label="Rounds Won"
            a={{
              primary: playerA.roundsWon.toLocaleString("en-US"),
              secondary: `Win Rate ${Math.round(playerA.roundsWinRatePct)}%`,
              ratingUrl: playerA.roundsWinRatingUrl,
            }}
            b={{
              primary: playerB.roundsWon.toLocaleString("en-US"),
              secondary: `Win Rate ${Math.round(playerB.roundsWinRatePct)}%`,
              ratingUrl: playerB.roundsWinRatingUrl,
            }}
            winner={winners.roundsWinRate}
          />

          <StatRow
            label="Kills / Match"
            a={{
              primary: Math.round(playerA.killsPerMatch).toLocaleString("en-US"),
              secondary: `Total ${playerA.killsTotal.toLocaleString("en-US")}`,
              ratingUrl: playerA.killsRatingUrl,
            }}
            b={{
              primary: Math.round(playerB.killsPerMatch).toLocaleString("en-US"),
              secondary: `Total ${playerB.killsTotal.toLocaleString("en-US")}`,
              ratingUrl: playerB.killsRatingUrl,
            }}
            winner={winners.killsPerMatch}
          />

          <StatRow
            label="Damage / Match"
            a={{
              primary: Math.round(playerA.damagePerMatch).toLocaleString("en-US"),
              secondary: `Total ${playerA.damageTotal.toLocaleString("en-US")}`,
              ratingUrl: playerA.damageRatingUrl,
            }}
            b={{
              primary: Math.round(playerB.damagePerMatch).toLocaleString("en-US"),
              secondary: `Total ${playerB.damageTotal.toLocaleString("en-US")}`,
              ratingUrl: playerB.damageRatingUrl,
            }}
            winner={winners.damagePerMatch}
          />

          <StatRow
            label="Score / Match"
            a={{
              primary: Math.round(playerA.scorePerMatch).toLocaleString("en-US"),
              secondary: `Total ${playerA.scoreTotal.toLocaleString("en-US")}`,
              ratingUrl: playerA.scoreRatingUrl,
            }}
            b={{
              primary: Math.round(playerB.scorePerMatch).toLocaleString("en-US"),
              secondary: `Total ${playerB.scoreTotal.toLocaleString("en-US")}`,
              ratingUrl: playerB.scoreRatingUrl,
            }}
            winner={winners.scorePerMatch}
          />

          <StatRow
            label="Accuracy"
            a={{
              primary: `${playerA.accuracyPct.toFixed(1)}%`,
              ratingUrl: playerA.accuracyRatingUrl,
            }}
            b={{
              primary: `${playerB.accuracyPct.toFixed(1)}%`,
              ratingUrl: playerB.accuracyRatingUrl,
            }}
            winner={winners.accuracy}
          />

          <StatRow
            label="K/D Ratio"
            a={{ primary: playerA.kd.toFixed(2), ratingUrl: playerA.kdRatingUrl }}
            b={{ primary: playerB.kd.toFixed(2), ratingUrl: playerB.kdRatingUrl }}
            winner={winners.kd}
          />

          <StatRow
            label="Avg Match Rating"
            a={{
              primary: playerA.matchRating.toFixed(2),
              ratingUrl: playerA.matchRatingUrl,
            }}
            b={{
              primary: playerB.matchRating.toFixed(2),
              ratingUrl: playerB.matchRatingUrl,
            }}
            winner={winners.matchRating}
          />

          {/* ── Accolades section ──────────────────────────────── */}
          <SectionHeader title="Accolades" />

          {/* Total accolades */}
          <StatRow
            label="Total Accolades"
            a={{ primary: playerA.totalAccolades.toLocaleString("en-US") }}
            b={{ primary: playerB.totalAccolades.toLocaleString("en-US") }}
            winner={winners.totalAccolades}
          />

          {/* Per-tier accolade cards */}
          {([100, 75, 50] as AccoladeTier[]).map((tier) => {
            const tierDefs = ACCOLADES.filter((a) => a.tier === tier);
            // Only show accolades where at least one player has earned ≥1
            const visibleDefs = tierDefs.filter(
              (def) =>
                (playerA.accoladesByName[def.name] ?? 0) > 0 ||
                (playerB.accoladesByName[def.name] ?? 0) > 0,
            );
            if (visibleDefs.length === 0) return null;
            const tierNumber = tier === 100 ? 1 : tier === 75 ? 2 : 3;
            return (
              <div key={tier} className="flex flex-col gap-2 sm:gap-3">
                <TierHeader tier={tier} tierNumber={tierNumber} />
                {visibleDefs.map((def) => (
                  <AccoladeRow
                    key={def.name}
                    def={def}
                    countA={playerA.accoladesByName[def.name] ?? 0}
                    countB={playerB.accoladesByName[def.name] ?? 0}
                    winner={winners.accolades[def.name] ?? "tie"}
                  />
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ============================================================
   Compare search (secondary — targets ?compare= param)
   ============================================================ */

function CompareSearch({
  knownNicknames,
  currentCompareTag,
}: {
  knownNicknames: string[];
  currentCompareTag: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [input, setInput] = useState(currentCompareTag);
  const [error, setError] = useState<string | null>(null);
  const datalistId = useId();
  const inputId = useId();

  useEffect(() => {
    setInput(currentCompareTag);
    setError(null);
  }, [currentCompareTag]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    const next = new URLSearchParams(searchParams.toString());

    if (trimmed === "") {
      next.delete("compare");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      return;
    }

    const canonical = knownNicknames.find(
      (n) => n.toLowerCase() === trimmed.toLowerCase(),
    );

    if (!canonical) {
      setError("Player not found");
      return;
    }

    setError(null);
    next.set("compare", canonical);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
      role="search"
      aria-label="Search for a player to compare"
    >
      <label htmlFor={inputId} className="sr-only">
        Compare with player ops tag
      </label>
      <div className="relative flex-1">
        <input
          id={inputId}
          type="search"
          list={datalistId}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Enter opponent ops tag…"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error !== null}
          className={cn(
            "w-full border bg-bg-overlay px-4 py-2.5 text-sm text-text",
            "rounded-sm placeholder:text-text-subtle",
            "transition-colors focus:outline-none focus:ring-1",
            error
              ? "border-[#a83838] focus:border-[#c44d4d] focus:ring-[#c44d4d]"
              : "border-border-strong focus:border-accent focus:ring-accent",
          )}
        />
        <datalist id={datalistId}>
          {knownNicknames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <button
        type="submit"
        className={cn(
          "shrink-0 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em]",
          "bg-accent text-bg transition-colors hover:bg-accent-soft",
          "rounded-sm",
        )}
      >
        Compare
      </button>
      {error && (
        <span
          role="alert"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c44d4d] sm:self-center"
        >
          {error}
        </span>
      )}
    </form>
  );
}

/* ============================================================
   Layout helpers
   ============================================================ */

/** Side-by-side wrapper for two cells. */
function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:gap-3">{children}</div>;
}

/**
 * Returns the highlight class for a cell based on whether this side wins.
 * Winner/tie → yellow accent border + tinted bg.
 * Loser → standard dark card chrome.
 */
function cellHighlight(side: "a" | "b", winner: StatWinner): string {
  const isWinner = winner === side || winner === "tie";
  return isWinner
    ? "border-2 border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(255,222,0,0.2)]"
    : "border border-border bg-bg-elevated";
}

/* ============================================================
   Profile cell
   ============================================================ */

function ProfileCell({ data }: { data: ComparePlayerData }) {
  return (
    <div className="flex flex-col items-center gap-2 border border-border bg-bg-elevated p-3 sm:p-4">
      {/* Profile photo — square, fills cell width */}
      <img
        src={data.profilePicUrl}
        alt={`${data.nickname} profile photo`}
        loading="lazy"
        decoding="async"
        className="block aspect-square w-full max-w-[120px] object-cover"
      />

      {/* Nickname */}
      <p className="break-words text-center text-sm font-extrabold leading-tight text-text [overflow-wrap:anywhere] sm:text-base">
        {data.nickname}
      </p>

      {/* Rating — inline (not overhanging) in the compare layout */}
      {data.overallRatingImageUrl !== "" && (
        <RatingPill
          ratingImageUrl={data.overallRatingImageUrl}
          pillClassName="flex items-center justify-center rounded-full bg-bg/80 px-2 py-0.5"
          iconImgClassName="block h-3 w-auto sm:h-3.5"
          alt={`Overall rating for ${data.nickname}`}
        />
      )}
    </div>
  );
}

/* ============================================================
   Level cell (no progress bar)
   ============================================================ */

function LevelCell({ data }: { data: ComparePlayerData }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-border bg-bg-elevated p-3 sm:p-4">
      {data.rankBadgeUrl !== "" && (
        <img
          src={data.rankBadgeUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="h-10 w-auto sm:h-12"
        />
      )}
      <span className="text-center text-base font-extrabold tracking-tight text-text sm:text-lg">
        {data.levelDisplay}
      </span>
    </div>
  );
}

/* ============================================================
   Stat row — two cells, one per player, with winner highlight
   ============================================================ */

type StatCellDef = {
  primary: string;
  secondary?: string;
  ratingUrl?: string;
};

function StatRow({
  label,
  a,
  b,
  winner,
}: {
  label: string;
  a: StatCellDef;
  b: StatCellDef;
  winner: StatWinner;
}) {
  return (
    <TwoCol>
      <StatCell label={label} cell={a} highlight={cellHighlight("a", winner)} />
      <StatCell label={label} cell={b} highlight={cellHighlight("b", winner)} />
    </TwoCol>
  );
}

function StatCell({
  label,
  cell,
  highlight,
}: {
  label: string;
  cell: StatCellDef;
  highlight: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 p-3 text-center transition-colors sm:gap-2 sm:p-4",
        highlight,
      )}
    >
      {/* Label */}
      <span className="text-[0.6rem] font-bold uppercase leading-tight tracking-[0.14em] text-text-muted sm:text-[0.65rem]">
        {label}
      </span>

      {/* Primary value — accent yellow, monospace */}
      <AnimatedValue
        value={cell.primary}
        className="font-mono text-xl font-extrabold leading-none tabular-nums text-accent sm:text-2xl"
      />

      {/* Secondary line (e.g. "Win Rate 65%" or "Total 1,234") */}
      {cell.secondary && (
        <span className="text-[0.65rem] font-semibold tabular-nums text-text-muted sm:text-xs">
          {cell.secondary}
        </span>
      )}

      {/* Inline rating icons — compact, no overhang */}
      {cell.ratingUrl && cell.ratingUrl !== "" && (
        <RatingPill
          ratingImageUrl={cell.ratingUrl}
          pillClassName="mt-0.5 flex items-center justify-center rounded-full bg-bg/70 px-1.5 py-0.5"
          iconImgClassName="block h-2.5 w-auto sm:h-3"
        />
      )}
    </div>
  );
}

/* ============================================================
   Accolade row
   ============================================================ */

function AccoladeRow({
  def,
  countA,
  countB,
  winner,
}: {
  def: AccoladeDefinition;
  countA: number;
  countB: number;
  winner: StatWinner;
}) {
  return (
    <TwoCol>
      <AccoladeCell
        def={def}
        count={countA}
        highlight={cellHighlight("a", winner)}
      />
      <AccoladeCell
        def={def}
        count={countB}
        highlight={cellHighlight("b", winner)}
      />
    </TwoCol>
  );
}

function AccoladeCell({
  def,
  count,
  highlight,
}: {
  def: AccoladeDefinition;
  count: number;
  highlight: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 p-3 transition-colors sm:p-4",
        highlight,
      )}
    >
      <img
        src={def.iconPath}
        alt={`${def.name} accolade`}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full max-w-[5rem] sm:max-w-[7rem]"
      />
      <div className="rounded-sm border border-border-strong bg-bg-overlay px-3 py-1">
        <span className="font-mono text-sm font-bold tabular-nums text-text sm:text-base">
          {count.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Section + tier headers
   ============================================================ */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border-strong pb-2 pt-1">
      <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-text sm:text-sm">
        {title}
      </span>
    </div>
  );
}

function TierHeader({
  tier,
  tierNumber,
}: {
  tier: AccoladeTier;
  tierNumber: number;
}) {
  return (
    <div className="flex items-baseline gap-2 border-b border-border pb-1.5">
      <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-text">
        Tier {tierNumber}
      </span>
      <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-accent sm:text-xs">
        {tier} XP
      </span>
    </div>
  );
}
