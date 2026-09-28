"use client";

/**
 * components/admin/CreateLadderForm.tsx – admin creates a new ladder.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function CreateLadderForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!k || !name.trim()) return setError("Give the ladder a key and a name.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.from("ladders").insert({ key: k, name: name.trim() }).select("id").single();
    setBusy(false);
    if (err || !data) return setError(err?.code === "23505" ? "That key is already taken." : err?.message || "Couldn't create.");
    router.push(`/admin/ladders/${data.id}`);
  }

  return (
    <div className="max-w-md border border-border bg-bg-elevated px-5 py-5">
      <p className={lbl}>New ladder</p>
      <div className="space-y-3">
        <div>
          <label className={lbl}>Key (URL slug)</label>
          <input className={input} value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. summer-2026" />
        </div>
        <div>
          <label className={lbl}>Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Ladder" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <Button type="button" size="sm" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create ladder"}</Button>
      </div>
    </div>
  );
}
