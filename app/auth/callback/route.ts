/**
 * app/auth/callback/route.ts
 * --------------------------------------------------------------------
 * OAuth + magic-link return handler. Both Google sign-in and the emailed
 * magic link redirect back here with a one-time `code`; we exchange it for
 * a session (which sets the auth cookies), then bounce the user on to
 * wherever they were headed (`next`, default the portal).
 *
 * The account-claim trigger on auth.users runs inside Postgres at the
 * moment the user is first created, so by the time we land here the
 * player's existing account (matched by email) is already linked.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/player-portal";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed — send them to login with an error flag.
  return NextResponse.redirect(`${origin}/player-portal/login?error=auth`);
}
