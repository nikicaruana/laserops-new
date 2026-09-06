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

export function cldImage(url: string | null | undefined, opts: { w?: number; h?: number } = {}): string {
  const u = url ?? "";
  const i = u.indexOf(UPLOAD);
  if (!u.includes("res.cloudinary.com") || i === -1) return u;
  const after = u.slice(i + UPLOAD.length);
  if (HAS_TRANSFORM.test(after)) return u; // already has a transform — leave it
  const t = ["f_auto", "q_auto", "dpr_auto", "c_fit"];
  if (opts.w) t.push(`w_${opts.w}`);
  if (opts.h) t.push(`h_${opts.h}`);
  return u.slice(0, i + UPLOAD.length) + t.join(",") + "/" + after;
}
