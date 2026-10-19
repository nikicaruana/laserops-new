/**
 * app/api/private-booking-enquiry/route.ts
 * --------------------------------------------------------------------
 * A logged-in player's private-booking request. It does NOT create a game any
 * more - it emails the request to us (bookings@) with the player's account
 * contact details + the date/time/headcount they asked for, and raises an admin
 * notification so it can't be missed. We then create the game ourselves and send
 * them the invite link. Mirrors the not-logged-in /api/booking enquiry, but
 * authenticated so we trust the contact details from the account.
 */
import { Resend } from "resend";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const { data: account } = await supabase
    .from("accounts")
    .select("id, full_name, ops_tag, email, phone_e164")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) return NextResponse.json({ ok: false, error: "No account found." }, { status: 403 });

  let body: { title?: string; scheduledAt?: string; headcount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt : "";
  const when = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(when.getTime())) {
    return NextResponse.json({ ok: false, error: "Pick a valid date and time." }, { status: 400 });
  }
  const headcount = Math.max(1, Math.floor(Number(body.headcount) || 0));
  if (!headcount) return NextResponse.json({ ok: false, error: "Enter how many players." }, { status: 400 });
  const title = (body.title || "").trim() || `${account.ops_tag || account.full_name || "Player"}'s Private Booking`;

  const contactEmail = account.email || user.email || "";
  const whenLabel = when.toLocaleString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Malta",
  });

  // --- Raise the admin alert (bell + dashboard). Non-fatal if it can't. ------
  const svc = createServiceClient();
  if (svc) {
    await svc.rpc("emit_admin_notification", {
      p_type_key: "private_booking_request",
      p_title: `Private booking request - ${title}`,
      p_body: `${account.full_name || account.ops_tag || "A player"} wants ${headcount} player${headcount === 1 ? "" : "s"} on ${whenLabel}. Create the game and send them the invite.`,
      p_href: "/admin/matches",
      p_entity_type: "account",
      p_entity_id: account.id,
      p_data: {
        account_id: account.id,
        ops_tag: account.ops_tag,
        full_name: account.full_name,
        email: contactEmail,
        phone: account.phone_e164,
        title,
        scheduled_at: when.toISOString(),
        headcount,
      },
    });
  }

  // --- Email us the enquiry --------------------------------------------------
  if (!process.env.RESEND_API_KEY) {
    // The admin alert still went out; just report the email couldn't be sent.
    return NextResponse.json({ ok: true, emailed: false });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const rows: [string, string][] = [
    ["Booking name", title],
    ["Player", account.full_name || account.ops_tag || "Player"],
    ["Ops tag", account.ops_tag || "-"],
    ["Email", contactEmail || "-"],
    ["Phone", account.phone_e164 || "-"],
    ["When", whenLabel],
    ["Players", String(headcount)],
  ];
  const tableRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;font-size:13px;color:#333;white-space:nowrap;border-bottom:1px solid #e0e0e0;">${esc(label)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #e0e0e0;">${esc(value)}</td>
      </tr>`)
    .join("");
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;">
  <h2 style="margin:0 0 4px;font-size:20px;color:#111;">Private booking request</h2>
  <p style="margin:0 0 20px;font-size:13px;color:#666;">From a signed-in player via the game portal. Create the game and send them the invite link.</p>
  <table style="border-collapse:collapse;width:100%;max-width:560px;"><tbody>${tableRows}</tbody></table>
  <p style="margin:20px 0 0;font-size:12px;color:#999;">Reply directly to this email to reach ${esc(account.full_name || account.ops_tag || "the player")}.</p>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "LaserOps Bookings <bookings@laseropsmalta.com>",
      to: ["bookings@laseropsmalta.com"],
      replyTo: contactEmail || undefined,
      subject: `Private Booking Request - ${title}`,
      html,
    });
    if (error) {
      console.error("[private-booking-enquiry] Resend error:", error);
      return NextResponse.json({ ok: false, error: "Couldn't send your request. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("[private-booking-enquiry] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
