"use client";

/**
 * components/portal/SquadInvitesInbox.tsx
 * --------------------------------------------------------------------
 * The player's pending squad invites, with accept/decline (respond_squad_invite
 * RPC re-checks the caps on accept). Shown on the Squads hub.
 */
import { useState } from "react";
import { cldImage } from "@/lib/cld";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type SquadInvite = { invite_id: string; squad_id: string; squad_name: string; badge_url: string | null };

export function SquadInvitesInbox({ invites }: { invites: SquadInvite[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("respond_squad_invite", { p_invite_id: id, p_accept: accept });
    setBusy(null);
    if (err) return setError(err.message);
    router.refresh();
  }

  if (invites.length === 0) return null;

  return (
    <section className="mb-10 border border-accent/40 bg-accent/5 px-5 py-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-accent">Squad invites ({invites.length})</h2>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      <ul className="space-y-2">
        {invites.map((i) => (
          <li key={i.invite_id} className="flex flex-wrap items-center justify-between gap-3 border border-border bg-bg-elevated px-4 py-2.5">
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-[0.6rem] font-bold text-text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.badge_url ? <img src={cldImage(i.badge_url, { w: 384 })} alt="" className="h-full w-full object-cover" /> : i.squad_name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-text">{i.squad_name}</span>
            </span>
            <span className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.1em]">
              <button type="button" disabled={busy === i.invite_id} onClick={() => respond(i.invite_id, true)} className="text-accent hover:text-accent-soft disabled:opacity-50">
                Accept
              </button>
              <button type="button" disabled={busy === i.invite_id} onClick={() => respond(i.invite_id, false)} className="text-text-subtle hover:text-red-400 disabled:opacity-50">
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
