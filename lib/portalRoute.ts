/**
 * lib/portalRoute.ts
 * --------------------------------------------------------------------
 * Decides where a just-authenticated player should land:
 *   - no ops tag yet        -> onboarding (full first-run setup)
 *   - ops tag but unsigned  -> waiver gate (existing/migrated players who
 *                              never signed must sign before playing)
 *   - otherwise             -> the portal
 * Shared by the auth callback (server) and password sign-in (client) so the
 * gating is identical everywhere. Waiver re-signing on version bumps is a
 * later enhancement; today the gate only catches never-signed accounts.
 */
export type GateAccount = {
  ops_tag: string | null;
  waiver_accepted_at: string | null;
};

/**
 * Sanitise a `next` redirect target: only same-app absolute paths are allowed,
 * never absolute URLs or protocol-relative ("//evil.com") ones (open-redirect
 * guard). Returns null when there's no usable target.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export function postAuthPath(account: GateAccount | null): string {
  if (!account) return "/player-portal/player-stats";
  if (!account.ops_tag) return "/player-portal/onboarding";
  if (!account.waiver_accepted_at) return "/player-portal/waiver";
  // Go straight to their own stats summary. Returning the final ?ops=<tag>
  // URL (rather than the /player-portal/player-stats entry, which would then
  // server-redirect again) avoids an extra redirect hop during the auth
  // transition – that double-redirect surfaced a brief client-side exception
  // flash before the page settled.
  return `/player-portal/player-stats/summary?ops=${encodeURIComponent(account.ops_tag)}`;
}
