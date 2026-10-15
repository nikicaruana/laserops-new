import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * app/api/track/route.ts
 * --------------------------------------------------------------------
 * First-party, consent-free landing page counter (see components/tracking/
 * PageVisit.tsx). Records a page view or CTA click into page_events.
 *
 * Nothing is stored on the visitor's device. "Unique visitors" use a salted
 * hash of IP + user agent where the salt rotates daily and is derived from a
 * server secret, so the raw IP is never stored and a visitor can't be followed
 * across days. Only allow-listed paths are accepted, bots are skipped, and the
 * route always answers 204 so it leaks nothing.
 */
export const dynamic = "force-dynamic";

const PATHS = new Set(["/welbees-offer"]);
const KINDS = new Set(["view", "cta_signup", "cta_games"]);
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i;

function maltaDay(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Malta" }).format(new Date());
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return s ? s.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua || BOT_RE.test(ua)) return done;

    // sendBeacon posts text/plain, so parse the raw body ourselves.
    const body = JSON.parse(await request.text()) as Record<string, unknown>;
    const path = typeof body.path === "string" ? body.path : "";
    const kind = typeof body.kind === "string" ? body.kind : "";
    if (!PATHS.has(path) || !KINDS.has(kind)) return done;

    const supabase = createServiceClient();
    if (!supabase) return done;

    const day = maltaDay();
    const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const visitorHash = createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);

    let referrerHost: string | null = null;
    try {
      if (typeof body.referrer === "string" && body.referrer) referrerHost = new URL(body.referrer).hostname.slice(0, 120);
    } catch { /* malformed referrer */ }

    await supabase.from("page_events").insert({
      path,
      kind,
      day,
      visitor_hash: visitorHash,
      source: clip(body.source, 60),
      referrer_host: referrerHost,
    });
  } catch {
    /* counting is best-effort */
  }
  return done;
}
