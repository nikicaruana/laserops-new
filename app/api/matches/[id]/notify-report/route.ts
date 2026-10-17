/**
 * app/api/matches/[id]/notify-report/route.ts
 * --------------------------------------------------------------------
 * Send the "match report is live" email to any CURRENT participant who hasn't
 * been notified for this match yet — without re-scoring. This fills the gap when
 * the line-up is corrected AFTER publishing (e.g. the wrong walk-in profile was
 * added, then swapped for the right one): the publish step already emailed the
 * original roster, so re-publishing just to reach one new player would needlessly
 * re-run scoring + refund/fulfilment. This action only emits the report
 * notification, and is DEDUPED per account (type + href), so it never
 * double-emails anyone — safe to click repeatedly. Admin + 2FA.
 *
 * Mirrors the match-report emit in app/api/matches/[id]/publish/route.ts, minus
 * the 14-day recency guard (a manual send is explicit intent).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { emitNotification } from "@/lib/notifications";
import { matchDateLabel, matchTimeRangeLabel } from "@/lib/match-time";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth: signed-in admin with a 2FA-elevated (aal2) session.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to send report emails." }, { status: 403 });

  const { data: m } = await supabase
    .from("matches")
    .select("id, title, match_code, scheduled_at, duration_minutes, pricing_mode, xp_distributed_at")
    .eq("id", id)
    .maybeSingle();
  if (!m) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!m.xp_distributed_at) return NextResponse.json({ error: "Publish the match first — there is no report to link to yet." }, { status: 400 });

  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Server is not configured for writes (service role key missing)." }, { status: 500 });

  // Same report type + href + payload as the publish route.
  const perPlayer = (m.pricing_mode as string | null) === "per_player";
  const matchCode = (m.match_code as string | null) ?? null;
  const href = matchCode ? `/match-report?match=${encodeURIComponent(matchCode)}` : "/player-portal/player-stats";
  const reportType = perPlayer ? "match_report_settle" : "match_report_live";
  const matchLabel = (m.title as string | null) || matchCode || "your recent game";
  const schedAt = (m.scheduled_at as string | null) || null;
  const matchDate = schedAt ? matchDateLabel(schedAt) : "";
  const matchTimeRange = schedAt ? matchTimeRangeLabel(schedAt, (m.duration_minutes as number | null) ?? null) : "";
  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.laseropsmalta.com").replace(/\/$/, "");
  const payUrl = `${siteBase}/player-portal/pay/${id}`;

  // Current participants with an account.
  const { data: parts } = await svc
    .from("match_player_aggregate")
    .select("account_id, nickname")
    .eq("match_id", id)
    .not("account_id", "is", null);
  const ids = [...new Set(((parts ?? []) as { account_id: string }[]).map((p) => p.account_id))];
  if (ids.length === 0) return NextResponse.json({ ok: true, sent: 0, recipients: [], skipped: 0 });

  // Dedup: who already has this exact report notification.
  const { data: already } = await svc
    .from("notifications")
    .select("account_id")
    .eq("type_key", reportType)
    .eq("href", href)
    .in("account_id", ids);
  const sentSet = new Set(((already ?? []) as { account_id: string }[]).map((n) => n.account_id));

  const targetIds = ids.filter((aid) => !sentSet.has(aid));
  const nameById = new Map(((parts ?? []) as { account_id: string; nickname: string }[]).map((p) => [p.account_id, p.nickname]));
  const recipients: string[] = [];
  for (const aid of targetIds) {
    await emitNotification(svc, aid, reportType, {
      title: "Your match report is live",
      body: `The report for ${matchLabel} is up. See your kills, captures, accolades and where you ranked.`,
      href,
      data: { matchLabel, matchDate, matchTimeRange, payUrl },
    });
    recipients.push(nameById.get(aid) ?? aid);
  }

  return NextResponse.json({ ok: true, sent: recipients.length, recipients, skipped: ids.length - targetIds.length });
}
