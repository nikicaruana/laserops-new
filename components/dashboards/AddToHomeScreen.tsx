"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * AddToHomeScreen
 * --------------------------------------------------------------------
 * Mobile-only button + instructional modal.
 *
 * Design rationale:
 *   - iOS Safari does NOT expose any programmatic API to trigger
 *     "Add to Home Screen". The only path is user-initiated via the
 *     Share sheet. So this is, by necessity, an instructional modal.
 *   - We could implement the real `beforeinstallprompt` flow on Android
 *     for a true install, but that requires PWA infrastructure (manifest
 *     + service worker + HTTPS). Deferred until we choose to build that.
 *   - This component is intentionally simple: detect iOS vs Android
 *     vs other, show the matching instructions, dismiss.
 *
 * Visibility:
 *   - Hidden on screens >= 1024px (no homescreen there). Tailwind `md:hidden`
 *     would also work; we pick lg here so iPad-sized tablets still see it.
 *   - Hidden if the page is already running in standalone mode (the user
 *     already added it to home screen and is launching from the icon).
 *   - Hidden if the user has dismissed it once this session (sessionStorage).
 */

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports as "Macintosh" but with touch events. Safe heuristic.
  const isIos =
    /iPhone|iPad|iPod/i.test(ua) ||
    (ua.includes("Macintosh") && "ontouchend" in document);
  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari uses navigator.standalone; everything else uses display-mode media query.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return iosStandalone || displayModeStandalone;
}

const SESSION_DISMISS_KEY = "laserops:a2hs-dismissed";

export function AddToHomeScreen() {
  // Mounted flag so we don't render anything until we've checked the
  // environment client-side. Avoids SSR/CSR mismatch.
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      // Already installed; nothing to do.
      return;
    }
    const wasDismissed =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
    setPlatform(detectPlatform());
    setMounted(true);
  }, []);

  // Don't render on SSR, on desktop, when dismissed, or when already installed.
  if (!mounted || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // sessionStorage can throw in private mode on some browsers — ignore.
    }
  }

  return (
    <>
      {/* Trigger button — pinned to the dashboard rail on mobile.
          Hidden at lg and above (no homescreen there). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "lg:hidden",
          "inline-flex items-center gap-2 rounded-sm border border-border-strong bg-bg-overlay px-3 py-1.5",
          "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-muted",
          "transition-colors hover:border-accent hover:text-accent",
        )}
        aria-label="Add LaserOps Malta to your home screen"
      >
        {/* Tiny plus icon — pure SVG, no library */}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 1.5v9M1.5 6h9" strokeLinecap="square" />
        </svg>
        Pin to Home
      </button>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="a2hs-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            // Click backdrop to close — but only when clicking the backdrop itself.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className={cn(
              "relative w-full border border-border-strong bg-bg-elevated p-6",
              "sm:max-w-md sm:rounded-sm",
              "max-sm:rounded-t-sm",
            )}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 p-2 text-text-subtle transition-colors hover:text-text"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="square" />
              </svg>
            </button>

            {/* Eyebrow */}
            <div className="flex items-center gap-2">
              <span aria-hidden className="block h-px w-8 bg-accent" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
                Field Kit
              </span>
            </div>

            <h2
              id="a2hs-title"
              className="mt-3 text-2xl font-extrabold leading-tight"
            >
              Pin LaserOps to your home screen
            </h2>

            <p className="mt-2 text-sm text-text-muted">
              Track your stats and challenges in one tap. No app store needed.
            </p>

            {/* Platform-specific instructions */}
            <div className="mt-5 space-y-3 text-sm text-text">
              {platform === "ios" && <IosInstructions />}
              {platform === "android" && <AndroidInstructions />}
              {platform === "other" && <GenericInstructions />}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle transition-colors hover:text-text"
              >
                Don&apos;t show again this visit
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-bg transition-colors hover:bg-accent-soft"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Instructions per platform ---------- */

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center border border-accent text-[0.7rem] font-bold text-accent"
      >
        {n}
      </span>
      <span className="leading-relaxed text-text-muted">{children}</span>
    </div>
  );
}

function IosInstructions() {
  return (
    <>
      <Step n={1}>
        Tap the <span className="font-semibold text-text">Share</span> icon at the bottom of Safari (the square with an arrow pointing up).
      </Step>
      <Step n={2}>
        Scroll the share sheet and tap{" "}
        <span className="font-semibold text-text">Add to Home Screen</span>.
      </Step>
      <Step n={3}>
        Tap <span className="font-semibold text-text">Add</span> in the top-right.
      </Step>
    </>
  );
}

function AndroidInstructions() {
  return (
    <>
      <Step n={1}>
        Tap the <span className="font-semibold text-text">⋮ menu</span> icon in your browser&apos;s top-right.
      </Step>
      <Step n={2}>
        Tap <span className="font-semibold text-text">Add to Home screen</span> or{" "}
        <span className="font-semibold text-text">Install app</span>.
      </Step>
      <Step n={3}>
        Confirm to drop the LaserOps shortcut on your home screen.
      </Step>
    </>
  );
}

function GenericInstructions() {
  return (
    <p className="text-text-muted">
      Open this page in your phone&apos;s browser, then use the browser&apos;s
      menu to add it to your home screen.
    </p>
  );
}
