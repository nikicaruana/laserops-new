"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { PlayerMatch } from "@/lib/player-history/engine";
import { ChartCard } from "./ChartCard";

/**
 * EloProgressionChart
 * --------------------------------------------------------------------
 * Single-line chart showing the player's ELO trajectory from the
 * default starting rating of 1000 through every recorded match.
 *
 * Pre-pends a synthetic "Start" baseline at 1000 because the dataset
 * records ELO AFTER each match. Without the baseline, the line
 * appears to start above 1000 on a player's very first match — which
 * isn't the truth. Every player begins at 1000 before any matches.
 *
 * --------------------------------------------------------------------
 * CHANGES in this pass:
 *
 *   1. Data labels above each point now render as integers. Previous
 *      version used `v.toLocaleString("en-US")` which preserves
 *      decimals (so a value of 1039.7 rendered as "1,039.7"). Wrapping
 *      with `Math.round` first gives "1,040". ELO ratings are
 *      conventionally whole numbers in display.
 *
 *   2. Reduced right-side margin so the rightmost data label has
 *      room without forcing the chart to compress. The default 16px
 *      right margin can clip the trailing label on narrow viewports.
 * --------------------------------------------------------------------
 */

type Props = {
  matches: PlayerMatch[];
};

const STARTING_ELO = 1000;

export function EloProgressionChart({ matches }: Props) {
  const realPoints = matches
    .filter((m) => m.eloAfter > 0)
    .map((m) => ({ matchId: m.matchId, elo: m.eloAfter }));

  if (realPoints.length === 0) {
    return (
      <ChartCard
        title="ELO Rating Progression"
        subtitle="ELO measures your competitive strength — win rounds against strong teams and perform well to climb."
      >
        <NoDataPanel message="No ELO data available yet for this player." />
      </ChartCard>
    );
  }

  const data: { matchId: string; elo: number }[] = [
    { matchId: "Start", elo: STARTING_ELO },
    ...realPoints,
  ];

  const eloValues = data.map((d) => d.elo);
  const minElo = Math.min(...eloValues);
  const maxElo = Math.max(...eloValues);
  const spread = Math.max(maxElo - minElo, 0);
  const pad = Math.max(spread * 0.1, 10);
  const yMin = Math.floor((minElo - pad) / 5) * 5;
  const yMax = Math.ceil((maxElo + pad) / 5) * 5;

  return (
    <ChartCard
      title="ELO Rating Progression"
      subtitle="ELO measures your competitive strength — win rounds against strong teams and perform well to climb. Every player starts at 1000."
    >
      <div className="h-[280px] w-full sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          {/* right:24 — needs more room than the other charts because
              the rightmost data point's LabelList ("1,084" etc.)
              extends to the right of the actual point and was clipping
              against the card edge. The other composed charts don't
              have this problem because their line labels were removed
              in pass 4.
              left:0 — YAxis manages its own width via the `width` prop. */}
          <LineChart data={data} margin={{ top: 28, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#262626" vertical={false} />
            <XAxis
              dataKey="matchId"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
            />
            <YAxis
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              // 40px is enough for "1,095" / "1,050" etc at 11px font.
              // Down from 48px — gives 8px back to the plot area.
              width={40}
              domain={[yMin, yMax]}
              allowDecimals={false}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ stroke: "#3a3a3a" }} />
            <Line
              type="monotone"
              dataKey="elo"
              name="ELO Rating"
              stroke="#60a5fa"
              strokeWidth={2.5}
              dot={{ fill: "#60a5fa", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#93c5fd" }}
            >
              <LabelList
                dataKey="elo"
                position="top"
                fill="#93c5fd"
                fontSize={11}
                offset={10}
                // Round to whole-number ELO. Source data may carry
                // decimals (e.g. 1039.7) but ELO is conventionally
                // displayed as an integer.
                formatter={(v: number) => Math.round(v).toLocaleString("en-US")}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* Shared subcomponents (also used by the other charts). */

export function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-sm border border-border-strong bg-bg-overlay px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-mono font-semibold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono tabular-nums" style={{ color: p.color }}>
          {p.name}: {formatValueForTooltip(p.value, p.dataKey)}
        </p>
      ))}
    </div>
  );
}

function formatValueForTooltip(value: number, dataKey: string): string {
  if (dataKey === "accuracy") return `${Math.round(value)}%`;
  if (dataKey === "kd" || dataKey === "matchRating") return value.toFixed(2);
  return Math.round(value).toLocaleString("en-US");
}

export function NoDataPanel({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center sm:h-[280px]">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
