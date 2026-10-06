"use client";

/**
 * components/portal/SquadInviteCta.tsx
 * --------------------------------------------------------------------
 * Shown on a squad's page when the viewer has a PENDING invite to that squad
 * (e.g. they navigated there from the invite notification). Accept/Decline via
 * the same respond_squad_invite RPC the Squads-hub inbox uses - on accept it
 * re-checks the squad caps, then the page refreshes them into the roster.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SquadInviteCta({ inviteId, squadName }: { inviteId: string; squadName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("respond_squad_invite", { p_invite_id: inviteId, p_accept: accept });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-text">
        You&rsquo;ve been invited to join <span className="font-bold text-accent">{squadName}</span>.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(true)}
          className="flex h-11 items-center border border-accent bg-accent px-6 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Working…" : "Accept invite"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(false)}
          className="flex h-11 items-center border border-border-strong px-5 text-xs font-bold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-red-500 hover:text-red-400 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
