"use client";

/**
 * components/portal/SquadMatchSignupButton.tsx
 * --------------------------------------------------------------------
 * Sign up to a squad-vs-squad match for your side. signup_squad_match RPC works
 * out which squad you represent and blocks if your squads are facing each other.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function SquadMatchSignupButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUp() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("signup_squad_match", { p_squad_match_id: matchId });
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  return (
    <div>
      <Button type="button" size="md" onClick={signUp} disabled={busy}>
        {busy ? "Signing up…" : "Sign up for the match"}
      </Button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
