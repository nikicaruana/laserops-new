/* eslint-disable */
/**
 * scripts/free-orphan-identity.ts
 * --------------------------------------------------------------------
 * Frees an email and/or ops_tag that a DELETED account is still holding, so it can
 * be reused (handy when re-testing the signup flow). Only touches rows whose
 * auth user no longer exists (true orphans) - never a live account. Nulls the
 * identifiers (releases the unique indexes) rather than deleting the row, so any
 * FK references stay intact. Dry-run by default; --write applies.
 *
 *   npx tsx scripts/free-orphan-identity.ts --email niki@laseropsmalta.com --ops-tag NikiC [--write]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const EMAIL = arg("--email");
const OPS = arg("--ops-tag");
const WRITE = process.argv.includes("--write");

function env() {
  const e: Record<string, string> = {};
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return e;
}

async function main() {
  if (!EMAIL && !OPS) { console.error("Pass --email and/or --ops-tag"); process.exit(1); }
  const e = env();
  const svc = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // Live auth user ids.
  const live = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { console.error("listUsers:", error.message); process.exit(1); }
    for (const u of data.users) live.add(u.id);
    if (data.users.length < 1000) break;
  }

  let q = svc.from("accounts").select("id, ops_tag, email, auth_user_id, reclaim_code");
  const ors: string[] = [];
  if (EMAIL) ors.push(`email.ilike.${EMAIL}`);
  if (OPS) ors.push(`ops_tag.ilike.${OPS}`);
  const { data: rows } = await q.or(ors.join(","));
  const matches = (rows ?? []) as any[];

  const orphans = matches.filter((r) => !r.auth_user_id || !live.has(r.auth_user_id));
  const liveHits = matches.filter((r) => r.auth_user_id && live.has(r.auth_user_id));
  if (liveHits.length) console.log(`SKIPPING ${liveHits.length} LIVE account(s) (auth user exists): ${liveHits.map((r) => r.ops_tag ?? r.email).join(", ")}`);
  if (!orphans.length) { console.log("No orphaned account holds that email/ops_tag. Nothing to free."); return; }

  for (const o of orphans) {
    const patch: any = {};
    // Email can be nulled; ops_tag CANNOT (an update trigger propagates it to
    // denormalized nickname columns that are NOT NULL - e.g. player_armory), so
    // retire it to a unique non-null placeholder, which frees the real tag.
    if (EMAIL && (o.email ?? "").toLowerCase() === EMAIL.toLowerCase()) patch.email = null;
    if (OPS && (o.ops_tag ?? "").toLowerCase() === OPS.toLowerCase()) { patch.ops_tag = `freed-${o.id.slice(0, 8)}`; patch.reclaim_code = null; }
    if (!Object.keys(patch).length) continue;
    console.log(`${WRITE ? "FREE" : "would free"} account ${o.id.slice(0, 8)} (ops_tag='${o.ops_tag}' email='${o.email}') -> ${JSON.stringify(patch)}`);
    if (WRITE) {
      const { error } = await svc.from("accounts").update(patch).eq("id", o.id);
      if (error) console.error(`  failed: ${error.message}`);
    }
  }
  if (!WRITE) console.log("\nDRY RUN - add --write to apply.");
}
main().catch((e) => { console.error(e); process.exit(1); });
