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
  LabelList,
} from "recharts";
import type { PlayerMatch } from "@/lib/player-history/engine";
import { ChartCard } from "./ChartCard";
import { DarkTooltip, NoDataPanel } from "./EloProgressionChart";

/**
 * KillsVsKdChart
 * --------------------------------------------------------------------
 * Yellow bars: kills per match. Red line on secondary axis: KD ratio.
 *
 * --------------------------------------------------------------------
 * CHANGE in this pass: tighter right margin (4 vs 12) to reduce
 * mobile dead space alongside the ChartCard padding fix.
 * --------------------------------------------------------------------
 */

type Props = {
  matches: PlayerMatch[];
};

export function KillsVsKdChart({ matches }: Props) {
  const data = matches.map((m) => ({
    matchId: m.matchId,
    kills: m.kills,
    kd: m.kd,
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Kills vs KD Ratio">
        <NoDataPanel message="No match data available yet." />
      </ChartCard>
    );
  }

  const killValues = data.map((d) => d.kills);
  const leftMax = niceCeil(Math.max(...killValues) * 1.15);

  const kdValues = data.map((d) => d.kd);
  const [rMin, rMax] = fittedDomain(kdValues, { padFraction: 0.15, minPad: 0.2 });

  return (
    <ChartCard
      title="Kills vs KD Ratio"
      subtitle="Per-match kills (yellow) and your kill/death ratio (red). Two views of the same fight: how active you were and how lethal."
    >
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 28, right: 4, left: 0, bottom: 8 }}>
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
              width={28}
              domain={[0, leftMax]}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={32}
              domain={[rMin, rMax]}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "#26262640" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} iconType="rect" />
            <Bar yAxisId="left" dataKey="kills" name="Kills" fill="#ffde00" radius={[2, 2, 0, 0]}>
              <LabelList
                dataKey="kills"
                position="top"
                fill="#ffde00"
                fontSize={11}
                offset={6}
              />
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="kd"
              name="KD Ratio"
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

/* ---------- Local axis helpers ---------- */

function fittedDomain(
  values: number[],
  opts: { padFraction: number; minPad: number },
): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 0);
  const pad = Math.max(spread * opts.padFraction, opts.minPad);
  return [Math.max(min - pad, 0), max + pad];
}

function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}
