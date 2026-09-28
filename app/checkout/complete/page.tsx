/**
 * app/checkout/complete/page.tsx
 * --------------------------------------------------------------------
 * Generic post-payment landing. Viva's Smart Checkout redirects here (the
 * success URL is configured once on the payment Source, so it's the same for
 * match fees, token bundles and gifts) with ?t={transactionId}&s={orderCode}
 * appended. This page is UX only: the actual payment is confirmed asynchronously
 * by the /api/viva/webhook handler, so we just reassure the customer and point
 * them onward. (Stripe uses per-checkout success URLs and doesn't land here.)
 */
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment received" };

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; s?: string }>;
}) {
  const { t, s } = await searchParams;
  const ref = s ?? t ?? "";

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md portal-card px-6 py-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-950/40 text-2xl text-emerald-300" aria-hidden>
          &#10003;
        </div>
        <h1 className="text-xl font-extrabold uppercase tracking-tight text-text sm:text-2xl">Payment received</h1>
        <p className="mt-3 text-sm text-text-muted">
          Thanks &ndash; your payment went through. We&rsquo;re confirming it now, and it&rsquo;ll show against
          your game or purchase within a few moments.
        </p>
        {ref !== "" && <p className="mt-3 font-mono text-[0.65rem] text-text-subtle">Ref {ref}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/player-portal/games"
            className="border border-accent bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-bg"
          >
            My games
          </Link>
          <Link
            href="/player-portal/store"
            className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
          >
            Store
          </Link>
        </div>
        <p className="mt-6 text-[0.65rem] text-text-subtle">
          If it hasn&rsquo;t updated shortly, refresh &ndash; the confirmation arrives via a secure webhook.
        </p>
      </div>
    </main>
  );
}
