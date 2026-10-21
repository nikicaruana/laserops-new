"use client";

/**
 * components/portal/player-compare/RadarCompare.tsx
 * --------------------------------------------------------------------
 * Kiviat / radar comparison of two players across the 9 rating components.
 * Each spoke is a player's PERCENTILE in the rated field for that stat, so no
 * outlier distorts the scale. Concentric rings are the star bands (dummy 1* in
 * the centre, then 2*..5* outward); ring spacing is uneven on purpose - it
 * mirrors how wide each band is (5* is the narrow top 10%). Player A is always
 * drawn; player B overlays when a comparison is picked. Hover a vertex for the
 * raw value + band.
 */
import { RADAR_AXES, BAND_RINGS, INNER_MARGIN, radiusForPct, type RadarPoint } from "@/lib/player-stats/radar";

const A_COLOR = "#f5c518"; // player A - amber (brand accent family)
const B_COLOR = "#38bdf8"; // player B - sky (strong CVD separation from amber)

const N = RADAR_AXES.length; // 9
const CX = 230, CY = 196, R = 122;
const ang = (i: number) => ((-90 + i * (360 / N)) * Math.PI) / 180;
const pt = (frac: number, i: number): [number, number] => [CX + frac * R * Math.cos(ang(i)), CY + frac * R * Math.sin(ang(i))];
const ringPoints = (frac: number) => Array.from({ length: N }, (_, i) => pt(frac, i).map((n) => n.toFixed(1)).join(",")).join(" ");
const shapePoints = (pts: RadarPoint[]) => pts.map((p, i) => pt(radiusForPct(p.pct), i).map((n) => n.toFixed(1)).join(",")).join(" ");

function Shape({ pts, name, color, lead }: { pts: RadarPoint[]; name: string; color: string; lead: boolean }) {
  return (
    <g>
      <polygon points={shapePoints(pts)} fill={color} fillOpacity={lead ? 0.2 : 0.14} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const [x, y] = pt(radiusForPct(p.pct), i);
        return (
          <circle key={p.key} cx={x} cy={y} r={lead ? 3.4 : 3} fill={color} stroke="var(--color-bg, #111)" strokeWidth={1}>
            <title>{`${name} — ${p.label}: ${p.fmt}  (${p.band})`}</title>
          </circle>
        );
      })}
    </g>
  );
}

export function RadarCompare({ pointsA, nameA, pointsB, nameB }: {
  pointsA: RadarPoint[];
  nameA: string;
  pointsB?: RadarPoint[] | null;
  nameB?: string | null;
}) {
  // Star-band labels sit just left of the straight-up spoke (axis 0).
  const bandLabels = [
    { frac: INNER_MARGIN * 0.5, t: "1★" },
    ...BAND_RINGS.filter((b) => b.star).map((b) => ({ frac: radiusForPct(b.pct), t: b.star })),
  ];

  return (
    <div className="text-text-muted">
      <svg viewBox="0 0 460 408" className="mx-auto block w-full max-w-[460px]" role="img" aria-label={`Radar comparing ${nameA}${nameB ? ` and ${nameB}` : ""} across nine stats`}>
        {/* band rings (outermost = field edge, brighter) */}
        {BAND_RINGS.map((b, idx) => {
          const outer = b.pct === 1;
          return <polygon key={b.pct} points={ringPoints(radiusForPct(b.pct))} fill={idx === 3 ? "currentColor" : "none"} fillOpacity={idx === 3 ? 0.04 : 0} stroke="currentColor" strokeOpacity={outer ? 0.34 : 0.14} strokeWidth={outer ? 1.4 : 1} />;
        })}
        {/* dummy 1-star ring */}
        <polygon points={ringPoints(INNER_MARGIN * 0.5)} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeDasharray="2 3" />

        {/* spokes */}
        {RADAR_AXES.map((ax, i) => { const [x, y] = pt(1, i); return <line key={ax.key} x1={CX} y1={CY} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} />; })}

        {/* star-band labels up the top spoke */}
        {bandLabels.map((b) => (
          <text key={b.t} x={CX - 6} y={CY - b.frac * R} textAnchor="end" dominantBaseline="middle" fontSize={8.5} fill="currentColor" opacity={0.7}>{b.t}</text>
        ))}

        {/* shapes: B under A */}
        {pointsB && nameB ? <Shape pts={pointsB} name={nameB} color={B_COLOR} lead={false} /> : null}
        <Shape pts={pointsA} name={nameA} color={A_COLOR} lead />

        {/* axis labels */}
        {RADAR_AXES.map((ax, i) => {
          const [x, y] = pt(1.18, i);
          const c = Math.cos(ang(i));
          const anchor = Math.abs(c) < 0.3 ? "middle" : c > 0 ? "start" : "end";
          return (
            <text key={ax.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={10.5} fill="currentColor" className="font-semibold">
              {ax.short}
            </text>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5 text-text"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: A_COLOR }} />{nameA}</span>
        {nameB ? <span className="inline-flex items-center gap-1.5 text-text"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: B_COLOR }} />{nameB}</span> : null}
        <span className="text-[0.65rem] text-text-subtle">rings = rating bands (1★ inner &rarr; 5★ edge)</span>
      </div>
    </div>
  );
}
