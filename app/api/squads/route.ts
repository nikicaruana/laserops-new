/**
 * app/api/squads/route.ts
 * --------------------------------------------------------------------
 * Create (POST) / edit (PATCH) a squad, with server-side name + description
 * validation (length + profanity) before the create_squad / update_squad RPC.
 * The RPCs still enforce the caps/roles.
 */
import { createClient } from "@/lib/supabase/server";
import { validateSquadName, validateSquadDescription } from "@/lib/squadText";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = validateSquadName(String(body.name ?? ""));
  if (!name.ok) return Response.json({ ok: false, error: name.error }, { status: 400 });
  const desc = validateSquadDescription(typeof body.description === "string" ? body.description : null);
  if (!desc.ok) return Response.json({ ok: false, error: desc.error }, { status: 400 });

  const { data, error } = await supabase.rpc("create_squad", {
    p_name: name.value,
    p_description: desc.value || null,
    p_is_searchable: Boolean(body.is_searchable),
  });
  if (error || !data) return Response.json({ ok: false, error: error?.message || "Couldn't create the squad." }, { status: 400 });
  return Response.json({ ok: true, id: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const squadId = String(body.squad_id ?? "");
  if (!squadId) return Response.json({ ok: false, error: "Missing squad." }, { status: 400 });

  let name: string | null = null;
  if ("name" in body) {
    const r = validateSquadName(String(body.name ?? ""));
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
    name = r.value;
  }
  let description: string | null = null;
  const descProvided = "description" in body;
  if (descProvided) {
    const r = validateSquadDescription(typeof body.description === "string" ? body.description : null);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
    description = r.value; // "" clears it, text sets it
  }

  const { error } = await supabase.rpc("update_squad", {
    p_squad_id: squadId,
    p_name: name,
    p_description: descProvided ? description : null, // null = keep existing
    p_is_searchable: typeof body.is_searchable === "boolean" ? body.is_searchable : null,
    p_badge_url: null,
  });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
