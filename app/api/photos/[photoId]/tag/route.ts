/**
 * app/api/photos/[photoId]/tag/route.ts
 * --------------------------------------------------------------------
 * Tag membership on a match photo ("I'm in this photo"). POST adds a tag,
 * DELETE removes one. A signed-in player may tag/untag THEMSELVES; admins may
 * tag/untag anyone (pass { ops } in the body). RLS enforces the same rules at
 * the DB level.
 */
import { createClient } from "@/lib/supabase/server";

async function resolveTarget(request: Request, supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: me } = await supabase.from("accounts").select("id, ops_tag").eq("auth_user_id", userId).maybeSingle();
  let body: { ops?: string } = {};
  try {
    body = (await request.json()) as { ops?: string };
  } catch {
    body = {};
  }
  const ops = (body.ops ?? "").trim();
  if (!ops) return { me, target: me }; // self
  // Tagging someone else -> admin only (RLS also enforces).
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return { me, target: null as { id: string; ops_tag: string | null } | null, forbidden: true };
  const { data: target } = await supabase.from("accounts").select("id, ops_tag").ilike("ops_tag", ops).maybeSingle();
  return { me, target };
}

export async function POST(request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: photo } = await supabase.from("match_photos").select("id").eq("id", photoId).maybeSingle();
  if (!photo) return Response.json({ ok: false, error: "Photo not found." }, { status: 404 });

  const { me, target, forbidden } = await resolveTarget(request, supabase, user.id);
  if (forbidden) return Response.json({ ok: false, error: "Only admins can tag other players." }, { status: 403 });
  if (!target?.id) return Response.json({ ok: false, error: "No player to tag." }, { status: 400 });

  const { error } = await supabase
    .from("match_photo_tags")
    .upsert({ photo_id: photo.id, account_id: target.id, created_by: me?.id ?? null }, { onConflict: "photo_id,account_id", ignoreDuplicates: true });
  if (error) {
    console.error("[photos/tag POST] failed:", error.message);
    return Response.json({ ok: false, error: "Could not add the tag." }, { status: 500 });
  }
  return Response.json({ ok: true, ops: target.ops_tag });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { target, forbidden } = await resolveTarget(request, supabase, user.id);
  if (forbidden) return Response.json({ ok: false, error: "Only admins can untag other players." }, { status: 403 });
  if (!target?.id) return Response.json({ ok: false, error: "No player to untag." }, { status: 400 });

  const { error } = await supabase.from("match_photo_tags").delete().eq("photo_id", photoId).eq("account_id", target.id);
  if (error) {
    console.error("[photos/tag DELETE] failed:", error.message);
    return Response.json({ ok: false, error: "Could not remove the tag." }, { status: 500 });
  }
  return Response.json({ ok: true, ops: target.ops_tag });
}
