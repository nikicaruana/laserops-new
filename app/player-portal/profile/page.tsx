/**
 * app/player-portal/profile/page.tsx
 * --------------------------------------------------------------------
 * The signed-in player's profile: identity, avatar upload, and a compact
 * stats strip pulled from the Supabase read-models. Auth-gated — anonymous
 * visitors are bounced to the login page.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AvatarUploader } from "@/components/portal/AvatarUploader";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your Profile",
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-elevated px-4 py-3 text-center">
      <div className="text-xl font-bold text-text">{value}</div>
      <div className="mt-1 text-[0.65rem] uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/profile");

  // Own account row (RLS scopes this to the caller).
  const { data: account } = await supabase
    .from("accounts")
    .select("id, ops_tag, email, full_name, profile_pic_url, is_admin, claim_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account) {
    return (
      <Container size="narrow" className="py-16">
        <p className="text-center text-text-muted">
          We couldn&apos;t find an account linked to your login yet. Please
          contact us and we&apos;ll get it sorted.
        </p>
      </Container>
    );
  }

  // Stats read-models are public-read; fetch this player's rows.
  const [{ data: stats }, { data: rating }] = await Promise.all([
    supabase
      .from("player_stats_lifetime")
      .select("games, win_rate, kills_per_round, avg_kd, current_level, total_xp")
      .eq("account_id", account.id)
      .maybeSingle(),
    supabase
      .from("player_ratings")
      .select("rating_overall")
      .eq("account_id", account.id)
      .maybeSingle(),
  ]);

  return (
    <Container size="narrow" className="py-12 sm:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-8 text-center text-2xl font-bold uppercase tracking-[0.12em] text-text sm:text-3xl">
          Your Profile
        </h1>

        <div className="flex flex-col items-center gap-6">
          <AvatarUploader
            initialUrl={account.profile_pic_url}
            opsTag={account.ops_tag}
          />

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl font-bold text-text">
                {account.ops_tag ?? account.full_name ?? "Operative"}
              </span>
              {account.is_admin && (
                <span className="border border-accent px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-accent">
                  Admin
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-muted">{account.email}</p>
          </div>
        </div>

        {/* Stats strip */}
        {stats ? (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCell label="Level" value={String(stats.current_level ?? "—")} />
            <StatCell
              label="Rating"
              value={rating?.rating_overall ? `${rating.rating_overall}★` : "—"}
            />
            <StatCell label="Games" value={String(stats.games ?? 0)} />
            <StatCell
              label="Kills / Round"
              value={stats.kills_per_round != null ? String(stats.kills_per_round) : "—"}
            />
            <StatCell label="Avg K/D" value={stats.avg_kd != null ? String(stats.avg_kd) : "—"} />
            <StatCell
              label="Win Rate"
              value={
                stats.win_rate != null
                  ? `${Math.round(Number(stats.win_rate) * 100)}%`
                  : "—"
              }
            />
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-text-subtle">
            No match stats yet — play a game to start building your record.
          </p>
        )}
      </div>
    </Container>
  );
}
