/**
 * app/player-portal/claim/page.tsx
 * --------------------------------------------------------------------
 * Lands a recipient who was emailed a token gift. Auth-gated - if they're new,
 * they sign up / sign in first (next brings them back here with the code). Once
 * signed in, they claim the gift (claim_token_gift grants the tokens once).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ClaimGiftButton } from "@/components/portal/ClaimGiftButton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Claim your gift" };

export default async function ClaimGiftPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(`/player-portal/claim?code=${code}`);
    redirect(`/player-portal/login?next=${next}`);
  }

  return (
    <Container size="narrow" className="py-16">
      <div className="mx-auto max-w-md portal-card p-8 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-accent">You&apos;ve got a gift</h1>
        <p className="mt-3 text-sm text-text-muted">
          Someone gifted you LaserOps game tokens. 1 token = 1 free game. Claim them to add them to your account.
        </p>
        <div className="mt-6">
          {code ? (
            <ClaimGiftButton code={code} />
          ) : (
            <p className="text-sm text-red-400">This claim link is missing its code. Please use the link from your email.</p>
          )}
        </div>
      </div>
    </Container>
  );
}
