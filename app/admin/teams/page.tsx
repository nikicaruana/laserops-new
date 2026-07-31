/**
 * app/admin/teams/page.tsx
 * --------------------------------------------------------------------
 * Manage teams (colour, display name, badge, order, active).
 */
import { createClient } from "@/lib/supabase/server";
import { TeamsManager, type TeamItem } from "@/components/admin/TeamsManager";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("id, colour, display_name, badge_url, sort_order, is_active")
    .order("sort_order");

  return (
    <div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          Teams
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Team colours, display names, and badges used in match reports.
        </p>
      </header>

      <TeamsManager initial={(data ?? []) as TeamItem[]} />
    </div>
  );
}
