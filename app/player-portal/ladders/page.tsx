/**
 * app/player-portal/ladders/page.tsx
 * --------------------------------------------------------------------
 * The competitive ladders hub: the Company ladder and the Pro ladder. Public
 * (reads via the public ladders policy).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { ladderDisplayName, ladderBlurb } from "@/lib/ladders";

export const metadata: Metadata = { title: "Ladders" };

type Ladder = { key: string; name: string; sponsor_name: string | null };

export default async function LaddersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("ladders").select("key, name, sponsor_name").eq("is_active", true);
  const ladders = (data ?? []) as Ladder[];
  // Company first.
  ladders.sort((a, b) => (a.key === "company" ? -1 : b.key === "company" ? 1 : 0));

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Ladders</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-muted">
          Squads climb the ladder by challenging teams above them. Beat a team above you and take their place.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {ladders.map((l) => (
          <li key={l.key}>
            <Link
              href={`/player-portal/ladders/${l.key}`}
              className="block h-full portal-card px-6 py-6 transition-colors hover:border-accent"
            >
              <h2 className="text-xl font-extrabold uppercase tracking-tight text-text">{ladderDisplayName(l.key, l.sponsor_name)}</h2>
              <p className="mt-2 text-sm text-text-muted">{ladderBlurb(l.key)}</p>
              <span className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.12em] text-accent">View standings →</span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
