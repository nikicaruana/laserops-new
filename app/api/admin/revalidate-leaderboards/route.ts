/**
 * app/api/admin/revalidate-leaderboards/route.ts
 * --------------------------------------------------------------------
 * Busts the cached leaderboard / Hall of Fame boards on demand. Those board
 * reads are wrapped in unstable_cache with a ~30-minute TTL and the
 * "leaderboards" + "sheets" tags (see lib/player-stats/supabase-summary.ts), so
 * after a Recompute the public boards would otherwise lag until the TTL expires.
 * The Recompute button calls this so the boards pick up fresh ratings/stats
 * immediately. Admin-only; no 2FA needed for a cache refresh.
 */
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

  revalidateTag("leaderboards");
  revalidateTag("sheets");
  return NextResponse.json({ ok: true, revalidated: ["leaderboards", "sheets"] });
}
