/**
 * app/player-portal/claim/page.tsx
 * --------------------------------------------------------------------
 * Lands a recipient who scanned a voucher QR / was emailed a token gift. Auth-gated
 * - if they're new, they sign up / sign in first (next brings them back here with
 * the code). We peek at the code's state on load (peek_token_gift, a read-only
 * definer) so an already-redeemed, voided, expired or unknown code shows a clear
 * message instead of inviting a claim that then fails. Only a still-valid code
 * renders the Claim button, which grants the tokens once via claim_token_gift.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ClaimGiftButton } from "@/components/portal/ClaimGiftButton";
import { createClient } from "@/lib/supabase/server";
import { cldImage } from "@/lib/cld";

export const metadata: Metadata = { title: "Claim your gift" };

type Peek = {
  found: boolean;
  status: string | null;
  tokens: number | null;
  expired: boolean;
  is_voucher: boolean;
  claimed_by_me: boolean;
};

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

  // Peek at the code's state so we render the right screen on load.
  const { data: peekRows } = code
    ? await supabase.rpc("peek_token_gift", { p_code: code })
    : { data: null };
  const peek = (Array.isArray(peekRows) ? peekRows[0] : peekRows) as Peek | undefined;

  // Work out which state to show. A still-valid code is the only one that
  // renders the Claim button; everything else is an informational screen.
  type Blocked = { heading: string; body: string; tone: "muted" | "error"; showStore?: boolean; showTokens?: boolean };
  let blocked: Blocked | null = null;
  if (!code) {
    blocked = { heading: "Missing code", body: "This claim link is missing its code. Please use the link from your email or voucher.", tone: "error" };
  } else if (!peek?.found) {
    blocked = { heading: "Code not valid", body: "We couldn't find a gift for this code. Double-check the link from your email or voucher.", tone: "error" };
  } else if (peek.status === "claimed") {
    blocked = peek.claimed_by_me
      ? { heading: "Already claimed", body: "You've already redeemed this code — the tokens are in your account.", tone: "muted", showTokens: true }
      : { heading: "Already redeemed", body: "This code has already been redeemed on another account.", tone: "muted", showStore: true };
  } else if (peek.status === "void") {
    blocked = { heading: "No longer valid", body: "This voucher has been cancelled and can no longer be redeemed.", tone: "muted", showStore: true };
  } else if (peek.expired) {
    blocked = { heading: "Voucher expired", body: "This voucher has passed its expiry date and can no longer be redeemed.", tone: "muted", showStore: true };
  }

  return (
    <Container size="narrow" className="py-16">
      <div className="mx-auto max-w-md portal-card p-8 text-center">
        {blocked ? (
          <>
            <h1 className={`text-2xl font-bold uppercase tracking-[0.12em] ${blocked.tone === "error" ? "text-red-400" : "text-text"}`}>
              {blocked.heading}
            </h1>
            <p className="mt-3 text-sm text-text-muted">{blocked.body}</p>
            {(blocked.showTokens || blocked.showStore) && (
              <div className="mt-6 flex flex-col items-center gap-3">
                {blocked.showTokens && (
                  <Button variant="primary" size="md" href="/player-portal/profile">
                    View your tokens
                  </Button>
                )}
                {blocked.showStore && (
                  <Button variant="secondary" size="md" href="/player-portal/store">
                    Go to the store
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
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
              <ClaimGiftButton code={code} />
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
