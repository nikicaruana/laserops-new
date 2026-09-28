"use client";

/**
 * components/live/PixelStatic.tsx
 * --------------------------------------------------------------------
 * Pixelly static overlay that covers a scrambled base on the enemy feed. A tiny
 * self-animating canvas draws mostly near-black pixels with a few dim-grey +
 * accent flecks (~12fps), scaled up with image-rendering:pixelated for a chunky
 * "signal jammed" look, with the deploying player's label on top. Shared by the
 * live feed and the LiveSim prototype so the effect stays identical.
 */
import { useEffect, useRef } from "react";

export function PixelStatic({ label }: { label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = 18, H = 18;
    c.width = W;
    c.height = H;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      if (now - last > 80) {
        last = now;
        const img = ctx.createImageData(W, H);
        for (let i = 0; i < img.data.length; i += 4) {
          const r = Math.random();
          const tint = r < 0.12; // occasional accent fleck
          // Mostly near-black with a few dim-grey pixels — a dark jam that
          // never flashes bright white.
          const v = r < 0.68 ? 14 : r < 0.9 ? 55 : 120;
          img.data[i] = tint ? 255 : v;
          img.data[i + 1] = tint ? 222 : v;
          img.data[i + 2] = tint ? 0 : v;
          img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-lg">
      <canvas ref={ref} className="h-full w-full" style={{ imageRendering: "pixelated", opacity: 0.9 }} />
      <div className="absolute inset-0 flex items-center justify-center p-1 text-center">
        <span className="text-[0.5rem] font-extrabold uppercase leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">{label}</span>
      </div>
    </div>
  );
}
