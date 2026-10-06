"use client";

/**
 * components/gallery/GalleryBrowser.tsx
 * --------------------------------------------------------------------
 * Public gallery, sourced from match-linked photos (match_photos). Client
 * component so filtering is instant and per-viewer. Filters: game dropdown,
 * year dropdown, month dropdown, and a "my matches" toggle for signed-in
 * players (match codes from the my_participated_match_codes RPC).
 *
 * In the lightbox a signed-in player can tag themselves ("I'm in this photo")
 * and, once tagged, share the photo to a story: the overlay (their live stats
 * band) is fetched on demand from /api/photos/overlay and handed to the shared
 * PhotoStoryComposer, same flow as the match report. Each photo also links to
 * its match report.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cldImage, cldSrcSet } from "@/lib/cld";
import { GalleryLightbox, type LightboxImage } from "./GalleryLightbox";
import { PhotoStoryComposer } from "@/components/match-report/PhotoStoryComposer";
import type { OverlayData } from "@/lib/story/meta";
import type { GalleryPhoto } from "@/lib/match-photos";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Composer = { photoUrl: string; matchCode: string; ops: string; overlayData?: OverlayData };

export function GalleryBrowser({ photos }: { photos: GalleryPhoto[] }) {
  const [matchCode, setMatchCode] = useState("all");
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [myCodes, setMyCodes] = useState<string[] | null>(null);
  const [ops, setOps] = useState("");
  const [tags, setTags] = useState<Record<string, string[]>>(() => Object.fromEntries(photos.map((p) => [p.id, p.taggedOps])));
  const [followees, setFollowees] = useState<{ accountId: string; ops: string; avatar: string | null }[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [sharing, setSharing] = useState(false);

  // Per-viewer context (fetched client-side so the page needs no auth):
  // the signed-in player's ops tag + the match codes they played in.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const [{ data: acc }, { data: codes }] = await Promise.all([
          supabase.from("accounts").select("id, ops_tag").eq("auth_user_id", user.id).maybeSingle(),
          supabase.rpc("my_participated_match_codes"),
        ]);
        if (!active) return;
        if (acc?.ops_tag) setOps(String(acc.ops_tag).trim());
        if (Array.isArray(codes) && codes.length) setMyCodes(codes as string[]);
        // Players this user follows -> taggable in photos. account rows aren't
        // readable for others, so map ids -> display via the public read-model.
        if (acc?.id) {
          const { data: followRows } = await supabase.from("follows").select("followee_id").eq("follower_id", acc.id);
          const ids = ((followRows ?? []) as { followee_id: string }[]).map((r) => r.followee_id);
          if (active && ids.length) {
            const { data: people } = await supabase.from("player_stats_lifetime").select("account_id, nickname, profile_pic_url").in("account_id", ids);
            if (active) {
              setFollowees(
                ((people ?? []) as { account_id: string; nickname: string | null; profile_pic_url: string | null }[])
                  .filter((p) => p.nickname)
                  .map((p) => ({ accountId: p.account_id, ops: p.nickname as string, avatar: p.profile_pic_url }))
                  .sort((a, b) => a.ops.localeCompare(b.ops, undefined, { sensitivity: "base" })),
              );
            }
          }
        }
      } catch {
        /* signed out or unavailable */
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

  const opsLc = ops.toLowerCase();
  const isTagged = (p: GalleryPhoto) => opsLc !== "" && (tags[p.id] ?? []).some((o) => o.toLowerCase() === opsLc);

  // Tag/untag a target ops on a photo. isSelf uses the self path (no ops body);
  // otherwise the target must be someone the viewer follows (server-enforced).
  async function toggleTag(p: GalleryPhoto, targetOps: string, isSelf: boolean) {
    const t = targetOps.trim();
    if (!t) return;
    const tlc = t.toLowerCase();
    const already = (tags[p.id] ?? []).some((o) => o.toLowerCase() === tlc);
    setTags((prev) => ({
      ...prev,
      [p.id]: already ? (prev[p.id] ?? []).filter((o) => o.toLowerCase() !== tlc) : [...(prev[p.id] ?? []), t],
    }));
    try {
      const res = await fetch(`/api/photos/${p.id}/tag`, {
        method: already ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(isSelf ? {} : { ops: t }),
      });
      if (!res.ok) throw new Error("tag request failed");
    } catch {
      setTags((prev) => ({
        ...prev,
        [p.id]: already ? [...(prev[p.id] ?? []), t] : (prev[p.id] ?? []).filter((o) => o.toLowerCase() !== tlc),
      }));
    }
  }

  async function openShare(p: GalleryPhoto) {
    if (!p.matchCode || sharing) return;
    setSharing(true);
    try {
      const res = await fetch(`/api/photos/overlay?match=${encodeURIComponent(p.matchCode)}`);
      const j = (await res.json()) as { ops: string; overlayData: OverlayData | null };
      if (!j.ops) return;
      setLightbox(null); // close the lightbox so the composer isn't behind it
      setComposer({ photoUrl: p.url, matchCode: p.matchCode, ops: j.ops, overlayData: j.overlayData ?? undefined });
    } catch {
      /* ignore - share stays unopened */
    } finally {
      setSharing(false);
    }
  }

  const renderActions = (i: number) => {
    const p = filtered[i];
    if (!p) return null;
    const tagged = tags[p.id] ?? [];
    const self = isTagged(p);
    const btn = "rounded-sm border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] transition-colors";
    return (
      <div className="flex flex-col items-center gap-2">
        {tagged.length > 0 && <p className="text-xs text-white/60">In this photo: {tagged.join(", ")}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {p.matchCode && (
            <Link href={`/match-report?match=${p.matchCode}`} className={`${btn} border-white/30 text-white/80 hover:border-accent hover:text-accent`}>
              View match
            </Link>
          )}
          {ops ? (
            <>
              <button type="button" onClick={() => toggleTag(p, ops, true)} className={`${btn} ${self ? "border-accent text-accent" : "border-white/30 text-white/80 hover:border-accent hover:text-accent"}`}>
                {self ? "Remove my tag" : "I'm in this photo"}
              </button>
              {self && (
                <button type="button" onClick={() => openShare(p)} disabled={sharing} className={`${btn} border-accent bg-accent text-bg hover:bg-accent-soft disabled:opacity-60`}>
                  {sharing ? "Opening…" : "Share to story"}
                </button>
              )}
            </>
          ) : (
            <Link href="/player-portal" className={`${btn} border-white/30 text-white/70 hover:border-accent hover:text-accent`}>
              Sign in to tag &amp; share
            </Link>
          )}
        </div>
        {ops && followees.length > 0 && (
          <div className="flex w-full flex-col items-center gap-1.5">
            <p className="text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white/45">Tag players you follow</p>
            <div className="flex max-w-md flex-wrap justify-center gap-1.5">
              {followees.map((f) => {
                const on = (tags[p.id] ?? []).some((o) => o.toLowerCase() === f.ops.toLowerCase());
                return (
                  <button
                    key={f.accountId}
                    type="button"
                    onClick={() => toggleTag(p, f.ops, false)}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.65rem] font-semibold transition-colors ${on ? "border-accent bg-accent/15 text-accent" : "border-white/25 text-white/80 hover:border-accent hover:text-accent"}`}
                  >
                    {f.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cldImage(f.avatar, { w: 48 })} alt="" className="h-4 w-4 rounded-full object-cover" />
                    )}
                    <span>{f.ops}</span>
                    {on && <span aria-hidden>&#10003;</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

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
                  src={cldImage(p.url, { w: 600, dpr: false })}
                  srcSet={cldSrcSet(p.url, 600, 1200)}
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
                  {isTagged(p) && <span className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent">You&rsquo;re in this</span>}
                </div>
              )}
            </div>
          ))}
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
    </>
  );
}
