/**
 * lib/avatar.ts
 * --------------------------------------------------------------------
 * The branded "generic operative" avatar shown whenever a player has no
 * custom photo. Same image the leaderboards use as their fallback, so the
 * default looks identical everywhere. Stored as null in the DB; this is a
 * display-time fallback, not a stored value.
 */
import { cldImage } from "@/lib/cld";

export const DEFAULT_AVATAR_URL = "/images/default-avatar.png";

/** A player's avatar, falling back to the branded default when unset. Cloudinary
 *  avatars are auto-served at display size (webp/avif); `w` is the target pixel
 *  width (~2× CSS px for retina). The local default + non-Cloudinary URLs pass
 *  through unchanged. Default 256 suits cells/cards; pass a larger w for heroes. */
export function avatarOrDefault(url: string | null | undefined, w = 256): string {
  const src = url && url.trim() !== "" ? url : DEFAULT_AVATAR_URL;
  return cldImage(src, { w });
}
