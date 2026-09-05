/**
 * app/api/story/_fonts/load.ts
 * --------------------------------------------------------------------
 * Loads the Montserrat TTF weights + the LaserOps logo for the story-image
 * generator. On the edge runtime the assets are fetched over HTTP from the
 * site's own origin (public/fonts + public/brand): file:// asset URLs can't be
 * fetched in the edge sandbox, and the node build of @vercel/og breaks on
 * Windows dev. Results are cached per origin across invocations.
 */
type Weight = 500 | 600 | 700 | 800;
export type StoryFont = { name: "Montserrat"; data: ArrayBuffer; weight: Weight; style: "normal" };

async function fetchAsset(baseUrl: string, path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) throw new Error(`Asset fetch failed (${res.status}): ${path}`);
  return res.arrayBuffer();
}

let fontsCache: StoryFont[] | null = null;

export async function loadStoryFonts(baseUrl: string): Promise<StoryFont[]> {
  if (fontsCache) return fontsCache;
  const [medium, semibold, bold, extrabold] = await Promise.all([
    fetchAsset(baseUrl, "/fonts/Montserrat-Medium.ttf"),
    fetchAsset(baseUrl, "/fonts/Montserrat-SemiBold.ttf"),
    fetchAsset(baseUrl, "/fonts/Montserrat-Bold.ttf"),
    fetchAsset(baseUrl, "/fonts/Montserrat-ExtraBold.ttf"),
  ]);
  fontsCache = [
    { name: "Montserrat", data: medium, weight: 500, style: "normal" },
    { name: "Montserrat", data: semibold, weight: 600, style: "normal" },
    { name: "Montserrat", data: bold, weight: 700, style: "normal" },
    { name: "Montserrat", data: extrabold, weight: 800, style: "normal" },
  ];
  return fontsCache;
}

function toBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

let logoCache: string | null = null;

/** LaserOps yellow logo as a data URI (Satori embeds it inline). */
export async function loadLogoDataUri(baseUrl: string): Promise<string> {
  if (logoCache) return logoCache;
  const ab = await fetchAsset(baseUrl, "/brand/laserops-logo-yellow.png");
  logoCache = `data:image/png;base64,${toBase64(ab)}`;
  return logoCache;
}
