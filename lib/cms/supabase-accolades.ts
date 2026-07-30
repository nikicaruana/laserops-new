/**
 * lib/cms/supabase-accolades.ts
 * --------------------------------------------------------------------
 * Supabase-backed replacement for fetchAccolades(). Returns the existing
 * Accolade[] shape from the accolade_definitions config table (match-scoped,
 * active rows), so the Match Report + Accolades leaderboard render unchanged.
 * Keyed by accoladeKey() for case/separator-insensitive matching.
 */
import { createClient } from "@/lib/supabase/server";
import { accoladeKey, type Accolade } from "@/lib/cms/accolades";

type Row = {
  name: string | null;
  description: string | null;
  badge_url: string | null;
  xp: number | null;
};

export async function getAccoladesFromSupabase(): Promise<Accolade[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accolade_definitions")
    .select("name, description, badge_url, xp")
    .eq("is_active", true)
    .eq("scope", "match");

  const seen = new Set<string>();
  const out: Accolade[] = [];
  for (const r of (data ?? []) as Row[]) {
    const name = (r.name ?? "").trim();
    if (name === "") continue;
    const key = accoladeKey(name);
    if (seen.has(key)) continue; // dedupe defensively
    seen.add(key);
    out.push({
      name,
      key,
      description: (r.description ?? "").trim(),
      badgeUrl: (r.badge_url ?? "").trim(),
      xp: r.xp ?? 0,
    });
  }
  return out;
}
