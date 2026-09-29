/**
 * app/api/xp-celebration/seen/route.ts
 * --------------------------------------------------------------------
 * POST { matchIds } to mark those matches' XP celebration as seen for the
 * signed-in player, so it won't show again.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { markCelebrated } from "@/lib/xp/celebration";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const { data: acct } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!acct) return Response.json({ ok: false }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { matchIds?: unknown };
  const matchIds = Array.isArray(body.matchIds) ? body.matchIds.filter((x): x is string => typeof x === "string") : [];

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false }, { status: 500 });

  await markCelebrated(svc, acct.id as string, matchIds);
  return Response.json({ ok: true });
}
