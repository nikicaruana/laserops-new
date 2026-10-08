"use client";

/**
 * components/portal/SquadControls.tsx
 * --------------------------------------------------------------------
 * Interactive squad actions for a member: copy the invite link, leave, set as
 * primary, and (captain/officer) manage members + edit the squad. Every write
 * goes through a SECURITY DEFINER RPC that re-checks the caller's role.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type RosterMember = { account_id: string; ops_tag: string | null; role: string; is_primary: boolean };

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function SquadControls({
  squadId,
  inviteCode,
  myRole,
  myIsPrimary,
  roster,
  initialName,
  initialDescription,
  initialSearchable,
}: {
  squadId: string;
  inviteCode: string | null;
  myRole: "captain" | "officer" | "member";
  myIsPrimary: boolean;
  roster: RosterMember[];
  initialName: string;
  initialDescription: string;
  initialSearchable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [lock, setLock] = useState<{ locked: boolean; season_name: string | null; unlock_on: string | null } | null>(null);

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [searchable, setSearchable] = useState(initialSearchable);
  const [savedNote, setSavedNote] = useState(false);

  const isCaptain = myRole === "captain";
  const canManage = myRole === "captain" || myRole === "officer";

  useEffect(() => {
    if (inviteCode) setInviteUrl(`${window.location.origin}/player-portal/squads/join/${inviteCode}`);
  }, [inviteCode]);

  useEffect(() => {
    createClient().rpc("squad_priority_lock").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setLock(row as { locked: boolean; season_name: string | null; unlock_on: string | null });
    });
  }, []);

  async function rpc(fn: string, args: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return false;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc(fn, args);
    setBusy(false);
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  }

  async function saveEdit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/squads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ squad_id: squadId, name: name.trim(), description: description.trim(), is_searchable: searchable }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !json.ok) {
      setError(json.error || "Couldn't save.");
      return;
    }
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1500);
    router.refresh();
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked – field is selectable */
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      {/* Invite link */}
      {inviteCode && (
        <section>
          <p className={lbl}>Invite link</p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} className={`${input} font-mono text-xs`} />
            <Button type="button" variant="secondary" size="md" onClick={copyInvite}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-1.5 text-[0.65rem] text-text-subtle">Share this so players can join the squad.</p>
        </section>
      )}

      {/* My membership */}
      <section className="flex flex-wrap items-center gap-3">
        {myIsPrimary ? (
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Your primary squad</span>
        ) : lock?.locked ? (
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle">Priority locked</span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => rpc("set_primary_squad", { p_squad_id: squadId }).then((ok) => ok && router.refresh())}
            className="text-xs font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft disabled:opacity-50"
          >
            Set as primary squad
          </button>
        )}
        {lock?.locked && (
          <span className="text-[0.65rem] text-text-subtle">
            Squad priority is locked for {lock.season_name ?? "the season"}
            {lock.unlock_on ? ` until ${fmtDate(lock.unlock_on)}` : ""}.{" "}
            <a href="/player-portal/squads/help" className="text-accent hover:text-accent-soft">Why?</a>
          </span>
        )}
        {!isCaptain && (
          <button
            type="button"
            disabled={busy}
            onClick={() => rpc("leave_squad", { p_squad_id: squadId }, "Leave this squad?").then((ok) => ok && router.push("/player-portal/squads"))}
            className="text-xs font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50"
          >
            Leave squad
          </button>
        )}
      </section>

      {/* Manage members (captain / officer) */}
      {canManage && (
        <section>
          <p className={lbl}>Manage members</p>
          <ul className="divide-y divide-border border border-border">
            {roster.map((m) => (
              <li key={m.account_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold text-text">
                  {m.ops_tag || "Player"}
                  <span className="ml-2 text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">{m.role}</span>
                </span>
                {m.role !== "captain" && (
                  <span className="flex flex-wrap items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.1em]">
                    {isCaptain && m.role === "member" && (
                      <button type="button" disabled={busy} onClick={() => rpc("set_squad_role", { p_squad_id: squadId, p_account_id: m.account_id, p_role: "officer" }).then((ok) => ok && router.refresh())} className="text-accent hover:text-accent-soft disabled:opacity-50">
                        Make officer
                      </button>
                    )}
                    {isCaptain && m.role === "officer" && (
                      <button type="button" disabled={busy} onClick={() => rpc("set_squad_role", { p_squad_id: squadId, p_account_id: m.account_id, p_role: "member" }).then((ok) => ok && router.refresh())} className="text-text-muted hover:text-accent disabled:opacity-50">
                        Demote
                      </button>
                    )}
                    {isCaptain && (
                      <button type="button" disabled={busy} onClick={() => rpc("transfer_captain", { p_squad_id: squadId, p_new_account_id: m.account_id }, `Make ${m.ops_tag || "this player"} the captain? You'll become an officer.`).then((ok) => ok && router.refresh())} className="text-text-muted hover:text-accent disabled:opacity-50">
                        Make captain
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => rpc("kick_squad_member", { p_squad_id: squadId, p_account_id: m.account_id }, "Remove this member?").then((ok) => ok && router.refresh())} className="text-text-subtle hover:text-red-400 disabled:opacity-50">
                      Remove
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Edit squad (captain) */}
      {isCaptain && (
        <section className="portal-card px-5 py-5">
          <p className={lbl}>Edit squad</p>
          <div className="space-y-3">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Squad name" />
            <textarea className={`${input} h-20 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder="Description" />
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
              <input type="checkbox" checked={searchable} onChange={(e) => setSearchable(e.target.checked)} className="h-4 w-4 accent-accent" />
              Publicly joinable
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={saveEdit}
              >
                Save
              </Button>
              {savedNote && <span className="text-xs text-accent">Saved.</span>}
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => rpc("disband_squad", { p_squad_id: squadId }, "Disband this squad? This removes it for everyone and can't be undone.").then((ok) => ok && router.push("/player-portal/squads"))}
              className="text-xs font-bold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Disband squad
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
