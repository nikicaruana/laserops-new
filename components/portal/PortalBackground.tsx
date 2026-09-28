"use client";
/**
 * components/portal/PortalBackground.tsx
 * --------------------------------------------------------------------
 * Ambient animated backdrop for the dark portal pages. Instead of flat
 * black, it renders a set of soft, slowly-drifting "bokeh" glows (LaserOps
 * yellow with a subtle warm red here and there) over a near-black base, with
 * a uniform dotted dapple overlay (the shared `.dimple-texture`) on top.
 *
 * Two motion systems, both cheap:
 *  1. Idle drift + breathe — pure CSS, animating only compositor-friendly
 *     transform/opacity on each orb (GPU, no JS cost). Frozen under
 *     `prefers-reduced-motion`.
 *  2. Reactive parallax — one JS layer that shifts the WHOLE orb field with a
 *     single transform on the container in response to pointer (desktop),
 *     scroll, and device tilt (mobile). Listeners are passive; a single rAF
 *     eases the field toward its target and STOPS as soon as it settles, so
 *     there's no steady CPU draw when nothing's moving. Skipped entirely under
 *     `prefers-reduced-motion`.
 *
 * It sits `fixed` behind the page (z-0); page content should sit in a
 * `relative z-10` wrapper so it renders on top. See app/globals.css
 * `.portal-bg*` + keyframes.
 *
 * Three variants (A/B/C) are provided so we can compare treatments. Pass
 * `variant` ("a" | "b" | "c"); default "a" (Ember).
 */
import { useEffect, useRef, type CSSProperties } from "react";

type Orb = {
  size: string;
  x: string;
  y: string;
  color: string;
  blur: number;
  drift: "a" | "b" | "c" | "d";
  dur: number;
  delay: number;
  breathe: number;
};

type Variant = { base: string; orbs: Orb[] };

const VARIANTS: Record<"a" | "b" | "c", Variant> = {
  // A — "Ember": warm yellow dominant, a whisper of red, slow + calm.
  a: {
    base: "radial-gradient(120% 120% at 50% 0%, #241c0d 0%, #15110a 45%, #0a0a0a 100%)",
    orbs: [
      { size: "56vmax", x: "12%", y: "16%", color: "rgba(255,222,0,0.30)", blur: 52, drift: "a", dur: 17, delay: 0, breathe: 10 },
      { size: "44vmax", x: "86%", y: "24%", color: "rgba(255,222,0,0.24)", blur: 48, drift: "b", dur: 20, delay: 2, breathe: 12 },
      { size: "50vmax", x: "18%", y: "90%", color: "rgba(255,206,0,0.22)", blur: 54, drift: "c", dur: 22, delay: 4, breathe: 14 },
      { size: "42vmax", x: "90%", y: "84%", color: "rgba(226,48,24,0.20)", blur: 54, drift: "d", dur: 20, delay: 1, breathe: 15 },
      { size: "30vmax", x: "58%", y: "50%", color: "rgba(238,74,30,0.14)", blur: 46, drift: "a", dur: 16, delay: 6, breathe: 11 },
      { size: "26vmax", x: "38%", y: "38%", color: "rgba(255,178,36,0.20)", blur: 42, drift: "b", dur: 15, delay: 3, breathe: 9 },
      { size: "15vmax", x: "72%", y: "18%", color: "rgba(255,240,190,0.10)", blur: 36, drift: "c", dur: 19, delay: 7, breathe: 13 },
    ],
  },
  // B — "Signal": red pulled up to sit alongside the yellow, a touch livelier.
  b: {
    base: "radial-gradient(120% 120% at 50% 100%, #1a120c 0%, #120c0a 50%, #0a0a0a 100%)",
    orbs: [
      { size: "46vmax", x: "24%", y: "16%", color: "rgba(255,222,0,0.15)", blur: 55, drift: "b", dur: 32, delay: 0, breathe: 13 },
      { size: "42vmax", x: "86%", y: "40%", color: "rgba(210,40,22,0.13)", blur: 60, drift: "a", dur: 38, delay: 4, breathe: 15 },
      { size: "40vmax", x: "16%", y: "82%", color: "rgba(255,222,0,0.12)", blur: 55, drift: "d", dur: 34, delay: 7, breathe: 14 },
      { size: "44vmax", x: "60%", y: "92%", color: "rgba(200,32,18,0.12)", blur: 60, drift: "c", dur: 40, delay: 2, breathe: 16 },
      { size: "24vmax", x: "52%", y: "50%", color: "rgba(255,170,30,0.09)", blur: 48, drift: "a", dur: 30, delay: 8, breathe: 12 },
      { size: "20vmax", x: "78%", y: "14%", color: "rgba(255,222,0,0.10)", blur: 42, drift: "b", dur: 36, delay: 5, breathe: 15 },
      { size: "30vmax", x: "8%", y: "46%", color: "rgba(150,20,12,0.10)", blur: 55, drift: "d", dur: 44, delay: 10, breathe: 18 },
    ],
  },
  // C — "Deep Field": sparse, large, very slow, blacker, one crimson corner.
  c: {
    base: "radial-gradient(140% 120% at 30% 20%, #16130b 0%, #0d0b07 55%, #080808 100%)",
    orbs: [
      { size: "64vmax", x: "8%", y: "8%", color: "rgba(255,222,0,0.14)", blur: 70, drift: "a", dur: 64, delay: 0, breathe: 24 },
      { size: "58vmax", x: "92%", y: "90%", color: "rgba(255,213,0,0.11)", blur: 70, drift: "c", dur: 70, delay: 6, breathe: 26 },
      { size: "40vmax", x: "6%", y: "96%", color: "rgba(190,28,16,0.12)", blur: 65, drift: "d", dur: 60, delay: 3, breathe: 22 },
      { size: "34vmax", x: "74%", y: "48%", color: "rgba(255,190,50,0.08)", blur: 55, drift: "b", dur: 56, delay: 9, breathe: 20 },
      { size: "14vmax", x: "84%", y: "16%", color: "rgba(255,255,255,0.045)", blur: 42, drift: "a", dur: 58, delay: 12, breathe: 23 },
    ],
  },
};

// Parallax reach (px) for each input. Kept modest — the orbs are huge, so a
// little shift reads clearly without dragging them off their coverage.
const POINTER_REACH = 54;
const TILT_REACH = 66;
const SCROLL_REACH = 150;
const EASE = 0.1; // toward-target lerp per frame (lower = smoother/slower)

export function PortalBackground({ variant = "a" }: { variant?: "a" | "b" | "c" }) {
  const v = VARIANTS[variant] ?? VARIANTS.a;
  const orbsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = orbsRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // target (where the field wants to be) vs current (where it is)
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0, scrollY = 0;
    let raf = 0, running = false;

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    const frame = () => {
      cx += (tx - cx) * EASE;
      cy += (ty - cy) * EASE;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      if (Math.abs(tx - cx) > 0.15 || Math.abs(ty - cy) > 0.15) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false; // settled — no more work until the next input
      }
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    const retarget = () => {
      tx = pointerX + tiltX;
      ty = pointerY + tiltY + scrollY;
      kick();
    };

    const onPointer = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2 * POINTER_REACH;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2 * POINTER_REACH;
      retarget();
    };
    const onScroll = () => {
      // orbs drift opposite the scroll for a gentle parallax depth
      scrollY = -clamp(window.scrollY * 0.12, 0, SCROLL_REACH);
      retarget();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tiltX = clamp(e.gamma / 45, -1, 1) * TILT_REACH;
      tiltY = clamp((e.beta - 45) / 45, -1, 1) * TILT_REACH;
      retarget();
    };

    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) {
      window.addEventListener("deviceorientation", onTilt, true);
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("deviceorientation", onTilt, true);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [variant]);

  return (
    <div className="portal-bg" style={{ background: v.base }} aria-hidden>
      <div className="portal-bg__orbs" ref={orbsRef}>
        {v.orbs.map((o, i) => (
          <span
            key={i}
            className="portal-bg__orb"
            style={{ left: o.x, top: o.y, width: o.size, height: o.size } as CSSProperties}
          >
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
      <div className="portal-bg__dapple dimple-texture" />
    </div>
  );
}
