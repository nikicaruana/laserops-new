"use client";
/**
 * components/layout/SectionAmbient.tsx
 * --------------------------------------------------------------------
 * Section-scoped ambient backdrop matching the site's PortalBackground: soft,
 * slowly-drifting bokeh orbs + a dotted dapple, but absolutely positioned inside
 * ONE section instead of fixed behind the whole page. Two tones:
 *   - "dark"   → warm yellow/red orbs + light dapple, for dark sections.
 *   - "yellow" → blackish orbs + dark dapple, for LaserOps-yellow sections.
 * Put it as the first child of a `relative overflow-hidden` section; page content
 * sits above it (relative z-10). pointer-events-none; frozen for reduced motion
 * via the shared portal keyframes.
 */
import type { CSSProperties } from "react";

type Tone = "dark" | "yellow";
type Orb = { size: string; x: string; y: string; color: string; blur: number; drift: "a" | "b" | "c" | "d"; dur: number; delay: number; breathe: number };

const ORBS: Record<Tone, Orb[]> = {
  dark: [
    { size: "42vmax", x: "8%", y: "18%", color: "rgba(255,222,0,0.10)", blur: 60, drift: "a", dur: 22, delay: 0, breathe: 14 },
    { size: "34vmax", x: "85%", y: "72%", color: "rgba(226,48,24,0.08)", blur: 60, drift: "c", dur: 26, delay: 3, breathe: 16 },
    { size: "28vmax", x: "62%", y: "28%", color: "rgba(255,178,36,0.07)", blur: 52, drift: "b", dur: 20, delay: 5, breathe: 12 },
    { size: "24vmax", x: "28%", y: "82%", color: "rgba(255,222,0,0.06)", blur: 50, drift: "d", dur: 24, delay: 7, breathe: 15 },
  ],
  yellow: [
    { size: "40vmax", x: "10%", y: "22%", color: "rgba(0,0,0,0.16)", blur: 62, drift: "a", dur: 24, delay: 0, breathe: 15 },
    { size: "32vmax", x: "84%", y: "18%", color: "rgba(0,0,0,0.12)", blur: 60, drift: "b", dur: 28, delay: 2, breathe: 16 },
    { size: "30vmax", x: "72%", y: "82%", color: "rgba(15,15,15,0.14)", blur: 56, drift: "c", dur: 22, delay: 4, breathe: 13 },
    { size: "24vmax", x: "26%", y: "78%", color: "rgba(0,0,0,0.10)", blur: 50, drift: "d", dur: 26, delay: 6, breathe: 14 },
  ],
};

const DAPPLE: Record<Tone, { image: string; opacity: number }> = {
  dark: {
    image:
      "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.06) 1px, transparent 1.5px), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.05) 1px, transparent 1.5px)",
    opacity: 0.6,
  },
  yellow: {
    image:
      "radial-gradient(circle at 20% 50%, rgba(0,0,0,0.4) 1px, transparent 1.5px), radial-gradient(circle at 70% 30%, rgba(0,0,0,0.3) 1px, transparent 1.5px)",
    opacity: 0.22,
  },
};

export function SectionAmbient({ tone = "dark", dapple = true }: { tone?: Tone; dapple?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {ORBS[tone].map((o, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={
            {
              left: o.x,
              top: o.y,
              width: o.size,
              height: o.size,
              background: `radial-gradient(circle at center, ${o.color} 0%, transparent 70%)`,
              filter: `blur(${o.blur}px)`,
              animation: `portal-drift-${o.drift} ${o.dur}s ease-in-out ${o.delay}s infinite, portal-breathe ${o.breathe}s ease-in-out ${o.delay}s infinite alternate`,
            } as CSSProperties
          }
        />
      ))}
      {dapple && (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: DAPPLE[tone].image, backgroundSize: "32px 32px, 48px 48px", opacity: DAPPLE[tone].opacity }}
        />
      )}
    </div>
  );
}
