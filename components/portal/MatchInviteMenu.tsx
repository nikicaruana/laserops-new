"use client";

/**
 * components/portal/MatchInviteMenu.tsx
 * --------------------------------------------------------------------
 * An "Invite" button that opens a menu to copy the shareable invite link or
 * invite one of the people you follow directly (they get a notification-bell
 * alert for the game). Replaces the always-open invite-link box. Followed
 * players load lazily on first open (my_following); inviting calls
 * invite_to_match.
 */
import { useEffect, useRef, useState } from "react";
import { cldImage } from "@/lib/cld";
import { createClient } from "@/lib/supabase/client";

type Follow = { account_id: string; ops_tag: string | null; profile_pic_url: string | null };

export function MatchInviteMenu({ matchId, inviteCode }: { matchId: string; inviteCode: string | null }) {
  const [open, setOpen] = useState(false);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function loadFollows() {
    if (loaded) return;
    const supabase = createClient();
    const { data } = await supabase.rpc("my_following");
    setFollows((data ?? []) as Follow[]);
    setLoaded(true);
  }

  function toggle() {
    setOpen((o) => {
      if (!o) void loadFollows();
      return !o;
    });
  }

  async function copyLink() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function invite(accountId: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("invite_to_match", { p_match_id: matchId, p_invitee_account_id: accountId });
    if (!error) setInvited((prev) => new Set(prev).add(accountId));
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent hover:text-accent"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Invite players
      </button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 mt-1 w-72 border border-border-strong bg-bg shadow-lg">
          {inviteCode && (
            <div className="border-b border-border p-3">
              <button
                type="button"
                onClick={copyLink}
                className="flex w-full items-center justify-center gap-2 border border-accent bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                  <rect x="9" y="9" width="11" height="11" rx="1.5" />
                  <path d="M5 15V5a1.5 1.5 0 0 1 1.5-1.5H15" strokeLinecap="round" />
                </svg>
                {copied ? "Link copied ✓" : "Copy invite link"}
              </button>
            </div>
          )}
          <p className="px-4 pt-3 pb-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Invite people you follow</p>
          {!loaded ? (
            <p className="px-4 py-4 text-xs text-text-subtle">Loading…</p>
          ) : follows.length === 0 ? (
            <p className="px-4 py-4 text-xs text-text-subtle">You&apos;re not following anyone yet.</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto pb-2">
              {follows.map((f) => {
                const name = f.ops_tag || "Player";
                const done = invited.has(f.account_id);
                return (
                  <li key={f.account_id} className="flex items-center gap-2.5 px-4 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-bg-overlay text-[0.55rem] font-bold text-text-muted">
                      {f.profile_pic_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cldImage(f.profile_pic_url, { w: 384 })} alt="" className="h-full w-full object-cover" />
                      ) : (
                        name.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{name}</span>
                    <button
                      type="button"
                      onClick={() => invite(f.account_id)}
                      disabled={done}
                      className="shrink-0 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft disabled:text-text-subtle"
                    >
                      {done ? "Invited" : "Invite"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
