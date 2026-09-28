/**
 * lib/ladders.ts – shared ladder helpers.
 */
export function ladderDisplayName(key: string, sponsorName: string | null): string {
  if (key === "company") return `LaserOps ${sponsorName?.trim() || "Company"} Ladder`;
  if (key === "pro") return "LaserOps Pro Ladder";
  return `LaserOps ${key} Ladder`;
}

/** Recommended banner upload size (4:1). */
export const LADDER_BANNER_W = 1600;
export const LADDER_BANNER_H = 400;

/** Responsive banner delivery: fixed 4:1 crop, width `w`, auto quality/format. */
export function ladderBannerUrl(url: string, w: number): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/c_fill,ar_4:1,g_auto,w_${w},q_auto,f_auto/`);
}

export function ladderBlurb(key: string): string {
  if (key === "company") return "Companies and organisations across Malta compete head-to-head.";
  if (key === "pro") return "The open ladder – create or join a squad and climb to the top for prizes.";
  return "";
}
