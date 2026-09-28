"use client";

/**
 * components/admin/AdminAlertsPanel.tsx
 * --------------------------------------------------------------------
 * Dashboard "Needs attention" queue: the unseen admin_notifications, most urgent
 * first, each linking to where it is handled. Shares the admin_notification_*
 * RPCs + realtime with AdminNotificationBell. Renders nothing when the queue is
 * clear, so the dashboard stays quiet when there is nothing to do.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notif = { id: string; priority: number; title: string; message: string | null; href: string | null; seen: boolean };

export function AdminAlertsPanel() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase.rpc("admin_notification_feed");
      if (!active) return;
      loaded.current = true;
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
      .channel("admin-alerts-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notifications" }, reload)
      .subscribe();
    const iv = setInterval(load, 90000);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, []);

  function dismiss(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, seen: true } : n)));
    createClient().rpc("dismiss_admin_notification", { p_id: id });
  }

  async function markAll() {
    const supabase = createClient();
    const { data } = await supabase.rpc("mark_all_admin_notifications_seen");
    const ids = (data ?? []) as string[];
    setNotifs((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, seen: true } : n)));
  }

  const unseen = notifs.filter((n) => !n.seen);
  // Keep the section out of the layout entirely when there is nothing pending
  // (and before the first load, so it never flashes empty chrome).
  if (!loaded.current || unseen.length === 0) return null;

  return (
    <section className="mb-8 border border-accent/40 bg-accent/5 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">
          Needs attention · {unseen.length}
        </h2>
        <button
          type="button"
          onClick={markAll}
          className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent"
        >
          Mark all seen
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {unseen.map((n) => {
          const body = (
            <span className="min-w-0">
              <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] ${n.priority <= 2 ? "text-accent" : "text-text"}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent ${n.priority <= 2 ? "animate-pulse" : ""}`} />
                {n.title}
              </span>
              {n.message && <span className="mt-0.5 block truncate text-xs text-text-muted">{n.message}</span>}
            </span>
          );
          return (
            <li key={n.id} className="flex items-center justify-between gap-3 border border-border bg-bg px-4 py-3">
              {n.href ? (
                <Link href={n.href} onClick={() => dismiss(n.id)} className="min-w-0 flex-1 hover:opacity-90">
                  {body}
                </Link>
              ) : (
                <span className="min-w-0 flex-1">{body}</span>
              )}
              <button
                type="button"
                onClick={() => dismiss(n.id)}
                aria-label="Dismiss"
                className="shrink-0 text-text-subtle hover:text-accent"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
