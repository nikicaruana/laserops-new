"use client";

/**
 * components/admin/LevelUnlocksManager.tsx
 * --------------------------------------------------------------------
 * Per-level reward editor. Each row is a level from the rank ladder (badge +
 * name) with editable prize fields: title, description, token reward, icon URL,
 * and an active toggle. Saves through the admin-gated admin_set_level_unlock RPC.
 */
import { useState } from "react";
import { cldImage } from "@/lib/cld";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Row = {
  level: number;
  rankName: string;
  badgeUrl: string;
  title: string;
  description: string;
  iconUrl: string;
  rewardTokens: number;
  rewardDoubleXp: number;
  rewardXp15: number;
  isActive: boolean;
};

const input =
  "h-10 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-text-muted";

export function LevelUnlocksManager({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [savingLevel, setSavingLevel] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ level: number; ok: boolean; text: string } | null>(null);
  const [onlySet, setOnlySet] = useState(false);

  function patch(level: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.level === level ? { ...r, ...p } : r)));
  }

  async function save(row: Row) {
    setSavingLevel(row.level);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_level_unlock", {
      p_level: row.level,
      p_title: row.title,
      p_description: row.description,
      p_icon_url: row.iconUrl,
      p_reward_tokens: Number(row.rewardTokens) || 0,
      p_is_active: row.isActive,
      p_reward_double_xp: Math.max(0, Math.round(Number(row.rewardDoubleXp) || 0)),
      p_reward_xp_1_5: Math.max(0, Math.round(Number(row.rewardXp15) || 0)),
    });
    setSavingLevel(null);
    setMsg({ level: row.level, ok: !error, text: error ? error.message : "Saved." });
    if (!error) router.refresh();
  }

  const shown = onlySet ? rows.filter((r) => r.title.trim() !== "") : rows;

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
        <input type="checkbox" checked={onlySet} onChange={(e) => setOnlySet(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
        Show only levels with a reward set
      </label>

      <div className="space-y-3">
        {shown.map((r) => (
          <div key={r.level} className="border border-border bg-bg-elevated p-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              {r.badgeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cldImage(r.badgeUrl, { w: 384 })} alt="" className="h-10 w-auto" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center border border-border text-xs text-text-subtle">L{r.level}</span>
              )}
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.08em] text-text">Level {r.level}</p>
                {r.rankName && <p className="text-xs text-text-muted">{r.rankName}</p>}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Prize / unlock</label>
                <input className={input} value={r.title} onChange={(e) => patch(r.level, { title: e.target.value })} placeholder="e.g. Free open game" />
              </div>
              <div className="lg:col-span-2">
                <label className={labelCls}>Description</label>
                <input className={input} value={r.description} onChange={(e) => patch(r.level, { description: e.target.value })} placeholder="Optional detail" />
              </div>
              <div>
                <label className={labelCls}>Game tokens</label>
                <input className={input} type="number" min={0} step="0.5" value={r.rewardTokens} onChange={(e) => patch(r.level, { rewardTokens: Number(e.target.value) })} />
              </div>
              <div>
                <label className={labelCls}>Double XP tokens</label>
                <input className={input} type="number" min={0} step="1" value={r.rewardDoubleXp} onChange={(e) => patch(r.level, { rewardDoubleXp: Number(e.target.value) })} />
              </div>
              <div>
                <label className={labelCls}>1.5x XP tokens</label>
                <input className={input} type="number" min={0} step="1" value={r.rewardXp15} onChange={(e) => patch(r.level, { rewardXp15: Number(e.target.value) })} />
              </div>
              <div className="lg:col-span-2">
                <label className={labelCls}>Icon URL (optional)</label>
                <input className={input} value={r.iconUrl} onChange={(e) => patch(r.level, { iconUrl: e.target.value })} placeholder="https://…" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
                  <input type="checkbox" checked={r.isActive} onChange={(e) => patch(r.level, { isActive: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
                  Active
                </label>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <Button type="button" size="sm" onClick={() => save(r)} disabled={savingLevel === r.level}>
                {savingLevel === r.level ? "Saving…" : "Save"}
              </Button>
              {msg && msg.level === r.level && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
