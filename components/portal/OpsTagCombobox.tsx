"use client";

/**
 * components/portal/OpsTagCombobox.tsx
 * --------------------------------------------------------------------
 * Shared, site-themed autocomplete for picking a player by ops tag. Replaces the
 * native <datalist>, which rendered an unthemeable white dropdown on desktop and
 * (worse) surfaced the suggestions in the mobile keyboard's suggestion strip
 * instead of a dropdown. This renders our own dark dropdown that looks and
 * behaves the same on desktop and mobile.
 *
 * Controlled input: the parent owns `value`/`onChange` (for URL sync) and
 * commits on `onPick` (a suggestion chosen) or via the form's own submit (Enter
 * with nothing highlighted / the View-Compare button).
 */
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export function OpsTagCombobox({
  value,
  onChange,
  options,
  onPick,
  placeholder,
  invalid,
  inputId,
  ariaLabel,
  describedById,
  maxItems = 10,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  /** Called when a suggestion is chosen (click or Enter on a highlighted row). */
  onPick: (canonical: string) => void;
  placeholder?: string;
  invalid?: boolean;
  inputId?: string;
  ariaLabel?: string;
  describedById?: string;
  maxItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Starts-with matches first, then contains; capped so the list stays tidy.
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const starts: string[] = [];
    const contains: string[] = [];
    for (const o of options) {
      const lo = o.toLowerCase();
      if (q === "" || lo.startsWith(q)) starts.push(o);
      else if (lo.includes(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, maxItems);
  }, [options, value, maxItems]);

  const showList = open && filtered.length > 0;

  function pick(v: string) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(false);
    setHighlight(-1);
    onPick(v);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (showList && highlight >= 0) {
        e.preventDefault();
        pick(filtered[highlight]);
      }
      // else: let the surrounding form submit (free-text commit / button).
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    }
  }

  return (
    <div className="relative flex-1">
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "w-full rounded-sm border bg-bg-overlay px-4 py-2.5 text-sm text-text placeholder:text-text-subtle transition-colors focus:outline-none focus:ring-1",
          invalid
            ? "border-[#a83838] focus:border-[#c44d4d] focus:ring-[#c44d4d]"
            : "border-border-strong focus:border-accent focus:ring-accent",
        )}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-sm border border-border-strong bg-bg-elevated shadow-lg">
          {filtered.map((opt, i) => (
            <li key={opt} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                // onMouseDown fires before the input's blur, so the pick isn't
                // swallowed by the list closing.
                onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "block w-full truncate px-4 py-2.5 text-left text-sm transition-colors",
                  i === highlight ? "bg-accent/15 text-accent" : "text-text hover:bg-bg-overlay",
                )}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
