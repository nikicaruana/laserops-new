"use client";

/**
 * components/portal/MarketingConsent.tsx
 * --------------------------------------------------------------------
 * Benefit-led marketing opt-in field used at onboarding and at the account-
 * claim gate. Leads with the match-stats benefit to lift acceptance, with the
 * broader marketing consent folded in underneath. Presentational only - the
 * caller owns the state and the save. Consent means accounts.marketing_opt_in.
 */
import {
  MARKETING_CONSENT_HEADLINE,
  MARKETING_CONSENT_DETAIL,
  MARKETING_CONSENT_CHECKBOX,
} from "@/lib/waiver";

export function MarketingConsent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="border border-border bg-bg-overlay px-4 py-4">
      <p className="text-sm font-bold text-accent">{MARKETING_CONSENT_HEADLINE}</p>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{MARKETING_CONSENT_DETAIL}</p>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-text">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        />
        <span>{MARKETING_CONSENT_CHECKBOX}</span>
      </label>
    </div>
  );
}
