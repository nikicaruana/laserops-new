/**
 * app/player-portal/ladders/[key]/page.tsx
 * --------------------------------------------------------------------
 * A ladder's standings: squads ranked by position. Public. A captain/officer can
 * enrol their squad (Pro); admins can reseed by roster XP. Match-driven movement
 * (swap on win, monthly drop) arrives in Stage B.
 */
import type { Metadata } from "next";
import { cldImage } from "@/lib/cld";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { ladderDisplayName, ladderBlurb, ladderBannerUrl } from "@/lib/ladders";
import { EnrollLadderButton, ReseedLadderButton } from "@/components/portal/LadderControls";

export const metadata: Metadata = { title: "Ladder" };

type Standing = {
  pos: number;
  squad_id: string;
  name: string;
  badge_url: string | null;
  member_count: number | null;
  roster_xp: number | null;
  last_match_at: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "No matches yet";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "–" : d.toLocaleDateString("en-GB", { timeZone: "Europe/Malta", day: "2-digit", month: "short", year: "numeric" });
}

export default async function LadderPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const supabase = await createClient();

  const { data: ladder } = await supabase.from("ladders").select("key, name, sponsor_name, image_url, is_active, challenge_range").eq("key", key).maybeSingle();
  if (!ladder || ladder.is_active === false) notFound();

  const { data: rows } = await supabase.rpc("ladder_standings", { p_ladder_key: key });
  const standings = (rows ?? []) as Standing[];

  // Enrolment options: squads the viewer manages that aren't already on this ladder.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let options: { id: string; name: string }[] = [];
  let isAdmin = false;
  const eligibleOpponents = new Set<string>();
  if (user) {
    const { data: account } = await supabase.from("accounts").select("id, is_admin").eq("auth_user_id", user.id).maybeSingle();
    isAdmin = account?.is_admin === true;
    if (account) {
      const { data: managed } = await supabase
        .from("squad_members")
        .select("squad:squads(id, name)")
        .eq("account_id", account.id)
        .in("role", ["captain", "officer"]);
      const managedSquads = ((managed ?? []) as unknown as { squad: { id: string; name: string } | null }[])
        .map((m) => m.squad)
        .filter((s): s is { id: string; name: string } => Boolean(s));
      const enrolled = new Set(standings.map((s) => s.squad_id));
      if (key !== "company" || isAdmin) options = managedSquads.filter((s) => !enrolled.has(s.id));

      // My squad on this ladder → who I can challenge (within ±challenge_range).
      const mine = managedSquads.find((s) => enrolled.has(s.id));
      if (mine) {
        const myPos = standings.find((s) => s.squad_id === mine.id)?.pos ?? 0;
        const range = ladder.challenge_range ?? 2;
        for (const s of standings) {
          if (s.squad_id !== mine.id && Math.abs(s.pos - myPos) <= range) eligibleOpponents.add(s.squad_id);
        }
      }
    }
  }

  return (
    <Container size="wide" className="py-10 sm:py-14">
      <div className="mb-6 text-xs">
        <Link href="/player-portal/ladders" className="font-semibold uppercase tracking-[0.12em] text-text-muted hover:text-accent">
          ← Ladders
        </Link>
      </div>

      {ladder.image_url && (
        <div className="mb-6 aspect-[4/1] w-full overflow-hidden portal-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cldImage(ladderBannerUrl(ladder.image_url, 1600), { w: 384 })}
            srcSet={`${ladderBannerUrl(ladder.image_url, 600)} 600w, ${ladderBannerUrl(ladder.image_url, 1000)} 1000w, ${ladderBannerUrl(ladder.image_url, 1600)} 1600w`}
            sizes="100vw"
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
            {ladderDisplayName(ladder.key, ladder.sponsor_name)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">{ladderBlurb(ladder.key)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EnrollLadderButton ladderKey={key} options={options} />
          {isAdmin && <ReseedLadderButton ladderKey={key} />}
        </div>
      </header>

      {standings.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
          No squads on this ladder yet.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border portal-surface text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Squad</th>
                <th className="px-4 py-3 text-right font-semibold">Roster XP</th>
                <th className="px-4 py-3 text-right font-semibold">Last match</th>
                <th className="px-4 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => (
                <tr key={s.squad_id} className="border-b border-border last:border-0 hover:bg-bg-elevated/50">
                  <td className="px-4 py-3 font-mono text-lg font-extrabold text-accent">{s.pos}</td>
                  <td className="px-4 py-3">
                    <Link href={`/player-portal/squads/${s.squad_id}`} className="flex items-center gap-3 font-bold text-text hover:text-accent">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-overlay text-[0.6rem] font-bold text-text-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {s.badge_url ? <img src={cldImage(s.badge_url, { w: 384 })} alt="" className="h-full w-full object-cover" /> : s.name.slice(0, 2).toUpperCase()}
                      </span>
                      {s.name}
                      <span className="text-xs font-normal text-text-subtle">{s.member_count ?? 0} members</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-muted">{Math.round(Number(s.roster_xp ?? 0)).toLocaleString("en-US")}</td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">{fmtDate(s.last_match_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {eligibleOpponents.has(s.squad_id) && (
                      <Link href={`/player-portal/ladders/${key}/challenge/${s.squad_id}`} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                        Challenge
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
