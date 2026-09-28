"use client";

/**
 * components/layout/HeaderAuth.tsx
 * --------------------------------------------------------------------
 * Desktop header auth control: a "Log In" button when signed out, or an
 * avatar + ops_tag chip that opens a menu (Account Settings / Sign Out) when
 * signed in. Client component so it doesn't force the static marketing pages to
 * render dynamically. Reserves width while loading to avoid layout shift.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAccount, avatarThumb } from "@/lib/hooks/useAccount";
import { avatarOrDefault } from "@/lib/avatar";

export function HeaderAuth() {
  const { loading, signedIn, opsTag, email, avatarUrl, isAdmin } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) return <div className="h-11 w-[5.5rem]" aria-hidden />;

  if (!signedIn) {
    return (
      <Button href="/player-portal/login" variant="secondary" size="md">
        Log In
      </Button>
    );
  }

  const label = opsTag || email || "Profile";
  const menuItem =
    "block w-full px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:bg-bg-overlay hover:text-accent";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group inline-flex h-11 items-center gap-2.5 border border-border-strong px-2.5 pr-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent"
      >
        <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-sm border border-border bg-bg-overlay">
          <img src={avatarThumb(avatarOrDefault(avatarUrl), 56)} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="max-w-[10rem] truncate group-hover:text-accent">{label}</span>
        <span className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-48 border border-border-strong bg-bg-elevated shadow-lg"
        >
          <Link href="/player-portal/profile" role="menuitem" className={menuItem} onClick={() => setOpen(false)}>
            Account Settings
          </Link>
          {isAdmin && (
            <Link href="/admin" role="menuitem" className={`${menuItem} border-t border-border`} onClick={() => setOpen(false)}>
              Admin panel
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className={`${menuItem} border-t border-border hover:text-red-400`}>
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
