/**
 * app/admin/ladders/page.tsx – admin: all ladders + create.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateLadderForm } from "@/components/admin/CreateLadderForm";
import { ladderDisplayName } from "@/lib/ladders";

export const metadata = { title: "Ladders" };

type Row = { id: string; key: string; name: string; sponsor_name: string | null; is_active: boolean };

export default async function AdminLaddersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("ladders").select("id, key, name, sponsor_name, is_active").order("created_at");
  const ladders = (data ?? []) as Row[];

  return (
    <div>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">Ladders</h1>
        <p className="mt-2 text-sm text-text-muted">Create and manage the competitive ladders.</p>
      </header>

      <ul className="mb-8 space-y-2">
        {ladders.map((l) => (
          <li key={l.id}>
            <Link href={`/admin/ladders/${l.id}`} className="flex flex-wrap items-center justify-between gap-3 border border-border bg-bg-elevated px-5 py-4 transition-colors hover:border-accent">
              <span className="font-bold text-text">{ladderDisplayName(l.key, l.sponsor_name)}</span>
              <span className={`text-[0.6rem] font-bold uppercase tracking-[0.12em] ${l.is_active ? "text-accent" : "text-text-subtle"}`}>
                {l.is_active ? "Active" : "Hidden"}
              </span>
            </Link>
          </li>
        ))}
        {ladders.length === 0 && <li className="text-sm text-text-muted">No ladders yet.</li>}
      </ul>

      <CreateLadderForm />
    </div>
  );
}
