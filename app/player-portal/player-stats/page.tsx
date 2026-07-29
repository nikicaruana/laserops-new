/**
 * app/player-portal/player-stats/page.tsx
 * --------------------------------------------------------------------
 * Entry point for "Player Stats". A signed-in player is taken straight to
 * their OWN summary (?ops=<their tag>); from there the search box lets them
 * look up anyone else. Anonymous visitors get the search-first summary.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PlayerStatsIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: account } = await supabase
      .from("accounts")
      .select("ops_tag")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (account?.ops_tag) {
      redirect(
        `/player-portal/player-stats/summary?ops=${encodeURIComponent(account.ops_tag)}`,
      );
    }
  }

  redirect("/player-portal/player-stats/summary");
}
