import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AdminGalleryManager, type GalleryGroup } from "@/components/admin/AdminGalleryManager";

export const metadata: Metadata = { title: "Gallery" };

type Row = {
  id: string;
  secure_url: string;
  caption: string | null;
  featured_home: boolean | null;
  created_at: string;
  match: { id: string; match_code: string | null; title: string | null; played_on: string | null; scheduled_at: string | null } | null;
};

export default async function AdminGalleryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("match_photos")
    .select("id, secure_url, caption, featured_home, created_at, match:matches(id, match_code, title, played_on, scheduled_at)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  // Group by match, newest match first.
  const byMatch = new Map<string, GalleryGroup>();
  for (const r of rows) {
    const m = r.match;
    const key = m?.id ?? "unlinked";
    if (!byMatch.has(key)) {
      byMatch.set(key, {
        matchId: m?.id ?? "",
        label: (m?.title || m?.match_code || "Unlinked photos") as string,
        matchCode: m?.match_code ?? null,
        date: (m?.played_on || m?.scheduled_at || r.created_at) ?? null,
        photos: [],
      });
    }
    byMatch.get(key)!.photos.push({ id: r.id, url: r.secure_url, caption: r.caption, featured: r.featured_home ?? false });
  }
  const groups = Array.from(byMatch.values()).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const total = rows.length;
  const featuredCount = rows.filter((r) => r.featured_home).length;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Gallery</h1>
      <p className="mb-6 text-sm text-text-muted">
        Every uploaded match photo in one place. Star a photo to feature it on the homepage, or delete it. {total} photo{total === 1 ? "" : "s"} total
        {featuredCount > 0 ? `, ${featuredCount} featured` : ""}.
      </p>
      <AdminGalleryManager groups={groups} />
    </div>
  );
}
