"use client";

/**
 * components/match-report/MatchImages.tsx
 * --------------------------------------------------------------------
 * Collapsible "Match Photos" section on the match report. Clicking a photo opens
 * the shared full-screen GalleryLightbox (same floating previewer as /gallery).
 * In the lightbox a signed-in player can tag themselves ("Tag myself"), admins
 * can tag/untag any player in the match, and a tagged player can share the photo
 * to a story (PhotoStoryComposer) with their live stats overlay.
 *
 * `demo` (used on the admin preview) keeps tagging client-only so the flow can
 * be exercised without real DB photos; sharing still renders for real.
 */
import { useEffect, useRef, useState } from "react";
import { PhotoStoryComposer } from "./PhotoStoryComposer";
import type { OverlayData } from "@/lib/story/meta";
import { cn } from "@/lib/cn";
import { cldImage } from "@/lib/cld";
import { GalleryLightbox, type LightboxImage } from "@/components/gallery/GalleryLightbox";

export type ReportPhoto = {
  id: string;
  url: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  taggedOps: string[];
};

type Props = {
  photos: ReportPhoto[];
  matchId: string;
  /** Signed-in viewer's ops tag ("" when signed out). */
  viewerOps?: string;
  isAdmin?: boolean;
  /** Ops tags of players in this match, for admin tagging. */
  roster?: string[];
  /** Preview mode: tag changes stay client-side (no API). */
  demo?: boolean;
  /** The viewer's overlay data, for the live band in the share composer. */
  overlayData?: OverlayData;
};

export function MatchImages({ photos, matchId, viewerOps = "", isAdmin = false, roster = [], demo = false, overlayData }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [composerPhoto, setComposerPhoto] = useState<string | null>(null);
  const [tags, setTags] = useState<Record<string, string[]>>(() => Object.fromEntries(photos.map((p) => [p.id, p.taggedOps])));

  // In demo mode (admin preview) the sample photos aren't real DB rows, so tags
  // can't persist to Supabase. Mirror them to localStorage so they survive a
  // reload, matching how real matches persist via the DB. (No-op on real reports.)
  const storeKey = `laserops-demo-tags:${matchId}`;
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!demo) {
      loadedRef.current = true;
      return;
    }
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setTags((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<string, string[]>) }));
    } catch {
      /* ignore */
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, matchId]);
  useEffect(() => {
    if (!demo || !loadedRef.current) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify(tags));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, matchId, tags]);

  if (photos.length === 0) return null;

  const viewerLc = viewerOps.trim().toLowerCase();

  async function apiTag(photoId: string, ops?: string) {
    if (demo) return;
    await fetch(`/api/photos/${photoId}/tag`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ops ? { ops } : {}),
    }).catch(() => {});
  }
  async function apiUntag(photoId: string, ops?: string) {
    if (demo) return;
    await fetch(`/api/photos/${photoId}/tag`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ops ? { ops } : {}),
    }).catch(() => {});
  }

  function addTag(photoId: string, ops: string, self: boolean) {
    setTags((t) => ({ ...t, [photoId]: [...(t[photoId] ?? []), ops] }));
    void apiTag(photoId, self ? undefined : ops);
  }
  function removeTag(photoId: string, ops: string, self: boolean) {
    setTags((t) => ({ ...t, [photoId]: (t[photoId] ?? []).filter((o) => o.toLowerCase() !== ops.toLowerCase()) }));
    void apiUntag(photoId, self ? undefined : ops);
  }

  const lightboxImages: LightboxImage[] = photos.map((p) => ({
    secureUrl: cldImage(p.url, { w: 1600 }),
    width: p.width ?? 1200,
    height: p.height ?? 800,
    caption: p.caption ?? undefined,
  }));

  const btn = "rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors";
  const renderActions = (i: number) => {
    const p = photos[i];
    if (!p) return null;
    const photoTags = tags[p.id] ?? [];
    const selfTagged = viewerLc !== "" && photoTags.some((o) => o.toLowerCase() === viewerLc);
    const untagged = roster.filter((r) => !photoTags.some((o) => o.toLowerCase() === r.toLowerCase()));
    return (
      <div className="flex w-full flex-col items-center gap-2.5">
        {photoTags.length > 0 && (
          <p className="text-center text-xs text-white/70">
            In this photo:{" "}
            {photoTags.map((o, idx) => (
              <span key={o}>
                <span className={o.toLowerCase() === viewerLc ? "text-accent" : ""}>{o}</span>
                {isAdmin && (
                  <button type="button" onClick={() => removeTag(p.id, o, false)} aria-label={`Untag ${o}`} className="ml-0.5 text-white/40 hover:text-red-400">
                    ×
                  </button>
                )}
                {idx < photoTags.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {viewerOps && (
            <button
              type="button"
              onClick={() => (selfTagged ? removeTag(p.id, viewerOps, true) : addTag(p.id, viewerOps, true))}
              className={cn(btn, selfTagged ? "border-white/30 text-white/80 hover:border-red-400 hover:text-red-400" : "border-accent text-accent hover:bg-accent hover:text-bg")}
            >
              {selfTagged ? "Remove my tag" : "Tag myself"}
            </button>
          )}

          {selfTagged && (
            <button
              type="button"
              onClick={() => { setComposerPhoto(p.url); setActive(null); }}
              className={cn(btn, "border-accent bg-accent text-bg hover:bg-accent-soft")}
            >
              Share to story
            </button>
          )}

          {isAdmin && untagged.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addTag(p.id, e.target.value, false);
                  e.currentTarget.value = "";
                }
              }}
              className="rounded-sm border border-white/30 bg-black/50 px-2 py-1.5 text-xs text-white"
            >
              <option value="" disabled>Tag a player…</option>
              {untagged.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>

        {!viewerOps && <p className="text-[0.7rem] text-white/50">Sign in to tag yourself and share.</p>}
      </div>
    );
  };

  return (
    <section className="portal-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <span className="text-base font-extrabold uppercase tracking-[0.14em] text-text sm:text-lg">Match Photos</span>
          <span className="rounded-sm bg-accent px-2 py-0.5 text-xs font-bold text-bg">{photos.length}</span>
        </span>
        <svg aria-hidden viewBox="0 0 16 16" className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <div className="gap-3 sm:columns-2 lg:columns-3">
            {photos.map((p, i) => (
              <button key={p.id} type="button" onClick={() => setActive(i)} className="mb-3 block w-full overflow-hidden rounded-sm border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cldImage(p.url, { w: 800 })} alt={p.caption ?? "Match photo"} loading="lazy" className="block w-full transition-transform hover:scale-[1.02]" />
              </button>
            ))}
          </div>
        </div>
      )}

      <GalleryLightbox images={lightboxImages} index={active} onClose={() => setActive(null)} renderActions={renderActions} />

      {composerPhoto && viewerOps && (
        <PhotoStoryComposer matchId={matchId} ops={viewerOps} photoUrl={composerPhoto} overlayData={overlayData} onClose={() => setComposerPhoto(null)} />
      )}
    </section>
  );
}
