/**
 * lib/payments/policy.ts - shared payment copy + refund-window policy.
 *
 * Refund tiers (hours before the game's scheduled start):
 *   >= 48h            -> automatic full refund on cancel
 *   24h to 48h        -> refund by request, approved by an admin
 *   < 24h             -> non-refundable
 *
 * REFUND_POLICY is shown to the player before they pay (next to the Pay button)
 * and on the hosted checkout page, where the provider supports it. Keep it in
 * sync with the tiers.
 */
export const AUTO_REFUND_HOURS = 48;
export const NO_REFUND_HOURS = 24;

export const REFUND_POLICY =
  "Cancel more than 48 hours before the game for an automatic full refund. Between 48 and 24 hours before, refunds are by request and approved by LaserOps. Within 24 hours of the game, payments are non-refundable. You can pass your spot to another player any time.";
