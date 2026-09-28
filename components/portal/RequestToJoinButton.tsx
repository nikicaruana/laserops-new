"use client";

/**
 * components/portal/RequestToJoinButton.tsx
 * --------------------------------------------------------------------
 * "Request to join" for a publicly-joinable squad. Sends a pending request
 * (request_to_join_squad RPC) to the captain + officers.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function RequestToJoinButton({ squadId, alreadyRequested }: { squadId: string; alreadyRequested: boolean }) {
  const [requested, setRequested] = useState(alreadyRequested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("request_to_join_squad", { p_squad_id: squadId });
    setBusy(false);
    if (err) return setError(err.message);
    setRequested(true);
  }

  if (requested) {
    return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Request sent – waiting for a captain to approve.</p>;
  }
  return (
    <div>
      <Button type="button" size="md" onClick={request} disabled={busy}>
        {busy ? "Sending…" : "Request to join"}
      </Button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
