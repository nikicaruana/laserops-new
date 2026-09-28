"use client";

/**
 * components/admin/AdminNotificationSummary.tsx
 * --------------------------------------------------------------------
 * Dashboard notification pane: a scrollable summary of recent admin
 * notifications (seen + unseen), newest / most urgent first, each linking to
 * where it's handled. Reuses the admin_notification_feed RPC + realtime, same as
 * the bell and the needs-attention queue. Unseen rows are highlighted; the list
 * scrolls inside a fixed-height box so the dashboard stays compact.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Notif = { id: string; priority: number; title: string; body: string | null; href: string | null; seen: boolean; created_at: string };

function whenText(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function AdminNotificationSummary() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const { data } = await supabase.rpc("admin_notification_feed");
      if (!active) return;
      loaded.current = true;
      setNotifs((data ?? []) as Notif[]);
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 300);
    };

    load();
    const channel = supabase
      .channel("admin-notif-summary")
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

  async function markAll() {
    const supabase = createClient();
    const { data } = await supabase.rpc("mark_all_admin_notifications_seen");
    const ids = (data ?? []) as string[];
    setNotifs((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, seen: true } : n)));
  }

  function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, seen: true } : n)));
    createClient().rpc("dismiss_admin_notification", { p_id: id });
  }

  function remove(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    createClient().rpc("remove_admin_notification", { p_id: id });
  }

  const unseen = notifs.filter((n) => !n.seen).length;

  return (
    <section className="mb-8 border border-border bg-bg-elevated px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-accent">
          Notifications{unseen > 0 ? ` · ${unseen} new` : ""}
        </h2>
        <div className="flex items-center gap-3">
          {unseen > 0 && (
            <button type="button" onClick={markAll} className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
              Mark all seen
            </button>
          )}
          <Link href="/admin/notifications" className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
            Manage →
          </Link>
        </div>
      </div>

      {!loaded.current ? (
        <p className="text-xs text-text-subtle">Loading…</p>
      ) : notifs.length === 0 ? (
        <p className="text-xs text-text-subtle">Nothing yet.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {notifs.map((n) => {
            const body = (
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {!n.seen && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent ${n.priority <= 2 ? "animate-pulse" : ""}`} />}
                  <span className={`truncate text-xs font-bold uppercase tracking-[0.1em] ${n.seen ? "text-text-muted" : "text-text"}`}>{n.title}</span>
                </span>
                {n.body && <span className="mt-0.5 block truncate text-xs text-text-subtle">{n.body}</span>}
              </span>
            );
            return (
              <li
                key={n.id}
                className={`flex items-center justify-between gap-3 border px-4 py-2.5 ${n.seen ? "border-border bg-bg/40" : "border-accent/40 bg-accent/5"}`}
              >
                {n.href ? (
                  <Link href={n.href} className="flex min-w-0 flex-1 hover:opacity-90">
                    {body}
                  </Link>
                ) : (
                  body
                )}
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-[0.6rem] uppercase tracking-[0.1em] text-text-subtle">{whenText(n.created_at)}</span>
                  {!n.seen && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      title="Mark as read"
                      className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
                    >
                      Read
                    </button>
                  )}
                  <button type="button" onClick={() => remove(n.id)} aria-label="Remove" title="Remove" className="text-text-subtle hover:text-red-400">
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
    </section>
  );
}
