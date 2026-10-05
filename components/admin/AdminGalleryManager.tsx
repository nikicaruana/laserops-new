"use client";

/**
 * components/admin/AdminGalleryManager.tsx
 * --------------------------------------------------------------------
 * Cross-match gallery: every uploaded match photo in one place. Star a photo to
 * feature it on the homepage (match_photos.featured_home, which the homepage
 * reads first), or delete it. Filter by match or to just the featured ones.
 * Reads come from the DB (no Cloudinary listing), deletes reuse the per-photo
 * admin route. Admin-gated page.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

export type GalleryPhoto = { id: string; url: string; caption: string | null; featured: boolean };
export type GalleryGroup = { matchId: string; label: string; matchCode: string | null; date: string | null; photos: GalleryPhoto[] };

export function AdminGalleryManager({ groups: initial }: { groups: GalleryGroup[] }) {
  const [groups, setGroups] = useState<GalleryGroup[]>(initial);
  const [matchFilter, setMatchFilter] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const patchPhoto = (photoId: string, fn: (p: GalleryPhoto) => GalleryPhoto | null) =>
    setGroups((gs) =>
      gs
        .map((g) => ({ ...g, photos: g.photos.map((p) => (p.id === photoId ? fn(p) : p)).filter(Boolean) as GalleryPhoto[] }))
        .filter((g) => g.photos.length > 0),
    );

  async function toggleFeatured(photoId: string, next: boolean) {
    setError("");
    patchPhoto(photoId, (p) => ({ ...p, featured: next })); // optimistic
    const { error: err } = await supabase.from("match_photos").update({ featured_home: next }).eq("id", photoId);
    if (err) {
      patchPhoto(photoId, (p) => ({ ...p, featured: !next }));
      setError(err.message || "Could not update the featured flag.");
    }
  }

  async function remove(photoId: string) {
    if (!confirm("Delete this photo? This removes it from the match, the gallery and Cloudinary. This cannot be undone.")) return;
    setError("");
    const snapshot = groups;
    patchPhoto(photoId, () => null); // optimistic
    try {
      const res = await fetch(`/api/admin/match-image/${photoId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) { setGroups(snapshot); setError(data.error || "Could not delete the photo."); }
    } catch {
      setGroups(snapshot);
      setError("Could not delete the photo.");
    }
  }

  const visible = useMemo(() => {
    let gs = matchFilter === "all" ? groups : groups.filter((g) => g.matchId === matchFilter);
    if (featuredOnly) gs = gs.map((g) => ({ ...g, photos: g.photos.filter((p) => p.featured) })).filter((g) => g.photos.length > 0);
    return gs;
  }, [groups, matchFilter, featuredOnly]);

  const totalShown = visible.reduce((n, g) => n + g.photos.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 border border-border bg-bg-elevated p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-text-muted">Match</span>
          <select
            value={matchFilter}
            onChange={(e) => setMatchFilter(e.target.value)}
            className="h-9 rounded-none border border-border-strong bg-bg px-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="all">All matches</option>
            {groups.map((g) => (
              <option key={g.matchId || g.label} value={g.matchId}>{g.label}</option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-1.5 text-sm text-text">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} className="h-4 w-4 accent-accent" />
          Featured only
        </label>
        <span className="ml-auto self-end pb-1.5 text-xs text-text-subtle">{totalShown} photo{totalShown === 1 ? "" : "s"} shown</span>
      </div>

      {error && <p className="text-xs font-semibold text-red-400">{error}</p>}

      {visible.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">No photos to show.</p>
      ) : (
        visible.map((g) => (
          <section key={g.matchId || g.label}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-accent">{g.label}</h2>
              <span className="text-[0.65rem] text-text-subtle">
                {g.date ? new Date(g.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                {" · "}{g.photos.length} photo{g.photos.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {g.photos.map((p) => (
                <div key={p.id} className="group relative overflow-hidden border border-border bg-bg-elevated">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? "Match photo"} loading="lazy" className="block aspect-square w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => toggleFeatured(p.id, !p.featured)}
                    aria-label={p.featured ? "Unfeature from homepage" : "Feature on homepage"}
                    title={p.featured ? "Featured on homepage" : "Feature on homepage"}
                    className={cn(
                      "absolute left-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-bg/80 text-base leading-none transition-opacity",
                      p.featured ? "text-accent opacity-100" : "text-text-muted opacity-0 hover:text-accent group-hover:opacity-100",
                    )}
                  >
                    {p.featured ? "★" : "☆"}
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
                    <p className="truncate px-2 py-1.5 text-[0.65rem] text-text-muted" title={p.caption}>{p.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
