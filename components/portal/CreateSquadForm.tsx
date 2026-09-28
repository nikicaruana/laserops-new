"use client";

/**
 * components/portal/CreateSquadForm.tsx
 * --------------------------------------------------------------------
 * Create a squad (you become its captain). The create_squad RPC enforces the
 * caps (1 created + 2 joined per player). Badge upload comes in a later phase.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SquadBadgeUploader } from "@/components/portal/SquadBadgeUploader";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function CreateSquadForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [searchable, setSearchable] = useState(true);
  const [badge, setBadge] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Give your squad a name (at least 2 characters).");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/squads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, is_searchable: searchable }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
    if (!res.ok || !json.ok || !json.id) {
      setSaving(false);
      setError(json.error || "Couldn't create the squad.");
      return;
    }
    // Upload the badge now that the squad exists (best-effort).
    if (badge) {
      try {
        const form = new FormData();
        form.append("file", badge, "badge.jpg");
        form.append("squad_id", json.id);
        await fetch("/api/squad-badge", { method: "POST", body: form });
      } catch {
        /* badge can be added later on the manage page */
      }
    }
    setSaving(false);
    router.push(`/player-portal/squads/${json.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <fieldset className="portal-card px-5 py-5">
        <legend className="px-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">Squad</legend>
        <div className="space-y-4">
          <div>
            <label className={lbl}>Badge <span className="text-text-subtle">(optional)</span></label>
            <SquadBadgeUploader name={name || "SQ"} onChange={setBadge} />
          </div>
          <div>
            <label className={lbl}>Squad name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Night Owls" />
          </div>
          <div>
            <label className={lbl}>Description <span className="text-text-subtle">(optional)</span></label>
            <textarea
              className={`${input} h-24 py-2`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={400}
              placeholder="What's your squad about?"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input type="checkbox" checked={searchable} onChange={(e) => setSearchable(e.target.checked)} className="h-4 w-4 accent-accent" />
            <span>
              Publicly joinable
              <span className="ml-1 text-xs text-text-subtle">– shows in Find a Squad and players can request to join. Your invite link joins instantly either way.</span>
            </span>
          </label>
        </div>
      </fieldset>

      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4">
        <Button type="submit" size="md" disabled={saving}>
          {saving ? "Creating…" : "Create squad"}
        </Button>
        <p className="text-[0.65rem] text-text-subtle">You can create 1 squad and be in up to 2.</p>
      </div>
    </form>
  );
}
