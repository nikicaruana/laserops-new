"use client";

/**
 * components/admin/EditableMatchTitle.tsx
 * --------------------------------------------------------------------
 * The match title as an inline-editable heading in the admin detail view.
 * Click Edit -> input + Save/Cancel; writes matches.title via the admin
 * session (admin_all RLS). Falls back to the match code when there's no title.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditableMatchTitle({
  matchId,
  initialTitle,
  fallback,
}: {
  matchId: string;
  initialTitle: string | null;
  fallback: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTitle ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("matches")
      .update({ title: value.trim() || null })
      .eq("id", matchId);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex flex-1 flex-col gap-2">
        <input
          autoFocus
          className="h-11 w-full min-w-0 rounded-none border border-border-strong bg-bg px-3 text-lg font-bold text-text focus:border-accent focus:outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Match title"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="border border-accent bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-bg disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setValue(initialTitle ?? "");
              setEditing(false);
            }}
            className="text-xs font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3">
      <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
        {initialTitle || fallback}
      </h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
      >
        Edit
      </button>
    </div>
  );
}
