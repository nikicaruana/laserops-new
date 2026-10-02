"use client";

/**
 * components/admin/MatchPhotosManager.tsx
 * --------------------------------------------------------------------
 * Admin UI to upload photos into a match and manage them. Uploads go to
 * Cloudinary (tagged with the match code so they also show in the public
 * gallery) and are recorded in match_photos. Photos appear in the match
 * report's Images section. Player tagging happens on the report/gallery side.
 */
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

export type AdminMatchPhoto = {
  id: string;
  url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  featuredHome?: boolean;
  taggedOps?: string[];
};

export function MatchPhotosManager({ matchId, initial, notifiedAt = null }: { matchId: string; initial: AdminMatchPhoto[]; notifiedAt?: string | null }) {
  const [photos, setPhotos] = useState<AdminMatchPhoto[]>(initial);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [notified, setNotified] = useState<string | null>(notifiedAt);
  const [notifying, setNotifying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function toggleFeatured(id: string, next: boolean) {
    setPhotos((p) => p.map((x) => (x.id === id ? { ...x, featuredHome: next } : x))); // optimistic
    const { error } = await supabase.from("match_photos").update({ featured_home: next }).eq("id", id);
    if (error) {
      setPhotos((p) => p.map((x) => (x.id === id ? { ...x, featuredHome: !next } : x)));
      setError(error.message || "Could not update the homepage flag.");
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    const list = Array.from(files);
    setProgress({ done: 0, total: list.length });
    const added: AdminMatchPhoto[] = [];
    for (let i = 0; i < list.length; i++) {
      const form = new FormData();
      form.append("file", list[i]);
      form.append("matchId", matchId);
      if (caption) form.append("caption", caption);
      try {
        const res = await fetch("/api/admin/match-image", { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; photo?: AdminMatchPhoto; error?: string };
        if (data.ok && data.photo) {
          added.push(data.photo);
        } else {
          setError(data.error || "One or more uploads failed.");
        }
      } catch {
        setError("Upload failed. Check your connection and try again.");
      }
      setProgress({ done: i + 1, total: list.length });
    }
    if (added.length) setPhotos((prev) => [...added, ...prev]);
    setBusy(false);
    setProgress(null);
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function notifyPlayers() {
    setNotifying(true);
    setError("");
    try {
      const res = await fetch("/api/admin/match-image/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const data = (await res.json()) as { ok: boolean; notifiedAt?: string; already?: boolean; error?: string };
      if (!data.ok) setError(data.error || "Could not notify players.");
      else setNotified(data.notifiedAt ?? new Date().toISOString());
    } catch {
      setError("Could not notify players.");
    } finally {
      setNotifying(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this photo? This removes it from the match, the gallery and Cloudinary.")) return;
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/admin/match-image/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setPhotos(prev);
        setError(data.error || "Could not delete the photo.");
      }
    } catch {
      setPhotos(prev);
      setError("Could not delete the photo.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border border-border bg-bg-elevated p-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Caption (optional, applied to this upload)</span>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Red team storming the objective"
            className="border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-col gap-1">
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 bg-accent px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-60"
          >
            {busy ? `Uploading ${progress?.done ?? 0}/${progress?.total ?? 0}…` : "Upload photos"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-border bg-bg-elevated p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Notify players</p>
          <p className="mt-0.5 text-xs text-text-subtle">
            {notified
              ? `Players were notified on ${new Date(notified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`
              : "Sends an email + in-app alert to everyone who played, letting them know the photos are up."}
          </p>
        </div>
        {!notified && (
          <button
            type="button"
            onClick={notifyPlayers}
            disabled={notifying || photos.length === 0}
            className="inline-flex items-center justify-center gap-2 border border-accent bg-accent/10 px-4 py-2 text-sm font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
          >
            {notifying ? "Notifying…" : "Notify players"}
          </button>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

      {photos.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No photos yet. Upload match photos here; they appear in the match report and the public gallery.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative overflow-hidden border border-border bg-bg-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? "Match photo"} loading="lazy" className="block aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => toggleFeatured(p.id, !p.featuredHome)}
                aria-label={p.featuredHome ? "Unfeature from homepage" : "Feature on homepage"}
                title={p.featuredHome ? "Featured on homepage" : "Feature on homepage"}
                className={cn(
                  "absolute left-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-base leading-none transition-opacity",
                  p.featuredHome ? "text-accent opacity-100" : "text-text-muted opacity-0 hover:text-accent group-hover:opacity-100",
                )}
              >
                {p.featuredHome ? "\u2605" : "\u2606"}
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="Delete photo"
                className={cn(
                  "absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-lg leading-none text-text-muted",
                  "opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100",
                )}
              >
                ×
              </button>
              {p.caption && (
                <p className="truncate px-2 py-1.5 text-[0.65rem] text-text-muted" title={p.caption}>
                  {p.caption}
                </p>
              )}
              {p.taggedOps && p.taggedOps.length > 0 && (
                <p className="px-2 pb-1.5 text-[0.6rem] text-accent">Tagged: {p.taggedOps.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
