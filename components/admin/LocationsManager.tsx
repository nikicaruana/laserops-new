"use client";

/**
 * components/admin/LocationsManager.tsx
 * --------------------------------------------------------------------
 * Manage playing locations (locations table): name + parking link + playing link,
 * with one marked default. The default is used for community-created open games
 * and pre-selected when an admin creates a game. Admin-gated by RLS + RPCs.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type LocationRow = {
  id: string;
  name: string;
  parkingUrl: string;
  playingUrl: string;
  isDefault: boolean;
};

const input =
  "h-10 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted";

export function LocationsManager({ initial }: { initial: LocationRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<LocationRow[]>(initial);
  const [adding, setAdding] = useState<{ name: string; parkingUrl: string; playingUrl: string }>({ name: "", parkingUrl: "", playingUrl: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, p: Partial<LocationRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function addLocation() {
    if (adding.name.trim() === "") return setMsg({ ok: false, text: "A location needs a name." });
    setBusyId("new");
    setMsg(null);
    const { error } = await supabase.rpc("admin_upsert_location", {
      p_id: null,
      p_name: adding.name,
      p_parking: adding.parkingUrl,
      p_playing: adding.playingUrl,
    });
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setAdding({ name: "", parkingUrl: "", playingUrl: "" });
    router.refresh();
  }

  async function save(r: LocationRow) {
    setBusyId(r.id);
    setMsg(null);
    const { error } = await supabase.rpc("admin_upsert_location", {
      p_id: r.id,
      p_name: r.name,
      p_parking: r.parkingUrl,
      p_playing: r.playingUrl,
    });
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_default_location", { p_id: id });
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setRows((rs) => rs.map((r) => ({ ...r, isDefault: r.id === id })));
    setMsg({ ok: true, text: "Default updated." });
    router.refresh();
  }

  async function remove(r: LocationRow) {
    if (r.isDefault) return setMsg({ ok: false, text: "Make another location the default before deleting this one." });
    setBusyId(r.id);
    setMsg(null);
    const { error } = await supabase.rpc("admin_delete_location", { p_id: r.id });
    setBusyId(null);
    if (error) return setMsg({ ok: false, text: error.message });
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    setMsg({ ok: true, text: "Removed." });
  }

  return (
    <div>
      {/* Existing locations */}
      <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Locations</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">No locations yet. Add your first below.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((r) => (
              <div key={r.id} className="grid gap-3 border border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[180px] flex-1">
                    <label className={labelCls}>Location name</label>
                    <input className={input} value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
                  </div>
                  <div className="flex items-end pb-0.5">
                    {r.isDefault ? (
                      <span className="inline-flex items-center border border-accent/50 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-accent">
                        Default
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => makeDefault(r.id)}
                        disabled={busyId === r.id}
                        className="px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted hover:text-accent disabled:opacity-50"
                      >
                        Make default
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Playing location (Google Maps link)</label>
                  <input className={input} value={r.playingUrl} onChange={(e) => patch(r.id, { playingUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
                </div>
                <div>
                  <label className={labelCls}>Parking location (Google Maps link)</label>
                  <input className={input} value={r.parkingUrl} onChange={(e) => patch(r.id, { parkingUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={() => save(r)} disabled={busyId === r.id}>
                    {busyId === r.id ? "Saving…" : "Save"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    disabled={busyId === r.id}
                    className="px-2 text-xs font-semibold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <p className="mt-3 max-w-2xl text-xs text-text-subtle">
          The default location is used for games the community opens, and is pre-selected when you create a game. Match
          reminders and calendar invites use the selected game&rsquo;s playing + parking links.
        </p>
      </section>

      {/* Add new */}
      <section className="border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Add a location</h2>
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Location name</label>
            <input className={input} value={adding.name} onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))} placeholder="e.g. White Rocks" />
          </div>
          <div>
            <label className={labelCls}>Playing location (Google Maps link)</label>
            <input className={input} value={adding.playingUrl} onChange={(e) => setAdding((a) => ({ ...a, playingUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/…" />
          </div>
          <div>
            <label className={labelCls}>Parking location (Google Maps link)</label>
            <input className={input} value={adding.parkingUrl} onChange={(e) => setAdding((a) => ({ ...a, parkingUrl: e.target.value }))} placeholder="https://maps.app.goo.gl/…" />
          </div>
          <div>
            <Button variant="secondary" size="md" onClick={addLocation} disabled={busyId === "new"}>
              {busyId === "new" ? "Adding…" : "+ Add location"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
