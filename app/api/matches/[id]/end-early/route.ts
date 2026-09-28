/**
 * app/api/matches/[id]/end-early/route.ts
 * --------------------------------------------------------------------
 * Admin ends a game early (e.g. bad weather) and refunds every paid player a
 * PORTION of what they paid - 25%, 50% or 75% - cash first, then tokens. Marks
 * the game completed (players attended, so partial refunds keep them 'paid').
 * Admin-gated. Body: { percent: 25 | 50 | 75 }. Returns { ok, refunded, percent }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refundAllPaidSignups } from "@/lib/payments/refund";

const ALLOWED = new Set([25, 50, 75]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });
  // Step-up: this ends a game / moves money, so require a 2FA-elevated session.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return Response.json({ ok: false, error: "Two-factor authentication is required to end a game early." }, { status: 403 });

  let percent = 0;
  try {
    const body = (await req.json()) as { percent?: number };
    percent = Number(body.percent);
  } catch {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!ALLOWED.has(percent)) return Response.json({ ok: false, error: "Pick 25, 50 or 75%." }, { status: 400 });

  const { data: match } = await supabase.from("matches").select("status, scheduled_at").eq("id", id).maybeSingle();
  if (!match) return Response.json({ ok: false, error: "Game not found." }, { status: 404 });
  if (match.status !== "live" && match.status !== "confirmed") {
    return Response.json({ ok: false, error: "Only a live or confirmed game can be ended early." }, { status: 400 });
  }

  const svc = createServiceClient();
  if (!svc) return Response.json({ ok: false, error: "Server not configured." }, { status: 500 });

  // Mark completed (they played, just cut short).
  await svc
    .from("matches")
    .update({ status: "completed", played_on: (match.scheduled_at ?? new Date().toISOString()).slice(0, 10) })
    .eq("id", id);

  const r = await refundAllPaidSignups(svc, id, {
    fraction: percent / 100,
    note: `Game ended early (${percent}% refund)`,
  });
  if (r.errors.length) console.error("[end-early] some refunds failed:", r.errors);

  return Response.json({ ok: true, percent, refunded: r.refunded, totalCashEur: r.totalCashEur, totalTokens: r.totalTokens, refundErrors: r.errors });
}
