"use client";

/**
 * components/admin/SelectNumberOnFocus.tsx
 * --------------------------------------------------------------------
 * Mounts once in the admin layout: whenever a number input anywhere in the
 * admin area gains focus, select its contents so typing overwrites the value
 * (clicking a "0" and typing "2" gives "2", not "02"). Covers every current
 * and future admin number field without per-input wiring. focusin bubbles, so
 * a single document listener catches them all.
 */
import { useEffect } from "react";

export function SelectNumberOnFocus() {
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === "number") {
        // Defer so the caret/selection isn't immediately reset by the browser.
        requestAnimationFrame(() => {
          try {
            t.select();
          } catch {
            /* some browsers dislike select() on number inputs – ignore */
          }
        });
      }
    };
    document.addEventListener("focusin", handler);
    return () => document.removeEventListener("focusin", handler);
  }, []);
  return null;
}
