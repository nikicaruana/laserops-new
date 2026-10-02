/**
 * lib/match-photos.ts
 * --------------------------------------------------------------------
 * Server-side reads for match-linked gallery photos. Photos live on Cloudinary;
 * the link + caption + who-is-tagged live in Supabase (match_photos /
 * match_photo_tags). Public read (RLS allows anon select).
 */
import type { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type MatchPhoto = {
  id: string;
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  /** Starred to show on the homepage "LaserOps in Action" strip. */
  featuredHome: boolean;
  /** Ops tags of players tagged in this photo (simple "in this photo" membership). */
  taggedOps: string[];
};

type PhotoRow = {
  id: string;
  public_id: string;
  secure_url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  featured_home: boolean | null;
};

/**
 * Photos for a match by its `matches.id` uuid. Two-step (photos, then tags)
 * rather than a nested embed: an embed failure (relationship/grant hiccup) must
 * never zero out the whole photo list - tags are best-effort.
 */
export async function fetchMatchPhotos(supabase: SupabaseServer, matchDbId: string): Promise<MatchPhoto[]> {
  const { data: rows, error } = await supabase
    .from("match_photos")
    .select("id, public_id, secure_url, width, height, caption, created_at, featured_home")
    .eq("match_id", matchDbId)
    .order("created_at", { ascending: false });
  if (error) console.error("[match-photos] read failed:", error.message);
  if (!rows || rows.length === 0) return [];

  const photos: MatchPhoto[] = (rows as unknown as PhotoRow[]).map((r) => ({
    id: r.id,
    publicId: r.public_id,
    url: r.secure_url,
    width: r.width,
    height: r.height,
    caption: r.caption,
    featuredHome: r.featured_home ?? false,
    taggedOps: [],
  }));

  // Tags in one query, merged in. Best-effort.
  const { data: tagRows } = await supabase
    .from("match_photo_tags")
    .select("photo_id, account:accounts!account_id(ops_tag)")
    .in(
      "photo_id",
      photos.map((p) => p.id),
    );
  if (tagRows) {
    const byPhoto = new Map<string, string[]>();
    for (const t of tagRows as unknown as { photo_id: string; account: { ops_tag: string | null } | { ops_tag: string | null }[] | null }[]) {
      const acc = Array.isArray(t.account) ? t.account[0] : t.account;
      const ops = acc?.ops_tag;
      if (!ops) continue;
      const arr = byPhoto.get(t.photo_id) ?? [];
      arr.push(ops);
      byPhoto.set(t.photo_id, arr);
    }
    for (const p of photos) p.taggedOps = byPhoto.get(p.id) ?? [];
  }

  return photos;
}

/** Photos for a match by its public `match_code` (the value in the report URL). */
export async function fetchMatchPhotosByCode(supabase: SupabaseServer, matchCode: string): Promise<MatchPhoto[]> {
  const { data: match } = await supabase.from("matches").select("id").eq("match_code", matchCode).maybeSingle();
  if (!match?.id) return [];
  return fetchMatchPhotos(supabase, match.id as string);
}

export type PlayerTaggedPhoto = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  /** Public match code, for linking the photo to its match report. */
  matchCode: string | null;
};

/**
 * Photos a given player is tagged in, most recent first. The inverse of the
 * per-photo tag merge: tags by account -> photo ids -> photos (+ each photo's
 * match code for a report link). Two-step (photos, then match codes) so a nested
 * embed hiccup can't zero the list. Public read (anon-select RLS).
 */
export async function fetchPlayerTaggedPhotos(
  supabase: SupabaseServer,
  opsTag: string,
  limit = 12,
): Promise<PlayerTaggedPhoto[]> {
  const tag = opsTag.trim();
  if (!tag) return [];

  const { data: acc } = await supabase.from("accounts").select("id").eq("ops_tag", tag).maybeSingle();
  if (!acc?.id) return [];

  const { data: tagRows } = await supabase
    .from("match_photo_tags")
    .select("photo_id")
    .eq("account_id", acc.id as string);
  const photoIds = [...new Set(((tagRows ?? []) as { photo_id: string }[]).map((t) => t.photo_id))];
  if (photoIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("match_photos")
    .select("id, secure_url, width, height, caption, created_at, match_id")
    .in("id", photoIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) console.error("[match-photos] player-tagged read failed:", error.message);
  if (!rows || rows.length === 0) return [];

  const typed = rows as unknown as (PhotoRow & { match_id: string | null })[];
  const matchIds = [...new Set(typed.map((r) => r.match_id).filter(Boolean) as string[])];
  const codeById = new Map<string, string | null>();
  if (matchIds.length > 0) {
    const { data: matchRows } = await supabase.from("matches").select("id, match_code").in("id", matchIds);
    for (const m of (matchRows ?? []) as { id: string; match_code: string | null }[]) codeById.set(m.id, m.match_code);
  }

  return typed.map((r) => ({
    id: r.id,
    url: r.secure_url,
    width: r.width,
    height: r.height,
    caption: r.caption,
    matchCode: r.match_id ? codeById.get(r.match_id) ?? null : null,
  }));
}

// --- Public gallery (match-photo sourced) --------------------------------
// /gallery and the homepage strip read match-linked photos straight from
// match_photos (joined to their match for code/title/date), so they no longer
// depend on listing a Cloudinary folder. featured_home powers the homepage.

export type GalleryPhoto = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  matchCode: string | null;
  matchTitle: string | null;
  playedOn: string | null;
  year: number | null;
  month: number | null;
  taggedOps: string[];
};

type GalleryRow = {
  id: string;
  secure_url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  match:
    | { match_code: string | null; title: string | null; played_on: string | null }
    | { match_code: string | null; title: string | null; played_on: string | null }[]
    | null;
};

function mapGalleryRow(r: GalleryRow): GalleryPhoto {
  const m = Array.isArray(r.match) ? r.match[0] : r.match;
  const played = m?.played_on ?? null;
  const d = played ? new Date(played) : null;
  const valid = d != null && !Number.isNaN(d.getTime());
  return {
    id: r.id,
    url: r.secure_url,
    width: r.width,
    height: r.height,
    caption: r.caption,
    matchCode: m?.match_code ?? null,
    matchTitle: m?.title ?? null,
    playedOn: played,
    year: valid ? d!.getUTCFullYear() : null,
    month: valid ? d!.getUTCMonth() + 1 : null,
    taggedOps: [],
  };
}

const GALLERY_SELECT =
  "id, secure_url, width, height, caption, created_at, match:matches(match_code, title, played_on)";

async function mergePhotoTags(supabase: SupabaseClient, photos: GalleryPhoto[]): Promise<void> {
  const ids = photos.map((p) => p.id);
  if (ids.length === 0) return;
  const { data } = await supabase.from("match_photo_tags").select("photo_id, account:accounts!account_id(ops_tag)").in("photo_id", ids);
  if (!data) return;
  const byPhoto = new Map<string, string[]>();
  for (const t of data as unknown as { photo_id: string; account: { ops_tag: string | null } | { ops_tag: string | null }[] | null }[]) {
    const acc = Array.isArray(t.account) ? t.account[0] : t.account;
    if (!acc?.ops_tag) continue;
    const arr = byPhoto.get(t.photo_id) ?? [];
    arr.push(acc.ops_tag);
    byPhoto.set(t.photo_id, arr);
  }
  for (const p of photos) p.taggedOps = byPhoto.get(p.id) ?? [];
}

/** Every match photo, joined to its match, newest game first. Used by /gallery. */
export async function fetchGalleryPhotos(supabase: SupabaseClient): Promise<GalleryPhoto[]> {
  const { data, error } = await supabase
    .from("match_photos")
    .select(GALLERY_SELECT)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[gallery] read failed:", error.message);
    return [];
  }
  const photos = ((data ?? []) as unknown as GalleryRow[]).map(mapGalleryRow);
  await mergePhotoTags(supabase, photos);
  photos.sort((a, b) => (b.playedOn ?? "").localeCompare(a.playedOn ?? ""));
  return photos;
}

/** Admin-starred photos for the homepage "LaserOps in Action" strip. */
export async function fetchFeaturedHomePhotos(supabase: SupabaseClient, limit = 9): Promise<GalleryPhoto[]> {
  const { data, error } = await supabase
    .from("match_photos")
    .select(GALLERY_SELECT)
    .eq("featured_home", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Column may not exist yet (pre-migration) -> fail soft so the homepage
  // falls back to its existing featured source.
  if (error) return [];
  return ((data ?? []) as unknown as GalleryRow[]).map(mapGalleryRow);
}
