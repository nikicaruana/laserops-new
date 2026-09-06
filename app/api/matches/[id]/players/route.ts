/**
 * app/api/matches/[id]/players/route.ts
 * --------------------------------------------------------------------
 * Edit a published player: (re)assign a headband to a profile (or leave it a
 * walk-in) and set the gun. Admin + 2FA (aal2). Persists the change to
 * match_participants, re-resolves the whole match's aggregate + awards from the
 * fresh roster (identities, avatars, guns, and the opponent names inside every
 * player's nemesis/kill lists), then rolls the change into careers. Scores,
 * streaks and XP amounts are NOT recomputed — only attribution.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveRoster, hbKey } from "@/lib/ingestion/roster";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth: admin with a 2FA-elevated session.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.json({ error: "Two-factor authentication is required to edit players." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { headset_label?: string; account_id?: string | null; gun?: string | null };
  const headset = (body.headset_label ?? "").trim();
  if (!headset) return NextResponse.json({ error: "Missing headset_label." }, { status: 400 });
  const accountId = body.account_id ? String(body.account_id) : null;
  const gun = body.gun ? String(body.gun) : null;

  const svc = createServiceClient();
  if (!svc) return NextResponse.json({ error: "Server is not configured for writes (service role key missing)." }, { status: 500 });

  // Persist the assignment on the roster (source of truth for a re-publish too).
  const { error: upErr } = await svc
    .from("match_participants")
    .upsert(
      { operator_id: OPERATOR_ID, match_id: id, headset_label: headset, account_id: accountId, gun_used: gun, source: "admin" },
      { onConflict: "match_id,headset_label" },
    );
  if (upErr) return NextResponse.json({ error: `Couldn't save the assignment: ${upErr.message}` }, { status: 500 });

  // Re-resolve the whole match from the fresh roster.
  const roster = await resolveRoster(supabase, id);
  const { data: aggs } = await supabase
    .from("match_player_aggregate")
    .select("headset_label, nemesis, killed, killed_by")
    .eq("match_id", id);

  type Tally = { headband?: string; nickname: string; count: number };
  type Nem = { headband?: string; nickname: string; profilePicUrl: string | null; level: number; killsFor: number; killsAgainst: number } | null;
  const renameTally = (t: Tally[] | null) => (t ?? []).map((x) => ({ ...x, nickname: x.headband ? roster(x.headband).nickname : x.nickname }));
  const renameNem = (nm: Nem) => (nm && nm.headband ? { ...nm, nickname: roster(nm.headband).nickname, profilePicUrl: roster(nm.headband).profilePicUrl } : nm);

  for (const row of (aggs ?? []) as { headset_label: string | null; nemesis: Nem; killed: Tally[] | null; killed_by: Tally[] | null }[]) {
    const r = roster(row.headset_label ?? "");
    const { error } = await svc.from("match_player_aggregate").update({
      account_id: r.accountId,
      nickname: r.nickname,
      profile_pic_url: r.profilePicUrl,
      gun_used: r.gun,
      nemesis: renameNem(row.nemesis),
      killed: renameTally(row.killed),
      killed_by: renameTally(row.killed_by),
    }).eq("match_id", id).eq("headset_label", row.headset_label ?? "");
    if (error) return NextResponse.json({ error: `Aggregate update failed: ${error.message}` }, { status: 500 });
  }

  // Re-point awards to the resolved accounts/names.
  const { data: awards } = await supabase.from("match_awards").select("headset_label").eq("match_id", id);
  const seen = new Set<string>();
  for (const a of (awards ?? []) as { headset_label: string | null }[]) {
    const label = a.headset_label ?? "";
    if (!label || seen.has(hbKey(label))) continue;
    seen.add(hbKey(label));
    const r = roster(label);
    await svc.from("match_awards").update({ account_id: r.accountId, nickname: r.nickname }).eq("match_id", id).eq("headset_label", label);
  }

  // Roll the change into careers (chronological XP/level, lifetime, level rewards).
  const { error: rollupErr } = await supabase.rpc("rollup_match_careers");
  if (rollupErr) return NextResponse.json({ error: `Saved, but the career rollup failed: ${rollupErr.message}` }, { status: 500 });

  const resolved = roster(headset);
  return NextResponse.json({ ok: true, nickname: resolved.nickname, gun: resolved.gun });
}
