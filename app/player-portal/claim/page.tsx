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
import { cldImage } from "@/lib/cld";

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

  // Game-token coin art (reward_images.game_token) so the claim page shows what
  // is being added, matching the store.
  const { data: coin } = await supabase
    .from("reward_images")
    .select("image_url")
    .eq("key", "game_token")
    .maybeSingle();
  const coinSrc = coin?.image_url ? cldImage(coin.image_url, { w: 280, trim: true }) : null;

  return (
    <Container size="narrow" className="py-16">
      <div className="mx-auto max-w-md portal-card p-8 text-center">
        {coinSrc && (
          <img
            src={coinSrc}
            alt="LaserOps game token"
            className="mx-auto mb-5 h-28 w-28 object-contain drop-shadow-[0_0_18px_rgba(254,222,0,0.35)]"
          />
        )}
        <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-accent">Claim your tokens</h1>
        <p className="mt-3 text-sm text-text-muted">
          This code adds LaserOps game tokens to your account. 1 token = 1 free game. Claim it to drop the tokens
          straight into your wallet.
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
