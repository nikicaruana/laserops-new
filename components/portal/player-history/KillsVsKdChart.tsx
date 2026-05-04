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
 * Mirrors the Looker dashboard chart.
 *
 * The two metrics tell different stories — high kills with low KD
 * means lots of action but lots of deaths too. Low kills with high
 * KD means careful, lethal play. Both visible together on one chart
 * makes the trade-off legible.
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
      <ChartCard title="Kills vs Kill/Death Ratio">
        <NoDataPanel message="No match data available yet." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Kills vs Kill/Death Ratio"
      subtitle="The evolution of the number of kills you are getting game on game for the last 10 matches played, overlaid with your kill/death ratio."
    >
      <div className="h-[300px] w-full sm:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 28, right: 12, left: 0, bottom: 8 }}>
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
              label={{
                value: "Kills",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "#737373" },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#737373"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={{ stroke: "#3a3a3a" }}
              width={36}
              label={{
                value: "KD Ratio",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 10, fill: "#737373" },
              }}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "#26262640" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} iconType="rect" />
            <Bar yAxisId="left" dataKey="kills" name="Kills" fill="#ffde00" radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="kd"
              name="KD Ratio"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#fca5a5" }}
            >
              <LabelList
                dataKey="kd"
                position="top"
                fill="#fca5a5"
                fontSize={11}
                offset={8}
                formatter={(v: number) => v.toFixed(2)}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
