"use client";

/**
 * components/admin/SocialPostsManager.tsx
 * --------------------------------------------------------------------
 * Manages the Instagram / social posts shown in the homepage GallerySection
 * (home_social_posts). Add, edit in place, reorder (display order), show/hide,
 * and delete. Images upload to Cloudinary via /api/admin/image (kind "social");
 * the returned URL is stored on the row. Admin-gated by RLS – no 2FA (content).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type SocialPostRow = {
  id: string;
  postUrl: string;
  imageUrl: string;
  caption: string;
  displayOrder: number;
  status: "published" | "hidden";
};

const input =
  "h-10 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const area =
  "min-h-[64px] w-full rounded-none border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted";

export function SocialPostsManager({ initial }: { initial: SocialPostRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<SocialPostRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, p: Partial<SocialPostRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function addPost() {
    setMsg(null);
    const nextOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), 0) + 10;
    const { error } = await supabase
      .from("home_social_posts")
      .insert({ display_order: nextOrder, status: "hidden" });
    if (error) return setMsg({ ok: false, text: error.message });
    router.refresh();
  }

  async function save(r: SocialPostRow) {
    setBusyId(r.id);
    setMsg(null);
    const { error } = await supabase
      .from("home_social_posts")
      .update({
        post_url: r.postUrl.trim(),
        image_url: r.imageUrl.trim(),
        caption: r.caption.trim(),
        display_order: r.displayOrder,
        status: r.status,
      })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    setMsg(null);
    const { error } = await supabase.from("home_social_posts").delete().eq("id", id);
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
      if (!j.ok || !j.url) {
        setMsg({ ok: false, text: j.error || "Upload failed." });
      } else {
        patch(id, { imageUrl: j.url });
        setMsg({ ok: true, text: "Image uploaded – remember to Save." });
      }
    } catch {
      setMsg({ ok: false, text: "Upload failed." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Social posts</h2>
        <Button variant="secondary" size="sm" onClick={addPost}>+ Add post</Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No posts yet. Add one to feature it on the homepage.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-4 border border-border p-4 sm:grid-cols-[120px_1fr]">
              {/* Image + upload */}
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
                  {busyId === r.id ? "Working…" : "Upload image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(r.id, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Fields */}
              <div className="grid gap-3">
                <div>
                  <label className={labelCls}>Instagram post URL</label>
                  <input className={input} value={r.postUrl} onChange={(e) => patch(r.id, { postUrl: e.target.value })} placeholder="https://www.instagram.com/p/…" />
                </div>
                <div>
                  <label className={labelCls}>Caption</label>
                  <textarea className={area} value={r.caption} onChange={(e) => patch(r.id, { caption: e.target.value })} />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-24">
                    <label className={labelCls}>Order</label>
                    <input className={input} type="number" value={r.displayOrder} onChange={(e) => patch(r.id, { displayOrder: Math.round(Number(e.target.value) || 0) })} />
                  </div>
                  <div className="w-36">
                    <label className={labelCls}>Status</label>
                    <select className={input} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value as SocialPostRow["status"] })}>
                      <option value="published">Published</option>
                      <option value="hidden">Hidden</option>
                    </select>
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
        Lower order shows first. Only &ldquo;Published&rdquo; posts appear on the homepage. New posts start hidden – upload
        an image, paste the post link, then publish. Changes show on the live site within about a minute.
      </p>
    </section>
  );
}
