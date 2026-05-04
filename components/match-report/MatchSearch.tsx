"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * MatchSearch
 * --------------------------------------------------------------------
 * Yellow search card at the top of /match-report. Provides:
 *
 *   - Text input for Match ID
 *   - Autocomplete dropdown filtering allMatchIds by the typed prefix
 *   - On submit (Enter or pick from dropdown), navigates to
 *     /match-report?match=<id> with player param stripped
 *   - Shows the currently-loaded matchId as the input value initially,
 *     so users can refine without retyping
 *
 * Visual: solid yellow background to clearly distinguish "interactive
 * input" from the dark match content rendered below.
 */

type Props = {
  allMatchIds: string[];
  initialValue: string;
};

export function MatchSearch({ allMatchIds, initialValue }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialValue);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "") {
      // Show top 8 most recent when input is empty (allMatchIds is
      // already sorted desc by recency)
      return allMatchIds.slice(0, 8);
    }
    return allMatchIds.filter((id) => id.toLowerCase().includes(trimmed)).slice(0, 8);
  }, [value, allMatchIds]);

  function navigateToMatch(matchId: string) {
    const trimmed = matchId.trim();
    if (trimmed === "") return;
    // Reset player param when changing match — the previously-selected
    // player is unlikely to be in the new match.
    router.push(`${pathname}?match=${encodeURIComponent(trimmed)}`);
    setShowSuggestions(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
      navigateToMatch(suggestions[highlightedIndex]);
    } else {
      navigateToMatch(value);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowSuggestions(true);
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div className="rounded-sm bg-accent px-5 py-4 text-bg sm:px-6 sm:py-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div ref={wrapperRef} className="relative flex-1">
          <label
            htmlFor="match-id-input"
            className="block text-[0.65rem] font-extrabold uppercase tracking-[0.18em]"
          >
            Match ID
          </label>
          <input
            id="match-id-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. LO-2026-10"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setShowSuggestions(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            className={cn(
              "mt-1 w-full bg-transparent border-b-2 border-bg/40 px-0 py-2",
              "text-base font-bold text-bg placeholder:text-bg/40 sm:text-lg",
              "focus:outline-none focus:border-bg",
            )}
          />

          {showSuggestions && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-sm border border-bg/30 bg-bg-elevated shadow-lg"
            >
              {suggestions.map((id, idx) => (
                <li
                  key={id}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  className={cn(
                    "cursor-pointer px-4 py-2 font-mono text-sm text-text",
                    "hover:bg-bg-overlay",
                    idx === highlightedIndex && "bg-bg-overlay",
                  )}
                  onMouseDown={(e) => {
                    // mousedown rather than click — so it fires before
                    // the input's blur handler hides the dropdown.
                    e.preventDefault();
                    navigateToMatch(id);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  {id}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          className={cn(
            "shrink-0 self-start sm:self-end",
            "bg-bg px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-accent",
            "transition-colors hover:bg-bg-elevated",
          )}
        >
          View Report
        </button>
      </form>
    </div>
  );
}
