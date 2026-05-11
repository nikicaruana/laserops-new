import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  if (!process.env.RESEND_API_KEY) {
    return Response.json(
      { ok: false, error: "Email service not configured." },
      { status: 500 },
    );
  }

  let body: { name?: string; email?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { name, email, message } = body;

  if (!name || !email || !message) {
    return Response.json(
      { ok: false, error: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  try {
    await resend.emails.send({
      from: "LaserOps Contact <noreply@laseropsmalta.com>",
      to: "info@laseropsmalta.com",
      replyTo: email,
      subject: `New Message from ${name}`,
      html: `
        <table style="font-family:sans-serif;font-size:14px;color:#333;border-collapse:collapse;width:100%;max-width:600px">
          <tr><td colspan="2" style="padding:20px 0;font-size:18px;font-weight:bold;border-bottom:2px solid #ffde00">
            New Contact Message
          </td></tr>
          <tr>
            <td style="padding:12px 16px 12px 0;font-weight:600;white-space:nowrap;vertical-align:top">Name</td>
            <td style="padding:12px 0">${name}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:12px 16px 12px 0;font-weight:600;white-space:nowrap;vertical-align:top">Email</td>
            <td style="padding:12px 0"><a href="mailto:${email}" style="color:#0066cc">${email}</a></td>
          </tr>
          <tr>
            <td style="padding:12px 16px 12px 0;font-weight:600;white-space:nowrap;vertical-align:top">Message</td>
            <td style="padding:12px 0;white-space:pre-wrap">${message}</td>
          </tr>
        </table>
      `,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[contact] Resend error:", err);
    return Response.json(
      { ok: false, error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }
}
