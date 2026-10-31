/**
 * app/api/photos/tagged/route.ts
 * --------------------------------------------------------------------
 * GET /api/photos/tagged?ops=<opsTag>&offset=<n>&limit=<n>
 * A page of the photos a player is tagged in, most recent first - the "load
 * more" source for the profile Photos grid. Resolving an ops tag to an account
 * needs to read `accounts`, which anon cannot (permission denied), so this uses
 * the cookie-aware client - the portal is auth-gated, so the viewer is signed
 * in. Returns { photos: PlayerTaggedPhoto[], hasMore: boolean }; fetches limit+1
 * under the hood to tell whether another page exists without a separate count.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchPlayerTaggedPhotos } from "@/lib/match-photos";

const MAX_LIMIT = 48;

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const ops = (sp.get("ops") ?? "").trim();
  if (!ops) return NextResponse.json({ photos: [], hasMore: false });

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get("limit")) || 24));
  const offset = Math.max(0, Number(sp.get("offset")) || 0);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ photos: [], hasMore: false });

  const rows = await fetchPlayerTaggedPhotos(supabase, ops, limit + 1, offset);
  const hasMore = rows.length > limit;
  return NextResponse.json({ photos: rows.slice(0, limit), hasMore });
}
