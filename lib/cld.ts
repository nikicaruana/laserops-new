/**
 * lib/cld.ts
 * --------------------------------------------------------------------
 * cldImage() — insert a Cloudinary delivery transform into a res.cloudinary.com
 * /image/upload/ URL so icons/thumbnails ship at their display size in a modern
 * format instead of the full-resolution source PNG. Raw base PNGs are ~767 KB;
 * at w_96 they're ~2.5 KB (webp/avif via f_auto).
 *
 * STRICT TRANSFORMATIONS (anti abuse): instead of emitting arbitrary inline
 * transforms (which let anyone generate unlimited derivatives against our cloud
 * and burn credits), every transform is a NAMED transformation (t_lo_*) drawn
 * from the registry below. With "Strict transformations" enabled in the
 * Cloudinary console, any transform that is not one of these named ones returns
 * 403 — so an attacker can't forge `.../w_601/...`, `.../w_602/...`, etc.
 *
 * Requested widths/heights SNAP to the nearest bucket in the registry, so call
 * sites keep the ergonomic `{ w: 384 }` API and never emit an un-named (and thus
 * blocked) transform. The registry is the single source of truth; after editing
 * it, run `npm run cld:sync` to (re)create the named transformations in
 * Cloudinary. See scripts/sync-cld-transformations.ts.
 *
 * Client-safe (pure string), no SDK/env needed.
 */
const UPLOAD = "/image/upload/";
// A leading transformation segment uses `key_value` tokens (comma-separated).
const HAS_TRANSFORM = /^(?:[a-z]{1,3}_[^/,]+)(?:,[a-z]{1,3}_[^/,]+)*\//i;

// ── Named-transformation registry (single source of truth) ────────────────
// Ascending. Requested sizes snap UP to the nearest bucket (never upscales past
// the source: c_fit caps at the original). Add a bucket here + run `cld:sync`
// to introduce a new size; most new sizes just land on an existing bucket.
export const CLD_WIDTHS = [64, 96, 128, 160, 200, 256, 320, 400, 512, 640, 800, 1200, 1600] as const;
export const CLD_HEIGHTS = [128, 200, 320] as const;
// Widths that also need a trim variant (badges with baked-in transparent padding).
export const CLD_TRIM_WIDTHS = [96, 160, 200, 256, 640] as const;

const BASE = "c_fit,f_auto,q_auto"; // size-less fallback

/** name -> full transformation string. The ONLY transforms we ever deliver. */
export function cldTransformRegistry(): Record<string, string> {
  const reg: Record<string, string> = { lo_base: BASE };
  for (const w of CLD_WIDTHS) reg[`lo_w${w}`] = `${BASE},w_${w}`;
  for (const h of CLD_HEIGHTS) reg[`lo_h${h}`] = `${BASE},h_${h}`;
  // e_trim is a chained component so it crops the border BEFORE the fit-resize.
  for (const w of CLD_TRIM_WIDTHS) reg[`lo_w${w}_trim`] = `e_trim/${BASE},w_${w}`;
  return reg;
}

function snapUp(value: number, buckets: readonly number[]): number {
  for (const b of buckets) if (value <= b) return b;
  return buckets[buckets.length - 1];
}

/** The named transformation (without the `t_` prefix) for a size request. */
function presetName(opts: { w?: number; h?: number; trim?: boolean }): string {
  if (opts.trim && opts.w) return `lo_w${snapUp(opts.w, CLD_TRIM_WIDTHS)}_trim`;
  if (opts.w) return `lo_w${snapUp(opts.w, CLD_WIDTHS)}`;
  if (opts.h) return `lo_h${snapUp(opts.h, CLD_HEIGHTS)}`;
  return "lo_base";
}

export function cldImage(
  url: string | null | undefined,
  // `dpr` is accepted for backwards compatibility but ignored: named transforms
  // use fixed widths and cldSrcSet() covers retina via a 1x/2x srcset.
  opts: { w?: number; h?: number; trim?: boolean; dpr?: boolean } = {},
): string {
  const u = url ?? "";
  const i = u.indexOf(UPLOAD);
  if (!u.includes("res.cloudinary.com") || i === -1) return u;
  const after = u.slice(i + UPLOAD.length);
  if (HAS_TRANSFORM.test(after)) return u; // already has a transform — leave it
  return u.slice(0, i + UPLOAD.length) + "t_" + presetName(opts) + "/" + after;
}

/** A 1x/2x srcset at fixed widths, so the browser picks the width by device DPR
 *  instead of us shipping an oversized original. "" when not a transformable
 *  Cloudinary URL. */
export function cldSrcSet(url: string | null | undefined, w1x: number, w2x: number): string {
  const a = cldImage(url, { w: w1x });
  const b = cldImage(url, { w: w2x });
  if (!a || a === (url ?? "")) return "";
  return `${a} 1x, ${b} 2x`;
}
