"use client";

/**
 * components/admin/ReviewsManager.tsx
 * --------------------------------------------------------------------
 * Manages the Google reviews shown in the homepage GallerySection (home_reviews).
 * Add, edit in place, reorder, show/hide, delete. Admin-gated by RLS – no 2FA.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type ReviewRow = {
  id: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  date: string; // YYYY-MM-DD or ""
  displayOrder: number;
  status: "published" | "hidden";
};

const input =
  "h-10 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const area =
  "min-h-[72px] w-full rounded-none border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted";

export function ReviewsManager({ initial }: { initial: ReviewRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<ReviewRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, p: Partial<ReviewRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function addReview() {
    setMsg(null);
    const nextOrder = rows.reduce((m, r) => Math.max(m, r.displayOrder), 0) + 10;
    const { error } = await supabase
      .from("home_reviews")
      .insert({ display_order: nextOrder, status: "hidden", rating: 5 });
    if (error) return setMsg({ ok: false, text: error.message });
    router.refresh();
  }

  async function save(r: ReviewRow) {
    setBusyId(r.id);
    setMsg(null);
    const { error } = await supabase
      .from("home_reviews")
      .update({
        reviewer_name: r.reviewerName.trim(),
        rating: Math.max(1, Math.min(5, Math.round(r.rating) || 5)),
        review_text: r.reviewText.trim(),
        review_date: r.date.trim() === "" ? null : r.date.trim(),
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
    const { error } = await supabase.from("home_reviews").delete().eq("id", id);
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setRows((rs) => rs.filter((r) => r.id !== id));
    setMsg({ ok: true, text: "Removed." });
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Google reviews</h2>
        <Button variant="secondary" size="sm" onClick={addReview}>+ Add review</Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No reviews yet. Add one to feature it on the homepage.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-3 border border-border p-4">
              <div className="flex flex-wrap gap-3">
                <div className="min-w-[180px] flex-1">
                  <label className={labelCls}>Reviewer name</label>
                  <input className={input} value={r.reviewerName} onChange={(e) => patch(r.id, { reviewerName: e.target.value })} />
                </div>
                <div className="w-28">
                  <label className={labelCls}>Rating (1-5)</label>
                  <input className={input} type="number" min={1} max={5} value={r.rating} onChange={(e) => patch(r.id, { rating: Math.round(Number(e.target.value) || 5) })} />
                </div>
                <div className="w-40">
                  <label className={labelCls}>Date</label>
                  <input className={input} type="date" value={r.date} onChange={(e) => patch(r.id, { date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Review text</label>
                <textarea className={area} value={r.reviewText} onChange={(e) => patch(r.id, { reviewText: e.target.value })} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-24">
                  <label className={labelCls}>Order</label>
                  <input className={input} type="number" value={r.displayOrder} onChange={(e) => patch(r.id, { displayOrder: Math.round(Number(e.target.value) || 0) })} />
                </div>
                <div className="w-36">
                  <label className={labelCls}>Status</label>
                  <select className={input} value={r.status} onChange={(e) => patch(r.id, { status: e.target.value as ReviewRow["status"] })}>
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
          ))}
        </div>
      )}

      {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <p className="mt-3 max-w-2xl text-xs text-text-subtle">
        Lower order shows first. Only &ldquo;Published&rdquo; reviews appear on the homepage. New reviews start hidden.
        Changes show on the live site within about a minute.
      </p>
    </section>
  );
}
