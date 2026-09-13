"use client";

/**
 * components/admin/LevelsManager.tsx
 * --------------------------------------------------------------------
 * The merged Levels page. One expandable row per rank level. Rank name and
 * score threshold are OWNED BY THE PROGRESSION CALIBRATOR (formula-driven) and
 * shown read-only here; the calibrator's "Publish & recompute" is the only
 * place they change. "Est. games" is ALSO read-only and derived live from the
 * instated formula (threshold / average XP-per-game across real games) — it is
 * not stored or hand-typed, so it can never drift from the curve. What this
 * page owns per level: the badge image and the unlock reward (prize,
 * description, icon, token grants, active flag). Badge saves straight to
 * rank_levels; the reward saves through the admin-gated admin_set_level_unlock
 * RPC. One "Save level" button per row commits both.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cldImage } from "@/lib/cld";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AdminImageUploader } from "@/components/admin/AdminImageUploader";

const OPERATOR_ID = "00000000-0000-0000-0000-000000000001";
const TIERS = ["Recruit", "Operative", "Ranger", "Specialist", "Veteran", "Elite", "Commander", "Warlord", "Apex", "Legend"];
const tierOf = (level: number) => TIERS[Math.max(0, Math.min(9, Math.floor((level - 1) / 5)))];
const numFmt = (v: number) => Math.round(v).toLocaleString("en-US");

export type LevelRow = {
  id: string;
  level: number;
  rankName: string;
  threshold: number;
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

function hasReward(r: LevelRow) {
  return r.title.trim() !== "" || r.rewardTokens > 0 || r.rewardDoubleXp > 0 || r.rewardXp15 > 0;
}

// Cumulative games to reach a level's threshold at average performance, no boosts.
function estGames(threshold: number, avgXpPerGame: number): number | null {
  if (threshold <= 0) return 0;
  if (avgXpPerGame <= 0) return null;
  return Math.max(1, Math.ceil(threshold / avgXpPerGame));
}

export function LevelsManager({ initialRows, avgXpPerGame }: { initialRows: LevelRow[]; avgXpPerGame: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<LevelRow[]>(initialRows);
  const [openLevel, setOpenLevel] = useState<number | null>(null);
  const [savingLevel, setSavingLevel] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ level: number; ok: boolean; text: string } | null>(null);
  const [onlyRewards, setOnlyRewards] = useState(false);

  function patch(level: number, p: Partial<LevelRow>) {
    setRows((rs) => rs.map((r) => (r.level === level ? { ...r, ...p } : r)));
  }

  async function save(row: LevelRow) {
    setSavingLevel(row.level);
    setMsg(null);
    // 1. Badge (the only ladder field this page owns) straight to rank_levels.
    const { error: e1 } = await supabase
      .from("rank_levels")
      .update({ operator_id: OPERATOR_ID, badge_url: row.badgeUrl || null })
      .eq("id", row.id);
    // 2. The unlock reward through the gated RPC.
    const e2 = e1
      ? e1
      : (
          await supabase.rpc("admin_set_level_unlock", {
            p_level: row.level,
            p_title: row.title,
            p_description: row.description,
            p_icon_url: row.iconUrl,
            p_reward_tokens: Number(row.rewardTokens) || 0,
            p_is_active: row.isActive,
            p_reward_double_xp: Math.max(0, Math.round(Number(row.rewardDoubleXp) || 0)),
            p_reward_xp_1_5: Math.max(0, Math.round(Number(row.rewardXp15) || 0)),
          })
        ).error;
    setSavingLevel(null);
    setMsg({ level: row.level, ok: !e2, text: e2 ? e2.message : "Saved." });
    if (!e2) router.refresh();
  }

  const shown = useMemo(() => (onlyRewards ? rows.filter(hasReward) : rows), [rows, onlyRewards]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">
          <input type="checkbox" checked={onlyRewards} onChange={(e) => setOnlyRewards(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
          Show only levels with a reward
        </label>
        <p className="text-[0.65rem] uppercase tracking-[0.1em] text-text-subtle">
          {avgXpPerGame > 0 ? `Est. games @ ~${numFmt(avgXpPerGame)} XP/game (avg, no boosts)` : "Est. games: no game data yet"}
        </p>
      </div>

      <div className="space-y-2">
        {shown.map((r, i) => {
          const open = openLevel === r.level;
          const showTier = i === 0 || tierOf(r.level) !== tierOf(shown[i - 1].level);
          const rewarded = hasReward(r);
          const eg = estGames(r.threshold, avgXpPerGame);
          return (
            <div key={r.level}>
              {showTier && (
                <p className="mb-1 mt-4 px-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-text-subtle first:mt-0">
                  {tierOf(r.level)}
                </p>
              )}
              <div className="border border-border bg-bg-elevated">
                {/* Collapsed header — click to expand */}
                <button
                  type="button"
                  onClick={() => setOpenLevel(open ? null : r.level)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  {r.badgeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cldImage(r.badgeUrl, { w: 384 })} alt="" className="h-9 w-auto shrink-0" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border text-[0.65rem] text-text-subtle">L{r.level}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase tracking-[0.06em] text-text">
                      Lvl {r.level} <span className="text-text-muted">· {r.rankName || tierOf(r.level)}</span>
                    </p>
                    <p className="truncate text-xs text-text-subtle">
                      {numFmt(r.threshold)} XP
                      {eg !== null && <span> · {eg === 0 ? "start" : `~${eg} game${eg === 1 ? "" : "s"}`}</span>}
                      {rewarded && r.title.trim() !== "" && <span className="text-text-muted"> · {r.title}</span>}
                    </p>
                  </div>
                  {rewarded ? (
                    <span className="shrink-0 rounded-full border border-accent/50 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-accent">Reward</span>
                  ) : (
                    <span className="shrink-0 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-text-subtle">No reward</span>
                  )}
                  <span className={`shrink-0 text-text-subtle transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
                </button>

                {/* Expanded editor */}
                {open && (
                  <div className="border-t border-border px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                      <div>
                        <span className={labelCls}>Badge image</span>
                        <AdminImageUploader
                          value={r.badgeUrl || null}
                          onChange={(url) => patch(r.level, { badgeUrl: url ?? "" })}
                          kind="rank"
                          previewClass="h-12 w-12"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 self-start text-xs sm:max-w-xs">
                        <div className="rounded border border-border bg-bg px-3 py-2">
                          <p className={labelCls}>Threshold</p>
                          <p className="font-mono text-sm text-text-muted">{numFmt(r.threshold)} XP</p>
                        </div>
                        <div className="rounded border border-border bg-bg px-3 py-2">
                          <p className={labelCls}>Est. games</p>
                          <p className="font-mono text-sm text-text-muted">{eg === null ? "—" : eg === 0 ? "start" : `~${eg}`}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-border/60 pt-4">
                      <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-accent">Unlock reward</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Button type="button" size="sm" onClick={() => save(r)} disabled={savingLevel === r.level}>
                        {savingLevel === r.level ? "Saving…" : "Save level"}
                      </Button>
                      {msg && msg.level === r.level && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
