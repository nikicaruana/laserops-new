"use client";

/**
 * components/portal/InviteToSquadButton.tsx
 * --------------------------------------------------------------------
 * On a player's profile: if the viewer captains/officers their primary squad
 * and the player isn't already in it, show an "Invite to <squad>" button
 * (my_squad_invite_context decides). Sends a direct squad invite.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function InviteToSquadButton({ opsTag }: { opsTag: string }) {
  const [squadName, setSquadName] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.rpc("my_squad_invite_context", { p_target_ops_tag: opsTag }).then(({ data }) => {
      if (!active) return;
      const row = ((data ?? []) as { squad_name: string }[])[0];
      setSquadName(row?.squad_name ?? null);
    });
    return () => {
      active = false;
    };
  }, [opsTag]);

  async function invite() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("invite_to_my_squad", { p_ops_tag: opsTag });
    setBusy(false);
    if (err) return setError(err.message);
    setInvited(true);
  }

  if (!squadName) return null;
  if (invited) {
    return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Invited to {squadName}</p>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={invite}
        disabled={busy}
        className="h-9 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-50"
      >
        {busy ? "Inviting…" : `Invite to ${squadName}`}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
