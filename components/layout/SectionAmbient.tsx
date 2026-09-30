"use client";
/**
 * components/layout/SectionAmbient.tsx
 * --------------------------------------------------------------------
 * Section-scoped copy of the site's PortalBackground. Two tones:
 *   - "dark"   -> the exact Ember bokeh orbs (warm yellow/red) + `.dimple-texture`
 *                 dapple, identical to the rest of the site.
 *   - "yellow" -> dapple ONLY (dark dots via `.dimple-texture-dark`), no orbs.
 * Reuses the shared `.portal-bg__*` classes + portal-drift/portal-breathe
 * keyframes so motion matches other pages (and freezes under reduced motion).
 * Put it as the first child of a `relative overflow-hidden` container; content
 * sits above it (in a relative wrapper).
 */
import type { CSSProperties } from "react";

type Tone = "dark" | "yellow";
type Orb = { size: string; x: string; y: string; color: string; blur: number; drift: "a" | "b" | "c" | "d"; dur: number; delay: number; breathe: number };

// PortalBackground variant "a" (Ember), exact values.
const DARK_ORBS: Orb[] = [
  { size: "56vmax", x: "12%", y: "16%", color: "rgba(255,222,0,0.30)", blur: 52, drift: "a", dur: 17, delay: 0, breathe: 10 },
  { size: "44vmax", x: "86%", y: "24%", color: "rgba(255,222,0,0.24)", blur: 48, drift: "b", dur: 20, delay: 2, breathe: 12 },
  { size: "50vmax", x: "18%", y: "90%", color: "rgba(255,206,0,0.22)", blur: 54, drift: "c", dur: 22, delay: 4, breathe: 14 },
  { size: "42vmax", x: "90%", y: "84%", color: "rgba(226,48,24,0.20)", blur: 54, drift: "d", dur: 20, delay: 1, breathe: 15 },
  { size: "30vmax", x: "58%", y: "50%", color: "rgba(238,74,30,0.14)", blur: 46, drift: "a", dur: 16, delay: 6, breathe: 11 },
  { size: "26vmax", x: "38%", y: "38%", color: "rgba(255,178,36,0.20)", blur: 42, drift: "b", dur: 15, delay: 3, breathe: 9 },
  { size: "15vmax", x: "72%", y: "18%", color: "rgba(255,240,190,0.10)", blur: 36, drift: "c", dur: 19, delay: 7, breathe: 13 },
];

export function SectionAmbient({ tone = "dark" }: { tone?: Tone }) {
  const orbs = tone === "yellow" ? [] : DARK_ORBS;
  const dappleClass = tone === "yellow" ? "dimple-texture-dark" : "dimple-texture";
  return (
    <div className="portal-bg pointer-events-none absolute inset-0" style={{ position: "absolute", zIndex: 0, background: "transparent" }} aria-hidden>
      <div className="portal-bg__orbs">
        {orbs.map((o, i) => (
          <span key={i} className="portal-bg__orb" style={{ left: o.x, top: o.y, width: o.size, height: o.size } as CSSProperties}>
            <span
              className="portal-bg__orb-inner"
              style={
                {
                  background: `radial-gradient(circle at center, ${o.color} 0%, transparent 70%)`,
                  filter: `blur(${o.blur}px)`,
                  animation: `portal-drift-${o.drift} ${o.dur}s ease-in-out ${o.delay}s infinite, portal-breathe ${o.breathe}s ease-in-out ${o.delay}s infinite alternate`,
                } as CSSProperties
              }
            />
          </span>
        ))}
      </div>
      <div className={`portal-bg__dapple ${dappleClass}`} />
    </div>
  );
}
