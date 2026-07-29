"use client";

/**
 * components/portal/OnboardingForm.tsx
 * --------------------------------------------------------------------
 * First-run setup shown right after a new player confirms their email or
 * signs in with Google. They pick a callsign (required) and optionally a
 * photo, real name, and birthday. The avatar uploads on its own (via the
 * AvatarUploader); this form saves the callsign + optional fields and then
 * enters the portal. Until a callsign is set the account is considered
 * "not onboarded" and is routed back here.
 */
import { useState } from "react";
import { AvatarUploader } from "@/components/portal/AvatarUploader";
import { Button } from "@/components/ui/Button";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (opsTag.trim().length < 3) {
      setError("Choose a callsign (at least 3 characters).");
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
            Callsign <span className="text-accent">*</span>
          </label>
          <input
            value={opsTag}
            onChange={(e) => setOpsTag(e.target.value)}
            maxLength={24}
            placeholder="Your callsign"
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

        {error && (
          <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Setting up…" : "Enter the portal"}
        </Button>
        <p className="text-center text-xs text-text-subtle">
          You can change any of this later in your profile.
        </p>
      </form>
    </div>
  );
}
