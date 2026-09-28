"use client";

/**
 * components/layout/NotificationBell.tsx
 * --------------------------------------------------------------------
 * Logged-in players' alert bell, backed by the persistent `notifications` table.
 * Unread notifications show first (priority 1 = top, then newest); already-seen
 * ones stay listed below (dimmed) so players can go back to recent activity,
 * Facebook-style. The badge counts only unread. Clicking marks that one seen but
 * keeps it in the list; "Mark all as seen" clears the unread state with an Undo.
 * Realtime + a slow poll (so delayed notifications appear when they come due).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notif = { id: string; priority: number; title: string; message: string | null; href: string | null; seen: boolean };

export function NotificationBell() {
  const [signedIn, setSignedIn] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setSignedIn(false);
        setNotifs([]);
        return;
      }
      setSignedIn(true);
      const nowIso = new Date().toISOString();
      const [{ data: unread }, { data: seen }] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, priority, title, body, href")
          .is("seen_at", null)
          .lte("deliver_at", nowIso)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("notifications")
          .select("id, priority, title, body, href")
          .not("seen_at", "is", null)
          .lte("deliver_at", nowIso)
          .order("seen_at", { ascending: false })
          .limit(20),
      ]);
      if (!active) return;
      const map = (rows: unknown, isSeen: boolean): Notif[] =>
        ((rows ?? []) as { id: string; priority: number; title: string; body: string | null; href: string | null }[]).map((n) => ({
          id: n.id,
          priority: n.priority,
          title: n.title,
          message: n.body,
          href: n.href,
          seen: isSeen,
        }));
      setNotifs([...map(unread, false), ...map(seen, true)]);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 300);
    };

    load();
    const channel = supabase
      .channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, reload)
      .subscribe();
    const iv = setInterval(load, 90000);
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(iv);
      supabase.removeChannel(channel);
      sub.subscription.unsubscribe();
    };
  }, []);

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

  function markSeenLocal(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, seen: true } : n)));
    createClient().rpc("dismiss_notification", { p_id: id });
  }

  async function markAllSeen() {
    const supabase = createClient();
    const { data } = await supabase.rpc("mark_all_notifications_seen");
    const ids = (data ?? []) as string[];
    setNotifs((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, seen: true } : n)));
    if (ids.length) {
      setUndoIds(ids);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoIds([]), 6000);
    }
  }

  async function undo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const ids = undoIds;
    setUndoIds([]);
    if (ids.length) {
      setNotifs((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, seen: false } : n)));
      await createClient().rpc("undo_notifications_seen", { p_ids: ids });
    }
  }

  if (!signedIn) return null;

  const unreadCount = notifs.filter((n) => !n.seen).length;
  const hasUrgent = notifs.some((n) => !n.seen && n.priority <= 1);
  const firstSeenIdx = notifs.findIndex((n) => n.seen);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center text-text transition-colors hover:text-accent"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.6rem] font-bold text-bg ${hasUrgent ? "animate-pulse bg-accent" : "bg-accent"}`}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-72 border border-border-strong bg-bg-elevated shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllSeen} className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">
                Mark all seen
              </button>
            )}
            {unreadCount === 0 && undoIds.length > 0 && (
              <button type="button" onClick={undo} className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-soft">
                Undo
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-subtle">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifs.map((n, i) => {
                const inner = (
                  <>
                    <span className="flex items-center gap-2">
                      {!n.seen && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent ${n.priority <= 1 ? "animate-pulse" : ""}`} />}
                      <span className={`text-xs font-bold uppercase tracking-[0.1em] ${n.seen ? "text-text-muted" : n.priority <= 1 ? "text-accent" : "text-text"}`}>{n.title}</span>
                    </span>
                    {n.message && <span className={`mt-0.5 block text-xs ${n.seen ? "text-text-subtle" : "text-text-muted"}`}>{n.message}</span>}
                  </>
                );
                const cls = `block px-4 py-3 hover:bg-bg-overlay ${n.seen ? "opacity-60" : ""}`;
                return (
                  <li key={n.id}>
                    {i === firstSeenIdx && firstSeenIdx > 0 && (
                      <p className="border-y border-border bg-bg-overlay px-4 py-1 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Earlier</p>
                    )}
                    {n.href ? (
                      <Link href={n.href} role="menuitem" onClick={() => { if (!n.seen) markSeenLocal(n.id); setOpen(false); }} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => { if (!n.seen) markSeenLocal(n.id); }} className={`w-full text-left ${cls}`}>
                        {inner}
                      </button>
                    )}
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
