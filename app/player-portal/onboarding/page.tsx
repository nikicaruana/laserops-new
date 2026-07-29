/**
 * app/player-portal/onboarding/page.tsx
 * --------------------------------------------------------------------
 * First-run profile setup. Reached after a new player confirms their email
 * or signs in with Google (the auth callback routes here when the account
 * has no callsign yet). If the account already has a callsign, they're
 * already set up, so skip to the portal.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { OnboardingForm } from "@/components/portal/OnboardingForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set Up Your Profile",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/onboarding");

  const { data: account } = await supabase
    .from("accounts")
    .select("ops_tag, full_name, profile_pic_url")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Already has a callsign -> already onboarded.
  if (account?.ops_tag) redirect("/player-portal");

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
            Set up your profile
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Welcome to LaserOps. Pick your callsign and a photo to get started.
          </p>
        </div>
        <OnboardingForm
          initialFullName={account?.full_name ?? null}
          initialAvatarUrl={account?.profile_pic_url ?? null}
        />
      </div>
    </Container>
  );
}
