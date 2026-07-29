/**
 * lib/waiver.ts
 * --------------------------------------------------------------------
 * The liability waiver + marketing-consent copy shown at onboarding, and
 * the waiver version we stamp on the account when a player accepts. Bump
 * WAIVER_VERSION whenever the wording changes so we can tell who agreed to
 * which revision (stored in accounts.waiver_version + waiver_accepted_at).
 */
export const WAIVER_VERSION = "1.0";

export const WAIVER_TITLE = "Waiver & Acknowledgement";

export const WAIVER_PARAGRAPHS = [
  "By participating in laser tag activities hosted by LaserOps, I acknowledge that physical activity involves inherent risks of injury. I voluntarily assume all such risks, including but not limited to bruises, falls, collisions, or minor injuries. I release LaserOps, its employees, affiliates, and the owner(s) of the property or premises where the activity takes place from any liability or claims arising from my participation, whether caused by negligence or otherwise.",
  "I confirm that I am in good health and not under the influence of drugs or alcohol.",
  "If I am under 18, I confirm that a parent or legal guardian is signing this waiver on my behalf.",
];

export const MARKETING_CONSENT_TEXT =
  "I agree to have my email address used to receive match stats, performance reports, seasonal challenges, game discounts, promotional content, and other news from LaserOps. I understand I can unsubscribe at any time.";
