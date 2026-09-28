"use client";

/**
 * components/admin/AdminNotificationBell.tsx
 * --------------------------------------------------------------------
 * The admin panel's operational alert bell, backed by admin_notifications (a
 * shared feed across all admins, with per-admin seen state). Same UX as the
 * player NotificationBell: unread first (priority 1 = top, then newest), seen
 * ones dimmed below, badge counts unread, click marks one seen, "Mark all seen"
 * with an Undo. Reads/writes go through the admin_notification_* RPCs; realtime
 * on the table keeps it live. Renders nothing for non-admins (the feed RPC is
 * gated), so it is safe anywhere in the admin shell.
 */
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notif = { id: string; priority: number; title: string; message: string | null; href: string | null; seen: boolean };

export function AdminNotificationBell() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Unique per instance: the bell is mounted twice (mobile top bar + desktop
  // sidebar), so a shared channel name would collide on subscribe.
  const channelName = `admin-notif-bell-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase.rpc("admin_notification_feed");
      if (!active) return;
      setNotifs(
        ((data ?? []) as { id: string; priority: number; title: string; body: string | null; href: string | null; seen: boolean }[]).map((n) => ({
          id: n.id,
          priority: n.priority,
          title: n.title,
          message: n.body,
          href: n.href,
          seen: n.seen,
        })),
      );
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 300);
    };

    load();
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, reload)
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
    createClient().rpc("dismiss_admin_notification", { p_id: id });
  }

  function removeOne(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    createClient().rpc("remove_admin_notification", { p_id: id });
  }

  async function markAllSeen() {
    const supabase = createClient();
    const { data } = await supabase.rpc("mark_all_admin_notifications_seen");
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
      await createClient().rpc("undo_admin_notifications_seen", { p_ids: ids });
    }
  }

  const unreadCount = notifs.filter((n) => !n.seen).length;
  const hasUrgent = notifs.some((n) => !n.seen && n.priority <= 2);
  const firstSeenIdx = notifs.findIndex((n) => n.seen);

  // Nothing to show and nothing seen: keep the bell hidden so a non-admin (empty
  // feed) sees no chrome. Admins with a cleared feed still get the bell.
  if (notifs.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Admin notifications (${unreadCount})` : "Admin notifications"}
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
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-72 border border-border-strong bg-bg shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Admin alerts</p>
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
            <p className="px-4 py-6 text-center text-xs text-text-subtle">No alerts.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifs.map((n, i) => {
                const inner = (
                  <>
                    <span className="flex items-center gap-2">
                      {!n.seen && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent ${n.priority <= 2 ? "animate-pulse" : ""}`} />}
                      <span className={`text-xs font-bold uppercase tracking-[0.1em] ${n.seen ? "text-text-muted" : n.priority <= 2 ? "text-accent" : "text-text"}`}>{n.title}</span>
                    </span>
                    {n.message && <span className={`mt-0.5 block text-xs ${n.seen ? "text-text-subtle" : "text-text-muted"}`}>{n.message}</span>}
                  </>
                );
                const cls = "block px-4 py-3 hover:bg-bg-elevated";
                return (
                  <li key={n.id}>
                    {i === firstSeenIdx && firstSeenIdx > 0 && (
                      <p className="border-y border-border bg-bg-elevated/50 px-4 py-1 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Earlier</p>
                    )}
                    <div className={`flex items-start ${n.seen ? "opacity-60" : ""}`}>
                      {n.href ? (
                        <Link href={n.href} role="menuitem" onClick={() => { if (!n.seen) markSeenLocal(n.id); setOpen(false); }} className={`min-w-0 flex-1 ${cls}`}>
                          {inner}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => { if (!n.seen) markSeenLocal(n.id); }} className={`min-w-0 flex-1 text-left ${cls}`}>
                          {inner}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeOne(n.id)}
                        aria-label="Remove"
                        title="Remove"
                        className="shrink-0 px-2 py-3 text-text-subtle hover:text-red-400"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden>
                          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
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
