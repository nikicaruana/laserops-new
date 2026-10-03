"use client";

/**
 * components/portal/TaggedPhotosGrid.tsx
 * --------------------------------------------------------------------
 * Grid of photos a player is tagged in, for the profile Photos section. Shows a
 * capped number with a "View all" toggle. Clicking a photo opens an in-place
 * previewer (lightbox) to flip through every tagged photo. From the previewer
 * the viewer can open that photo's match report, and - on their OWN profile -
 * share the photo to a story (with their live stats overlay) or remove their tag.
 */
import { useEffect, useState } from "react";
import { cldImage } from "@/lib/cld";
import Link from "next/link";
import { GalleryLightbox, type LightboxImage } from "@/components/gallery/GalleryLightbox";
import { PhotoStoryComposer } from "@/components/match-report/PhotoStoryComposer";
import { createClient } from "@/lib/supabase/client";
import type { OverlayData } from "@/lib/story/meta";
import type { PlayerTaggedPhoto } from "@/lib/match-photos";

type Composer = { photoUrl: string; matchCode: string; ops: string; overlayData?: OverlayData };

export function TaggedPhotosGrid({
  photos,
  opsTag,
  limit = 6,
}: {
  photos: PlayerTaggedPhoto[];
  opsTag: string;
  limit?: number;
}) {
  const [list, setList] = useState<PlayerTaggedPhoto[]>(photos);
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [viewerOps, setViewerOps] = useState("");
  const [composer, setComposer] = useState<Composer | null>(null);
  const [sharing, setSharing] = useState(false);

  // Re-sync when the parent passes a different profile's photos. useState only
  // seeds the INITIAL value, so without this the grid keeps showing the previous
  // profile's photos after a client-side nav - e.g. your OWN tagged photos would
  // wrongly persist when you open someone else's summary.
  useEffect(() => { setList(photos); setExpanded(false); setLightbox(null); }, [photos]);

  // The share / remove-tag actions act on the signed-in viewer, so only offer
  // them when the viewer is looking at their OWN profile.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data: acc } = await supabase.from("accounts").select("ops_tag").eq("auth_user_id", user.id).maybeSingle();
        if (active && acc?.ops_tag) setViewerOps(String(acc.ops_tag).trim());
      } catch {
        /* signed out */
      }
    })();
    return () => { active = false; };
  }, []);

  const isOwner = viewerOps !== "" && viewerOps.toLowerCase() === opsTag.trim().toLowerCase();

  if (list.length === 0) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center border border-dashed border-border bg-bg-elevated px-4 py-8 text-center">
        <p className="text-sm text-text-subtle">
          No tagged photos yet. When {opsTag} is tagged in match photos, they show up here.
        </p>
      </div>
    );
  }

  const shown = expanded ? list : list.slice(0, limit);
  const hiddenCount = list.length - limit;

  const lightboxImages: LightboxImage[] = list.map((p) => ({
    secureUrl: p.url,
    width: p.width ?? 1200,
    height: p.height ?? 800,
    caption: [p.matchCode, p.caption].filter(Boolean).join(" — ") || undefined,
  }));

  async function removeTag(p: PlayerTaggedPhoto) {
    const idx = list.findIndex((x) => x.id === p.id);
    const next = list.filter((x) => x.id !== p.id);
    setList(next);
    setLightbox(next.length === 0 ? null : Math.min(idx, next.length - 1));
    try {
      await fetch(`/api/photos/${p.id}/tag`, { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {
      /* best-effort; the grid already updated optimistically */
    }
  }

  async function openShare(p: PlayerTaggedPhoto) {
    if (!p.matchCode || sharing) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/photos/overlay?match=${encodeURIComponent(p.matchCode)}`);
      const j = (await res.json()) as { ops: string; overlayData: OverlayData | null };
      if (!j.ops) return;
      setLightbox(null);
      setComposer({ photoUrl: p.url, matchCode: p.matchCode, ops: j.ops, overlayData: j.overlayData ?? undefined });
    } catch {
      /* ignore */
    } finally {
      setSharing(false);
    }
  }

  const btn = "rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors";
  const renderActions = (i: number) => {
    const p = list[i];
    if (!p) return null;
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {p.matchCode && (
          <Link
            href={`/match-report?match=${encodeURIComponent(p.matchCode)}&player=${encodeURIComponent(opsTag)}`}
            className={`${btn} border-white/30 text-white/80 hover:border-accent hover:text-accent`}
          >
            View match
          </Link>
        )}
        {isOwner && (
          <>
            <button type="button" onClick={() => openShare(p)} disabled={sharing} className={`${btn} border-accent bg-accent text-bg hover:bg-accent-soft disabled:opacity-60`}>
              {sharing ? "Opening…" : "Share to story"}
            </button>
            <button type="button" onClick={() => removeTag(p)} className={`${btn} border-white/30 text-white/70 hover:border-red-400 hover:text-red-400`}>
              Remove my tag
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="portal-card p-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setLightbox(i)}
            className="group relative aspect-square overflow-hidden rounded-sm border border-border bg-bg"
            aria-label="Preview this photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cldImage(p.url, { w: 400 })}
              alt={p.caption ?? `Photo of ${opsTag}`}
              className="aspect-square h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="border border-border-strong px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            View all {list.length}
          </button>
        </div>
      )}

      <GalleryLightbox images={lightboxImages} index={lightbox} onClose={() => setLightbox(null)} renderActions={renderActions} />

      {composer && (
        <PhotoStoryComposer
          matchId={composer.matchCode}
          ops={composer.ops}
          photoUrl={composer.photoUrl}
          overlayData={composer.overlayData}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  );
}
