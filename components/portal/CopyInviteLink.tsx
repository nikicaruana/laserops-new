"use client";

/**
 * components/portal/CopyInviteLink.tsx
 * --------------------------------------------------------------------
 * Copy a match's invite link (origin + /invite/<code>) to the clipboard.
 *   full    -> a read-only field showing the URL + a Copy button (manage page)
 *   compact -> a small "Copy link" button (table rows)
 * The URL is built on the client so it uses whatever origin the app is served
 * from.
 */
import { useEffect, useState } from "react";

export function CopyInviteLink({ code, compact = false }: { code: string | null; compact?: boolean }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (code) setUrl(`${window.location.origin}/invite/${code}`);
  }, [code]);

  if (!code) return null;

  async function copy() {
    const value = url || `/invite/${code}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context) – no-op; the field is selectable.
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={copy}
        className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:text-accent"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    );
  }

  return (
    <div className="flex max-w-xl items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        className="h-10 w-full min-w-0 rounded-none border border-border-strong bg-bg px-3 font-mono text-xs text-text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="h-10 shrink-0 border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
