import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * On-demand cache refresh.
 * --------------------------------------------------------------------
 * Every Google-Sheet read is tagged "sheets" (see lib/sheets.ts and the
 * Hall of Fame unstable_cache calls). Hitting this endpoint revalidates that
 * tag, so the next visit to any page re-reads the latest published sheets
 * immediately instead of waiting out the normal ~5-minute cache. Use it after
 * editing a match's numbers, claiming a score, updating the CMS, etc.
 *
 * Usage (GET, so you can bookmark it):
 *   https://www.laseropsmalta.com/api/revalidate?secret=YOUR_SECRET
 *
 * Set REVALIDATE_SECRET in the Vercel project env vars. Until it's set, the
 * endpoint is inert (returns 503) so it can't be abused.
 *
 * Note: this refreshes the SITE's copy of the published sheets. It can't
 * speed up Google's own "Publish to web" propagation — if the published CSV
 * itself is still behind your edits, give Google a minute, then hit this.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Revalidation is not configured (REVALIDATE_SECRET unset)." },
      { status: 503 },
    );
  }

  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid secret." }, { status: 401 });
  }

  revalidateTag("sheets");
  return NextResponse.json({ ok: true, revalidated: "sheets" });
}
