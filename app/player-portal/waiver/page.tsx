/**
 * app/player-portal/waiver/page.tsx
 * --------------------------------------------------------------------
 * Waiver gate for existing players who haven't signed. Auth-gated; if the
 * player has already signed (or hasn't set an ops tag yet, in which case
 * onboarding handles the waiver), they're redirected away.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { WaiverGateForm } from "@/components/portal/WaiverGateForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign the Waiver",
};

export default async function WaiverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/waiver");

  const { data: account } = await supabase
    .from("accounts")
    .select("ops_tag, waiver_accepted_at, marketing_opt_in")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // No ops tag yet -> onboarding owns the waiver. Already signed -> done.
  if (!account || !account.ops_tag) redirect("/player-portal/onboarding");
  if (account.waiver_accepted_at) redirect("/player-portal");

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
            One quick thing
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            Before you play, please read and sign our waiver.
          </p>
        </div>
        <WaiverGateForm initialMarketing={account.marketing_opt_in ?? false} />
      </div>
    </Container>
  );
}
