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

export function postAuthPath(account: GateAccount | null): string {
  if (!account) return "/player-portal";
  if (!account.ops_tag) return "/player-portal/onboarding";
  if (!account.waiver_accepted_at) return "/player-portal/waiver";
  return "/player-portal";
}
