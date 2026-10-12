/**
 * app/player-portal/pay/[matchId]/page.tsx
 * --------------------------------------------------------------------
 * Post-game "settle up" page (login-gated), reached from the match-report email.
 * Shows the player's bill: game fee minus any token they apply, plus drinks they
 * add, and the amount to pay by Revolut (or cash). Only for per-player games the
 * player actually played; flat-rate bookings are settled by the organiser.
 */
import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";
import { PaySettlement } from "@/components/portal/PaySettlement";

export const metadata: Metadata = { title: "Settle up", robots: { index: false, follow: false } };

export default async function PayPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/player-portal/login?next=/player-portal/pay/${matchId}`);

  const { data: account } = await supabase
    .from("accounts")
    .select("id, ops_tag, full_name, discount_price_eur")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account) {
    return (
      <Container size="narrow" className="py-16">
        <p className="text-center text-sm text-text-muted">We couldn&apos;t find an account linked to your login.</p>
      </Container>
    );
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, match_code, title, status, price_eur, pricing_mode")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) notFound();

  const [{ data: part }, { data: balRaw }, { data: drinks }, { data: orders }, { data: cfg }, { data: tokenImg }] = await Promise.all([
    supabase
      .from("match_participants")
      .select("id, paid_at, settlement_token_intent, player_marked_paid_at")
      .eq("match_id", matchId)
      .eq("account_id", account.id)
      .maybeSingle(),
    supabase.rpc("my_token_balance"),
    supabase.from("drink_menu").select("id, name, price_eur").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("match_drink_orders").select("drink_id, qty").eq("match_id", matchId).eq("account_id", account.id),
    supabase.from("pricing_config").select("revolut_pay_link").eq("id", 1).maybeSingle(),
    supabase.from("reward_images").select("image_url").eq("key", "game_token").maybeSingle(),
  ]);

  const label = match.title || match.match_code || "your game";
  const eligible =
    match.pricing_mode === "per_player" && ["live", "completed"].includes(match.status ?? "") && Boolean(part);

  if (!eligible) {
    const reason =
      match.pricing_mode !== "per_player"
        ? "This game is settled by the organiser, so there's nothing for you to pay here."
        : !part
          ? "We don't have you on this game's roster yet. If you played, let the LaserOps team know."
          : "This game isn't ready for payment yet.";
    return (
      <Container size="narrow" className="py-16">
        <div className="portal-card p-6 text-center">
          <h1 className="text-xl font-bold uppercase tracking-[0.08em] text-text">Nothing to settle</h1>
          <p className="mt-2 text-sm text-text-muted">{reason}</p>
        </div>
      </Container>
    );
  }

  const gameFee = account.discount_price_eur != null ? Number(account.discount_price_eur) : Number(match.price_eur ?? 0);

  return (
    <Container size="narrow" className="py-10 sm:py-14">
      <PaySettlement
        matchId={match.id}
        matchCode={match.match_code ?? ""}
        label={label}
        opsTag={account.ops_tag ?? ""}
        gameFee={gameFee}
        tokenBalance={Number(balRaw ?? 0)}
        tokenApplied={Number(part?.settlement_token_intent ?? 0)}
        drinks={(drinks ?? []).map((d) => ({ id: d.id as string, name: d.name as string, price: Number(d.price_eur) }))}
        initialQuantities={Object.fromEntries((orders ?? []).map((o) => [o.drink_id as string, Number(o.qty)]))}
        revolutLink={(cfg?.revolut_pay_link as string) ?? ""}
        tokenImageUrl={((tokenImg?.image_url as string | null) ?? "").trim()}
        alreadyPaid={Boolean(part?.paid_at)}
        playerMarkedPaid={Boolean(part?.player_marked_paid_at)}
      />
    </Container>
  );
}
