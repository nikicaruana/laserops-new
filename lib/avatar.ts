/**
 * lib/avatar.ts
 * --------------------------------------------------------------------
 * The branded "generic operative" avatar shown whenever a player has no
 * custom photo. Same image the leaderboards use as their fallback, so the
 * default looks identical everywhere. Stored as null in the DB; this is a
 * display-time fallback, not a stored value.
 */
export const DEFAULT_AVATAR_URL =
  "https://i.postimg.cc/sxy2jVMR/Generic-Ops-Profile-Pic.png";

/** A player's avatar, falling back to the branded default when unset. */
export function avatarOrDefault(url: string | null | undefined): string {
  return url && url.trim() !== "" ? url : DEFAULT_AVATAR_URL;
}
