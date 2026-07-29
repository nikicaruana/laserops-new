"use client";

/**
 * components/portal/OnboardingForm.tsx
 * --------------------------------------------------------------------
 * First-run setup shown right after a new player confirms their email or
 * signs in with Google. They pick an Ops Tag (required), optionally a photo,
 * real name, and birthday, and must accept the liability waiver. They can
 * also opt in to marketing emails. The avatar uploads on its own (via the
 * AvatarUploader); this form saves the rest and enters the portal. Until an
 * Ops Tag is set the account is "not onboarded" and is routed back here.
 */
import { useState } from "react";
import { AvatarUploader } from "@/components/portal/AvatarUploader";
import { Button } from "@/components/ui/Button";
import {
  WAIVER_TITLE,
  WAIVER_PARAGRAPHS,
  MARKETING_CONSENT_TEXT,
} from "@/lib/waiver";

const inputStyles =
  "h-14 w-full rounded-none border border-border-strong bg-bg-elevated px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

export function OnboardingForm({
  initialFullName,
  initialAvatarUrl,
}: {
  initialFullName: string | null;
  initialAvatarUrl: string | null;
}) {
  const [opsTag, setOpsTag] = useState("");
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [dob, setDob] = useState("");
  const [acceptWaiver, setAcceptWaiver] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (opsTag.trim().length < 3) {
      setError("Choose an ops tag (at least 3 characters).");
      return;
    }
    if (!acceptWaiver) {
      setError("Please read and accept the waiver to continue.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ops_tag: opsTag,
        full_name: fullName,
        date_of_birth: dob || null,
        accept_waiver: true,
        marketing_opt_in: marketingOptIn,
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      setSaving(false);
      setError(data.error || "Couldn't save. Please try again.");
      return;
    }
    window.location.assign("/player-portal");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4">
        <AvatarUploader initialUrl={initialAvatarUrl} opsTag={opsTag || null} />
        <p className="text-xs text-text-subtle">
          Add a photo now, or keep the default operative and change it later.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Ops Tag <span className="text-accent">*</span>
          </label>
          <input
            value={opsTag}
            onChange={(e) => setOpsTag(e.target.value)}
            maxLength={24}
            placeholder="Your ops tag"
            autoFocus
            className={inputStyles}
          />
          <p className="mt-1.5 text-xs text-text-subtle">
            This is how you&apos;ll appear on the leaderboards. 3–24 characters.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Full name <span className="text-text-subtle">(optional)</span>
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={80}
            placeholder="Your name"
            className={inputStyles}
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            Date of birth <span className="text-text-subtle">(optional)</span>
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className={inputStyles}
          />
        </div>

        {/* Waiver (required) */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            {WAIVER_TITLE} <span className="text-accent">*</span>
          </p>
          <div className="max-h-40 space-y-2 overflow-y-auto border border-border bg-bg px-4 py-3 text-xs leading-relaxed text-text-muted">
            {WAIVER_PARAGRAPHS.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={acceptWaiver}
              onChange={(e) => setAcceptWaiver(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span>I have read and agree to the {WAIVER_TITLE} above.</span>
          </label>
        </div>

        {/* Marketing (optional) */}
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-text-muted">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          <span>{MARKETING_CONSENT_TEXT}</span>
        </label>

        {error && (
          <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Setting up…" : "Enter the portal"}
        </Button>
        <p className="text-center text-xs text-text-subtle">
          You can change your details later in your profile.
        </p>
      </form>
    </div>
  );
}
