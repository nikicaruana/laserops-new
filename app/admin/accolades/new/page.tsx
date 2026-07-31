/**
 * app/admin/accolades/new/page.tsx
 * --------------------------------------------------------------------
 * Create a new accolade definition.
 */
import Link from "next/link";
import { AccoladeEditor, type AccoladeRecord } from "@/components/admin/AccoladeEditor";

export const metadata = { title: "New accolade" };

export default function NewAccoladePage() {
  const blank: AccoladeRecord = {
    id: "",
    name: "",
    description: "",
    badge_url: "",
    xp: null,
    points: 0,
    scope: "match",
    is_active: true,
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/accolades" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Accolades
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New accolade
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          XP sets the tier: 100 = Tier 1, 75 = Tier 2, 50 = Tier 3.
        </p>
      </header>

      <AccoladeEditor accolade={blank} mode="create" />
    </div>
  );
}
