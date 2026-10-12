"use client";

/**
 * components/admin/DrinkMenuManager.tsx
 * --------------------------------------------------------------------
 * Admin editor for the drinks menu. Players self-report drinks (with quantity)
 * on the post-game pay page; prices here feed that total. Add, rename, re-price,
 * activate/deactivate and remove drinks. Writes go through the admin-gated
 * admin_set_drink / admin_delete_drink RPCs.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export type Drink = { id: string; name: string; price: number; sortOrder: number; isActive: boolean };

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";

export function DrinkMenuManager({ initial }: { initial: Drink[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Drink[]>(initial);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function setField<K extends keyof Drink>(id: string, key: K, value: Drink[K]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  async function saveRow(r: Drink) {
    const priceN = Number(r.price);
    if (!r.name.trim() || !Number.isFinite(priceN) || priceN < 0) {
      setMsg({ ok: false, text: "Enter a name and a price (0 or more)." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_drink", {
      p_id: r.id, p_name: r.name.trim(), p_price: priceN, p_sort: r.sortOrder, p_is_active: r.isActive,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Saved ${r.name.trim()}.` });
    router.refresh();
  }

  async function removeRow(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the menu?`)) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_delete_drink", { p_id: id });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setRows((prev) => prev.filter((r) => r.id !== id));
    setMsg({ ok: true, text: `Removed ${name}.` });
    router.refresh();
  }

  async function addDrink() {
    const priceN = Number(newPrice);
    if (!newName.trim() || !Number.isFinite(priceN) || priceN < 0) {
      setMsg({ ok: false, text: "Enter a name and a price." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const nextSort = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
    const { error } = await supabase.rpc("admin_set_drink", {
      p_id: null, p_name: newName.trim(), p_price: priceN, p_sort: nextSort, p_is_active: true,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setNewName("");
    setNewPrice("");
    setMsg({ ok: true, text: "Drink added." });
    router.refresh();
  }

  return (
    <div>
      <section className="mb-6 border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Menu</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">No drinks yet. Add one below.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Drink</th>
                  <th className="px-3 py-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Price (€)</th>
                  <th className="px-3 py-2 text-center text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Active</th>
                  <th className="px-3 py-2 text-right text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-middle">
                    <td className="px-3 py-2">
                      <input className={input} value={r.name} onChange={(e) => setField(r.id, "name", e.target.value)} />
                    </td>
                    <td className="w-32 px-3 py-2">
                      <input className={`${input} font-mono`} type="number" min={0} step="0.01" value={r.price}
                        onChange={(e) => setField(r.id, "price", Number(e.target.value))} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" className="h-4 w-4 accent-accent" checked={r.isActive}
                        onChange={(e) => setField(r.id, "isActive", e.target.checked)} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button type="button" onClick={() => saveRow(r)} disabled={busy}
                        className="px-2 text-xs font-semibold uppercase tracking-[0.1em] text-accent hover:text-accent-soft disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => removeRow(r.id, r.name)} disabled={busy}
                        className="ml-2 px-2 text-xs font-semibold uppercase tracking-[0.1em] text-red-400 hover:text-red-300 disabled:opacity-50">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
      </section>

      <section className="border border-border bg-bg-elevated p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent">Add a drink</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <div>
            <label className={labelCls}>Name</label>
            <input className={input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Coffee" />
          </div>
          <div>
            <label className={labelCls}>Price (€)</label>
            <input className={`${input} font-mono`} type="number" min={0} step="0.01" value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)} placeholder="e.g. 2.00" />
          </div>
          <Button variant="primary" size="md" onClick={addDrink} disabled={busy}>{busy ? "Working…" : "Add drink"}</Button>
        </div>
        <p className="mt-3 text-xs text-text-subtle">
          Players pick these (with a quantity) when settling up after a game. Deactivate a drink to hide it without losing its history.
        </p>
      </section>
    </div>
  );
}
