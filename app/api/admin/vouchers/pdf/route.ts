/**
 * app/api/admin/vouchers/pdf/route.ts
 * --------------------------------------------------------------------
 * Printable prize-voucher sheet. Admin-gated. Two-sided, card-style, 3 cards per
 * A4 page on a #fede00 yellow ground. For each group of 3 vouchers it lays down a
 * FRONT page (logo only) immediately followed by a BACK page (the "1 game token"
 * value, numbered redeem steps, the short backup code, the expiry, and the QR that
 * opens /player-portal/claim?code=<code>). Print duplex, flipping on the LONG edge,
 * then cut into 3 strips — each strip is a logo-front / details-back voucher.
 * Scanning the QR runs the normal claim flow (sign up / in first if needed, then
 * the token is granted once).
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
// Print-resolution wordmark (2000x373, transparent, rasterised from the vector
// logo) so the prominent front logo stays crisp at ~400 DPI.
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "laserops-wordmark-print.png");
const LOGO_RATIO = 373 / 2000;
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

  try {
  // Pre-render the QR PNGs for each voucher. Black modules on the same yellow as
  // the card, so the code sits directly on the ground with no white tile — the
  // contrast is still well within scanner tolerance.
  const claimBase = `${brand.siteUrl}/player-portal/claim`;
  const qrBuffers = await Promise.all(
    vouchers.map((v) =>
      QRCode.toBuffer(`${claimBase}?code=${encodeURIComponent(v.claim_code)}`, {
        type: "png", margin: 1, width: 360, color: { dark: "#111111ff", light: "#fede00ff" },
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

    const PAGE_W = 595.28, PAGE_H = 841.89;
    const YELLOW = "#fede00";
    const L = 40, R = 555.28, CW = R - L;
    const PER_PAGE = 3;
    const gap = 16;
    const topY = 36;
    const cardH = (PAGE_H - topY - 24 - gap * (PER_PAGE - 1)) / PER_PAGE;
    const host = brand.siteUrl.replace(/^https?:\/\//, "");
    const slotY = (slot: number) => topY + slot * (cardH + gap);

    // Fill the whole sheet yellow (full-bleed) so every cut card is yellow.
    const paintBg = () => doc.rect(0, 0, PAGE_W, PAGE_H).fill(YELLOW);
    // Dashed cut guide around each card — visible on yellow, sharp corners.
    const cardFrame = (cy: number) =>
      doc.rect(L, cy, CW, cardH).lineWidth(0.75).dash(4, { space: 3 }).strokeColor("#00000055").stroke().undash();

    // FRONT face: the logo only, centred on the yellow card.
    const drawFront = (cy: number) => {
      cardFrame(cy);
      if (logo) {
        const lw = 360;
        const lh = lw * LOGO_RATIO;
        doc.image(logo, L + (CW - lw) / 2, cy + (cardH - lh) / 2, { width: lw });
      } else {
        doc.font("bold").fontSize(34).fillColor("#111")
          .text("LASEROPS", L, cy + cardH / 2 - 28, { width: CW, align: "center", lineBreak: false });
        doc.font("semi").fontSize(10).fillColor("#333")
          .text("TACTICAL LASER TAG", L, doc.y + 4, { width: CW, align: "center", characterSpacing: 3, lineBreak: false });
      }
    };

    // BACK face: value, redeem steps, backup code, expiry, terms, and the QR.
    // Everything in near-black on the yellow ground so it reads boldly; the QR
    // shares the yellow background (no white tile).
    const drawBack = (v: Voucher, cy: number, qrIndex: number) => {
      cardFrame(cy);
      const pad = 26;
      const qrSize = 140;
      const qrX = R - pad - qrSize;
      const qrY = cy + (cardH - qrSize) / 2 - 2;
      const textX = L + pad;
      const textW = qrX - 24 - textX;
      const tok = Number(v.tokens) || 1;

      // Manual line advances throughout — pdfkit's doc.y is unreliable after
      // lineBreak:false runs, so every line's y is tracked explicitly.
      let ty = cy + pad;

      // Heading + short accent rule.
      doc.font("bold").fontSize(21).fillColor("#111")
        .text(`${tok} GAME TOKEN${tok === 1 ? "" : "S"}`, textX, ty, { width: textW, lineBreak: false });
      ty += 30;
      doc.moveTo(textX, ty).lineTo(textX + 48, ty).lineWidth(2.5).strokeColor("#111").stroke();
      ty += 15;

      // How to redeem — eyebrow + numbered steps.
      doc.font("bold").fontSize(7.5).fillColor("#111")
        .text("HOW TO REDEEM", textX, ty, { characterSpacing: 1.6, lineBreak: false });
      ty += 15;
      const steps = [
        "Scan the QR code with your phone camera.",
        "Sign in, or create your free LaserOps account.",
        "Tap “Claim” to add the token to your account.",
      ];
      steps.forEach((s, n) => {
        doc.font("bold").fontSize(9.5).fillColor("#111").text(`${n + 1}`, textX, ty, { continued: true, lineBreak: false });
        doc.font("med").fontSize(9.5).fillColor("#1a1a1a").text(`   ${s}`, { lineBreak: false });
        ty += 16;
      });
      ty += 9;

      // Backup code — label + prominent code.
      doc.font("semi").fontSize(7).fillColor("#4a4a2e")
        .text("BACKUP CODE", textX, ty, { characterSpacing: 1.4, lineBreak: false });
      ty += 12;
      doc.font("bold").fontSize(12.5).fillColor("#111")
        .text(v.claim_code, textX, ty, { characterSpacing: 1.4, lineBreak: false });
      ty += 20;

      // Validity + terms reference.
      doc.font("semi").fontSize(7.5).fillColor("#222")
        .text(`Valid until ${fmtDate(v.expires_at)}   ·   1 token = 1 game`, textX, ty, { lineBreak: false });
      ty += 12;
      doc.font("med").fontSize(7).fillColor("#3a3a2a")
        .text(`Game tokens are subject to our Terms & Conditions at ${host}/terms`, textX, ty, { width: textW });

      // QR — directly on the yellow, with a bold caption under it.
      doc.image(qrBuffers[qrIndex], qrX, qrY, { width: qrSize, height: qrSize });
      doc.font("bold").fontSize(8).fillColor("#111")
        .text("SCAN TO CLAIM", qrX, qrY + qrSize + 6, { width: qrSize, align: "center", characterSpacing: 1, lineBreak: false });
    };

    // Per group of 3: a page of fronts, then a page of backs in the same slots.
    // Duplex-print flipping on the long edge so each card gets its own back.
    let firstPage = true;
    for (let g = 0; g < vouchers.length; g += PER_PAGE) {
      const group = vouchers.slice(g, g + PER_PAGE);
      if (!firstPage) doc.addPage();
      firstPage = false;
      paintBg();
      group.forEach((_, slot) => drawFront(slotY(slot)));

      doc.addPage();
      paintBg();
      group.forEach((v, slot) => drawBack(v, slotY(slot), g + slot));
    }

    doc.end();
  });

  const fname = `laserops-vouchers-${(label ?? "batch").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
  } catch (e) {
    // Temporary diagnostic: surface the real failure to the admin so we can see
    // whether it is a missing traced asset (fonts/logo) or a pdfkit error.
    const diag = {
      cwd: process.cwd(),
      boldExists: fs.existsSync(F_BOLD),
      semiExists: fs.existsSync(F_SEMI),
      medExists: fs.existsSync(F_MED),
      logoExists: fs.existsSync(LOGO_PATH),
      error: String((e as { stack?: string })?.stack ?? e),
    };
    return new Response("VOUCHER PDF ERROR\n" + JSON.stringify(diag, null, 2), {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
