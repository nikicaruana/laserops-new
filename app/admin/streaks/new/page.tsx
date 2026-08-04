/**
 * app/admin/streaks/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new streak definition. The firing rule is added after creation
 * (needs the streak's id).
 */
import Link from "next/link";
import { StreakEditor, type StreakRecord } from "@/components/admin/StreakEditor";

export const metadata = { title: "New streak" };

export default function NewStreakPage() {
  const blank: StreakRecord = {
    id: "",
    name: "",
    description: "",
    badge_url: "",
    xp: 0,
    points: 0,
    tier: null,
    is_active: true,
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/streaks" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Streaks
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New streak
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Save the streak first, then set the rule that decides when it fires.
        </p>
      </header>

      <StreakEditor streak={blank} mode="create" />
    </div>
  );
}
