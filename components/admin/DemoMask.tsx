"use client";

/**
 * components/admin/DemoMask.tsx
 * --------------------------------------------------------------------
 * Demo Mode auto-masker. Marking individual fields with <Sensitive> only covers
 * the spots we remember; this guarantees coverage across EVERY admin subpage by
 * scanning the rendered admin content and blurring any leaf element whose text
 * is an email, a phone number or a money (euro) figure. It re-runs on DOM changes
 * and navigation (MutationObserver) and the moment Demo Mode is toggled, so it
 * works without a refresh. Display-only: it just adds the `demo-sensitive` class
 * (CSS blur); no data is touched. Names can't be pattern-detected, so those still
 * rely on <Sensitive> marks.
 */
import { useEffect } from "react";

const EMAIL = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/;

function looksSensitive(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > 120) return false;
  if (t.includes("€")) return true; // euro figure
  if (EMAIL.test(t)) return true;
  // phone: 7-15 digits, only phone chars, and must carry a + or a separator so a
  // bare number (e.g. a score or XP) is never mistaken for one.
  if (/^\+?[\d\s()\-]+$/.test(t)) {
    const digits = t.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15 && (t.startsWith("+") || /[\s()\-]/.test(t))) return true;
  }
  return false;
}

export function DemoMask() {
  useEffect(() => {
    const root = document.getElementById("admin-main") ?? document.body;
    let frame: number | null = null;

    function apply() {
      frame = null;
      const on = document.documentElement.getAttribute("data-demo") === "on";
      if (!on) {
        root.querySelectorAll("[data-demo-auto]").forEach((el) => {
          el.classList.remove("demo-sensitive");
          el.removeAttribute("data-demo-auto");
        });
        return;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let el = walker.nextNode() as Element | null;
      while (el) {
        // Leaf text-bearing elements only, so we blur the value, not a whole panel.
        if (el.childElementCount === 0 && !el.classList.contains("demo-sensitive")) {
          const text = el.textContent ?? "";
          if (looksSensitive(text)) {
            el.classList.add("demo-sensitive");
            el.setAttribute("data-demo-auto", "");
          }
        }
        el = walker.nextNode() as Element | null;
      }
    }

    function schedule() {
      if (frame != null) return;
      frame = requestAnimationFrame(apply);
    }

    // React re-renders may strip our class; watching class + content + structure
    // (debounced to one pass per frame, idempotent) re-applies it.
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    const htmlMo = new MutationObserver(schedule);
    htmlMo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-demo"] });

    apply();
    return () => {
      mo.disconnect();
      htmlMo.disconnect();
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
