/**
 * app/api/admin/vouchers/pdf/route.ts
 * --------------------------------------------------------------------
 * Printable prize-voucher sheet. Admin-gated. Lays out the vouchers of a batch
 * as card-style blocks (3 per A4 page) with the LaserOps logo, a "1 game token"
 * value, a QR code that opens /player-portal/claim?code=<code>, the short backup
 * code, and the expiry. Scanning the QR runs the normal claim flow (sign up /
 * in first if needed, then the token is granted once).
 *
 * Query: ?label=<batch label>  (use "(no label)" for the unlabeled batch), or
 * ?ids=<id,id,...>. ?all=1 includes claimed/void too (default: unclaimed only).
 */
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { brand } from "@/lib/brand";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type Voucher = { claim_code: string; tokens: number; expires_at: string | null; status: string };

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "laserops-logo-black.png");
const F_BOLD = path.join(FONT_DIR, "Montserrat-ExtraBold.ttf");
const F_SEMI = path.join(FONT_DIR, "Montserrat-SemiBold.ttf");
const F_MED = path.join(FONT_DIR, "Montserrat-Medium.ttf");

function fmtDate(iso: string | null): string {
  if (!iso) return "no expiry";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return new Response("Admins only.", { status: 403 });

  const url = new URL(req.url);
  const label = url.searchParams.get("label");
  const idsParam = url.searchParams.get("ids");
  const includeAll = url.searchParams.get("all") === "1";

  let q = supabase
    .from("token_gifts")
    .select("claim_code, tokens, expires_at, status, created_at")
    .eq("is_voucher", true)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (idsParam) {
    q = q.in("id", idsParam.split(",").map((s) => s.trim()).filter(Boolean));
  } else if (label != null) {
    q = label === "(no label)" ? q.is("batch_label", null) : q.eq("batch_label", label);
  } else {
    return new Response("Provide ?label= or ?ids=.", { status: 400 });
  }
  if (!includeAll) q = q.eq("status", "unclaimed");

  const { data, error } = await q;
  if (error) return new Response(error.message, { status: 500 });
  const vouchers = (data ?? []) as Voucher[];
  if (vouchers.length === 0) return new Response("No vouchers to print for that batch.", { status: 404 });

  // Pre-render the QR PNGs (dark on transparent-white) for each voucher.
  const claimBase = `${brand.siteUrl}/player-portal/claim`;
  const qrBuffers = await Promise.all(
    vouchers.map((v) =>
      QRCode.toBuffer(`${claimBase}?code=${encodeURIComponent(v.claim_code)}`, {
        type: "png", margin: 1, width: 360, color: { dark: "#111111ff", light: "#ffffffff" },
      }),
    ),
  );

  const logo = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

  const pdf: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 36, bottom: 24, left: 40, right: 40 } });
    doc.registerFont("bold", F_BOLD);
    doc.registerFont("semi", F_SEMI);
    doc.registerFont("med", F_MED);
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const PAGE_W = 595.28;
    const L = 40, R = 555.28, CW = R - L;
    const PER_PAGE = 3;
    const gap = 16;
    const topY = 36;
    const cardH = (841.89 - topY - 24 - gap * (PER_PAGE - 1)) / PER_PAGE;

    vouchers.forEach((v, i) => {
      const slot = i % PER_PAGE;
      if (i > 0 && slot === 0) doc.addPage();
      const cy = topY + slot * (cardH + gap);

      // Sharp-cornered card frame so the cards cut cleanly on straight lines.
      doc.rect(L, cy, CW, cardH).lineWidth(1).strokeColor("#c9c9c9").stroke();

      const pad = 24;
      const qrSize = Math.min(cardH - pad * 2, 150);
      const qrX = R - pad - qrSize;
      const qrY = cy + (cardH - qrSize) / 2;
      const textX = L + pad;
      const textW = qrX - 20 - textX;

      // Logo — prominent; it already carries the "Tactical Laser Tag" tagline.
      let ty = cy + pad;
      if (logo) {
        doc.image(logo, textX, ty, { fit: [255, 48] });
        ty += 58;
      } else {
        doc.font("bold").fontSize(20).fillColor("#111").text("LASEROPS", textX, ty, { lineBreak: false });
        doc.font("semi").fontSize(8).fillColor("#555").text("TACTICAL LASER TAG", textX, doc.y + 2, { characterSpacing: 2.5, lineBreak: false });
        ty = doc.y + 16;
      }

      // Value
      const tok = Number(v.tokens) || 1;
      doc.font("bold").fontSize(22).fillColor("#111")
        .text(`${tok} GAME TOKEN${tok === 1 ? "" : "S"}`, textX, ty, { width: textW, lineBreak: false });
      ty = doc.y + 7;

      // How to redeem — numbered steps.
      const steps = [
        "Scan the QR code with your phone camera.",
        "Sign in, or create your free LaserOps account.",
        "Tap “Claim” to add the token to your account.",
      ];
      steps.forEach((s, n) => {
        doc.font("bold").fontSize(9).fillColor("#111").text(`${n + 1}`, textX, ty, { continued: true, lineBreak: false });
        doc.font("med").fontSize(9).fillColor("#555").text(`   ${s}`, { width: textW });
        ty = doc.y + 3;
      });
      ty += 8;

      // Backup code — kept quiet; the QR is the main path.
      doc.font("med").fontSize(9).fillColor("#9a9a9a")
        .text(`Code  ${v.claim_code}`, textX, ty, { lineBreak: false, characterSpacing: 0.8 });
      doc.font("med").fontSize(8.5).fillColor("#9a9a9a")
        .text(`Valid until ${fmtDate(v.expires_at)}  ·  1 token = 1 game  ·  ${brand.siteUrl.replace(/^https?:\/\//, "")}/claim`, textX, ty + 15, { width: textW, lineBreak: false });

      // QR
      doc.image(qrBuffers[i], qrX, qrY, { width: qrSize, height: qrSize });
      doc.font("med").fontSize(7.5).fillColor("#888").text("Scan to claim", qrX, qrY + qrSize + 3, { width: qrSize, align: "center", lineBreak: false });
    });

    doc.end();
  });

  const fname = `laserops-vouchers-${(label ?? "batch").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
