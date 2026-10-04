/**
 * lib/cld.ts
 * --------------------------------------------------------------------
 * cldImage() — insert Cloudinary delivery transforms into a res.cloudinary.com
 * /image/upload/ URL so icons/thumbnails ship at their display size in a modern
 * format instead of the full-resolution source PNG. Raw base PNGs are ~767 KB;
 * at w_96 they're ~2.5 KB (webp/avif via f_auto). Non-Cloudinary or already-
 * transformed URLs are returned unchanged, so it's safe to wrap any src.
 *
 * Client-safe (pure string), no SDK/env needed.
 */
const UPLOAD = "/image/upload/";
// A leading transformation segment uses `key_value` tokens (comma-separated).
const HAS_TRANSFORM = /^(?:[a-z]{1,3}_[^/,]+)(?:,[a-z]{1,3}_[^/,]+)*\//i;

export function cldImage(url: string | null | undefined, opts: { w?: number; h?: number; trim?: boolean; dpr?: boolean } = {}): string {
  const u = url ?? "";
  const i = u.indexOf(UPLOAD);
  if (!u.includes("res.cloudinary.com") || i === -1) return u;
  const after = u.slice(i + UPLOAD.length);
  if (HAS_TRANSFORM.test(after)) return u; // already has a transform — leave it
  const t = ["f_auto", "q_auto"];
  if (opts.dpr !== false) t.push("dpr_auto");
  t.push("c_fit");
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  // e_trim as a separate chained transform so it crops the uniform/transparent
  // border BEFORE the fit-resize — for badges with baked-in padding.
  const prefix = opts.trim ? "e_trim/" : "";
  return u.slice(0, i + UPLOAD.length) + prefix + t.join(",") + "/" + after;
}

/** A 1x/2x srcset at fixed widths (dpr_auto off), so the browser picks the width
 *  by device DPR instead of us shipping an oversized original. "" when not a
 *  transformable Cloudinary URL. */
export function cldSrcSet(url: string | null | undefined, w1x: number, w2x: number): string {
  const a = cldImage(url, { w: w1x, dpr: false });
  const b = cldImage(url, { w: w2x, dpr: false });
  if (!a || a === (url ?? "")) return "";
  return `${a} 1x, ${b} 2x`;
}
