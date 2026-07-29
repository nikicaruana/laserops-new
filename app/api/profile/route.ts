/**
 * app/api/profile/route.ts  — PATCH
 * --------------------------------------------------------------------
 * Updates the signed-in player's editable account fields: ops_tag,
 * full_name, date_of_birth, and the public-visibility toggles. Ops tag is
 * validated (format + profanity) here; uniqueness is enforced by the DB
 * unique index (we translate the 23505 violation into a friendly message).
 * The "update own row" RLS policy scopes the write to the caller; the
 * protect_account_fields trigger still guards is_admin/auth_user_id/etc.
 */
import { createClient } from "@/lib/supabase/server";
import { validateOpsTag } from "@/lib/opsTag";

function isValidDob(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const year = d.getUTCFullYear();
  const now = new Date();
  return year >= 1900 && d.getTime() <= now.getTime();
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) return Response.json({ ok: false, error: "No account linked." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.ops_tag === "string") {
    const result = validateOpsTag(body.ops_tag);
    if (!result.ok) {
      return Response.json({ ok: false, field: "ops_tag", error: result.error }, { status: 400 });
    }
    updates.ops_tag = result.value;
  }

  if ("full_name" in body) {
    const fn = typeof body.full_name === "string" ? body.full_name.trim() : "";
    updates.full_name = fn === "" ? null : fn.slice(0, 80);
  }

  if ("date_of_birth" in body) {
    const dob = body.date_of_birth;
    if (dob === null || dob === "") {
      updates.date_of_birth = null;
    } else if (typeof dob === "string" && isValidDob(dob)) {
      updates.date_of_birth = dob;
    } else {
      return Response.json({ ok: false, field: "date_of_birth", error: "Enter a valid date." }, { status: 400 });
    }
  }

  if (typeof body.show_full_name === "boolean") updates.show_full_name = body.show_full_name;
  if (typeof body.show_date_of_birth === "boolean") updates.show_date_of_birth = body.show_date_of_birth;

  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase.from("accounts").update(updates).eq("id", account.id);
  if (error) {
    if (error.code === "23505") {
      return Response.json(
        { ok: false, field: "ops_tag", error: "That ops tag is already taken." },
        { status: 409 },
      );
    }
    console.error("[api/profile] update failed:", error);
    return Response.json({ ok: false, error: "Couldn't save. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
