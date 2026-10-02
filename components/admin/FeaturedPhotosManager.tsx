"use client";

/**
 * components/admin/FeaturedPhotosManager.tsx
 * --------------------------------------------------------------------
 * Picks the photos shown in the homepage "LaserOps in Action" strip
 * (home_featured_photos), replacing the Cloudinary `featured` tag. Paste a
 * Cloudinary image URL (from any match / gallery photo) or upload one, add an
 * optional caption, and order them. Admin-gated by RLS. When no photos are set
 * here the homepage falls back to the old `featured` tag.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type FeaturedPhotoRow = { id: string; imageUrl: string; caption: string; displayOrder: number };

const input =
  "h-10 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted";

export function FeaturedPhotosManager({ initial }: { initial: FeaturedPhotoRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<FeaturedPhotoRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, p: Partial<FeaturedPhotoRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function addPhoto() {
    setMsg(null);
    const nextOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), 0) + 10;
    const { error } = await supabase.from("home_featured_photos").insert({ display_order: nextOrder });
    if (error) return setMsg({ ok: false, text: error.message });
    router.refresh();
  }

  async function save(r: FeaturedPhotoRow) {
    setBusyId(r.id);
    setMsg(null);
    const { error } = await supabase
      .from("home_featured_photos")
      .update({ image_url: r.imageUrl.trim(), caption: r.caption.trim(), display_order: r.displayOrder })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    setMsg(null);
    const { error } = await supabase.from("home_featured_photos").delete().eq("id", id);
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setRows((rs) => rs.filter((r) => r.id !== id));
    setMsg({ ok: true, text: "Removed." });
  }

  async function upload(id: string, file: File) {
    setBusyId(id);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "social");
    try {
      const res = await fetch("/api/admin/image", { method: "POST", body: fd });
      const j = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!j.ok || !j.url) setMsg({ ok: false, text: j.error || "Upload failed." });
      else { patch(id, { imageUrl: j.url }); setMsg({ ok: true, text: "Uploaded - remember to Save." }); }
    } catch {
      setMsg({ ok: false, text: "Upload failed." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Featured photos (homepage strip)</h2>
        <Button variant="secondary" size="sm" onClick={addPhoto}>+ Add photo</Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          No featured photos selected. While this is empty the homepage shows photos tagged
          &ldquo;featured&rdquo; in Cloudinary. Add photos here to take over.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-4 border border-border p-4 sm:grid-cols-[120px_1fr]">
              <div>
                <div className="aspect-square w-full overflow-hidden border border-border bg-bg">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[0.6rem] uppercase tracking-[0.12em] text-text-subtle">
                      No image
                    </div>
                  )}
                </div>
                <label className="mt-2 block cursor-pointer text-center text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-accent hover:text-accent-soft">
                  {busyId === r.id ? "Working…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(r.id, f); e.target.value = ""; }}
                  />
                </label>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className={labelCls}>Image URL (paste a Cloudinary link, or upload)</label>
                  <input className={input} value={r.imageUrl} onChange={(e) => patch(r.id, { imageUrl: e.target.value })} placeholder="https://res.cloudinary.com/…" />
                </div>
                <div>
                  <label className={labelCls}>Caption (optional)</label>
                  <input className={input} value={r.caption} onChange={(e) => patch(r.id, { caption: e.target.value })} />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-24">
                    <label className={labelCls}>Order</label>
                    <input className={input} type="number" value={r.displayOrder} onChange={(e) => patch(r.id, { displayOrder: Math.round(Number(e.target.value) || 0) })} />
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="primary" size="sm" onClick={() => save(r)} disabled={busyId === r.id}>
                      {busyId === r.id ? "Saving…" : "Save"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={busyId === r.id}
                      className="px-2 text-xs font-semibold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <p className="mt-3 max-w-2xl text-xs text-text-subtle">
        Lower order shows first; up to 9 appear on the homepage. Tip: open the gallery, copy a photo&rsquo;s
        image address, and paste it here to feature it.
      </p>
    </section>
  );
}
