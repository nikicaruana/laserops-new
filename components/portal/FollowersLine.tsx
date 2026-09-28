"use client";

/**
 * components/portal/FollowersLine.tsx
 * --------------------------------------------------------------------
 * Small "N followers" line under a player's ops tag on the summary page.
 * Clicking it (when there are followers) opens a modal listing the accounts
 * that follow them, loaded on demand via the player_followers RPC. Each entry
 * links to that player's summary. Avatars are square (circles are for squads).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { avatarOrDefault } from "@/lib/avatar";

type Follower = { ops_tag: string | null; profile_pic_url: string | null };

export function FollowersLine({ opsTag, count }: { opsTag: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Follower[] | null>(null);

  useEffect(() => {
    if (!open || rows) return;
    let active = true;
    createClient()
      .rpc("player_followers", { p_ops_tag: opsTag })
      .then(({ data }) => {
        if (active) setRows((data ?? []) as Follower[]);
      });
    return () => {
      active = false;
    };
  }, [open, rows, opsTag]);

  const label = (
    <>
      <span className="font-bold text-text">{count}</span> follower{count === 1 ? "" : "s"}
    </>
  );

  if (count === 0) {
    return <p className="text-xs text-text-subtle">{label}</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto border border-border bg-bg-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Followers · {count}
              </p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-text-subtle hover:text-accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {rows === null ? (
              <p className="px-5 py-8 text-center text-sm text-text-subtle">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-text-subtle">No followers yet.</p>
            ) : (
              <ul>
                {rows.map((f, i) => {
                  const name = f.ops_tag || "Player";
                  return (
                    <li key={`${name}-${i}`} className="border-b border-border last:border-0">
                      <Link
                        href={`/player-portal/player-stats/summary?ops=${encodeURIComponent(name)}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-bg-elevated"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-bg-overlay text-[0.6rem] font-bold text-text-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={avatarOrDefault(f.profile_pic_url)} alt="" className="h-full w-full object-cover" />
                        </span>
                        <span className="text-sm font-semibold text-text">{name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
