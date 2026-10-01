/**
 * app/api/admin/match-image/notify/route.ts
 * --------------------------------------------------------------------
 * Admin action: announce that a match's photos are up. Emits the
 * `match_photos_added` notification (in-app + email via the dispatch cron) to
 * every player who took part, then stamps matches.photos_notified_at so it only
 * fires once per match. Admin-gated; the emit itself runs with the service role
 * (emit_notification is service_role only).
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  // Admin only (user session).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  let matchId = "";
  try {
    const body = (await request.json()) as { matchId?: string };
    matchId = String(body.matchId ?? "").trim();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!matchId) return Response.json({ ok: false, error: "No match specified." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server is not configured for notifications." }, { status: 500 });

  const { data: match } = await svc
    .from("matches")
    .select("id, match_code, title, photos_notified_at")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return Response.json({ ok: false, error: "Match not found." }, { status: 404 });
  if (match.photos_notified_at) {
    return Response.json({ ok: true, already: true, notifiedAt: match.photos_notified_at });
  }

  // Must have photos to announce.
  const { count: photoCount } = await svc
    .from("match_photos")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);
  if (!photoCount || photoCount === 0) {
    return Response.json({ ok: false, error: "Upload some photos before notifying players." }, { status: 400 });
  }

  // Everyone who took part in the match (distinct, non-null accounts).
  const { data: partRows } = await svc
    .from("match_participants")
    .select("account_id")
    .eq("match_id", matchId)
    .not("account_id", "is", null);
  const accountIds = [...new Set(((partRows ?? []) as { account_id: string }[]).map((p) => p.account_id))];

  const label = (match.title as string | null) || (match.match_code as string | null) || "your recent game";
  const code = match.match_code as string | null;
  const href = code ? `/match-report?match=${encodeURIComponent(code)}` : "/player-portal/player-stats";
  const title = "Match photos are up";
  const body = `Photos from ${label} have been uploaded. Take a look and tag yourself.`;

  for (const accountId of accountIds) {
    await emitNotification(svc, accountId, "match_photos_added", { title, body, href });
  }

  const nowIso = new Date().toISOString();
  await svc.from("matches").update({ photos_notified_at: nowIso }).eq("id", matchId);

  return Response.json({ ok: true, notified: accountIds.length, notifiedAt: nowIso });
}
