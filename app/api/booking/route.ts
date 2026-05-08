import { Resend } from "resend";
import type { NextRequest } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return Response.json(
      { ok: false, error: "Email service is not configured." },
      { status: 500 },
    );
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const {
    eventType,
    fullName,
    email,
    phone,
    companyName,
    date,
    startTime,
    endTime,
    players,
    comments,
  } = body;

  // Basic server-side validation
  if (!eventType || !fullName || !email || !date || !startTime || !players) {
    return Response.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const subject = `New Booking Enquiry — ${eventType} on ${date}`;

  const rows = [
    ["Event Type", eventType],
    ["Full Name", fullName],
    ["Email", email],
    ["Phone", phone || "—"],
    ["Company", companyName || "—"],
    ["Date", date],
    ["Start Time", startTime],
    ["End Time", endTime || "—"],
    ["Number of Players", players],
    ["Comments", comments || "—"],
  ];

  const tableRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;font-size:13px;color:#333;white-space:nowrap;border-bottom:1px solid #e0e0e0;">${label}</td>
        <td style="padding:8px 12px;font-size:13px;color:#111;border-bottom:1px solid #e0e0e0;">${value}</td>
      </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#fff;">
  <h2 style="margin:0 0 4px;font-size:20px;color:#111;">New Booking Enquiry</h2>
  <p style="margin:0 0 20px;font-size:13px;color:#666;">Submitted via laseropsmalta.com/booking</p>
  <table style="border-collapse:collapse;width:100%;max-width:560px;">
    <tbody>${tableRows}</tbody>
  </table>
  <p style="margin:20px 0 0;font-size:12px;color:#999;">
    Reply directly to this email to respond to ${fullName}.
  </p>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: "LaserOps Bookings <bookings@laseropsmalta.com>",
      to: ["bookings@laseropsmalta.com"],
      replyTo: email,
      subject,
      html,
    });

    if (error) {
      console.error("[booking] Resend error:", error);
      return Response.json(
        { ok: false, error: "Failed to send email. Please try again." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[booking] Unexpected error:", err);
    return Response.json(
      { ok: false, error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
