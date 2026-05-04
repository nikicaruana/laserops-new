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
 * Single-line chart showing the player's post-match ELO over time,
 * one point per match. Mirrors the Looker dashboard chart of the
 * same name.
 *
 * Shows the player's competitive trajectory — climbing rating means
 * they're winning rounds against strong opposition, dipping rating
 * means losing to weaker teams (or losing to strong teams hurts less).
 *
 * Y axis auto-scales — recharts picks a sensible range based on the
 * data, with a small margin top/bottom.
 *
 * X axis ticks: match IDs. With many matches the labels can overlap
 * on narrow viewports; we set angle=-30 on small screens via
 * media-query trick (ugly but works).
 */

type Props = {
  matches: PlayerMatch[];
};

export function EloProgressionChart({ matches }: Props) {
  // Filter out matches with no ELO data (early matches before ELO
  // tracking was added). The chart should only show the period for
  // which ELO is available.
  const data = matches
    .filter((m) => m.eloAfter > 0)
    .map((m) => ({ matchId: m.matchId, elo: m.eloAfter }));

  if (data.length === 0) {
    return (
      <ChartCard
        title="ELO Rating Progression"
        subtitle="ELO measures your competitive strength — win rounds against strong teams and perform well to climb."
      >
        <NoDataPanel message="No ELO data available yet for this player." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="ELO Rating Progression"
      subtitle="ELO measures your competitive strength — win rounds against strong teams and perform well to climb."
    >
      <div className="h-[280px] w-full sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 28, right: 16, left: 0, bottom: 8 }}>
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
              width={48}
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
              {/* Inline data labels above each point — matches the
                  Looker chart's "1,025  1,053  1,057  1,084" style. */}
              <LabelList
                dataKey="elo"
                position="top"
                fill="#93c5fd"
                fontSize={11}
                offset={10}
                formatter={(v: number) => v.toLocaleString("en-US")}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* Shared subcomponents (also used by the other charts). The DarkTooltip
   is exported here and re-imported elsewhere — keeps styling consistent
   across all four charts on the page. */

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
  // Per-key formatting: percentages, ratios, or comma'd ints depending
  // on the metric. Falls back to a comma-formatted integer.
  if (dataKey === "accuracy") return `${Math.round(value * 100)}%`;
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
