/**
 * app/api/story/[matchId]/[ops]/route.tsx
 * --------------------------------------------------------------------
 * Generates a 1080 x 1920 Instagram/Facebook story image for one player's
 * match summary. Query param `t` selects the layout (personal | team |
 * nemesis | xp). matchId === "PREVIEW" renders the sample report so the
 * layouts can be designed before real ingestion data exists.
 *
 *   GET /api/story/LO-2026-10/Kini?t=personal
 *   GET /api/story/PREVIEW/Kini?t=nemesis
 *
 * Access: a player may only generate a story for THEIR OWN stats - the signed-in
 * account's ops_tag must match the requested player. PREVIEW (dummy design data)
 * is restricted to admins.
 *
 * Runs on the edge runtime: the node build of @vercel/og has a Windows-dev
 * bug loading its wasm/font assets, and OG generation is the canonical edge
 * use-case anyway.
 */
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { findPlayerInReport, type MatchReport } from "@/lib/match-report/engine";
import { loadStoryFonts, loadLogoDataUri } from "../../_fonts/load";
import { renderStory, renderPhotoStory, sat, collectStoryImages } from "../../_render";
import { isStoryTemplate, isPhotoOverlay, type PhotoOverlay } from "@/lib/story/meta";

export const runtime = "edge";

function toBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Fetch every remote image the template needs into a data URI. Failures (a
 *  404, a webp Satori can't decode, a slow host) are dropped rather than
 *  crashing the whole image - that asset just renders blank. */
async function preloadImages(urls: string[], baseUrl: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    urls.map(async (u) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(sat(u, baseUrl), { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return;
        const ct = res.headers.get("content-type") || "image/png";
        map.set(u, `data:${ct};base64,${toBase64(await res.arrayBuffer())}`);
      } catch {
        // leave unresolved -> renders blank
      }
    }),
  );
  return map;
}

export async function GET(req: Request, ctx: { params: Promise<{ matchId: string; ops: string }> }) {
  const { matchId, ops } = await ctx.params;
  const decodedMatch = decodeURIComponent(matchId);
  const decodedOps = decodeURIComponent(ops);
  const reqUrl = new URL(req.url);
  const origin = reqUrl.origin;
  const t = reqUrl.searchParams.get("t") ?? "personal";
  const template = isStoryTemplate(t) ? t : "personal";

  // Authorise: you can only make a story for your own stats.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required", { status: 401 });

  // Resolve the report (real match, or the sample report for PREVIEW). Engines
  // are imported lazily so their deps never inflate the edge bundle.
  let report: MatchReport | null = null;
  if (decodedMatch === "PREVIEW") {
    // Dummy design data - admins only.
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) return new Response("Not allowed", { status: 403 });
    const { buildPreviewReportFromDb } = await import("@/lib/match-report/preview-report");
    report = await buildPreviewReportFromDb();
  } else {
    // The requested player must be the signed-in account's own ops tag.
    const { data: account } = await supabase.from("accounts").select("ops_tag").eq("auth_user_id", user.id).maybeSingle();
    const myOps = (account?.ops_tag ?? "").trim().toLowerCase();
    if (!myOps || myOps !== decodedOps.trim().toLowerCase()) {
      return new Response("You can only share your own match stats", { status: 403 });
    }
    const { fetchMatchReportSupabase } = await import("@/lib/match-report/supabase-engine");
    const result = await fetchMatchReportSupabase(supabase, decodedMatch);
    if (result.ok) report = result.report;
  }

  if (!report) return new Response("Match not found", { status: 404 });

  let player = findPlayerInReport(report, decodedOps);
  if (!player) return new Response("Player not found in match", { status: 404 });

  // PREVIEW-only helper so the level-up XP layout can be reviewed even though
  // the sample player doesn't level up naturally: ?demo=levelup bumps them one
  // level. No effect on real matches.
  if (decodedMatch === "PREVIEW" && reqUrl.searchParams.get("demo") === "levelup") {
    player = { ...player, xpCurrentLevelBeforeMatch: player.level, xpCurrentLevelAfterMatch: player.level + 1, xpLevelUpInMatch: true };
  }

  // Photo-story mode: a match photo positioned in the frame + an optional stats
  // overlay. The photo URL must be one of ours (a /public asset or Cloudinary).
  const isPhoto = t === "photo";
  const photoUrl = isPhoto ? (reqUrl.searchParams.get("photo") ?? "") : "";
  if (isPhoto) {
    const okHost = photoUrl.startsWith("/") || photoUrl.startsWith(origin) || photoUrl.includes("res.cloudinary.com/");
    if (!photoUrl || !okHost) return new Response("Invalid photo", { status: 400 });
  }

  // Blurred cover fill for Fit-mode letterbox bars. Cloudinary can blur; other
  // hosts (e.g. /public) fall back to a sharp cover of the same image.
  const bgUrl =
    isPhoto && photoUrl && photoUrl.includes("res.cloudinary.com/") && photoUrl.includes("/image/upload/")
      ? photoUrl.replace("/image/upload/", "/image/upload/e_blur:1200,w_600,h_1067,c_fill/")
      : photoUrl;

  const preloadUrls = collectStoryImages(report, player);
  if (isPhoto && photoUrl) {
    preloadUrls.push(photoUrl);
    if (bgUrl !== photoUrl) preloadUrls.push(bgUrl);
  }

  const [fonts, logo, images] = await Promise.all([
    loadStoryFonts(origin),
    loadLogoDataUri(origin),
    preloadImages(preloadUrls, origin),
  ]);
  const resolve = (u: string | undefined | null) => (u ? images.get(u) ?? "" : "");
  const num = (k: string, d: number) => {
    const v = Number(reqUrl.searchParams.get(k));
    return Number.isFinite(v) ? v : d;
  };

  try {
    const element = isPhoto
      ? renderPhotoStory(report, player, logo, resolve, {
          photo: images.get(photoUrl) ?? "",
          bg: images.get(bgUrl) ?? images.get(photoUrl) ?? "",
          img: { w: num("iw", 1080), h: num("ih", 1920), left: num("il", 0), top: num("it", 0) },
          overlay: isPhotoOverlay(reqUrl.searchParams.get("ov") ?? "") ? (reqUrl.searchParams.get("ov") as PhotoOverlay) : "main",
          branding: reqUrl.searchParams.get("brand") !== "0",
        })
      : renderStory(template, report, player, logo, resolve);
    const image = new ImageResponse(element, {
      width: 1080,
      height: 1920,
      fonts,
    });
    const buf = await image.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "image/png",
        // PREVIEW is admin design tooling - never cache it, so tweaks show
        // immediately. Real matches cache aggressively (immutable once ingested).
        "Cache-Control": decodedMatch === "PREVIEW" ? "no-store" : "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("[story] render failed", err);
    return new Response("Could not generate story image", { status: 500 });
  }
}
