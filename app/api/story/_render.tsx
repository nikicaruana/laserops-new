/**
 * app/api/story/_render.tsx
 * --------------------------------------------------------------------
 * The four shareable story layouts (1080 x 1920) rendered with Satori-safe
 * JSX (flexbox + inline styles only) for next/og ImageResponse.
 *
 *   - personal : personal stats (each with its match rank) + streaks + accolades
 *   - team     : match result + team breakdown + the player's stat line
 *   - nemesis  : head-to-head with the player's nemesis
 *   - xp       : XP earned + level progression (incl. level-up)
 *
 * Kept deliberately separate from the on-site report components: Satori only
 * supports a subset of CSS (no grid, inline styles only, images need explicit
 * sizes), so these are purpose-built rather than reused.
 */
import type { CSSProperties, ReactElement } from "react";
import type { MatchPlayer, MatchReport } from "@/lib/match-report/engine";
import type { StoryTemplate, PhotoOverlay } from "@/lib/story/meta";
import { getRankByLevel } from "@/lib/cms/ranking-system";
import { brand } from "@/lib/brand";

const W = 1080;
const H = 1920;

const C = {
  bg: "#0a0a0a",
  elevated: "#16161a",
  overlay: "#1c1c22",
  border: "#2a2a30",
  borderStrong: "#3a3a42",
  accent: "#ffde00",
  accentSoft: "#fff5a8",
  text: "#f5f5f5",
  muted: "#a3a3a3",
  subtle: "#737373",
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  loss: "#dc2626",
} as const;

// A warm yellow "bokeh" background: scattered soft out-of-focus glows over a
// warm charcoal base, echoing the glow treatment used elsewhere on the site.
// Brighter and more inviting than flat black - the whole point is that people
// actually want to share it. Cards keep their own dark fill so text stays legible.
const BG_IMAGE =
  "radial-gradient(520px 520px at 10% 12%, rgba(255,222,0,0.26), rgba(255,222,0,0) 70%), " +
  "radial-gradient(360px 360px at 88% 8%, rgba(255,222,0,0.20), rgba(255,222,0,0) 70%), " +
  "radial-gradient(660px 660px at 86% 86%, rgba(255,222,0,0.20), rgba(255,222,0,0) 72%), " +
  "radial-gradient(300px 300px at 16% 66%, rgba(255,222,0,0.22), rgba(255,222,0,0) 70%), " +
  "radial-gradient(200px 200px at 60% 40%, rgba(255,222,0,0.14), rgba(255,222,0,0) 70%), " +
  "radial-gradient(320px 320px at 8% 94%, rgba(255,222,0,0.16), rgba(255,222,0,0) 72%), " +
  "radial-gradient(240px 240px at 94% 46%, rgba(255,255,255,0.06), rgba(255,255,255,0) 70%), " +
  "linear-gradient(180deg, #241f14 0%, #17151b 52%, #100e12 100%)";

/** Make an image URL safe to FETCH for Satori: absolutise /public paths against
 *  the current request origin and force a PNG delivery format on Cloudinary URLs
 *  (Satori can't decode webp/avif). Used by the route's pre-loader, not at
 *  render time. */
export function sat(url: string | undefined | null, baseUrl?: string): string {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  let u = url;
  if (u.startsWith("/")) u = `${baseUrl || brand.siteUrl}${u}`;
  if (u.includes("res.cloudinary.com") && u.includes("/image/upload/") && !u.includes("/upload/f_")) {
    u = u.replace("/image/upload/", "/image/upload/f_png/");
  }
  return u;
}

function beforeBadgeUrl(report: MatchReport, p: MatchPlayer): string {
  return getRankByLevel(report.ranks, p.xpCurrentLevelBeforeMatch)?.badgeUrl || p.rankBadgeUrl || "";
}
function afterBadgeUrl(report: MatchReport, p: MatchPlayer): string {
  return getRankByLevel(report.ranks, p.xpCurrentLevelAfterMatch)?.badgeUrl || p.xpLevelBadgeImage || p.rankBadgeUrl || "";
}

/** Every remote image URL a template might render, so the route can pre-fetch
 *  them into data URIs (Satori's own fetcher is unreliable and would crash the
 *  whole image if one asset 404s / is webp). */
export function collectStoryImages(report: MatchReport, player: MatchPlayer): string[] {
  const urls = new Set<string>();
  const add = (u?: string | null) => {
    if (u) urls.add(u);
  };
  add(player.profilePicUrl);
  add(player.rankBadgeUrl);
  add(beforeBadgeUrl(report, player));
  add(afterBadgeUrl(report, player));
  (player.matchStreaks ?? []).forEach((s) => add(s.badgeUrl));
  player.earnedAccolades.forEach((e) => add(e.accolade.badgeUrl));
  if (player.nemesis) add(player.nemesis.profilePicUrl);
  add(report.game.winningTeamBadge);
  add(report.game.losingTeamBadge);
  return [...urls];
}

// Resolver set per render call. renderStory builds the element tree
// synchronously (no awaits), so a module-scoped resolver is safe across
// concurrent requests - each call sets it and finishes building before yielding.
type ImgResolver = (url: string | undefined | null) => string;
let RESOLVE: ImgResolver = (u) => u ?? "";

/** Image that degrades to a same-size spacer when the asset is missing.
 *  Satori throws on <img src="">, so we must never emit an empty src. */
function Im({ url, size, radius, border, cover, style }: { url: string | undefined | null; size: number | [number, number]; radius?: number; border?: string; cover?: boolean; style?: CSSProperties }): ReactElement {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  const src = RESOLVE(url);
  const base: CSSProperties = { width: w, height: h, ...style };
  if (radius !== undefined) base.borderRadius = radius;
  if (border !== undefined) base.border = border;
  if (!src) return <div style={{ display: "flex", ...base }} />;
  return <img src={src} width={w} height={h} alt="" style={{ objectFit: cover ? "cover" : "contain", ...base }} />;
}

function teamHex(team: string): string {
  const t = team.toLowerCase();
  if (t === "red") return C.red;
  if (t === "blue") return C.blue;
  if (t === "green") return C.green;
  if (t === "yellow") return C.accent;
  return C.muted;
}

/* ---------- shared frame ---------- */

function Frame({ logo, eyebrow, children }: { logo: string; eyebrow: string; children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", backgroundColor: "#0a0a0c", backgroundImage: BG_IMAGE, fontFamily: "Montserrat", paddingTop: 64, paddingLeft: 64, paddingRight: 64, paddingBottom: 195 }}>
      {/* No top accent bar: it would clash with the story app's timer/header
          UI that overlays the top of the frame. The logo is enlarged to own
          that space instead, with a little clearance below the timer. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
        {logo ? <img src={logo} width={310} height={88} alt="" style={{ objectFit: "contain" }} /> : <div style={{ display: "flex", width: 310, height: 88 }} />}
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 4, color: C.muted, textTransform: "uppercase" }}>{eyebrow}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: 36 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 2, color: C.accent, textTransform: "uppercase" }}>laseropsmalta.com</div>
      </div>
    </div>
  );
}

function TeamPill({ team }: { team: string }): ReactElement {
  const hex = teamHex(team);
  return (
    <div style={{ display: "flex", border: `2px solid ${hex}`, color: hex, borderRadius: 6, padding: "6px 18px", fontSize: 26, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>{team || "-"}</div>
  );
}

/** Stat tile: value, label, and match rank. Rank text is highlighted (accent,
 *  bold) when the player is top-2 for that stat. `highlight` gives the tile an
 *  accent background (used to emphasise Score). All tiles share one size so the
 *  eight fit neatly on two rows. */
function StatTile({ label, value, rank, highlight }: { label: string; value: string; rank?: number; highlight?: boolean }): ReactElement {
  const top2 = typeof rank === "number" && rank > 0 && rank <= 2;
  const fg = highlight ? C.bg : C.text;
  const sub = highlight ? C.bg : C.muted;
  const rankColor = highlight ? C.bg : top2 ? C.accent : C.subtle;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: highlight ? C.accent : C.elevated, border: highlight ? "none" : `1px solid ${C.border}`, borderRadius: 12, padding: "16px 10px", width: 216, height: 172 }}>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 800, color: fg }}>{value}</div>
      <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: sub, marginTop: 4 }}>{label}</div>
      {typeof rank === "number" && rank > 0 ? (
        <div style={{ display: "flex", fontSize: 20, fontWeight: top2 ? 800 : 700, letterSpacing: 1, color: rankColor, marginTop: 7, textTransform: "uppercase" }}>Rank #{rank}</div>
      ) : (
        <div style={{ display: "flex" }} />
      )}
    </div>
  );
}

function StatGrid({ p }: { p: MatchPlayer }): ReactElement {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center", width: 918 }}>
      <StatTile label="Score" value={p.score.toLocaleString("en-US")} rank={p.scoreRank} highlight />
      <StatTile label="Kills" value={String(p.kills)} rank={p.killsRank} />
      <StatTile label="Deaths" value={String(p.deaths)} rank={p.deathsRank} />
      <StatTile label="K/D" value={p.kd.toFixed(2)} rank={p.kdRank} />
      <StatTile label="Accuracy" value={`${Math.round(p.accuracy * 100)}%`} rank={p.accuracyRank} />
      <StatTile label="Damage" value={p.damage.toLocaleString("en-US")} rank={p.damageRank} />
      <StatTile label="Caps" value={String(p.objCaps ?? 0)} rank={p.objCapsRank} />
      <StatTile label="Cap Time" value={`${p.capTime ?? 0}s`} rank={p.capTimeRank} />
    </div>
  );
}

function BadgeStrip({ title, items }: { title: string; items: { badgeUrl: string; count?: number }[] }): ReactElement {
  const shown = items.slice(0, 4);
  const extra = items.length - shown.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 22 }}>
      <div style={{ display: "flex", fontSize: 32, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: C.accent }}>{title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 14 }}>
        {shown.map((it, i) => (
          <div key={i} style={{ display: "flex", position: "relative" }}>
            <Im url={it.badgeUrl} size={222} />
            {typeof it.count === "number" && it.count > 1 ? (
              <div style={{ display: "flex", position: "absolute", top: -8, right: -8, backgroundColor: C.accent, color: C.bg, fontSize: 32, fontWeight: 800, borderRadius: 40, padding: "2px 17px", border: `3px solid ${C.bg}` }}>×{it.count}</div>
            ) : null}
          </div>
        ))}
        {extra > 0 ? <div style={{ display: "flex", fontSize: 46, fontWeight: 800, color: C.muted }}>+{extra}</div> : null}
      </div>
    </div>
  );
}

/** Centered identity block: photo, name, and (optionally) team + rank + level. */
function IdentityHeader({ p, showLevel = true, photo = 250 }: { p: MatchPlayer; showLevel?: boolean; photo?: number }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", border: `5px solid ${C.accent}`, borderRadius: 14, padding: 6 }}>
        <Im url={p.profilePicUrl} size={photo} radius={8} cover />
      </div>
      <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: C.text, marginTop: 18 }}>{p.nickname}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
        <TeamPill team={p.teamColor} />
        {showLevel ? <Im url={p.rankBadgeUrl} size={60} /> : null}
        {showLevel ? <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.muted }}>Lvl. {p.level}</div> : null}
      </div>
    </div>
  );
}

/* ---------- templates ---------- */

function PersonalStory(report: MatchReport, p: MatchPlayer, logo: string): ReactElement {
  // Best-first so that when there are more badges than fit, the best show.
  const streaks = [...(p.matchStreaks ?? [])]
    .sort((a, b) => b.points * b.count - a.points * a.count)
    .map((s) => ({ badgeUrl: s.badgeUrl, count: s.count }));
  const accolades = [...p.earnedAccolades]
    .sort((a, b) => (b.accolade.xp ?? 0) - (a.accolade.xp ?? 0))
    .map((e) => ({ badgeUrl: e.accolade.badgeUrl }));
  return (
    <Frame logo={logo} eyebrow="Match Stats">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "space-between" }}>
        <IdentityHeader p={p} photo={290} />
        <div style={{ display: "flex", marginTop: 30 }}>
          <StatGrid p={p} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {streaks.length > 0 ? <BadgeStrip title="Streaks" items={streaks} /> : <div style={{ display: "flex" }} />}
          {accolades.length > 0 ? <BadgeStrip title="Accolades" items={accolades} /> : <div style={{ display: "flex" }} />}
        </div>
      </div>
    </Frame>
  );
}

function TeamStory(report: MatchReport, p: MatchPlayer, logo: string): ReactElement {
  const g = report.game;
  const won = p.isWinner;
  const redRounds = g.teams.red.roundWins;
  const blueRounds = g.teams.blue.roundWins;
  const redBadge = g.winningTeam === "Red" ? g.winningTeamBadge : g.losingTeamBadge;
  const blueBadge = g.winningTeam === "Blue" ? g.winningTeamBadge : g.losingTeamBadge;
  const scoreTop2 = p.scoreRank > 0 && p.scoreRank <= 2;
  return (
    <Frame logo={logo} eyebrow="Match Result">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 158, fontWeight: 800, color: won ? C.accent : C.loss }}>{won ? "VICTORY" : "DEFEAT"}</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 3, color: C.muted, textTransform: "uppercase", marginTop: 4 }}>{report.matchDate}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 54 }}>
          <Im url={redBadge} size={230} />
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", fontSize: 160, fontWeight: 800, color: C.red }}>{redRounds}</div>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: C.subtle }}>-</div>
            <div style={{ display: "flex", fontSize: 160, fontWeight: 800, color: C.blue }}>{blueRounds}</div>
          </div>
          <Im url={blueBadge} size={230} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Im url={p.profilePicUrl} size={380} radius={18} cover border={`6px solid ${teamHex(p.teamColor)}`} />
          <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: C.text, marginTop: 18 }}>{p.nickname}</div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: scoreTop2 ? 800 : 700, color: scoreTop2 ? C.accent : C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>#{p.scoreRank} on the scoreboard</div>
        </div>
        <div style={{ display: "flex" }}>
          <StatGrid p={p} />
        </div>
      </div>
    </Frame>
  );
}

function NemesisStory(report: MatchReport, p: MatchPlayer, logo: string): ReactElement {
  const n = p.nemesis;
  if (!n) {
    return (
      <Frame logo={logo} eyebrow="Nemesis">
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", fontSize: 48, fontWeight: 700, color: C.muted }}>No nemesis this match.</div>
      </Frame>
    );
  }
  return (
    <Frame logo={logo} eyebrow="Nemesis">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 108, fontWeight: 800, color: C.accent }}>NEMESIS</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 3, color: C.muted, textTransform: "uppercase", marginTop: 4 }}>{report.matchDate}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 30, marginTop: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 380 }}>
            <Im url={p.profilePicUrl} size={320} radius={16} cover border={`6px solid ${C.accent}`} />
            <div style={{ display: "flex", fontSize: 50, fontWeight: 800, color: C.text, marginTop: 18 }}>{p.nickname}</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: C.muted }}>Lvl. {p.level}</div>
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: C.subtle }}>VS</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 380 }}>
            <Im url={n.profilePicUrl} size={320} radius={16} cover border={`6px solid ${C.loss}`} />
            <div style={{ display: "flex", fontSize: 50, fontWeight: 800, color: C.text, marginTop: 18 }}>{n.nickname}</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: C.muted }}>Lvl. {n.level}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: C.elevated, border: `1px solid ${C.border}`, borderRadius: 16, padding: "34px 66px" }}>
              <div style={{ display: "flex", fontSize: 128, fontWeight: 800, color: C.accent }}>{n.killsFor}</div>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>You killed</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: C.elevated, border: `1px solid ${C.border}`, borderRadius: 16, padding: "34px 66px" }}>
              <div style={{ display: "flex", fontSize: 128, fontWeight: 800, color: C.loss }}>{n.killsAgainst}</div>
              <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>Killed you</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 44 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: C.accent }}>Damage</div>
            <div style={{ display: "flex", alignItems: "center", gap: 46, marginTop: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", fontSize: 78, fontWeight: 800, color: C.accent }}>{n.damageFor.toLocaleString("en-US")}</div>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>You dealt</div>
              </div>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 800, color: C.subtle }}>vs</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", fontSize: 78, fontWeight: 800, color: C.loss }}>{n.damageAgainst.toLocaleString("en-US")}</div>
                <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.muted, textTransform: "uppercase" }}>They dealt</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function XpStory(report: MatchReport, p: MatchPlayer, logo: string): ReactElement {
  const leveledUp = p.xpCurrentLevelAfterMatch > p.xpCurrentLevelBeforeMatch;
  const breakdown = [
    { label: "From points", value: p.xpFromPoints },
    { label: "From rounds", value: p.xpFromWins },
    { label: "From accolades", value: p.xpFromAccolades },
  ];
  return (
    <Frame logo={logo} eyebrow="XP & Level">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
        <IdentityHeader p={p} showLevel={false} photo={300} />
        {leveledUp ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 44 }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: 4, color: C.accent, textTransform: "uppercase" }}>Level Up</div>
            <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Im url={beforeBadgeUrl(report, p)} size={190} />
                <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: C.muted }}>Lvl {p.xpCurrentLevelBeforeMatch}</div>
              </div>
              <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: C.accent }}>▶</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Im url={afterBadgeUrl(report, p)} size={250} />
                <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: C.accent }}>Lvl {p.xpCurrentLevelAfterMatch}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 44 }}>
            <Im url={beforeBadgeUrl(report, p)} size={280} />
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: C.text, marginTop: 10 }}>Level {p.level}</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 44 }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 800, color: C.accent }}>+{p.xpEarnedThisMatch.toLocaleString("en-US")}</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 3, color: C.muted, textTransform: "uppercase" }}>XP this match</div>
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 44 }}>
          {breakdown.map((b, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: C.elevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: "30px 30px", width: 296 }}>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: C.text }}>+{b.value.toLocaleString("en-US")}</div>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: C.accent, marginLeft: 8 }}>XP</div>
              </div>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 1, color: C.muted, textTransform: "uppercase", marginTop: 6 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function renderStory(template: StoryTemplate, report: MatchReport, player: MatchPlayer, logo: string, resolve: ImgResolver): ReactElement {
  RESOLVE = resolve;
  switch (template) {
    case "team":
      return TeamStory(report, player, logo);
    case "nemesis":
      return NemesisStory(report, player, logo);
    case "xp":
      return XpStory(report, player, logo);
    case "personal":
    default:
      return PersonalStory(report, player, logo);
  }
}

/* ---------- photo story (a match photo + optional stats overlay) ---------- */

export type PhotoStoryOpts = {
  photo: string; // data URI of the (already positioned) photo
  bg?: string; // data URI of a cover/blurred fill shown behind (fills Fit letterbox bars)
  img: { w: number; h: number; left: number; top: number }; // placement in the 1080x1920 frame
  overlay: PhotoOverlay;
  branding: boolean;
};

type StatItem = { label: string; value: string; rank: number };
function allStats(p: MatchPlayer): StatItem[] {
  return [
    { label: "Score", value: p.score.toLocaleString("en-US"), rank: p.scoreRank },
    { label: "Kills", value: String(p.kills), rank: p.killsRank },
    { label: "Deaths", value: String(p.deaths), rank: p.deathsRank },
    { label: "K/D", value: p.kd.toFixed(2), rank: p.kdRank },
    { label: "Accuracy", value: `${Math.round(p.accuracy * 100)}%`, rank: p.accuracyRank },
    { label: "Damage", value: p.damage.toLocaleString("en-US"), rank: p.damageRank },
    { label: "Caps", value: String(p.objCaps ?? 0), rank: p.objCapsRank ?? 0 },
    { label: "Cap Time", value: `${p.capTime ?? 0}s`, rank: p.capTimeRank ?? 0 },
  ];
}

function OverlayStatItem({ s }: { s: StatItem }): ReactElement {
  const top2 = s.rank > 0 && s.rank <= 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: C.text }}>{s.value}</div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.muted, marginTop: 3 }}>{s.label}</div>
      {s.rank > 0 ? <div style={{ display: "flex", fontSize: 24, fontWeight: top2 ? 800 : 700, color: top2 ? C.accent : C.subtle, marginTop: 5, textTransform: "uppercase" }}>Rank #{s.rank}</div> : <div style={{ display: "flex" }} />}
    </div>
  );
}

function BandTitle({ children }: { children: string }): ReactElement {
  return <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: C.accent }}>{children}</div>;
}

function OverlayBand(report: MatchReport, p: MatchPlayer, overlay: PhotoOverlay): ReactElement {
  // Ops tag headline: centered, yellow, no team-colour label.
  const nameRow = (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
      <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: C.accent }}>{p.nickname}</div>
    </div>
  );

  if (overlay === "main" || overlay === "highlights") {
    const hasObjectivePlay = report.players.some((pl) => (pl.objCaps ?? 0) > 0 || (pl.capTime ?? 0) > 0);
    const base = allStats(p).filter((s) => hasObjectivePlay || (s.label !== "Caps" && s.label !== "Cap Time"));
    const items = overlay === "main" ? base.slice(0, 4) : [...base].sort((a, b) => a.rank - b.rank).slice(0, 4);
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {nameRow}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {items.map((s, i) => (
            <OverlayStatItem key={i} s={s} />
          ))}
        </div>
      </div>
    );
  }

  if (overlay === "captures") {
    const items: StatItem[] = [
      { label: "Score", value: p.score.toLocaleString("en-US"), rank: p.scoreRank },
      { label: "Captures", value: String(p.objCaps ?? 0), rank: p.objCapsRank ?? 0 },
      { label: "Cap Time", value: `${p.capTime ?? 0}s`, rank: p.capTimeRank ?? 0 },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {nameRow}
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {items.map((s, i) => (
            <OverlayStatItem key={i} s={s} />
          ))}
        </div>
      </div>
    );
  }

  if (overlay === "result") {
    const g = report.game;
    const won = p.isWinner;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: won ? C.accent : C.loss }}>{won ? "VICTORY" : "DEFEAT"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 8 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: C.red }}>RED</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: C.red }}>{g.teams.red.roundWins}</div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: C.subtle }}>-</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: C.blue }}>{g.teams.blue.roundWins}</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: C.blue }}>BLUE</div>
        </div>
      </div>
    );
  }

  if (overlay === "accolade") {
    const badges = [...p.earnedAccolades].sort((a, b) => (b.accolade.xp ?? 0) - (a.accolade.xp ?? 0)).slice(0, 5);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BandTitle>Accolades</BandTitle>
        {badges.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 16 }}>
            {badges.map((e, i) => (
              <Im key={i} url={e.accolade.badgeUrl} size={210} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: C.muted, marginTop: 12 }}>No accolades this match</div>
        )}
      </div>
    );
  }

  if (overlay === "streaks") {
    const streaks = [...(p.matchStreaks ?? [])].sort((a, b) => b.points * b.count - a.points * a.count).slice(0, 5);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BandTitle>Streaks</BandTitle>
        {streaks.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 16 }}>
            {streaks.map((s, i) => (
              <div key={i} style={{ display: "flex", position: "relative" }}>
                <Im url={s.badgeUrl} size={210} />
                {s.count > 1 ? (
                  <div style={{ display: "flex", position: "absolute", top: -6, right: -6, backgroundColor: C.accent, color: C.bg, fontSize: 26, fontWeight: 800, borderRadius: 40, padding: "2px 14px", border: `3px solid ${C.bg}` }}>×{s.count}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: C.muted, marginTop: 12 }}>No streaks this match</div>
        )}
      </div>
    );
  }

  // identity - centered: ops tag, then level badge, then level text
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: C.accent }}>{p.nickname}</div>
      <Im url={p.rankBadgeUrl} size={150} style={{ marginTop: 14 }} />
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: C.muted, marginTop: 8 }}>Lvl. {p.level}</div>
    </div>
  );
}

export function renderPhotoStory(report: MatchReport, player: MatchPlayer, logo: string, resolve: ImgResolver, opts: PhotoStoryOpts): ReactElement {
  RESOLVE = resolve;
  const showBrandFooter = opts.branding && opts.overlay === "none";
  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", backgroundColor: "#000", fontFamily: "Montserrat" }}>
      {/* Fill layer: a cover (blurred, for Cloudinary) version behind the photo so
          Fit-mode letterbox bars show a continuation of the image, not black. */}
      {opts.bg ? <img src={opts.bg} width={W} height={H} alt="" style={{ position: "absolute", inset: 0, objectFit: "cover" }} /> : null}
      {opts.bg ? <div style={{ display: "flex", position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.35)" }} /> : null}

      {opts.photo ? (
        <img src={opts.photo} width={opts.img.w} height={opts.img.h} alt="" style={{ position: "absolute", left: opts.img.left, top: opts.img.top, objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", position: "absolute", inset: 0, backgroundColor: C.elevated }} />
      )}

      {/* Logo + match date: centered, pushed below the story app's timer bar. */}
      {opts.branding && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: 0, left: 0, width: W, paddingTop: 170, paddingBottom: 300, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.88) 40%, rgba(0,0,0,0.62) 68%, rgba(0,0,0,0.28) 86%, rgba(0,0,0,0) 100%)" }}>
          {logo ? <img src={logo} width={420} height={120} alt="" style={{ objectFit: "contain" }} /> : <div style={{ display: "flex", width: 420, height: 120 }} />}
          {report.matchDate ? <div style={{ display: "flex", marginTop: 10, fontSize: 30, fontWeight: 700, letterSpacing: 3, color: C.text, textTransform: "uppercase" }}>{report.matchDate}</div> : null}
        </div>
      )}

      {opts.overlay !== "none" && (
        <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 0, bottom: 0, width: W, paddingLeft: 56, paddingRight: 56, paddingTop: 170, paddingBottom: 230, backgroundImage: "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0) 100%)" }}>
          {OverlayBand(report, player, opts.overlay)}
          {opts.branding && <div style={{ display: "flex", justifyContent: "center", marginTop: 30, fontSize: 40, fontWeight: 800, letterSpacing: 3, color: C.accent, textTransform: "uppercase" }}>laseropsmalta.com</div>}
        </div>
      )}

      {showBrandFooter && (
        <div style={{ display: "flex", justifyContent: "center", position: "absolute", bottom: 230, width: W }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, letterSpacing: 3, color: C.accent, textTransform: "uppercase" }}>laseropsmalta.com</div>
        </div>
      )}
    </div>
  );
}
