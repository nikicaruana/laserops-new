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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/player-portal";

  // Surface any error Supabase itself passed back (e.g. expired link).
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] verifyOtp failed:", error.message);
  } else {
    console.error(
      "[auth/callback] no code or token_hash in callback. providerError:",
      providerError ?? "(none)",
    );
  }

  return NextResponse.redirect(`${origin}/player-portal/login?error=auth`);
}
