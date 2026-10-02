"use client";

/**
 * components/portal/SquadInviteSearch.tsx
 * --------------------------------------------------------------------
 * Captains/officers invite a player straight from the squad's view / manage
 * screens: type an ops tag (autocompleted from the public lifetime read-model),
 * pick one, and it sends a squad invite via invite_to_squad(squad_id, ops_tag).
 * Squad-specific (not the viewer's primary), so it works even for a captain
 * managing a non-primary squad.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SquadInviteSearch({ squadId, squadName }: { squadId: string; squadName: string }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setSuggestions([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("player_stats_lifetime")
        .select("nickname")
        .ilike("nickname", `${needle}%`)
        .not("nickname", "is", null)
        .limit(6);
      if (active) setSuggestions([...new Set((data ?? []).map((r) => r.nickname as string))]);
    }, 180);
    return () => { active = false; clearTimeout(t); };
  }, [q, supabase]);

  async function invite(tag: string) {
    const ops = tag.trim();
    if (!ops || busy) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("invite_to_squad", { p_squad_id: squadId, p_ops_tag: ops });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: `Invited ${ops} to ${squadName}.` });
    setQ("");
    setSuggestions([]);
  }

  return (
    <div className="relative max-w-md">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); invite(q); } }}
          placeholder="Search a player by ops tag…"
          className="h-10 flex-1 border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => invite(q)}
          disabled={busy || q.trim().length < 2}
          className="h-10 shrink-0 border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-colors hover:bg-accent-soft disabled:opacity-50"
        >
          {busy ? "Inviting…" : "Invite"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full border border-border-strong bg-bg-elevated shadow-xl">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => invite(s)}
                className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-accent hover:text-bg"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
