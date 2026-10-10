/**
 * app/player-portal/games/new/page.tsx
 * --------------------------------------------------------------------
 * Player-facing "open a game" page (Phase 2b). Auth-gated. The create_player_match
 * RPC enforces the 3-active-games cap; this page just shows the form and a note.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { CreatePlayerMatchForm } from "@/components/portal/CreatePlayerMatchForm";

export const metadata: Metadata = { title: "Open a Game" };

export default async function NewGamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/games/new");

  const [{ data: account }, { data: isAdmin }, { data: hasPlayed }] = await Promise.all([
    supabase.from("accounts").select("ops_tag").eq("auth_user_id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
    supabase.rpc("has_played_game"),
  ]);
  // Open games are LaserOps-organised only - non-admins cannot create them.
  if (!isAdmin) redirect("/player-portal/games");
  const canOpen = Boolean(isAdmin) || Boolean(hasPlayed);

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href="/player-portal/games" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Games
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Open a Game</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Pick a date and time and we&apos;ll list it for others to join. Once enough players sign up,
          it goes to us to confirm.
        </p>
      </header>
      {canOpen ? (
        <CreatePlayerMatchForm opsTag={account?.ops_tag ?? null} />
      ) : (
        <div className="max-w-2xl portal-card px-6 py-10 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-accent">Play a game first</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">
            You&apos;ll be able to open your own games once you&apos;ve played at least one. Jump into an
            open game to get started - after that, this unlocks.
          </p>
          <Link
            href="/player-portal/games"
            className="mt-5 inline-flex h-11 items-center border border-accent bg-accent px-6 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            Find an open game
          </Link>
        </div>
      )}
    </Container>
  );
}
