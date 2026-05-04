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
 * ShotsVsAccuracyChart
 * --------------------------------------------------------------------
 * Yellow bars: shots fired per match. Red line on secondary axis:
 * accuracy (0..100%). Mirrors the Looker dashboard chart.
 *
 * The pairing is informative: high shots with high accuracy = aim
 * AND volume. High shots with low accuracy = spray and pray. Low
 * shots with high accuracy = patient sniper play.
 */

type Props = {
  matches: PlayerMatch[];
};

export function ShotsVsAccuracyChart({ matches }: Props) {
  const data = matches.map((m) => ({
    matchId: m.matchId,
    shots: m.shots,
    accuracy: m.accuracy * 100, // recharts secondary axis works better with 0..100 here
  }));

  if (data.length === 0) {
    return (
      <ChartCard title="Shots vs Accuracy">
        <NoDataPanel message="No match data available yet." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Shots vs Accuracy"
      subtitle="Your accuracy trends over time, and how it relates to the volume of shots you fire in a match."
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
              width={48}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${v}`
              }
              label={{
                value: "Shots",
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
              width={42}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
              label={{
                value: "Accuracy",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 10, fill: "#737373" },
              }}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "#26262640" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }} iconType="rect" />
            <Bar yAxisId="left" dataKey="shots" name="Shots" fill="#ffde00" radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="accuracy"
              name="Accuracy"
              stroke="#ef4444"
              strokeWidth={2.5}
              dot={{ fill: "#ef4444", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#fca5a5" }}
            >
              <LabelList
                dataKey="accuracy"
                position="top"
                fill="#fca5a5"
                fontSize={11}
                offset={8}
                formatter={(v: number) => `${Math.round(v)}%`}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
