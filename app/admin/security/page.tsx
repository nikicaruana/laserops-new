/**
 * app/admin/security/page.tsx
 * --------------------------------------------------------------------
 * Your admin security – two-factor authentication (TOTP). Sensitive config
 * changes require a code from an enrolled authenticator.
 */
import { TotpEnroll } from "@/components/admin/TotpEnroll";

export const metadata = { title: "Security" };

export default function AdminSecurityPage() {
  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Security
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Two-factor authentication for your account. Sensitive changes (scoring, accolades, and
          more) require a code from your authenticator app – so nobody at your device can make them
          without your phone.
        </p>
      </header>

      <TotpEnroll />
    </div>
  );
}
