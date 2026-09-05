"use client";

/**
 * components/match-report/PlayerNarrative.tsx
 * --------------------------------------------------------------------
 * The AI match write-up shown under a player's name. Collapsed by default and
 * only generated when opened (saves an API call per view). Caches per (match,
 * player) in sessionStorage so re-opening doesn't re-generate or re-spend.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Status = "idle" | "loading" | "ready" | "error";

export function PlayerNarrative({ matchId, ops }: { matchId: string; ops: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [text, setText] = useState("");

  // Reset (collapsed) whenever the player changes.
  useEffect(() => {
    setOpen(false);
    setStatus("idle");
    setText("");
  }, [matchId, ops]);

  async function ensureLoaded() {
    if (status === "ready" || status === "loading") return;
    const key = `narrative:${matchId}:${ops}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setText(cached);
        setStatus("ready");
        return;
      }
    } catch {
      /* ignore */
    }
    setStatus("loading");
    try {
      const res = await fetch(`/api/player-narrative/${encodeURIComponent(matchId)}/${encodeURIComponent(ops)}`);
      const data = (await res.json()) as { ok: boolean; text?: string };
      if (data.ok && data.text) {
        try {
          sessionStorage.setItem(key, data.text);
        } catch {
          /* ignore */
        }
        setText(data.text);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void ensureLoaded();
  }

  return (
    <section className="mt-5 border border-border bg-bg-overlay/40">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
        <span className="flex items-center gap-2">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-accent">AI Match Write-up</span>
          <span className="rounded-sm border border-border-strong px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-[0.12em] text-text-subtle">AI generated</span>
        </span>
        <svg aria-hidden viewBox="0 0 16 16" className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 sm:px-6 sm:py-5">
          {status === "loading" && (
            <div className="flex flex-col gap-2" aria-label="Generating write-up">
              <span className="h-3 w-full animate-pulse rounded-sm bg-border" />
              <span className="h-3 w-[92%] animate-pulse rounded-sm bg-border" />
              <span className="h-3 w-[78%] animate-pulse rounded-sm bg-border" />
            </div>
          )}
          {status === "ready" && <p className="text-sm leading-relaxed text-text-muted sm:text-base">{text}</p>}
          {status === "error" && <p className="text-sm text-text-subtle">Write-up unavailable right now.</p>}
        </div>
      )}
    </section>
  );
}
