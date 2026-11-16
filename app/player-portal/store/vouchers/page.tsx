/**
 * app/player-portal/store/vouchers/page.tsx
 * --------------------------------------------------------------------
 * Enquiry page for buying LaserOps Game Token gift vouchers in bulk. Open to
 * everyone (no login required). If the visitor is signed in we prefill and trust
 * their contact details; otherwise the form collects an email and phone. The
 * enquiry emails info@ and raises an admin alert - no online payment.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { VoucherEnquiryForm } from "@/components/portal/VoucherEnquiryForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Game Token Vouchers",
};

export default async function VoucherEnquiryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let account: { full_name: string | null; ops_tag: string | null; email: string | null; phone_e164: string | null } | null = null;
  if (user) {
    const { data } = await supabase
      .from("accounts")
      .select("full_name, ops_tag, email, phone_e164")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    account = data ?? null;
  }

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/player-portal/store"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted transition hover:text-accent"
        >
          <svg aria-hidden viewBox="0 0 12 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <path d="M5 1L1 5l4 4M1 5h10" />
          </svg>
          Back to store
        </Link>

        {/* Hero image of the printed vouchers */}
        <div className="mt-5 overflow-hidden rounded-sm border border-border">
          <img
            src="/images/store/voucher-promo.webp"
            alt="LaserOps Game Token gift vouchers"
            className="block h-auto w-full object-cover"
          />
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
          Game Token Vouchers
        </h1>
        <p className="mt-3 text-center text-sm text-text-muted">
          Printed gift vouchers, each loaded with game tokens (1 token = 1 game). Perfect for gifts, parties, team
          days, or stocking a prize pool. Tell us how many you&apos;d like and we&apos;ll be in touch to arrange it.
        </p>

        <div className="mt-8 portal-card p-6 sm:p-8">
          <VoucherEnquiryForm
            loggedIn={Boolean(user)}
            accountEmail={account?.email ?? user?.email ?? null}
            accountPhone={account?.phone_e164 ?? null}
            accountName={account?.full_name ?? account?.ops_tag ?? null}
          />
        </div>

        <p className="mt-6 text-center text-xs text-text-subtle">
          Prefer to talk it through? Email{" "}
          <a href="mailto:info@laseropsmalta.com" className="underline hover:text-accent">
            info@laseropsmalta.com
          </a>
          .
        </p>
      </div>
    </Container>
  );
}
