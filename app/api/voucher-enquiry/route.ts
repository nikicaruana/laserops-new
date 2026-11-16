/**
 * app/api/voucher-enquiry/route.ts
 * --------------------------------------------------------------------
 * A store visitor's enquiry about buying LaserOps Game Token gift vouchers in
 * bulk (for example, a batch of "1 game" cards to gift or resell). It does NOT
 * create or charge anything - it emails the enquiry to info@ and raises an admin
 * alert so we can get back to them and arrange it by hand.
 *
 * Works signed-in OR signed-out: when a player is signed in we trust the contact
 * details from their account (no need to re-type them); when not, the visitor
 * supplies an email and phone in the form. Mirrors the private-booking enquiry.
 */
import { Resend } from "resend";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Loose email sanity check - the real validation is us replying to it.
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If signed in, pull trusted contact details from the account.
  let account: { id: string; full_name: string | null; ops_tag: string | null; email: string | null; phone_e164: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("accounts")
      .select("id, full_name, ops_tag, email, phone_e164")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    account = data ?? null;
  }

  let body: { vouchers?: number; tokensPer?: number; email?: string; phone?: string; name?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const vouchers = Math.floor(Number(body.vouchers) || 0);
  const tokensPer = Math.floor(Number(body.tokensPer) || 0);
  if (vouchers < 1 || vouchers > 500) {
    return NextResponse.json({ ok: false, error: "Enter how many vouchers you'd like (1-500)." }, { status: 400 });
  }
  if (tokensPer < 1 || tokensPer > 50) {
    return NextResponse.json({ ok: false, error: "Enter how many game tokens each voucher holds (1-50)." }, { status: 400 });
  }

  // Contact details: trusted from the account when signed in, otherwise required
  // from the form.
  const name = (account?.full_name || account?.ops_tag || (body.name || "").trim() || "").trim();
  const contactEmail = (account?.email || user?.email || (body.email || "").trim()).trim();
  const contactPhone = (account?.phone_e164 || (body.phone || "").trim()).trim();
  const notes = (body.notes || "").trim().slice(0, 2000);

  if (!contactEmail || !looksLikeEmail(contactEmail)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email so we can get back to you." }, { status: 400 });
  }
  if (!contactPhone) {
    return NextResponse.json({ ok: false, error: "Enter a phone number so we can reach you." }, { status: 400 });
  }

  const totalTokens = vouchers * tokensPer;

  // --- Raise the admin alert (bell + dashboard). Non-fatal if it can't. ------
  const svc = createServiceClient();
  if (svc) {
    await svc.rpc("emit_admin_notification", {
      p_type_key: "voucher_enquiry",
      p_title: `Voucher enquiry - ${vouchers} x ${tokensPer} token${tokensPer === 1 ? "" : "s"}`,
      p_body: `${name || contactEmail} wants ${vouchers} voucher${vouchers === 1 ? "" : "s"} of ${tokensPer} token${tokensPer === 1 ? "" : "s"} each (${totalTokens} tokens total). Get back to them to arrange it.`,
      p_href: "/admin/notifications",
      p_entity_type: account ? "account" : null,
      p_entity_id: account?.id ?? null,
      p_data: {
        account_id: account?.id ?? null,
        signed_in: Boolean(user),
        name: name || null,
        email: contactEmail,
        phone: contactPhone,
        vouchers,
        tokens_per_voucher: tokensPer,
        total_tokens: totalTokens,
        notes: notes || null,
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
    ["Vouchers", String(vouchers)],
    ["Tokens per voucher", String(tokensPer)],
    ["Total tokens", String(totalTokens)],
    ["Name", name || "-"],
    ["Email", contactEmail],
    ["Phone", contactPhone],
    ["Account", account ? "Signed-in player" : "Guest (not signed in)"],
  ];
  if (notes) rows.push(["Notes", notes]);

  const tableRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;font-size:13px;color:#333;white-space:nowrap;border-bottom:1px solid #e0e0e0;vertical-align:top;">${esc(label)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #e0e0e0;white-space:pre-wrap;">${esc(value)}</td>
      </tr>`)
    .join("");
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;">
  <h2 style="margin:0 0 4px;font-size:20px;color:#111;">Game token voucher enquiry</h2>
  <p style="margin:0 0 20px;font-size:13px;color:#666;">Someone wants to buy game-token gift vouchers. Get back to them to arrange payment and printing.</p>
  <table style="border-collapse:collapse;width:100%;max-width:560px;"><tbody>${tableRows}</tbody></table>
  <p style="margin:20px 0 0;font-size:12px;color:#999;">Reply directly to this email to reach ${esc(name || "them")}.</p>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "LaserOps Store <noreply@laseropsmalta.com>",
      to: ["info@laseropsmalta.com"],
      replyTo: contactEmail,
      subject: `Voucher enquiry - ${vouchers} x ${tokensPer} token${tokensPer === 1 ? "" : "s"}`,
      html,
    });
    if (error) {
      console.error("[voucher-enquiry] Resend error:", error);
      return NextResponse.json({ ok: false, error: "Couldn't send your enquiry. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, emailed: true });
  } catch (err) {
    console.error("[voucher-enquiry] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
