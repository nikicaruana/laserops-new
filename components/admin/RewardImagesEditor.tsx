"use client";

/**
 * components/admin/RewardImagesEditor.tsx
 * --------------------------------------------------------------------
 * Upload the reward artwork the app + emails reuse: the game-token coin and the
 * XP-boost tokens (2x / 1.5x). One image per reward key, stored in reward_images
 * (admin-write RLS). The game-token image feeds the {{tokenImageUrl}} email token.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

export type RewardImage = { key: string; label: string; image_url: string | null };

export function RewardImagesEditor({ initial }: { initial: RewardImage[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RewardImage[]>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, image_url: string | null) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, image_url } : r)));
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("reward_images")
      .upsert(rows.map((r) => ({ key: r.key, label: r.label, image_url: r.image_url })), { onConflict: "key" });
    setBusy(false);
    if (err) return setError(err.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-5">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className="border border-border bg-bg-elevated px-5 py-5">
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-text-muted">{r.label}</p>
            <AdminImageUploader
              value={r.image_url}
              onChange={(url) => set(r.key, url)}
              kind="reward"
              previewClass="h-24 w-24"
              expandable
            />
            <p className="mt-2 font-mono text-[0.6rem] text-text-subtle">{r.key}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="md" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save reward images"}</Button>
        {saved && <span className="text-xs text-accent">Saved.</span>}
      </div>
    </div>
  );
}
