"use client";

/**
 * components/gallery/GalleryBrowser.tsx
 * --------------------------------------------------------------------
 * Public gallery, sourced from match-linked photos (match_photos). Client
 * component so filtering is instant and per-viewer. Filters: game dropdown,
 * year dropdown, month dropdown, and a "my matches" toggle for signed-in
 * players (match codes from the my_participated_match_codes RPC). Each photo
 * opens in the shared lightbox and links to its match report.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cldImage } from "@/lib/cld";
import { GalleryLightbox, type LightboxImage } from "./GalleryLightbox";
import type { GalleryPhoto } from "@/lib/match-photos";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function GalleryBrowser({ photos }: { photos: GalleryPhoto[] }) {
  const [matchCode, setMatchCode] = useState("all");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [myCodes, setMyCodes] = useState<string[] | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Per-viewer "my matches" (codes the signed-in player played in). Fetched
  // client-side so the page itself needs no auth; stays null when signed out.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.rpc("my_participated_match_codes");
        if (active && Array.isArray(data) && data.length) setMyCodes(data as string[]);
      } catch {
        /* signed out or unavailable - no toggle */
      }
    })();
    return () => { active = false; };
  }, []);

  const matchOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of photos) {
      if (!p.matchCode || seen.has(p.matchCode)) continue;
      const date = p.playedOn ? new Date(p.playedOn).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
      seen.set(p.matchCode, [p.matchCode, p.matchTitle || date].filter(Boolean).join(" · "));
    }
    return [...seen.entries()].map(([code, label]) => ({ code, label }));
  }, [photos]);

  const years = useMemo(
    () => [...new Set(photos.map((p) => p.year).filter((y): y is number => y != null))].sort((a, b) => b - a),
    [photos],
  );
  const months = useMemo(() => {
    const scope = year === "all" ? photos : photos.filter((p) => String(p.year) === year);
    return [...new Set(scope.map((p) => p.month).filter((m): m is number => m != null))].sort((a, b) => a - b);
  }, [photos, year]);

  const filtered = useMemo(
    () =>
      photos.filter((p) => {
        if (matchCode !== "all" && p.matchCode !== matchCode) return false;
        if (year !== "all" && String(p.year) !== year) return false;
        if (month !== "all" && String(p.month) !== month) return false;
        if (mineOnly && myCodes && !(p.matchCode && myCodes.includes(p.matchCode))) return false;
        return true;
      }),
    [photos, matchCode, year, month, mineOnly, myCodes],
  );

  const lightboxImages: LightboxImage[] = filtered.map((p) => ({
    secureUrl: p.url,
    width: p.width ?? 1200,
    height: p.height ?? 800,
    caption: [p.matchCode, p.caption].filter(Boolean).join(" — ") || undefined,
  }));

  const select =
    "h-9 border border-border-strong bg-bg px-3 text-xs font-semibold uppercase tracking-[0.1em] text-text focus:border-accent focus:outline-none";
  const active = matchCode !== "all" || year !== "all" || month !== "all" || mineOnly;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
        <select aria-label="Filter by game" className={select} value={matchCode} onChange={(e) => setMatchCode(e.target.value)}>
          <option value="all">All games</option>
          {matchOptions.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
        <select aria-label="Filter by year" className={select} value={year} onChange={(e) => { setYear(e.target.value); setMonth("all"); }}>
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>
        <select aria-label="Filter by month" className={select} value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={String(m)}>{MONTHS[m]}</option>
          ))}
        </select>
        {myCodes && myCodes.length > 0 && (
          <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="h-4 w-4 accent-accent" />
            Only my matches
          </label>
        )}
        {active && (
          <button
            type="button"
            onClick={() => { setMatchCode("all"); setYear("all"); setMonth("all"); setMineOnly(false); }}
            className="text-xs font-semibold uppercase tracking-[0.1em] text-accent hover:underline"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-text-subtle">
          {filtered.length} photo{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-sm portal-card p-8 text-center sm:p-12">
          <p className="text-base text-text-muted">No photos match these filters.</p>
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
          {filtered.map((p, i) => (
            <div key={p.id} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-sm sm:mb-4">
              <button type="button" onClick={() => setLightbox(i)} className="block w-full" aria-label={p.caption || "View photo"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cldImage(p.url, { w: 600 })}
                  alt={p.caption || `Match photo${p.matchCode ? " from " + p.matchCode : ""}`}
                  width={p.width ?? undefined}
                  height={p.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="block w-full select-none object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </button>
              {p.matchCode && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    href={`/match-report?match=${p.matchCode}`}
                    className="pointer-events-auto text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white hover:text-accent"
                  >
                    {p.matchCode} →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <GalleryLightbox images={lightboxImages} index={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
