"use client";

/**
 * components/portal/GamesViewToggle.tsx
 * --------------------------------------------------------------------
 * List / Calendar switch for the Open Games section. The list view is the
 * existing server-rendered game cards (passed as children); the calendar view is
 * GamesCalendar. Remembers the choice per browser.
 */
import { useEffect, useState } from "react";
import { GamesCalendar, type CalendarGame } from "@/components/portal/GamesCalendar";

const STORE_KEY = "laserops-games-view";

export function GamesViewToggle({ games, children }: { games: CalendarGame[]; children: React.ReactNode }) {
  const [view, setView] = useState<"list" | "calendar">("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === "calendar" || saved === "list") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function choose(v: "list" | "calendar") {
    setView(v);
    try {
      localStorage.setItem(STORE_KEY, v);
    } catch {
      /* ignore */
    }
  }

  const tab = (v: "list" | "calendar", label: string) => (
    <button
      type="button"
      onClick={() => choose(v)}
      className={`border px-4 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] transition-colors ${
        view === v ? "border-accent bg-accent/10 text-accent" : "border-border-strong bg-bg-overlay/70 text-text-muted backdrop-blur-sm hover:border-accent hover:text-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tab("list", "List")}
        {tab("calendar", "Calendar")}
      </div>
      {view === "list" ? children : <GamesCalendar games={games} />}
    </div>
  );
}
