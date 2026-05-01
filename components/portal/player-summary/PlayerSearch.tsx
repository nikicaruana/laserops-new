"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * PlayerSearch
 * --------------------------------------------------------------------
 * Search input for selecting a player by ops tag.
 *
 * UX:
 *   - Type to see autocomplete suggestions (native <datalist> — fast,
 *     accessible, no JS gymnastics, plays well with mobile keyboards).
 *   - Press Enter or click "View" to commit.
 *   - On commit:
 *       1. Validate against the known nicknames (case-insensitive)
 *       2. Update URL ?ops= to the canonical (correctly-cased) nickname
 *       3. Save to localStorage so the next visit auto-loads the same player
 *   - Invalid tag → show "Player not found" message inline; URL unchanged.
 *
 * State:
 *   - Input text is local component state (typing shouldn't update URL on
 *     every keystroke).
 *   - Active player comes from the URL ?ops= param (single source of truth).
 *
 * localStorage:
 *   - Key: 'laserops:last-ops-tag'
 *   - Written on successful commit
 *   - Read by PlayerSearchAutoload on first visit if URL has no ?ops=
 *   - Cleared on the page if the URL points at a name no longer in the data
 *     (keeps stale-pointing localStorage from haunting the user)
 */

const LOCALSTORAGE_KEY = "laserops:last-ops-tag";

type PlayerSearchProps = {
  /** All known player nicknames, used for autocomplete + validation. */
  knownNicknames: string[];
  /** Current ?ops= value from URL. Pre-fills the input and shows "currently viewing" hint. */
  currentOpsTag: string;
};

export function PlayerSearch({ knownNicknames, currentOpsTag }: PlayerSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [input, setInput] = useState(currentOpsTag);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Stable IDs for accessibility — input/label/datalist association.
  const datalistId = useId();
  const inputId = useId();
  const errorId = useId();

  // When URL ?ops= changes externally (back button, link click), reflect it
  // in the input so the input always matches what's being viewed.
  useEffect(() => {
    setInput(currentOpsTag);
    setError(null);
  }, [currentOpsTag]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed === "") {
      setError(null);
      // Empty submit clears the URL param (returns to "no player selected" state)
      const next = new URLSearchParams(searchParams.toString());
      next.delete("ops");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return;
    }

    // Case-insensitive match against the canonical list.
    const canonical = knownNicknames.find(
      (n) => n.toLowerCase() === trimmed.toLowerCase(),
    );

    if (!canonical) {
      setError("Player not found");
      return;
    }

    setError(null);
    // Save successful lookups so returning visitors auto-load.
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, canonical);
    } catch {
      // localStorage can throw in private mode on some browsers — ignore.
    }

    // Update URL with the canonical (correctly-cased) nickname.
    const next = new URLSearchParams(searchParams.toString());
    next.set("ops", canonical);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
      role="search"
    >
      <label htmlFor={inputId} className="sr-only">
        Player ops tag
      </label>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          // The native datalist attribute wires this to the <datalist> below
          // for browser-native autocomplete. Mobile browsers show their own
          // suggestion UI on top of this — fine.
          list={datalistId}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Clear error on edit so the user isn't shown a stale error
            // while they're correcting the input.
            if (error) setError(null);
          }}
          placeholder="Enter ops tag…"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full border bg-bg-overlay px-4 py-2.5 text-sm text-text",
            "rounded-sm placeholder:text-text-subtle",
            "transition-colors focus:outline-none focus:ring-1",
            error
              ? "border-[#a83838] focus:border-[#c44d4d] focus:ring-[#c44d4d]"
              : "border-border-strong focus:border-accent focus:ring-accent",
          )}
        />
        <datalist id={datalistId}>
          {knownNicknames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <button
        type="submit"
        className={cn(
          "shrink-0 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em]",
          "bg-accent text-bg transition-colors hover:bg-accent-soft",
          "rounded-sm",
        )}
      >
        View
      </button>
      {error && (
        <span
          id={errorId}
          role="alert"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c44d4d] sm:self-center"
        >
          {error}
        </span>
      )}
    </form>
  );
}

/**
 * Tiny client component whose only job is to read localStorage on mount
 * and, if there's a saved ops tag AND the URL has no ?ops= param, navigate
 * to the saved player. Mounted near the top of the page so the redirect
 * happens before the user notices the empty state.
 *
 * Why a separate component: localStorage access requires "use client" + a
 * useEffect (server has no localStorage). Isolating this avoids forcing
 * the entire summary view to be a client component just for this nicety.
 */
export function PlayerSearchAutoload({
  hasOpsParam,
}: {
  hasOpsParam: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const triedRef = useRef(false);

  useEffect(() => {
    // Only attempt autoload once per mount, only if URL has no ?ops=.
    if (triedRef.current) return;
    triedRef.current = true;
    if (hasOpsParam) return;

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LOCALSTORAGE_KEY);
    } catch {
      // ignore
    }
    if (!saved) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("ops", saved);
    // Use replace so the empty state isn't in browser history
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [hasOpsParam, pathname, router, searchParams]);

  return null;
}
