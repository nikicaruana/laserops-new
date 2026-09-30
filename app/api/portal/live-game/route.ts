/**
 * app/api/portal/live-game/route.ts
 * --------------------------------------------------------------------
 * The signed-in user's CURRENT live game, if any. Drives the header "Live Game"
 * button so people on their phones jump straight in mid-game:
 *   - a participant (signed in)  -> the live in-match view
 *   - registered but not yet in  -> the sign-in screen
 *   - an admin (not involved)    -> spectate the live in-match view
 * Returns { match: { id, title, target: "live" | "join" } | null }.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ match: null });

  const { data: account } = await supabase.from("accounts").select("id, is_admin").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return NextResponse.json({ match: null });

  const [{ data: parts }, { data: signs }] = await Promise.all([
    supabase.from("match_participants").select("match_id").eq("account_id", account.id),
    supabase.from("match_signups").select("match_id").eq("account_id", account.id).eq("status", "registered"),
  ]);
  const partIds = new Set(((parts ?? []) as { match_id: string }[]).map((r) => r.match_id));
  const regIds = new Set(((signs ?? []) as { match_id: string }[]).map((r) => r.match_id));
  const myIds = [...new Set([...partIds, ...regIds])];

  // Prefer a live match the user is involved in; else, for admins, any live match.
  type LiveMatch = { id: string; title: string | null };
  let m: LiveMatch | null = null;
  if (myIds.length > 0) {
    const { data } = await supabase
      .from("matches")
      .select("id, title")
      .in("id", myIds)
      .eq("status", "live")
      .order("went_live_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    m = (data as LiveMatch | null) ?? null;
  }
  if (!m && account.is_admin === true) {
    const { data } = await supabase
      .from("matches")
      .select("id, title")
      .eq("status", "live")
      .order("went_live_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    m = (data as LiveMatch | null) ?? null;
  }
  if (!m) return NextResponse.json({ match: null });

  // Where the button goes: live view if you're in it (or an admin spectating),
  // otherwise the sign-in screen so a registered player can actually join.
  const joined = partIds.has(m.id);
  const registered = regIds.has(m.id);
  const target = joined ? "live" : registered ? "join" : "live";
  return NextResponse.json({ match: { id: m.id, title: m.title ?? null, target } });
}
