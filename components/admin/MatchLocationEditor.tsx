"use client";

/**
 * components/admin/MatchLocationEditor.tsx
 * --------------------------------------------------------------------
 * Change one game's location after creation. Lists the venues (locations table,
 * fetched client-side) and saves matches.location_id via the admin RLS update.
 * The chosen venue's parking + playing map links then flow into this game's
 * reminders and calendar invite. No 2FA (low-stakes content).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const input =
  "h-11 w-60 rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function MatchLocationEditor({
  matchId,
  currentLocationId,
}: {
  matchId: string;
  currentLocationId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [locations, setLocations] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [locationId, setLocationId] = useState(currentLocationId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase
      .from("locations")
      .select("id, name, is_default")
      .order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []) as { id: string; name: string; is_default: boolean }[];
        setLocations(list);
        // A game with no explicit location uses the default – reflect that here.
        if (!currentLocationId) {
          const def = list.find((l) => l.is_default) ?? list[0];
          if (def) setLocationId((cur) => cur || def.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from("matches").update({ location_id: locationId || null }).eq("id", matchId);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Location</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className={labelCls}>Venue</label>
          <select className={input} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.length === 0 && <option value="">No locations set up</option>}
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.is_default ? " (default)" : ""}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" size="md" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      <p className="mt-3 max-w-xl text-xs text-text-subtle">
        Sets the parking + playing map links sent in this game&rsquo;s reminders and calendar invite. Manage venues at
        Admin &rarr; Locations.
      </p>
    </section>
  );
}
