"use client";

/**
 * components/admin/DemoModeToggle.tsx
 * --------------------------------------------------------------------
 * Demo Mode slider for the admin sidebar. When ON, every element marked
 * `demo-sensitive` (via <Sensitive> or the class) is blurred on screen - so a
 * live demo can show the real admin without exposing customer emails, phone
 * numbers, names or revenue figures. It changes NOTHING in the database: it only
 * toggles the `data-demo` attribute on <html>, which a CSS rule reads. Per-browser
 * (localStorage), so it never affects other admins or players. The admin layout
 * sets the attribute pre-paint from the same key to avoid a flash on navigation.
 */
import { useEffect, useState } from "react";

const KEY = "laserops:demo-mode";

export function DemoModeToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY) === "1";
      setOn(v);
      document.documentElement.toggleAttribute("data-demo", v);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.toggleAttribute("data-demo", next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      title="Blur customer data and figures on screen for a demo. Nothing is changed in the database."
      className="flex w-full items-center justify-between gap-2 border border-border-strong bg-bg-elevated px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-accent"
    >
      <span className={on ? "text-accent" : ""}>Demo mode{on ? " · on" : ""}</span>
      <span
        aria-hidden
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${on ? "bg-accent" : "bg-border-strong"}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-bg transition-transform ${on ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
