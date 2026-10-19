/**
 * app/player-portal/games/join/[code]/page.tsx
 * --------------------------------------------------------------------
 * Game invite auto-join landing (mirrors squads/join/[code]). The /invite/<code>
 * CTAs point a logged-out visitor's login/signup `next` here, so once they finish
 * authenticating + onboarding they land on THIS route, which signs them up to the
 * game and forwards them to the game page (where they see who's in). `code` is the
 * match's invite_code. Auth-gated; falls back to the invite page if the sign-up
 * can't complete automatically (e.g. a mobile number is required).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Join Game" };

export default async function JoinGamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const here = `/player-portal/games/join/${code}`;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=${encodeURIComponent(here)}`);

  const { data: account } = await supabase.from("accounts").select("id, ops_tag").eq("auth_user_id", user!.id).maybeSingle();
  // Not finished onboarding yet -> set up first, then return here to auto-join.
  if (!account?.ops_tag) redirect(`/player-portal/onboarding?next=${encodeURIComponent(here)}`);

  const { data: match } = await supabase.from("matches").select("id, status").eq("invite_code", code).maybeSingle();
  if (!match) {
    return (
      <Container size="narrow" className="py-16 text-center">
        <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text">Game not found</h1>
        <p className="mt-3 text-sm text-text-muted">That game invite link isn&apos;t valid or has expired.</p>
        <Link href="/player-portal/games" className="mt-6 inline-block text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
          ← Browse games
        </Link>
      </Container>
    );
  }

  const open = ["tentative", "awaiting_confirm", "confirmed"].includes(match.status ?? "");
  const { data: existing } = await supabase
    .from("match_signups").select("status").eq("match_id", match.id).eq("account_id", account.id).maybeSingle();

  // Already in (or the game no longer takes signups) -> straight to the game page.
  if (existing?.status === "registered" || existing?.status === "waitlisted" || !open) {
    redirect(`/player-portal/games/${match.id}`);
  }

  // Auto sign up (the DB trigger demotes to waitlist if the game is full).
  const { error } = await supabase
    .from("match_signups")
    .upsert({ match_id: match.id, account_id: account.id, status: "registered" }, { onConflict: "match_id,account_id" });
  if (!error) redirect(`/player-portal/games/${match.id}`);

  // Couldn't auto-join (e.g. a mobile number is required first) -> finish on the
  // invite page, which has the add-phone flow.
  redirect(`/invite/${code}`);
}
