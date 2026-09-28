"use client";

/**
 * components/admin/AdminAlertTypesTable.tsx
 * --------------------------------------------------------------------
 * Enable / disable the admin-panel alert types (admin_notification_types). A
 * disabled type stops emitting new alerts (emit_admin_notification checks
 * is_active); existing alerts are untouched. Writes go straight to the table
 * (admin_all RLS). Optimistic toggle, reverts on error.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { key: string; label: string; description: string | null; priority: number; is_active: boolean };

export function AdminAlertTypesTable({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: string, next: boolean) {
    setError(null);
    setBusy(key);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, is_active: next } : r)));
    const { error: err } = await createClient()
      .from("admin_notification_types")
      .update({ is_active: next })
      .eq("key", key);
    setBusy(null);
    if (err) {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, is_active: !next } : r)));
      setError(err.message);
    }
  }

  return (
    <div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Alert</th>
              <th className="px-4 py-3 text-center font-semibold">Priority</th>
              <th className="px-4 py-3 text-right font-semibold">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                <td className="px-4 py-3">
                  <span className="font-semibold text-text">{r.label}</span>
                  {r.description && <span className="mt-0.5 block text-xs text-text-muted">{r.description}</span>}
                </td>
                <td className="px-4 py-3 text-center font-mono tabular-nums text-accent">{r.priority}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.is_active}
                    aria-label={`${r.is_active ? "Disable" : "Enable"} ${r.label}`}
                    disabled={busy === r.key}
                    onClick={() => toggle(r.key, !r.is_active)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
                      r.is_active ? "border-accent bg-accent" : "border-border-strong bg-bg-elevated"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                        r.is_active ? "translate-x-6 bg-bg" : "translate-x-1 bg-text-subtle"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
