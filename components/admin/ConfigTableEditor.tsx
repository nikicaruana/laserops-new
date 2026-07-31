"use client";

/**
 * components/admin/ConfigTableEditor.tsx
 * --------------------------------------------------------------------
 * Reusable row editor for a banded config table (rank_levels, elo_tiers,
 * rating_brackets). Each row is edited inline; existing rows update by `id`
 * (so renaming a natural key never duplicates), new rows insert, removed rows
 * delete. Everything commits together behind one gated (TOTP) "Save changes".
 * An optional image column uses AdminImageUploader.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { TotpGate } from "@/components/admin/TotpGate";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";

export type ColumnKind = "number" | "text" | "image" | "readonly" | "select";
export type ColumnSpec = {
  key: string;
  label: string;
  kind: ColumnKind;
  step?: string;
  width?: string;
  align?: "left" | "right" | "center";
  options?: { value: string; label: string }[];
};

export type EditableRow = { id: string | null; [key: string]: unknown };

const cellInput =
  "h-10 w-full rounded-none border border-border-strong bg-bg px-2 text-sm text-text focus:border-accent focus:outline-none";

export function ConfigTableEditor({
  table,
  columns,
  initialRows,
  imageKind,
  gateAction,
  canAdd = false,
  canDelete = false,
  newRowTemplate,
  autoIncrement,
  addLabel = "+ Add row",
}: {
  table: string;
  columns: ColumnSpec[];
  initialRows: EditableRow[];
  imageKind?: "rank" | "tier" | "streak" | "team" | "gun" | "accolade";
  gateAction: string;
  canAdd?: boolean;
  canDelete?: boolean;
  /** Plain, serializable blank row (server components can't pass a factory fn). */
  newRowTemplate?: Record<string, unknown>;
  /** Column set to (row count + 1) when a new row is added, e.g. "sort_order". */
  autoIncrement?: string;
  addLabel?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRow[]>(initialRows);
  const [removed, setRemoved] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  function setCell(idx: number, key: string, value: unknown) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
    setState("idle");
  }

  function removeRow(idx: number) {
    setRows((prev) => {
      const row = prev[idx];
      if (row.id) setRemoved((r) => [...r, row.id as string]);
      return prev.filter((_, i) => i !== idx);
    });
    setState("idle");
  }

  function addRow() {
    if (!newRowTemplate) return;
    setRows((prev) => [
      ...prev,
      {
        ...newRowTemplate,
        id: null,
        ...(autoIncrement ? { [autoIncrement]: prev.length + 1 } : {}),
      },
    ]);
    setState("idle");
  }

  function payloadOf(row: EditableRow): Record<string, unknown> {
    const out: Record<string, unknown> = { operator_id: OPERATOR_ID };
    for (const c of columns) {
      if (c.kind === "readonly" && row.id) continue; // don't rewrite a fixed natural key on update
      out[c.key] = row[c.key] === "" ? null : row[c.key];
    }
    return out;
  }

  async function doSave() {
    setGateOpen(false);
    setState("saving");
    setError(null);
    const supabase = createClient();

    for (const id of removed) {
      const { error: err } = await supabase.from(table).delete().eq("id", id);
      if (err) {
        setError(`Delete failed: ${err.message}`);
        setState("idle");
        return;
      }
    }

    for (const row of rows) {
      const payload = payloadOf(row);
      const res = row.id
        ? await supabase.from(table).update(payload).eq("id", row.id)
        : await supabase.from(table).insert(payload);
      if (res.error) {
        setError(res.error.message);
        setState("idle");
        return;
      }
    }

    setRemoved([]);
    setState("saved");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-3 font-semibold ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`} style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
              {canDelete && <th className="px-3 py-3" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={(row.id as string) ?? `new-${idx}`} className="border-b border-border last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 align-middle ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                    {c.kind === "readonly" ? (
                      <span className="font-mono tabular-nums text-text-muted">{String(row[c.key] ?? "")}</span>
                    ) : c.kind === "image" ? (
                      <AdminImageUploader
                        value={(row[c.key] as string) ?? null}
                        onChange={(url) => setCell(idx, c.key, url)}
                        kind={imageKind ?? "team"}
                        previewClass="h-10 w-10"
                      />
                    ) : c.kind === "select" ? (
                      <select className={cellInput} value={(row[c.key] as string) ?? ""} onChange={(e) => setCell(idx, c.key, e.target.value)}>
                        {(c.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={c.kind === "number" ? "number" : "text"}
                        step={c.step ?? "any"}
                        className={cellInput}
                        value={(row[c.key] as string | number) ?? ""}
                        onChange={(e) =>
                          setCell(idx, c.key, c.kind === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
                        }
                        onFocus={(e) => e.target.select()}
                      />
                    )}
                  </td>
                ))}
                {canDelete && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="md"
          onClick={() => {
            setError(null);
            setGateOpen(true);
          }}
          disabled={state === "saving"}
        >
          {state === "saving" ? "Saving…" : "Save changes"}
        </Button>
        {canAdd && (
          <button
            type="button"
            onClick={addRow}
            className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
          >
            {addLabel}
          </button>
        )}
        {state === "saved" && <span className="text-xs text-accent">Saved.</span>}
      </div>

      <TotpGate
        open={gateOpen}
        action={gateAction}
        onCancel={() => setGateOpen(false)}
        onVerified={doSave}
      />
    </div>
  );
}
