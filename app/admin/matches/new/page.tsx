/**
 * app/admin/matches/new/page.tsx
 * --------------------------------------------------------------------
 * Create an open game (booking slot). Players sign up to it; it confirms for
 * admin sign-off at quorum.
 */
import Link from "next/link";
import { CreateMatchForm } from "@/components/admin/CreateMatchForm";

export const metadata = { title: "Create match" };

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
          Create match
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Open matches (with or without Double XP) accept player signups; a private booking is a
          direct booking created already confirmed and kept off the public list.
        </p>
      </header>

      <CreateMatchForm />
    </div>
  );
}
