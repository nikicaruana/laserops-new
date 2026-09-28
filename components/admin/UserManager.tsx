"use client";

/**
 * components/admin/UserManager.tsx
 * --------------------------------------------------------------------
 * Manage admin users. Lists current admins (with email – this page is admin-
 * only) and lets you revoke, plus a search to grant admin to any account. The
 * accounts admin RLS policy + protect_account_fields let an admin flip is_admin;
 * guards prevent revoking yourself or the last admin (lock-out safety).
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminUser = { id: string; ops_tag: string | null; email: string | null };

const input =
  "h-10 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

export function UserManager({
  admins: initialAdmins,
  selfAccountId,
}: {
  admins: AdminUser[];
  selfAccountId: string | null;
}) {
  const [admins, setAdmins] = useState<AdminUser[]>(initialAdmins);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function search(q: string) {
    setQuery(q);
    setError(null);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const like = `*${q.trim()}*`;
    const { data, error: err } = await supabase
      .from("accounts")
      .select("id, ops_tag, email, is_admin")
      .or(`ops_tag.ilike.${like},email.ilike.${like}`)
      .eq("is_admin", false)
      .limit(10);
    setSearching(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResults((data ?? []) as AdminUser[]);
  }

  async function grant(u: AdminUser) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("accounts").update({ is_admin: true }).eq("id", u.id);
    setBusy(false);
    if (err) return setError(err.message);
    setAdmins((prev) => [...prev, u].sort((a, b) => (a.ops_tag ?? "").localeCompare(b.ops_tag ?? "")));
    setResults((prev) => prev.filter((r) => r.id !== u.id));
  }

  async function revoke(u: AdminUser) {
    if (u.id === selfAccountId) return setError("You can't remove your own admin access.");
    if (admins.length <= 1) return setError("There must be at least one admin.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("accounts").update({ is_admin: false }).eq("id", u.id);
    setBusy(false);
    if (err) return setError(err.message);
    setAdmins((prev) => prev.filter((a) => a.id !== u.id));
  }

  return (
    <div className="max-w-2xl space-y-8">
      {error && (
        <p className="border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">{error}</p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">
          Admins ({admins.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {admins.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-4 border border-border bg-bg-elevated px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {u.ops_tag ?? "–"}
                  {u.id === selfAccountId && <span className="ml-2 text-[0.55rem] uppercase tracking-[0.14em] text-text-subtle">you</span>}
                </p>
                <p className="truncate text-xs text-text-muted">{u.email}</p>
              </div>
              <button
                type="button"
                onClick={() => revoke(u)}
                disabled={busy || u.id === selfAccountId || admins.length <= 1}
                className="shrink-0 border border-red-900/60 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-red-400 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Revoke
              </button>
            </li>
          ))}
          {admins.length === 0 && <li className="text-xs text-text-subtle">No admins.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-accent">Grant admin</h2>
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by ops tag or email…"
          className={input}
        />
        {searching && <p className="mt-2 text-xs text-text-subtle">Searching…</p>}
        {results.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {results.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-4 border border-border bg-bg-elevated px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{u.ops_tag ?? "–"}</p>
                  <p className="truncate text-xs text-text-muted">{u.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => grant(u)}
                  disabled={busy}
                  className="shrink-0 border border-accent bg-accent px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-bg disabled:opacity-50"
                >
                  Make admin
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="mt-2 text-xs text-text-subtle">No non-admin accounts match.</p>
        )}
      </section>
    </div>
  );
}
