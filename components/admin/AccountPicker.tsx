"use client";

/**
 * components/admin/AccountPicker.tsx
 * --------------------------------------------------------------------
 * Search accounts by ops tag / name / email and pick one – for linking a headband
 * or a walk-in roster entry to a real profile (identity resolution). Admin-only
 * read (accounts RLS: own row, or admin reads all), so email is never exposed to
 * a non-admin here - they'd only ever match their own row.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export type PickedAccount = { id: string; ops_tag: string | null; full_name: string | null };
// Results also carry email for display (to disambiguate same-named players); it's
// not part of PickedAccount since callers only need id / ops_tag / name.
type AccountResult = PickedAccount & { email: string | null };

export function AccountPicker({
  onPick,
  onCancel,
  autoFocus = true,
  className,
}: {
  onPick: (account: PickedAccount) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Override the default fixed width (e.g. "w-full" to fill a form cell). */
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      const supabase = createClient();
      const like = `%${term.replace(/[%_]/g, "")}%`;
      const { data } = await supabase
        .from("accounts")
        .select("id, ops_tag, full_name, email")
        .or(`ops_tag.ilike.${like},full_name.ilike.${like},email.ilike.${like}`)
        .limit(8);
      setBusy(false);
      setResults((data ?? []) as AccountResult[]);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className={cn("w-72 max-w-full border border-border-strong bg-bg p-2 shadow-lg", className)}>
      <div className="flex items-center gap-2">
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
          placeholder="Search ops tag, name or email…"
          className="h-9 w-full rounded-none border border-border-strong bg-bg-elevated px-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-1 text-text-subtle hover:text-text" aria-label="Cancel">
            ×
          </button>
        )}
      </div>
      <div className="mt-1 max-h-56 overflow-y-auto">
        {busy && <p className="px-2 py-2 text-xs text-text-subtle">Searching…</p>}
        {!busy && q.trim() && results.length === 0 && (
          <p className="px-2 py-2 text-xs text-text-subtle">No matches.</p>
        )}
        {results.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick({ id: a.id, ops_tag: a.ops_tag, full_name: a.full_name })}
            className="flex w-full flex-col gap-0.5 px-2 py-1.5 text-left hover:bg-bg-elevated"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-text">{a.full_name || a.ops_tag || "Player"}</span>
              {a.ops_tag && <span className="shrink-0 font-mono text-xs text-text-subtle">{a.ops_tag}</span>}
            </span>
            {a.email && <span className="truncate text-[0.7rem] text-text-subtle">{a.email}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
