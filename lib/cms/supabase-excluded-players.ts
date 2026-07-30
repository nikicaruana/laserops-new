/**
 * lib/cms/supabase-excluded-players.ts
 * --------------------------------------------------------------------
 * Supabase-backed replacement for fetchExcludedNicknames(). Returns the
 * set of active prize-ineligible nicknames (lowercased/trimmed) from the
 * excluded_players table, so isPrizeIneligible() works unchanged.
 *
 * Only active rows are exposed to anon (RLS + column grant, see the
 * 20260730210000 migration). `reason` is never read.
 */
import { createClient } from "@/lib/supabase/server";

export async function getExcludedNicknamesFromSupabase(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("excluded_players")
    .select("nickname")
    .eq("status", "active");

  const set = new Set<string>();
  for (const r of (data ?? []) as { nickname: string | null }[]) {
    const n = (r.nickname ?? "").trim().toLowerCase();
    if (n !== "") set.add(n);
  }
  return set;
}
