/**
 * lib/payments/refund-config.ts
 * --------------------------------------------------------------------
 * Admin-editable refund policy (refund_config), read via the cookieless public
 * client so marketing / portal pages that show the policy stay static / ISR.
 * Falls back to the hardcoded policy.ts constants on any failure, so refunds
 * keep working even if the row is missing. Edited from /admin/refunds.
 */
import { createPublicClient } from "@/lib/supabase/public";
import { AUTO_REFUND_HOURS, NO_REFUND_HOURS, REFUND_POLICY } from "@/lib/payments/policy";

export type RefundConfig = {
  autoRefundHours: number;
  noRefundHours: number;
  policyText: string;
};

export const DEFAULT_REFUND_CONFIG: RefundConfig = {
  autoRefundHours: AUTO_REFUND_HOURS,
  noRefundHours: NO_REFUND_HOURS,
  policyText: REFUND_POLICY,
};

export async function getRefundConfig(): Promise<RefundConfig> {
  try {
    const sb = createPublicClient();
    const { data } = await sb
      .from("refund_config")
      .select("auto_refund_hours, no_refund_hours, policy_text")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return DEFAULT_REFUND_CONFIG;
    const auto = Number(data.auto_refund_hours);
    const no = Number(data.no_refund_hours);
    const text = typeof data.policy_text === "string" ? data.policy_text.trim() : "";
    return {
      autoRefundHours: Number.isFinite(auto) ? auto : DEFAULT_REFUND_CONFIG.autoRefundHours,
      noRefundHours: Number.isFinite(no) ? no : DEFAULT_REFUND_CONFIG.noRefundHours,
      policyText: text === "" ? DEFAULT_REFUND_CONFIG.policyText : text,
    };
  } catch {
    return DEFAULT_REFUND_CONFIG;
  }
}
