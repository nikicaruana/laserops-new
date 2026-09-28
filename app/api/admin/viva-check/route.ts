/**
 * app/api/admin/viva-check/route.ts
 * --------------------------------------------------------------------
 * Admin-only Viva connectivity diagnostic. GET runs vivaSelfTest() and reports
 * config presence + live OAuth / webhook-key checks WITHOUT exposing any secret
 * value, so the sandbox bring-up (once the demo keys are set) is a single click
 * with clear pass/fail per step. Returns { ok, report }.
 */
import { createClient } from "@/lib/supabase/server";
import { vivaSelfTest } from "@/lib/payments/providers/viva";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return Response.json({ ok: false, error: "Admins only." }, { status: 403 });

  const report = await vivaSelfTest();
  return Response.json({ ok: report.ok, report });
}
