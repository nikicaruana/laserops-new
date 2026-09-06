"use client";

/**
 * components/admin/PublishedPlayersEditor.tsx
 * --------------------------------------------------------------------
 * Post-publish player editor. For a scored match, admins can (re)assign a
 * headband to a real profile (e.g. a walk-in who made an account days later) or
 * leave it a walk-in, and set the gun (the round JSON doesn't carry it). Saving
 * re-attributes the published stats to that profile and rolls it into their
 * career — WITHOUT re-scoring. 2FA-gated (elevated once per session).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AccountPicker, type PickedAccount } from "@/components/admin/AccountPicker";
import { TotpGate } from "@/components/admin/TotpGate";

export type EditablePlayer = {
  headset_label: string;
  nickname: string;
  team_colour: string | null;
  gun_used: string | null;
  account_id: string | null;
};

type RowState = { accountId: string | null; label: string; gun: string };

export function PublishedPlayersEditor({
  matchId,
  players,
  guns,
}: {
  matchId: string;
  players: EditablePlayer[];
  guns: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(players.map((p) => [p.headset_label, { accountId: p.account_id, label: p.nickname, gun: p.gun_used ?? "" }])),
  );
  const base = Object.fromEntries(players.map((p) => [p.headset_label, { accountId: p.account_id, label: p.nickname, gun: p.gun_used ?? "" }]));

  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [elevated, setElevated] = useState(false);
  const [gateFor, setGateFor] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data?.currentLevel === "aal2") setElevated(true);
    });
  }, []);

  const dirty = (hb: string) => {
    const r = rows[hb], b = base[hb];
    return !!r && !!b && (r.accountId !== b.accountId || r.gun !== b.gun);
  };

  function setRow(hb: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [hb]: { ...prev[hb], ...patch } }));
  }

  async function save(hb: string) {
    setBusy(hb);
    setErr((e) => ({ ...e, [hb]: "" }));
    setMsg((m) => ({ ...m, [hb]: "" }));
    try {
      const r = rows[hb];
      const res = await fetch(`/api/matches/${matchId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headset_label: hb, account_id: r.accountId, gun: r.gun || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; nickname?: string };
      if (!res.ok || !data.ok) {
        setErr((e) => ({ ...e, [hb]: data.error || "Save failed." }));
      } else {
        setMsg((m) => ({ ...m, [hb]: "Saved" }));
        router.refresh();
      }
    } catch (e) {
      setErr((er) => ({ ...er, [hb]: e instanceof Error ? e.message : "Save failed." }));
    }
    setBusy(null);
  }

  function onSaveClick(hb: string) {
    if (elevated) return void save(hb);
    setGateFor(hb);
  }

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
            <th className="px-4 py-3 font-semibold">Headband</th>
            <th className="px-4 py-3 font-semibold">Profile</th>
            <th className="px-4 py-3 font-semibold">Team</th>
            <th className="px-4 py-3 font-semibold">Gun</th>
            <th className="px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const hb = p.headset_label;
            const r = rows[hb];
            const isWalkin = !r?.accountId;
            return (
              <tr key={hb} className="border-b border-border align-top last:border-0">
                <td className="px-4 py-3 font-mono text-text-muted">{hb}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={isWalkin ? "text-text-subtle" : "font-semibold text-text"}>
                      {r?.label || hb}
                      {isWalkin && <span className="ml-2 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-amber-300">Walk-in</span>}
                    </span>
                    {pickerFor === hb ? (
                      <div className="mt-1">
                        <AccountPicker
                          onPick={(a: PickedAccount) => {
                            setRow(hb, { accountId: a.id, label: a.ops_tag || a.full_name || "Player" });
                            setPickerFor(null);
                          }}
                          onCancel={() => setPickerFor(null)}
                        />
                        <button type="button" onClick={() => { setRow(hb, { accountId: null, label: hb }); setPickerFor(null); }} className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400">
                          Set as walk-in
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setPickerFor(hb)} className="self-start text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-accent hover:text-accent-soft">
                        {isWalkin ? "Assign to profile" : "Change profile"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">{p.team_colour ?? "–"}</td>
                <td className="px-4 py-3">
                  <select
                    value={r?.gun ?? ""}
                    onChange={(e) => setRow(hb, { gun: e.target.value })}
                    className="max-w-[10rem] border border-border-strong bg-bg px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
                  >
                    <option value="">— none —</option>
                    {guns.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!dirty(hb) || busy === hb}
                      onClick={() => onSaveClick(hb)}
                      className="border border-accent bg-accent px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
                    >
                      {busy === hb ? "Saving…" : "Save"}
                    </button>
                    {msg[hb] && <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-emerald-300">✓ {msg[hb]}</span>}
                    {err[hb] && <span className="text-[0.65rem] text-red-400">{err[hb]}</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <TotpGate
        open={gateFor !== null}
        action="edit this player"
        onCancel={() => setGateFor(null)}
        onVerified={async () => {
          const hb = gateFor;
          setGateFor(null);
          setElevated(true);
          if (hb) await save(hb);
        }}
      />
    </div>
  );
}
