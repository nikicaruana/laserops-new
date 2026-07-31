/**
 * app/auth/callback/route.ts
 * --------------------------------------------------------------------
 * Single return handler for every email/OAuth link. Supabase can send back
 * either of two shapes depending on provider/template:
 *   - `code`                 -> exchangeCodeForSession (OAuth, magic link, PKCE)
 *   - `token_hash` + `type`  -> verifyOtp (email confirm, recovery, magic link
 *                               when templates use {{ .TokenHash }})
 * We handle both, then redirect to `next` (default the portal). On any
 * failure we send the user to login with an error flag and log the reason
 * (visible in the dev server output) so issues are diagnosable.
 */
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postAuthPath } from "@/lib/portalRoute";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/player-portal";
  // Only ever redirect within the app — reject absolute or protocol-relative
  // ("//evil.com") targets to avoid an open redirect.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/player-portal";

  // Surface any error Supabase itself passed back (e.g. expired link).
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  const supabase = await createClient();

  // New / unfinished accounts (no callsign yet) go to onboarding first.
  // Password-recovery links must NOT be diverted — they need to reach the
  // reset-password page. Otherwise: incomplete accounts are forced through
  // onboarding/waiver; complete accounts honor an explicit `next` (e.g.
  // returning to /profile after linking Google), defaulting to their summary.
  async function destination(): Promise<string> {
    if (type === "recovery" || next.startsWith("/player-portal/reset-password")) {
      return `${origin}${next}`;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return `${origin}${next}`;
    const { data: account } = await supabase
      .from("accounts")
      .select("ops_tag, waiver_accepted_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const gated = postAuthPath(account);
    if (!account?.ops_tag || !account?.waiver_accepted_at) {
      return `${origin}${gated}`;
    }
    return `${origin}${next !== "/player-portal" ? next : gated}`;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(await destination());
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(await destination());
    console.error("[auth/callback] verifyOtp failed:", error.message);
  } else {
    console.error(
      "[auth/callback] no code or token_hash in callback. providerError:",
      providerError ?? "(none)",
    );
  }

  return NextResponse.redirect(`${origin}/player-portal/login?error=auth`);
}
