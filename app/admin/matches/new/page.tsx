/**
 * app/admin/matches/new/page.tsx
 * --------------------------------------------------------------------
 * Create an open game (booking slot). Players sign up to it; it confirms for
 * admin sign-off at quorum.
 */
import Link from "next/link";
import { CreateMatchForm } from "@/components/admin/CreateMatchForm";

export const metadata = { title: "New open game" };

export default function NewMatchPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-xs">
        <Link href="/admin/matches" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Match Manager
        </Link>
      </div>
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
          New open game
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Opens for player signups immediately. Reaches &quot;Awaiting OK&quot; once the minimum
          players sign up; you confirm it from there.
        </p>
      </header>

      <CreateMatchForm />
    </div>
  );
}
