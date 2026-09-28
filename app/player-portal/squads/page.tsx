/**
 * app/player-portal/squads/page.tsx
 * --------------------------------------------------------------------
 * Squads hub: the squads you're in, plus Find a Squad (searchable squads) and a
 * create button. Auth-gated.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { SquadInvitesInbox, type SquadInvite } from "@/components/portal/SquadInvitesInbox";

export const metadata: Metadata = { title: "Squads" };

type SquadCard = { id: string; name: string; badge_url: string | null; member_count: number | null; description?: string | null };
type Membership = { role: string; is_primary: boolean; squad: SquadCard | null };

function Badge({ url, name }: { url: string | null; name: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-sm font-bold text-text-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default async function SquadsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/player-portal/login?next=/player-portal/squads");
  const { data: account } = await supabase.from("accounts").select("id").eq("auth_user_id", user.id).maybeSingle();

  let searchQuery = supabase
    .from("squads")
    .select("id, name, badge_url, member_count, description")
    .eq("is_searchable", true)
    .order("member_count", { ascending: false })
    .limit(30);
  if (q) searchQuery = searchQuery.ilike("name", `%${q.replace(/[%_]/g, "")}%`);

  const [{ data: memberRows }, { data: searchRows }] = await Promise.all([
    account
      ? supabase
          .from("squad_members")
          .select("role, is_primary, squad:squads(id, name, badge_url, member_count)")
          .eq("account_id", account.id)
      : Promise.resolve({ data: [] as Membership[] }),
    searchQuery,
  ]);

  const { data: inviteRows } = account ? await supabase.rpc("my_pending_squad_invites") : { data: [] };
  const invites = (inviteRows ?? []) as SquadInvite[];

  const myMemberships = ((memberRows ?? []) as unknown as Membership[]).filter((m) => m.squad);
  const mySquadIds = new Set(myMemberships.map((m) => m.squad!.id));
  const found = ((searchRows ?? []) as SquadCard[]).filter((s) => !mySquadIds.has(s.id));

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">Squads</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Team up, climb the ladder. Create a squad or join one via an invite link.
          </p>
        </div>
        {myMemberships.length < 2 && (
          <Link
            href="/player-portal/squads/new"
            className="flex h-11 items-center gap-2 border border-accent bg-accent px-5 text-xs font-bold uppercase tracking-[0.12em] text-bg transition-transform active:scale-[0.98]"
          >
            + Create a squad
          </Link>
        )}
      </header>

      <SquadInvitesInbox invites={invites} />

      {myMemberships.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-accent">Your squads</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {myMemberships.map((m) => (
              <li key={m.squad!.id} className="portal-card transition-colors hover:border-accent">
                <Link href={`/player-portal/squads/${m.squad!.id}`} className="flex items-center gap-4 px-5 py-4">
                  <Badge url={m.squad!.badge_url} name={m.squad!.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-bold text-text">{m.squad!.name}</span>
                    <span className="text-xs text-text-muted">
                      {m.squad!.member_count ?? 0}/20 · {m.role}
                      {m.is_primary ? " · primary" : ""}
                    </span>
                  </span>
                </Link>
                {(m.role === "captain" || m.role === "officer") && (
                  <div className="border-t border-border px-5 py-2">
                    <Link href={`/player-portal/squads/${m.squad!.id}/manage`} className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                      Manage squad →
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-accent">Find a squad</h2>
          <form action="/player-portal/squads" method="get">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search squads…"
              className="h-9 w-56 max-w-full rounded-none border border-border bg-bg-overlay px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
            />
          </form>
        </div>
        {found.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            {q ? "No squads match that search." : "No public squads yet. Be the first to create one."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {found.map((s) => (
              <li key={s.id}>
                <Link href={`/player-portal/squads/${s.id}`} className="flex items-center gap-4 portal-card px-5 py-4 transition-colors hover:border-accent">
                  <Badge url={s.badge_url} name={s.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-bold text-text">{s.name}</span>
                    <span className="block truncate text-xs text-text-muted">{s.member_count ?? 0}/20 members{s.description ? ` · ${s.description}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
