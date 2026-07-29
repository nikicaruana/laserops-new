/**
 * app/player-portal/profile/page.tsx
 * --------------------------------------------------------------------
 * Account MANAGEMENT for the signed-in player — edit ops tag, name, DOB,
 * visibility, avatar, and password. Stats live on the player-stats page,
 * not here. Auth-gated.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProfileManager } from "@/components/portal/ProfileManager";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/profile");

  const [{ data: account }, { data: hasPassword }] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "ops_tag, full_name, date_of_birth, profile_pic_url, show_full_name, show_date_of_birth, marketing_opt_in",
      )
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase.rpc("current_user_has_password"),
  ]);

  if (!account) {
    return (
      <Container size="narrow" className="py-16">
        <p className="text-center text-text-muted">
          We couldn&apos;t find an account linked to your login yet. Please contact us and
          we&apos;ll get it sorted.
        </p>
      </Container>
    );
  }

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-8 text-center text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
          Your Profile
        </h1>
        <ProfileManager
          opsTag={account.ops_tag}
          fullName={account.full_name}
          dateOfBirth={account.date_of_birth}
          showFullName={account.show_full_name ?? false}
          showDateOfBirth={account.show_date_of_birth ?? false}
          marketingOptIn={account.marketing_opt_in ?? false}
          profilePicUrl={account.profile_pic_url}
          email={user.email ?? null}
          hasPassword={hasPassword ?? false}
        />
      </div>
    </Container>
  );
}
