"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * InstallAppButton (formerly AddToHomeScreen)
 * --------------------------------------------------------------------
 * Universal "Install LaserOps" button. Behaviour adapts to the platform:
 *
 *   - **Android Chrome (and any browser firing `beforeinstallprompt`)**:
 *     Captures the deferred prompt event on mount, suppresses Chrome's
 *     auto-banner, and triggers the native install prompt when our
 *     button is clicked. After user accepts/dismisses, the prompt is
 *     consumed (cannot re-fire).
 *
 *   - **iOS Safari**: there is NO programmatic API to trigger Add-to-
 *     Home-Screen on iOS. The button opens an instructional modal
 *     walking the user through the Share-sheet steps manually.
 *
 *   - **Already installed (any platform)**: button is hidden. We detect
 *     this via display-mode standalone (Chrome/Android) and
 *     navigator.standalone (iOS Safari).
 *
 *   - **Other browsers** (Firefox iOS, browsers with no install path):
 *     button is hidden. We don't have anything useful to offer.
 *
 * Visibility:
 *   - Phone-only (sm:hidden). Tablets/desktop have less compelling
 *     install stories and the page header layout doesn't accommodate
 *     this control gracefully on wider widths.
 *   - Hidden if user dismissed it once this session (sessionStorage).
 *     Persistent localStorage feels too aggressive — letting them see
 *     it again next visit is fine.
 *   - Hidden after a successful install (via the appinstalled event).
 */

type Platform = "ios" | "android" | "other";

/**
 * Type for Chrome's BeforeInstallPromptEvent — not in standard TS DOM lib
 * since the install prompt is a Chrome extension, not a web standard.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

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
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const displayModeStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return iosStandalone || displayModeStandalone;
}

const SESSION_DISMISS_KEY = "laserops:install-dismissed";

export function InstallAppButton() {
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  /**
   * The captured beforeinstallprompt event. We save this so our button
   * click can replay it. Held in a ref so we can also use it for the
   * "is the prompt available?" check without triggering re-renders.
   */
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  // Mirror the existence of the deferred prompt as state too, so
  // visibility logic (which depends on having a prompt available)
  // re-renders when one becomes available.
  const [hasPrompt, setHasPrompt] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    const wasDismissed =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
    setPlatform(detectPlatform());
    setMounted(true);

    // Capture beforeinstallprompt — fired by Chrome when the page
    // qualifies for install. Suppress the auto-banner so our custom
    // button is the only entry point. The event will only fire
    // once per page load; we save it for later replay on click.
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setHasPrompt(true);
    }

    // Detect successful install — the appinstalled event fires
    // regardless of how the install was triggered (our button, Chrome's
    // own UI, manual A2HS, etc.). Hide our button when this fires.
    function handleAppInstalled() {
      setInstalled(true);
      deferredPromptRef.current = null;
      setHasPrompt(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!mounted || installed || dismissed) return null;

  // Visibility decision: who should see this button?
  //   - iOS users: always (we show the instructional modal). They can
  //     install via Share sheet.
  //   - Android/Chrome users: only if we've captured the prompt event.
  //     If the prompt hasn't fired yet, the button does nothing useful.
  //   - "Other" platforms (e.g. Firefox iOS, niche browsers): hide. No
  //     install path we can offer.
  const showButton =
    platform === "ios" || (platform === "android" && hasPrompt) || (platform === "other" && hasPrompt);

  if (!showButton) return null;

  async function handleClick() {
    // iOS: open instructional modal. No API.
    if (platform === "ios") {
      setOpen(true);
      return;
    }

    // Other platforms with a captured prompt: trigger native install.
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) {
      // Fallback: open instructional modal if for some reason we don't
      // have the event but expected to. Edge case but safe.
      setOpen(true);
      return;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      // Whether accepted or dismissed, the event is now consumed.
      // Clear it. The appinstalled listener will hide the button if
      // user accepted; otherwise the button stays for a retry on next
      // page load (when the event fires again).
      deferredPromptRef.current = null;
      setHasPrompt(false);
      if (choice.outcome === "dismissed") {
        // User said no this time. Don't pester for the rest of this
        // session — but also don't permanently dismiss; they may change
        // their mind on a future visit.
        handleDismissForSession();
      }
    } catch {
      // prompt() can throw on certain browser states; fail silently
      // and let the user try again later.
    }
  }

  function handleDismissForSession() {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // sessionStorage can throw in private mode — ignore.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "sm:hidden",
          "inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-3 py-1.5",
          "text-[0.65rem] font-bold uppercase tracking-[0.14em] text-bg",
          "transition-colors hover:bg-accent-soft",
        )}
        aria-label="Install LaserOps as an app on your device"
      >
        {/* Phone-with-arrow icon — purpose-built so it reads as "install
            on phone" rather than a generic plus. */}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 1.5v6M3.5 5L6 7.5 8.5 5M2 9.5h8" strokeLinecap="square" />
        </svg>
        Install App
      </button>

      {/* iOS-only modal. Other platforms get the native prompt instead. */}
      {open && platform === "ios" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
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

            <div className="flex items-center gap-2">
              <span aria-hidden className="block h-px w-8 bg-accent" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
                Field Kit
              </span>
            </div>

            <h2
              id="install-title"
              className="mt-3 text-2xl font-extrabold leading-tight"
            >
              Install LaserOps on your iPhone
            </h2>

            <p className="mt-2 text-sm text-text-muted">
              Track your stats and rank in one tap. No app store needed.
            </p>

            <div className="mt-5 space-y-3 text-sm text-text">
              <Step n={1}>
                Tap the <span className="font-semibold text-text">Share</span> icon
                at the bottom of Safari (the square with an arrow pointing up).
              </Step>
              <Step n={2}>
                Scroll the share sheet and tap{" "}
                <span className="font-semibold text-text">Add to Home Screen</span>.
              </Step>
              <Step n={3}>
                Tap <span className="font-semibold text-text">Add</span> in the top-right.
              </Step>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleDismissForSession}
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

/* ---------- Step component ---------- */

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

/**
 * Backwards-compatibility export — the component used to be called
 * AddToHomeScreen. Existing imports continue to work.
 */
export { InstallAppButton as AddToHomeScreen };
