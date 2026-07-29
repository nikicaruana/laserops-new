"use client";

/**
 * components/layout/HeaderAuth.tsx
 * --------------------------------------------------------------------
 * Desktop header auth control: a "Log In" button when signed out, or an
 * avatar + ops_tag chip (linking to the profile) when signed in. Client
 * component so it doesn't force the static marketing pages to render
 * dynamically. Reserves width while loading to avoid layout shift.
 */
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAccount, avatarThumb } from "@/lib/hooks/useAccount";
import { avatarOrDefault } from "@/lib/avatar";

export function HeaderAuth() {
  const { loading, signedIn, opsTag, email, avatarUrl } = useAccount();

  if (loading) return <div className="h-11 w-[5.5rem]" aria-hidden />;

  if (!signedIn) {
    return (
      <Button href="/player-portal/login" variant="secondary" size="md">
        Log In
      </Button>
    );
  }

  const label = opsTag || email || "Profile";

  return (
    <Link
      href="/player-portal/profile"
      className="group inline-flex h-11 items-center gap-2.5 border border-border-strong px-2.5 pr-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-text transition-colors hover:border-accent"
      aria-label="Your profile"
    >
      <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full border border-border bg-bg-overlay">
        <img
          src={avatarThumb(avatarOrDefault(avatarUrl), 56)}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <span className="max-w-[10rem] truncate group-hover:text-accent">{label}</span>
    </Link>
  );
}
