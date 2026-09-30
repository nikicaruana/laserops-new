/**
 * app/api/portal/live-game/route.ts
 * --------------------------------------------------------------------
 * The signed-in player's CURRENT live game, if any — a match that is live and
 * that they have either signed into (participant) or are registered for. Drives
 * the header "Live Game" button so players on their phones can jump straight to
 * the in-match view. Returns { match: { id, title } | null }.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ match: null });

  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return NextResponse.json({ match: null });

  const [{ data: parts }, { data: signs }] = await Promise.all([
    supabase.from("match_participants").select("match_id").eq("account_id", account.id),
    supabase.from("match_signups").select("match_id").eq("account_id", account.id).eq("status", "registered"),
  ]);
  const ids = [
    ...new Set([
      ...((parts ?? []) as { match_id: string }[]).map((r) => r.match_id),
      ...((signs ?? []) as { match_id: string }[]).map((r) => r.match_id),
    ]),
  ];
  if (ids.length === 0) return NextResponse.json({ match: null });

  const { data: m } = await supabase
    .from("matches")
    .select("id, title")
    .in("id", ids)
    .eq("status", "live")
    .order("went_live_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ match: m ? { id: m.id, title: m.title ?? null } : null });
}
