/**
 * lib/story/share.ts
 * --------------------------------------------------------------------
 * Client-side helpers for sharing/downloading a generated story image. Browser
 * APIs (fetch, File, navigator.share) are only touched inside these functions,
 * so the module is safe to import; only call them from client components.
 *
 * There is no web API to auto-post to a personal Instagram/Facebook story, so
 * the intended path is the native share sheet (navigator.share) on mobile, with
 * a download fallback on desktop / unsupported browsers.
 */
export function storyFileName(ops: string, template: string): string {
  return `laserops-${ops}-${template}.png`.replace(/[^a-z0-9.\-]/gi, "-");
}

export async function fetchStoryFile(src: string, fileName: string): Promise<File> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Story image request failed (${res.status})`);
  const blob = await res.blob();
  return new File([blob], fileName, { type: "image/png" });
}

export function canShareFile(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
  return typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
}

export async function shareFile(file: File): Promise<void> {
  await (navigator as Navigator).share({
    files: [file],
    title: "My LaserOps Malta match",
    text: "Check out my match on LaserOps Malta",
  });
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** True if the native share sheet is likely available (mobile). Used to decide
 *  whether to show a "Share" button vs. a "Download" one. */
export function shareSheetLikely(): boolean {
  return typeof navigator !== "undefined" && typeof (navigator as Navigator).share === "function";
}
