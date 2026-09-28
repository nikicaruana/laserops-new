"use client";

/**
 * components/portal/SquadJoinRequests.tsx
 * --------------------------------------------------------------------
 * Pending join requests for a squad (captain/officer view): accept or decline.
 * Accepting adds the player (respond_join_request RPC re-checks role + caps).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type JoinRequest = { request_id: string; ops_tag: string | null; created_at: string };

export function SquadJoinRequests({ requests }: { requests: JoinRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("respond_join_request", { p_request_id: id, p_accept: accept });
    setBusy(null);
    if (err) return setError(err.message);
    router.refresh();
  }

  if (requests.length === 0) return null;

  return (
    <section className="mb-8 border border-accent/40 bg-accent/5 px-5 py-5">
      <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-accent">Join requests ({requests.length})</p>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      <ul className="divide-y divide-border">
        {requests.map((r) => (
          <li key={r.request_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
            <span className="font-semibold text-text">{r.ops_tag || "Player"}</span>
            <span className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.1em]">
              <button type="button" disabled={busy === r.request_id} onClick={() => respond(r.request_id, true)} className="text-accent hover:text-accent-soft disabled:opacity-50">
                Accept
              </button>
              <button type="button" disabled={busy === r.request_id} onClick={() => respond(r.request_id, false)} className="text-text-subtle hover:text-red-400 disabled:opacity-50">
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
