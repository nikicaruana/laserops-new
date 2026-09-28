"use client";

/**
 * components/portal/WaiverGateForm.tsx
 * --------------------------------------------------------------------
 * Lightweight waiver step for EXISTING players who never signed (migrated
 * accounts already have an ops tag, so they skip full onboarding). Shows the
 * waiver + a required accept, plus a marketing opt-in (prefilled from their
 * current setting). On accept it stamps the waiver and enters the portal.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { WAIVER_TITLE, WAIVER_PARAGRAPHS, MARKETING_CONSENT_TEXT } from "@/lib/waiver";

export function WaiverGateForm({ initialMarketing }: { initialMarketing: boolean }) {
  const [accept, setAccept] = useState(false);
  const [marketing, setMarketing] = useState(initialMarketing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accept) {
      setError("Please read and accept the waiver to continue.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept_waiver: true, marketing_opt_in: marketing }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setSaving(false);
      setError(data.error || "Couldn't save. Please try again.");
      return;
    }
    window.location.assign("/player-portal/player-stats");
  }

  return (
    <form onSubmit={submit} className="space-y-5 portal-card px-6 py-8 sm:px-8">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          {WAIVER_TITLE} <span className="text-accent">*</span>
        </p>
        <div className="max-h-56 space-y-2 overflow-y-auto border border-border bg-bg px-4 py-3 text-xs leading-relaxed text-text-muted">
          {WAIVER_PARAGRAPHS.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-text">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>I have read and agree to the {WAIVER_TITLE} above.</span>
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-text-muted">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        />
        <span>{MARKETING_CONSENT_TEXT}</span>
      </label>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Agree and continue"}
      </Button>
    </form>
  );
}
