/**
 * scripts/sync-cld-transformations.mjs
 * --------------------------------------------------------------------
 * Provision the named Cloudinary transformations that lib/cld.ts delivers, so
 * "Strict transformations" can be enabled in the Cloudinary console without
 * breaking any image (arbitrary/forged transforms then 403, ours keep working).
 *
 * Run after editing the CLD_* ladders in lib/cld.ts:
 *   npm run cld:sync
 *
 * Idempotent: creates each named transformation, or updates it (definition +
 * allowed_for_strict) if it already exists. Reads creds from .env.local.
 *
 * KEEP THE LADDERS BELOW IN SYNC WITH lib/cld.ts (cldTransformRegistry()).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Must mirror lib/cld.ts ─────────────────────────────────────────────────
const CLD_WIDTHS = [64, 96, 128, 160, 200, 256, 320, 400, 512, 640, 800, 1200, 1600];
const CLD_HEIGHTS = [128, 200, 320];
const CLD_TRIM_WIDTHS = [96, 160, 200, 256, 640];
const BASE = "c_fit,f_auto,q_auto";

function registry() {
  const reg = { lo_base: BASE };
  for (const w of CLD_WIDTHS) reg[`lo_w${w}`] = `${BASE},w_${w}`;
  for (const h of CLD_HEIGHTS) reg[`lo_h${h}`] = `${BASE},h_${h}`;
  for (const w of CLD_TRIM_WIDTHS) reg[`lo_w${w}_trim`] = `e_trim/${BASE},w_${w}`;
  return reg;
}

function env(key) {
  const txt = readFileSync(join(ROOT, ".env.local"), "utf8");
  const m = txt.match(new RegExp("^" + key + "=(.*)$", "m"));
  return m ? m[1].trim() : undefined;
}

const cloud = env("CLOUDINARY_CLOUD_NAME");
const apiKey = env("CLOUDINARY_API_KEY");
const apiSecret = env("CLOUDINARY_API_SECRET");
if (!cloud || !apiKey || !apiSecret) {
  console.error("Missing CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET in .env.local");
  process.exit(1);
}
const auth = "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
const api = `https://api.cloudinary.com/v1_1/${cloud}/transformations`;

async function form(method, url, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, {
    method,
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function sync(name, transformation) {
  // Try to create; if it already exists, update its definition + strict flag.
  let r = await form("POST", api, { name, transformation, allowed_for_strict: "true" });
  if (r.ok) return "created";
  const msg = JSON.stringify(r.json).toLowerCase();
  if (r.status === 400 && msg.includes("exist")) {
    r = await form("PUT", `${api}/${encodeURIComponent(name)}`, {
      unsafe_update: transformation,
      allowed_for_strict: "true",
    });
    if (r.ok) return "updated";
  }
  throw new Error(`${name}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
}

(async () => {
  const reg = registry();
  const names = Object.keys(reg);
  console.log(`Syncing ${names.length} named transformations to cloud "${cloud}"...\n`);
  let created = 0, updated = 0;
  for (const name of names) {
    try {
      const outcome = await sync(name, reg[name]);
      outcome === "created" ? created++ : updated++;
      console.log(`  ${outcome.padEnd(7)} t_${name}  =  ${reg[name]}`);
    } catch (e) {
      console.error(`  FAIL    t_${name}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`\nDone. ${created} created, ${updated} updated, ${names.length} total.`);
  console.log("Next: enable Strict transformations in the Cloudinary console (Settings > Security).");
})();
