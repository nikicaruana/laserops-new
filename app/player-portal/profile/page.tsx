/**
 * app/player-portal/profile/page.tsx
 * --------------------------------------------------------------------
 * Account MANAGEMENT for the signed-in player – edit ops tag, name, DOB,
 * visibility, avatar, and password. Stats live on the player-stats page,
 * not here. Auth-gated.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ProfileManager } from "@/components/portal/ProfileManager";
import { TokenWallet } from "@/components/portal/TokenWallet";
import { createClient } from "@/lib/supabase/server";
import { fetchPlayerTaggedPhotos } from "@/lib/match-photos";

export const metadata: Metadata = {
  title: "Your Profile",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/profile");

  const [{ data: account }, { data: hasPassword }, { data: tokenBalance }, { data: tokenLots }, { data: tokenTx }, { data: boostRows }, { data: rewardImgs }] =
    await Promise.all([
      supabase
        .from("accounts")
        .select(
          "ops_tag, full_name, phone_e164, date_of_birth, profile_pic_url, show_full_name, show_date_of_birth, marketing_opt_in",
        )
        .eq("auth_user_id", user.id)
        .maybeSingle(),
      supabase.rpc("current_user_has_password"),
      supabase.rpc("my_token_balance"),
      supabase.from("token_lots").select("amount_remaining, expires_at, source").gt("amount_remaining", 0),
      supabase
        .from("token_transactions")
        .select("delta, kind, created_at, note, eur_amount")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.rpc("my_xp_boosts"),
      supabase.from("reward_images").select("key, image_url"),
    ]);

  const boosts = { double: 0, oneFive: 0 };
  for (const b of (boostRows ?? []) as { boost_type: string; balance: number }[]) {
    if (b.boost_type === "double") boosts.double = Number(b.balance) || 0;
    if (b.boost_type === "one_five") boosts.oneFive = Number(b.balance) || 0;
  }
  const imgByKey = new Map<string, string>();
  for (const ri of (rewardImgs ?? []) as { key: string; image_url: string | null }[]) imgByKey.set(ri.key, ri.image_url ?? "");
  const boostImages = { double: imgByKey.get("xp_boost_2x") ?? "", oneFive: imgByKey.get("xp_boost_1_5x") ?? "" };

  const taggedPhotos = account?.ops_tag
    ? (await fetchPlayerTaggedPhotos(supabase, account.ops_tag, 24)).map((p) => ({ id: p.id, url: p.url }))
    : [];

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
          phone={account.phone_e164}
          dateOfBirth={account.date_of_birth}
          showFullName={account.show_full_name ?? false}
          showDateOfBirth={account.show_date_of_birth ?? false}
          marketingOptIn={account.marketing_opt_in ?? false}
          profilePicUrl={account.profile_pic_url}
          email={user.email ?? null}
          hasPassword={hasPassword ?? false}
          linkedProviders={(user.identities ?? []).map((i) => i.provider)}
          taggedPhotos={taggedPhotos}
          tokenWallet={
            <TokenWallet balance={Number(tokenBalance ?? 0)} lots={tokenLots ?? []} transactions={tokenTx ?? []} boosts={boosts} boostImages={boostImages} />
          }
        />
      </div>
    </Container>
  );
}
