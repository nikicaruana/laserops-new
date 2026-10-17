"use client";

/**
 * components/admin/MatchResultsBox.tsx
 * --------------------------------------------------------------------
 * One place, at the top of the match page, to make results official and keep
 * them fresh. Leads with Publish / Re-publish — which RE-SCORES from the current
 * line-up (roster, guns, headband assignments) and recomputes XP/level/ELO. It
 * flags when the line-up changed since publishing (results_stale_at), so an admin
 * knows a re-publish is needed. A lighter "Recompute XP & ELO only" replays
 * career progression without re-scoring (for a level/ELO config change). Both 2FA.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TotpGate } from "@/components/admin/TotpGate";

type Action = "publish" | "recompute" | "notify-report";

export function MatchResultsBox({
  matchId,
  published,
  stale,
}: {
  matchId: string;
  published: boolean;
  stale: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null); // which action the 2FA gate is for
  const [busy, setBusy] = useState<Action | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/${action}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean; error?: string; players?: number; winner?: string | null; matches?: number;
        sent?: number; recipients?: string[]; skipped?: number;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error || (action === "publish" ? "Publish failed." : action === "recompute" ? "Recompute failed." : "Sending report emails failed."));
      } else {
        if (action === "publish") setMsg(`Published — ${data.players} players${data.winner ? `, winner ${data.winner}` : ""}.`);
        else if (action === "recompute") setMsg(`Recomputed ${data.players} players across ${data.matches} matches.`);
        else setMsg((data.sent ?? 0) > 0
          ? `Report email sent to ${data.sent} new player${data.sent === 1 ? "" : "s"}${data.recipients?.length ? `: ${data.recipients.join(", ")}` : ""}. (${data.skipped} already notified.)`
          : `Everyone in the line-up has already been emailed — nothing to send.`);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(null);
  }

  const boxStale = published && stale;

  return (
    <div className={`mb-8 px-5 py-4 ${boxStale ? "border-l-4 border border-l-amber-400 border-amber-600 bg-amber-950/40" : "border border-border bg-bg-elevated"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] ${boxStale ? "text-amber-300" : published ? "text-emerald-300" : "text-text"}`}>
            {boxStale && <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />}
            {!published ? "Not published yet" : boxStale ? "Line-up changed since publishing" : "✓ Published · up to date"}
          </p>
          <p className="mt-1 max-w-xl text-xs text-text-muted">
            {!published
              ? "Publish to write each player's official score, accolades, XP and ELO from the current line-up."
              : boxStale
                ? "A headband, gun or profile changed after publishing. Re-publish to re-score from the new line-up — recompute alone won't re-score."
                : "Scores, XP and ELO reflect the current line-up. Re-publish after any change; recompute only replays career XP/ELO."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setPending("publish")}
            className={`border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-transform active:scale-[0.98] disabled:opacity-50 ${boxStale ? "animate-pulse border-amber-400 bg-amber-400 text-bg" : "border-accent bg-accent text-bg"}`}
          >
            {busy === "publish" ? "Publishing…" : published ? "Re-publish scores" : "Publish scores"}
          </button>
          {published && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setPending("recompute")}
              className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy === "recompute" ? "Recomputing…" : "Recompute XP & ELO only"}
            </button>
          )}
          {published && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setPending("notify-report")}
              title="Email the match report to any player added/corrected after publishing. Deduped — never double-sends."
              className="border border-border-strong px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy === "notify-report" ? "Sending…" : "Email report to new players"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-[0.65rem] text-text-subtle">All require 2FA. Publishing is blocked until every capture ambiguity is reviewed. &ldquo;Email report to new players&rdquo; only reaches players who haven&rsquo;t been emailed yet (e.g. a corrected walk-in) — it never re-scores or double-sends.</p>
      {msg && <p className="mt-2 text-xs text-emerald-300">{msg}</p>}
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      <TotpGate
        open={pending !== null}
        action={pending === "recompute" ? "recompute results" : pending === "notify-report" ? "email the match report to new players" : "publish match scores"}
        onCancel={() => setPending(null)}
        onVerified={async () => {
          const a = pending;
          setPending(null);
          if (a) await run(a);
        }}
      />
    </div>
  );
}
