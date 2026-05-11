"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "laserops_consent_v1";

type ConsentState = {
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
};

type GtagConsentParams = {
  analytics_storage: "granted" | "denied";
  ad_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildConsentParams(state: ConsentState): GtagConsentParams {
  return {
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
  };
}

function pushConsentUpdate(params: GtagConsentParams) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  // Use the same gtag() call pattern as the Consent Mode v2 default script.
  // Pushing via arguments object matches what gtag() itself does internally.
  function gtag(..._args: unknown[]) {
    // biome-ignore lint/style/noArguments: gtag requires the arguments object
    window.dataLayer!.push(arguments as unknown as Record<string, unknown>);
  }
  gtag("consent", "update", params);
}

function readStorage(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

function writeStorage(state: ConsentState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode, storage full) — silent fail
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CookieConsent
 * --------------------------------------------------------------------
 * GDPR consent banner wired to GTM Consent Mode v2.
 *
 * On mount:
 *   - Reads localStorage for a prior consent decision.
 *   - If found: silently re-applies via gtag('consent', 'update', …),
 *     no banner shown.
 *   - If not found: shows the fixed bottom banner.
 *
 * User choices:
 *   - Accept All   → analytics + marketing both granted
 *   - Decline All  → both denied
 *   - Manage       → inline panel with per-category toggles + Save
 *
 * Re-opening:
 *   Listens for the custom DOM event `laserops:open-cookie-settings`
 *   so the Footer "Cookie Settings" link can re-open the banner at any
 *   time. The panel re-opens with the current saved state pre-filled.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // On mount: check localStorage. Re-apply consent silently if already set.
  useEffect(() => {
    const saved = readStorage();
    if (saved) {
      pushConsentUpdate(buildConsentParams(saved));
      // Don't show banner — user already decided.
    } else {
      setVisible(true);
    }
  }, []);

  // Listen for re-open events fired by the Footer "Cookie Settings" link.
  useEffect(() => {
    const handleReopen = () => {
      const saved = readStorage();
      if (saved) {
        setAnalytics(saved.analytics);
        setMarketing(saved.marketing);
      }
      setManaging(false);
      setVisible(true);
    };
    document.addEventListener("laserops:open-cookie-settings", handleReopen);
    return () =>
      document.removeEventListener("laserops:open-cookie-settings", handleReopen);
  }, []);

  const applyAndClose = useCallback((state: ConsentState) => {
    writeStorage(state);
    pushConsentUpdate(buildConsentParams(state));
    setVisible(false);
    setManaging(false);
  }, []);

  const handleAcceptAll = useCallback(() => {
    applyAndClose({ analytics: true, marketing: true, timestamp: Date.now() });
  }, [applyAndClose]);

  const handleDeclineAll = useCallback(() => {
    applyAndClose({ analytics: false, marketing: false, timestamp: Date.now() });
  }, [applyAndClose]);

  const handleSavePreferences = useCallback(() => {
    applyAndClose({ analytics, marketing, timestamp: Date.now() });
  }, [analytics, marketing, applyAndClose]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-bg shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
    >
      {/* ── Manage Preferences panel ──────────────────────────── */}
      {managing && (
        <div className="border-b border-border bg-bg-elevated px-5 py-5 sm:px-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
            Manage Preferences
          </p>
          <div className="space-y-4">
            <ToggleRow
              id="consent-analytics"
              label="Analytics"
              description="Helps us understand which pages are popular and how people find us."
              checked={analytics}
              onChange={setAnalytics}
            />
            <ToggleRow
              id="consent-marketing"
              label="Marketing"
              description="Used to show relevant ads for LaserOps on other platforms (Meta, Google)."
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
          <button
            type="button"
            onClick={handleSavePreferences}
            className="mt-5 h-10 w-full border border-accent px-6 text-xs font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent hover:text-bg sm:w-auto"
          >
            Save Preferences
          </button>
        </div>
      )}

      {/* ── Main banner ───────────────────────────────────────── */}
      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
          {/* Text */}
          <div className="flex-1">
            <p className="text-sm font-bold text-text">We use cookies</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              We use cookies to understand how people use our site and to show
              relevant ads. You can accept all, decline all, or choose what
              you&rsquo;re comfortable with.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
            <button
              type="button"
              onClick={handleDeclineAll}
              className="h-10 border border-border px-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              Decline All
            </button>
            <button
              type="button"
              onClick={() => {
                if (!managing) {
                  // Pre-fill toggles from saved state (or defaults) when opening.
                  const saved = readStorage();
                  setAnalytics(saved?.analytics ?? false);
                  setMarketing(saved?.marketing ?? false);
                }
                setManaging((m) => !m);
              }}
              className="h-10 border border-border px-4 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              {managing ? "Hide" : "Manage"}
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="h-10 bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle row
// ---------------------------------------------------------------------------

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          checked ? "border-accent bg-accent" : "border-border bg-bg-overlay",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform",
            checked ? "translate-x-4 bg-bg" : "translate-x-0.5 bg-text-muted",
          )}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>

      {/* Label + description */}
      <label htmlFor={id} className="cursor-pointer">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-text">
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
          {description}
        </p>
      </label>
    </div>
  );
}
