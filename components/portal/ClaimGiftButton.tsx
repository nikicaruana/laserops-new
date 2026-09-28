"use client";

/**
 * components/portal/ClaimGiftButton.tsx
 * --------------------------------------------------------------------
 * Claims an email-gifted token pack for the signed-in player. Calls the
 * claim_token_gift RPC (definer; validates the code + grants the tokens once).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function ClaimGiftButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("claim_token_gift", { p_code: code });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(Number(data ?? 0));
  }

  if (done != null) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-text">
          {done} game token{done === 1 ? "" : "s"} added to your account. Enjoy the game!
        </p>
        <Button variant="primary" size="md" href="/player-portal/profile">
          View your tokens
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <Button variant="primary" size="lg" onClick={claim} disabled={busy}>
        {busy ? "Claiming…" : "Claim your tokens"}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={() => router.push("/player-portal/store")}
        className="block w-full text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
      >
        Go to the store
      </button>
    </div>
  );
}
