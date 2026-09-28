"use client";

/**
 * components/admin/AdminLadderManager.tsx
 * --------------------------------------------------------------------
 * Admin control of one ladder: config (name, sponsor, image, description,
 * squad limit, challenge range, max idle days, dates, active), enrolled squads
 * (add via search / remove), and join requests (accept/deny). Config writes go
 * directly to `ladders` (admin_all RLS); squads + requests go through RPCs.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { LadderBannerUploader } from "@/components/admin/LadderBannerUploader";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export type LadderConfig = {
  name: string;
  sponsor_name: string;
  description: string;
  image_url: string;
  squad_limit: string;
  challenge_range: string;
  max_idle_days: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};
export type LadderSquad = { squad_id: string; name: string; position: number };
export type LadderRequest = { request_id: string; squad_name: string };

export function AdminLadderManager({
  ladderId,
  initial,
  squads,
  requests,
}: {
  ladderId: string;
  initial: LadderConfig;
  squads: LadderSquad[];
  requests: LadderRequest[];
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState<LadderConfig>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);

  const set = (k: keyof LadderConfig, v: string | boolean) => setCfg((c) => ({ ...c, [k]: v }));
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  async function saveConfig() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("ladders")
      .update({
        name: cfg.name.trim(),
        sponsor_name: cfg.sponsor_name.trim() || null,
        description: cfg.description.trim() || null,
        squad_limit: numOrNull(cfg.squad_limit),
        challenge_range: Number(cfg.challenge_range) || 2,
        max_idle_days: Number(cfg.max_idle_days) || 30,
        start_date: cfg.start_date || null,
        end_date: cfg.end_date || null,
        is_active: cfg.is_active,
      })
      .eq("id", ladderId);
    setBusy(false);
    if (err) return setError(err.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  async function searchSquads(term: string) {
    setQ(term);
    if (!term.trim()) return setResults([]);
    const supabase = createClient();
    const { data } = await supabase.from("squads").select("id, name").ilike("name", `%${term.replace(/[%_]/g, "")}%`).limit(8);
    setResults((data ?? []) as { id: string; name: string }[]);
  }

  async function rpc(fn: string, args: Record<string, unknown>) {
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

  async function addSquad(id: string) {
    if (await rpc("admin_add_squad_to_ladder", { p_ladder_id: ladderId, p_squad_id: id })) {
      setQ("");
      setResults([]);
      router.refresh();
    }
  }

  async function removeSquad(id: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from("ladder_squads").delete().eq("ladder_id", ladderId).eq("squad_id", id);
    setBusy(false);
    if (err) return setError(err.message);
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-8">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      {/* Config */}
      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>Ladder settings</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={lbl}>Name</label><input className={input} value={cfg.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Sponsor name <span className="text-text-subtle">(company ladder title slot)</span></label><input className={input} value={cfg.sponsor_name} onChange={(e) => set("sponsor_name", e.target.value)} placeholder="e.g. Acme Corp" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Description / rules</label><textarea className={`${input} h-24 py-2`} value={cfg.description} onChange={(e) => set("description", e.target.value)} placeholder="Explain the ladder rules…" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Banner image <span className="text-text-subtle">(sponsorship banner)</span></label><LadderBannerUploader ladderId={ladderId} initialUrl={cfg.image_url || null} /></div>
          <div><label className={lbl}>Squad limit</label><input type="number" min="1" className={input} value={cfg.squad_limit} onChange={(e) => set("squad_limit", e.target.value)} placeholder="Unlimited" /></div>
          <div><label className={lbl}>Challenge range (± positions)</label><input type="number" min="1" className={input} value={cfg.challenge_range} onChange={(e) => set("challenge_range", e.target.value)} /></div>
          <div><label className={lbl}>Max idle days (drop after)</label><input type="number" min="1" className={input} value={cfg.max_idle_days} onChange={(e) => set("max_idle_days", e.target.value)} /></div>
          <div />
          <div><label className={lbl}>Start date</label><input type="date" className={`${input} [color-scheme:dark]`} value={cfg.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
          <div><label className={lbl}>End date</label><input type="date" className={`${input} [color-scheme:dark]`} value={cfg.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text sm:col-span-2">
            <input type="checkbox" checked={cfg.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 accent-accent" />
            Active (visible on the site)
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" size="sm" onClick={saveConfig} disabled={busy}>Save settings</Button>
          {saved && <span className="text-xs text-accent">Saved.</span>}
        </div>
      </section>

      {/* Join requests */}
      {requests.length > 0 && (
        <section className="border border-accent/40 bg-accent/5 px-5 py-5">
          <p className={lbl}>Join requests ({requests.length})</p>
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.request_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-text">{r.squad_name}</span>
                <span className="flex items-center gap-4 text-[0.65rem] font-bold uppercase tracking-[0.1em]">
                  <button type="button" disabled={busy} onClick={() => rpc("respond_ladder_request", { p_request_id: r.request_id, p_accept: true }).then((ok) => ok && router.refresh())} className="text-accent hover:text-accent-soft disabled:opacity-50">Accept</button>
                  <button type="button" disabled={busy} onClick={() => rpc("respond_ladder_request", { p_request_id: r.request_id, p_accept: false }).then((ok) => ok && router.refresh())} className="text-text-subtle hover:text-red-400 disabled:opacity-50">Deny</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Enrolled squads */}
      <section>
        <p className={lbl}>Squads ({squads.length})</p>
        <div className="mb-3">
          <input className={input} value={q} onChange={(e) => searchSquads(e.target.value)} placeholder="Search a squad to add…" />
          {results.length > 0 && (
            <ul className="mt-1 border border-border-strong bg-bg">
              {results.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => addSquad(s.id)} className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-bg-elevated">{s.name}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="divide-y divide-border border border-border">
          {squads.map((s) => (
            <li key={s.squad_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="font-semibold text-text"><span className="mr-2 font-mono text-accent">#{s.position}</span>{s.name}</span>
              <button type="button" disabled={busy} onClick={() => removeSquad(s.squad_id)} className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400 disabled:opacity-50">Remove</button>
            </li>
          ))}
          {squads.length === 0 && <li className="px-4 py-3 text-sm text-text-muted">No squads on this ladder yet.</li>}
        </ul>
      </section>
    </div>
  );
}
