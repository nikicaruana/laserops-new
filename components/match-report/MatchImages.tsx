"use client";

/**
 * components/match-report/MatchImages.tsx
 * --------------------------------------------------------------------
 * Collapsible "Images" section on the match report: the photos an admin
 * uploaded to this match, with a lightbox. In the lightbox a signed-in player
 * can tag themselves ("I'm in this"), admins can tag any player, and a player
 * who is tagged can share the photo to a story (PhotoStoryComposer).
 *
 * `demo` (used on the admin preview) keeps tagging client-only so the flow can
 * be exercised without real DB photos; sharing still renders for real.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PhotoStoryComposer } from "./PhotoStoryComposer";
import type { OverlayData } from "@/lib/story/meta";
import { cn } from "@/lib/cn";
import { cldImage } from "@/lib/cld";

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

  function isTagged(photoId: string, ops: string) {
    return (tags[photoId] ?? []).some((o) => o.toLowerCase() === ops.toLowerCase());
  }

  function addTag(photoId: string, ops: string, self: boolean) {
    setTags((t) => ({ ...t, [photoId]: [...(t[photoId] ?? []), ops] }));
    void apiTag(photoId, self ? undefined : ops);
  }
  function removeTag(photoId: string, ops: string, self: boolean) {
    setTags((t) => ({ ...t, [photoId]: (t[photoId] ?? []).filter((o) => o.toLowerCase() !== ops.toLowerCase()) }));
    void apiUntag(photoId, self ? undefined : ops);
  }

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

      {active !== null && (
        <Lightbox
          photos={photos}
          index={active}
          tags={tags}
          viewerOps={viewerOps}
          viewerLc={viewerLc}
          isAdmin={isAdmin}
          roster={roster}
          onClose={() => setActive(null)}
          onIndex={(i) => setActive(((i % photos.length) + photos.length) % photos.length)}
          onToggleSelf={(photoId) => (isTagged(photoId, viewerOps) ? removeTag(photoId, viewerOps, true) : addTag(photoId, viewerOps, true))}
          onAdminAdd={(photoId, ops) => addTag(photoId, ops, false)}
          onAdminRemove={(photoId, ops) => removeTag(photoId, ops, false)}
          onShare={(url) => {
            setComposerPhoto(url);
            setActive(null); // close the lightbox so the composer isn't behind it
          }}
        />
      )}

      {composerPhoto && viewerOps && (
        <PhotoStoryComposer matchId={matchId} ops={viewerOps} photoUrl={composerPhoto} overlayData={overlayData} onClose={() => setComposerPhoto(null)} />
      )}
    </section>
  );
}

function Lightbox(props: {
  photos: ReportPhoto[];
  index: number;
  tags: Record<string, string[]>;
  viewerOps: string;
  viewerLc: string;
  isAdmin: boolean;
  roster: string[];
  onClose: () => void;
  onIndex: (i: number) => void;
  onToggleSelf: (photoId: string) => void;
  onAdminAdd: (photoId: string, ops: string) => void;
  onAdminRemove: (photoId: string, ops: string) => void;
  onShare: (url: string) => void;
}) {
  const { photos, index, tags, viewerOps, viewerLc, isAdmin, roster, onClose, onIndex, onToggleSelf, onAdminAdd, onAdminRemove, onShare } = props;
  const p = photos[index];
  const photoTags = tags[p.id] ?? [];
  const selfTagged = viewerLc !== "" && photoTags.some((o) => o.toLowerCase() === viewerLc);
  const untagged = useMemo(() => roster.filter((r) => !photoTags.some((o) => o.toLowerCase() === r.toLowerCase())), [roster, photoTags]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndex(index - 1);
      if (e.key === "ArrowRight") onIndex(index + 1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, onClose, onIndex]);

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-black/95 p-4 sm:p-6">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border-strong text-2xl leading-none text-text-muted hover:text-accent">×</button>

      {photos.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }} aria-label="Previous" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-bg/70 text-2xl text-text-muted hover:text-accent sm:left-4">‹</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }} aria-label="Next" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-bg/70 text-2xl text-text-muted hover:text-accent sm:right-4">›</button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cldImage(p.url, { w: 1600 })} alt={p.caption ?? "Match photo"} onClick={(e) => e.stopPropagation()} className="max-h-[62vh] w-auto max-w-full rounded-sm border border-border-strong" />

      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col items-center gap-2.5">
        {p.caption && <p className="text-center text-sm text-text">{p.caption}</p>}

        {photoTags.length > 0 && (
          <p className="text-center text-xs text-text-muted">
            In this photo:{" "}
            {photoTags.map((o, i) => (
              <span key={o}>
                <span className={o.toLowerCase() === viewerLc ? "text-accent" : ""}>{o}</span>
                {isAdmin && (
                  <button type="button" onClick={() => onAdminRemove(p.id, o)} aria-label={`Untag ${o}`} className="ml-0.5 text-text-subtle hover:text-red-400">×</button>
                )}
                {i < photoTags.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {viewerOps && (
            <button
              type="button"
              onClick={() => onToggleSelf(p.id)}
              className={cn("rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors", selfTagged ? "border-border-strong text-text-muted hover:text-red-400" : "border-accent text-accent hover:bg-accent hover:text-bg")}
            >
              {selfTagged ? "Remove my tag" : "Tag myself"}
            </button>
          )}

          {selfTagged && (
            <button
              type="button"
              onClick={() => onShare(p.url)}
              className="inline-flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-bg transition-colors hover:bg-accent-soft"
            >
              Share to story
            </button>
          )}

          {isAdmin && untagged.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAdminAdd(p.id, e.target.value);
                  e.currentTarget.value = "";
                }
              }}
              className="rounded-sm border border-border bg-bg px-2 py-1.5 text-xs text-text"
            >
              <option value="" disabled>Tag a player…</option>
              {untagged.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>

        {!viewerOps && <p className="text-[0.7rem] text-text-subtle">Sign in to tag yourself and share.</p>}
      </div>
    </div>
  );
}
