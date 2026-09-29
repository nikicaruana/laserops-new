/**
 * app/api/xp-celebration/route.ts
 * --------------------------------------------------------------------
 * GET the pending first-login XP celebration for the signed-in player (the XP
 * journey + unlocks across every scored match they haven't seen yet), or null.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPendingXpCelebration } from "@/lib/xp/celebration";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ pending: null });

  const { data: acct } = await supabase
    .from("accounts")
    .select("id, ops_tag")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!acct) return Response.json({ pending: null });

  const svc = createServiceClient();
  if (!svc) return Response.json({ pending: null });

  const pending = await getPendingXpCelebration(
    svc,
    acct.id as string,
    ((acct.ops_tag as string) ?? "").trim() || "Player",
  );
  return Response.json({ pending });
}
