/**
 * scripts/backfill-private-invites.ts  (one-off)
 * Send the .ics calendar invites for the private bookings that were created
 * already "confirmed" (so they skipped the /confirm route that emails invites).
 *   npx tsx scripts/backfill-private-invites.ts
 * Sends to the business (bookings@) + any registered players. Idempotent-ish:
 * re-running just re-issues the same invite (same UID/sequence), which calendar
 * clients treat as an update, not a duplicate.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sendMatchInvites } from "../lib/calendar-invite";

const PATTERNS = ["GO / Zack Spiteri", "MFSA / Marzia", "Isaac's Private Bo"];

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  for (const pat of PATTERNS) {
    const { data } = await svc
      .from("matches")
      .select("id, title, status, scheduled_at")
      .ilike("title", `%${pat}%`);
    const rows = (data ?? []) as { id: string; title: string | null; status: string | null; scheduled_at: string | null }[];
    if (rows.length === 0) {
      console.log(`NO MATCH for "${pat}"`);
      continue;
    }
    for (const r of rows) {
      if (r.status !== "confirmed" && r.status !== "live") {
        console.log(`SKIP  "${r.title}" [${r.id}] - status ${r.status}`);
        continue;
      }
      const res = await sendMatchInvites(r.id, "REQUEST");
      console.log(`SEND  "${r.title}" [${r.id}] -> sent=${res.sent} ok=${res.ok}${res.reason ? " reason=" + res.reason : ""}`);
    }
  }
}

main();
