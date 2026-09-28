"use client";

/**
 * components/layout/GameCta.tsx
 * --------------------------------------------------------------------
 * The primary header CTA. For signed-out visitors it's "Book a Game" (→ the
 * marketing booking page); for signed-in players it becomes "Game Portal"
 * (→ the games hub: open games, their games, create/book). Client component so
 * the marketing pages stay statically cacheable.
 */
import { Button } from "@/components/ui/Button";
import { useAccount } from "@/lib/hooks/useAccount";
import { ctaLinks } from "@/lib/nav";

export function GameCta({
  size = "md",
  className,
  onClick,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}) {
  const { loading, signedIn } = useAccount();
  const portal = signedIn && !loading;
  return (
    <Button
      href={portal ? "/player-portal/games" : ctaLinks.primary.href}
      variant="primary"
      size={size}
      className={className}
      onClick={onClick}
    >
      {portal ? "Game Portal" : ctaLinks.primary.label}
    </Button>
  );
}
