"use client";

/**
 * components/portal/WakeLockToggle.tsx
 * --------------------------------------------------------------------
 * Keep-screen-on toggle for the fullscreen live feed top bar. Self-contained:
 * holds its own on/off state (default on) which drives the Screen Wake Lock, and
 * renders a bright/moon button. Player mid-game wants the screen to stay lit.
 */
import { useState } from "react";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";

export function WakeLockToggle() {
  const [keepAwake, setKeepAwake] = useState(true);
  useWakeLock(keepAwake);
  return (
    <button
      type="button"
      onClick={() => setKeepAwake((k) => !k)}
      title={keepAwake ? "Screen stays on - tap to allow auto-lock" : "Screen will auto-lock - tap to keep it on"}
      aria-label="Keep screen on"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center text-lg leading-none transition-colors ${keepAwake ? "text-accent" : "text-text-subtle"}`}
    >
      {keepAwake ? "🔆" : "🌙"}
    </button>
  );
}
