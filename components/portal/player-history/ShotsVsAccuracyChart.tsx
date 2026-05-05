"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PlayerMatch } from "@/lib/player-history/engine";
import { ChartCard } from "./ChartCard";
import { NoDataPanel } from "./EloProgressionChart";

/**
 * ShotsVsAccuracyChart
 * --------------------------------------------------------------------
 * Yellow bars: shots fired per match. Red line on secondary axis:
 * accuracy (0..100%).
 *
 * --------------------------------------------------------------------
 * CHANGES in this pass:
 *
 *   1. Reverted the two-line X-axis tick (match ID + gun name) — on
 *      phones the gun names overlapped each other and the match IDs
 *      overlapped between adjacent ticks. Now the X axis matches the
 *      other charts: just match IDs.
 *
 *   2. Gun used moves to a custom tooltip. Tap or hover any bar/point
 *      and you see the match ID, shots, accuracy AND the gun used in
 *      that match. The gun is the contextually most interesting piece
 *      of info for an accuracy chart, but it's revealed on demand
 *      rather than baked into the axis.
 *
 *      We use a chart-specific tooltip (ShotsAccuracyTooltip) rather
 *      than the shared DarkTooltip — the gun field is unique to this
 *      chart, so a one-off custom tooltip keeps the shared component
 *      simple.
 *
 *   3. Tighter mobile margins (left:0, right:4) to reduce wasted
 *      horizontal space alongside the ChartCard padding fix.
 * --------------------------------------------------------------------
 */

type Props = {
  matches: PlayerMatch[];
};

export function ShotsVsAccuracyChart({ matches }: Props) {
  const data = matches.map((m) => ({
    matchId: m.matchId,
    shots: m.shots,
    accuracy: m.accuracy * 100,
    // Carried as a hidden field on each datum so the custom tooltip
    // can read it from the payload. Recharts attaches the full data
    // object to each tooltip payload entry under `payload.payload`.
    gunUsed: m.gunUsed || "—",
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Shots vs Accuracy">
        <NoDataPanel message="No match data available yet." />
      </ChartCard>
    );
  }

  const shotValues = data.map((d) => d.shots);
  const leftMax = niceCeil(Math.max(...shotValues) * 1.1);

  const accValues = data.map((d) => d.accuracy);
  const [rMin, rMax] = fittedDomain(accValues, {
    padFraction: 0.2,
    minPad: 3,
    floor: 0,
    ceil: 100,
  });

  return (
    <ChartCard
      title="Shots vs Accuracy"
      subtitle="Your accuracy trends over time, and how it relates to the volume of shots you fire in a match. Tap a bar to see which gun you used."
    >
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#262626" vertical={false} />
            <XAxis
              dataKey="matchId"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
            />
            <YAxis
              yAxisId="left"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={36}
              domain={[0, leftMax]}
              allowDecimals={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${v}`
              }
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={36}
              domain={[rMin, rMax]}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
            />
            <Tooltip content={<ShotsAccuracyTooltip />} cursor={{ fill: "#26262640" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} iconType="rect" />
            <Bar yAxisId="left" dataKey="shots" name="Shots Fired" fill="#ffde00" radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="accuracy"
              name="Accuracy"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#fca5a5" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ---------- Custom tooltip with gun reveal ----------
   Chart-specific because the gun field doesn't apply to the other
   charts. Same visual language as the shared DarkTooltip but with a
   "Gun used" line at the bottom. */

type ShotsAccuracyDatum = {
  matchId: string;
  shots: number;
  accuracy: number;
  gunUsed: string;
};

function ShotsAccuracyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
    payload?: ShotsAccuracyDatum;
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  // All payload entries share the same datum (one matchId per row),
  // so we can pull the gun from the first entry.
  const gun = payload[0]?.payload?.gunUsed ?? "";
  return (
    <div className="rounded-sm border border-border-strong bg-bg-overlay px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-mono font-semibold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono tabular-nums" style={{ color: p.color }}>
          {p.name}: {formatValue(p.value, p.dataKey)}
        </p>
      ))}
      {gun !== "" && (
        // Yellow accent for the gun line so it visually stands out
        // from the metric values above. Different visual weight signals
        // "this is metadata, not a metric."
        <p className="mt-1 border-t border-border-strong pt-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-accent">
          Gun used: <span className="font-bold">{gun}</span>
        </p>
      )}
    </div>
  );
}

function formatValue(value: number, dataKey: string): string {
  if (dataKey === "accuracy") return `${Math.round(value)}%`;
  return Math.round(value).toLocaleString("en-US");
}

/* ---------- Local helpers ---------- */

function fittedDomain(
  values: number[],
  opts: {
    padFraction: number;
    minPad: number;
    floor?: number;
    ceil?: number;
  },
): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0);
  const pad = Math.max(spread * opts.padFraction, opts.minPad);
  let lo = min - pad;
  let hi = max + pad;
  if (opts.floor !== undefined) lo = Math.max(lo, opts.floor);
  if (opts.ceil !== undefined) hi = Math.min(hi, opts.ceil);
  return [lo, hi];
}

function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}
