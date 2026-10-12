/**
 * app/api/signups/[matchId]/cancel/route.ts
 * --------------------------------------------------------------------
 * A player cancels their own signup. Pay-after-game: nothing is charged at
 * sign-up, so there is never anything to refund - we just cancel the signup
 * (waitlist promotion + notifications are handled DB-side). Returns
 * { ok, refund: "none" }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!account) return Response.json({ ok: false, error: "No account found." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server not configured." }, { status: 500 });

  const { data: signup } = await supabase
    .from("match_signups")
    .select("status")
    .eq("match_id", matchId)
    .eq("account_id", account.id)
    .maybeSingle();
  if (!signup) return Response.json({ ok: false, error: "You're not signed up to this game." }, { status: 404 });

  await svc.from("match_signups").update({ status: "cancelled" }).eq("match_id", matchId).eq("account_id", account.id);
  return Response.json({ ok: true, refund: "none" });
}
