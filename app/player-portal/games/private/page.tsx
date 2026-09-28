/**
 * app/player-portal/games/private/page.tsx
 * --------------------------------------------------------------------
 * Player-facing private booking request (Game Portal). Auth-gated. Prefills the
 * form with the player's account contact details; the create_private_booking RPC
 * creates an unlisted 'tentative' match for an admin to price and confirm.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { CreatePrivateBookingForm } from "@/components/portal/CreatePrivateBookingForm";

export const metadata: Metadata = { title: "Book a Private Game" };

export default async function PrivateBookingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/games/private");

  const { data: account } = await supabase
    .from("accounts")
    .select("ops_tag, full_name, phone_e164")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href="/player-portal/games" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Game Portal
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Book a Private Game</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          For a birthday, group, or corporate session. Tell us when and how many, and we&apos;ll come
          back to you with the price and confirm it.
        </p>
      </header>
      <CreatePrivateBookingForm
        opsTag={account?.ops_tag ?? null}
        fullName={account?.full_name ?? null}
        phone={account?.phone_e164 ?? null}
      />
    </Container>
  );
}
