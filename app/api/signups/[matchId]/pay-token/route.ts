/**
 * app/api/signups/[matchId]/pay-token/route.ts
 * --------------------------------------------------------------------
 * A player pays for a confirmed game with their game tokens (fully with 1 token,
 * or partially with a fraction, topping up the rest online). All the work is done
 * by the spend_tokens SECURITY DEFINER RPC, which verifies the caller owns the
 * balance and the signup, draws down lots oldest-expiry-first, and marks the
 * signup paid once a full token is applied. The client can't set a balance or
 * mark itself paid - only this RPC can. Body: { amount }. Returns { ok, applied }.
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  let amount = 1;
  let idempotencyKey: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { amount?: number; idempotencyKey?: string };
    if (typeof body.amount === "number" && Number.isFinite(body.amount)) amount = body.amount;
    if (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) idempotencyKey = body.idempotencyKey.trim();
  } catch {
    /* default to 1 */
  }
  if (amount <= 0) return Response.json({ ok: false, error: "Amount must be positive." }, { status: 400 });

  const { data: applied, error } = await supabase.rpc("spend_tokens", { p_match_id: matchId, p_amount: amount, p_idempotency_key: idempotencyKey });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
  return Response.json({ ok: true, applied: Number(applied ?? 0) });
}
