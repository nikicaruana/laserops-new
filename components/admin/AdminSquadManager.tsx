"use client";

/**
 * components/admin/AdminSquadManager.tsx
 * --------------------------------------------------------------------
 * Admin full control of a squad: edit its fields, manage member roles, remove
 * members, disband. Writes squads / squad_members directly (admin_all RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { SquadBadgeUploader } from "@/components/portal/SquadBadgeUploader";

export type AdminMember = { account_id: string; ops_tag: string | null; role: string; is_primary: boolean };

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function AdminSquadManager({
  squadId,
  initialName,
  initialDescription,
  initialSearchable,
  initialBadgeUrl,
  members,
}: {
  squadId: string;
  initialName: string;
  initialDescription: string;
  initialSearchable: boolean;
  initialBadgeUrl: string | null;
  members: AdminMember[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [searchable, setSearchable] = useState(initialSearchable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("squads").update({ name: name.trim(), description: description.trim() || null, is_searchable: searchable }).eq("id", squadId);
    setBusy(false);
    if (err) return setError(err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function setRole(accountId: string, role: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("squad_members").update({ role }).eq("squad_id", squadId).eq("account_id", accountId);
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  async function remove(accountId: string) {
    if (!window.confirm("Remove this member from the squad?")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("squad_members").delete().eq("squad_id", squadId).eq("account_id", accountId);
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  async function disband() {
    if (!window.confirm("Disband this squad entirely? This removes it for everyone.")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("squads").delete().eq("id", squadId);
    setBusy(false);
    if (err) return setError(err.message);
    router.push("/admin/squads");
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>Squad badge</p>
        <SquadBadgeUploader squadId={squadId} initialUrl={initialBadgeUrl} name={name} />
      </section>

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>Squad details</p>
        <div className="space-y-3">
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name" />
          <textarea className={`${input} h-20 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder="Description" />
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input type="checkbox" checked={searchable} onChange={(e) => setSearchable(e.target.checked)} className="h-4 w-4 accent-accent" />
            Publicly joinable
          </label>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={save} disabled={busy}>Save</Button>
            {saved && <span className="text-xs text-accent">Saved.</span>}
          </div>
        </div>
      </section>

      <section>
        <p className={lbl}>Members ({members.length})</p>
        <ul className="divide-y divide-border border border-border">
          {members.map((m) => (
            <li key={m.account_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="font-semibold text-text">
                {m.ops_tag || "Player"}
                <span className="ml-2 text-[0.6rem] uppercase tracking-[0.12em] text-text-muted">{m.role}{m.is_primary ? " · primary" : ""}</span>
              </span>
              {m.role !== "captain" && (
                <span className="flex flex-wrap items-center gap-3 text-[0.65rem] font-bold uppercase tracking-[0.1em]">
                  {m.role === "member" ? (
                    <button type="button" disabled={busy} onClick={() => setRole(m.account_id, "officer")} className="text-accent hover:text-accent-soft disabled:opacity-50">Make officer</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setRole(m.account_id, "member")} className="text-text-muted hover:text-accent disabled:opacity-50">Demote</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => remove(m.account_id)} className="text-text-subtle hover:text-red-400 disabled:opacity-50">Remove</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border pt-4">
        <button type="button" disabled={busy} onClick={disband} className="text-xs font-bold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50">
          Disband squad
        </button>
      </section>
    </div>
  );
}
