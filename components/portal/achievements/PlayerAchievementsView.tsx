import Link from "next/link";
import { cldImage } from "@/lib/cld";
import type { PlayerAchievements, AchievementItem, AchievementSection } from "@/lib/leaderboards/player-achievements";
import { CollapsibleSection } from "@/components/portal/CollapsibleSection";
import { WeaponAchievementsAccordion } from "@/components/portal/achievements/WeaponAchievementsAccordion";
import { Placing } from "@/components/portal/achievements/Placing";

/**
 * PlayerAchievementsView
 * --------------------------------------------------------------------
 * A player's ranked placements across every competitive surface: an avatar +
 * prominent placings count, then a collapsible section per source. Each snippet
 * links to where the placing is shown in full. Weapon mastery is a tap-to-expand
 * grid of guns. Visible for any player.
 */
export function PlayerAchievementsView({ data }: { data: PlayerAchievements }) {
  return (
    <div className="space-y-6">
      <Header nickname={data.nickname} profilePicUrl={data.profilePicUrl} total={data.totalCount} />

      <p className="text-left text-sm leading-relaxed text-text-muted sm:text-center">
        See where <span className="font-semibold text-text">{data.nickname}</span> left their mark in the
        community&apos;s all-time and seasonal records and accomplishments.
      </p>

      {data.totalCount === 0 ? (
        <div className="portal-card px-6 py-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-text-muted">No achievements yet</p>
          <p className="mt-2 text-sm text-text-subtle">
            {data.nickname} hasn&apos;t placed on any leaderboard, record, or Hall of Fame board yet. Keep playing – placings show up here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.sections.map((section) => (
            <CollapsibleSection
              key={section.key}
              align="responsive"
              title={<SectionTitle title={section.title} count={sectionCount(section)} />}
            >
              <div className="mx-auto max-w-3xl">
                <p className="mb-4 text-left text-xs text-text-subtle sm:text-center">{section.blurb}</p>
                {section.kind === "weapons" ? (
                  <WeaponAchievementsAccordion weapons={section.weapons} />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {section.items.map((item, i) => (
                      <AchievementRow key={`${section.key}-${i}`} item={item} />
                    ))}
                  </ul>
                )}
                <div className="mt-4 text-left sm:text-center">
                  <Link href={section.href} className="text-xs font-bold uppercase tracking-[0.12em] text-accent hover:text-accent-soft">
                    View full board →
                  </Link>
                </div>
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  );
}

function sectionCount(section: AchievementSection): number {
  return section.kind === "weapons"
    ? section.weapons.reduce((n, w) => n + w.items.length + (w.isMaster ? 1 : 0), 0)
    : section.items.length;
}

/* ---------- Header ---------- */

function Header({ nickname, profilePicUrl, total }: { nickname: string; profilePicUrl: string; total: number }) {
  return (
    <div className="portal-card flex items-center gap-4 p-4 sm:gap-5 sm:p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cldImage(profilePicUrl, { w: 224 })}
        alt=""
        className="h-20 w-20 shrink-0 rounded-lg border-2 border-border-strong object-cover sm:h-24 sm:w-24"
      />
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-text-subtle">Achievements</p>
        <h2 className="truncate text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">{nickname}</h2>
      </div>
      <div className="ml-auto flex shrink-0 flex-col items-center rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-center sm:px-5 sm:py-3">
        <span className="font-mono text-3xl font-extrabold leading-none tabular-nums text-accent sm:text-4xl">
          {total.toLocaleString("en-US")}
        </span>
        <span className="mt-1 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-accent/90 sm:text-[0.6rem]">
          Placing{total === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span>{title}</span>
      <span className="rounded-sm bg-bg-overlay px-2 py-0.5 font-mono text-xs font-bold text-text-muted">{count}</span>
    </span>
  );
}

/* ---------- Achievement row (links to the full board) ---------- */

function AchievementRow({ item }: { item: AchievementItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-3 portal-card p-3 transition-colors hover:border-accent sm:p-4"
      >
        <Placing rank={item.rank} />
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cldImage(item.imageUrl, { w: 96 })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">{item.label}</p>
          {item.detail ? <p className="truncate text-xs text-text-muted">{item.detail}</p> : null}
        </div>
        <span aria-hidden className="shrink-0 text-text-subtle">→</span>
      </Link>
    </li>
  );
}
