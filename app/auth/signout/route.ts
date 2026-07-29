/**
 * app/auth/signout/route.ts
 * --------------------------------------------------------------------
 * Clears the Supabase session and returns to the login page. POST-only so
 * a stray link/prefetch can't log anyone out.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/player-portal/login", request.url), {
    status: 303,
  });
}
