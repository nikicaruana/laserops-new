/**
 * app/admin/elo/page.tsx
 * --------------------------------------------------------------------
 * ELO config. Two parts:
 *   - elo_config: the rating-engine settings (key/value; the value column is
 *     text, so Yes/No + enum settings sit alongside the numbers).
 *   - elo_tiers: the named ELO bands (Recruit..Elite).
 * Both saves are gated (TOTP). Changing these affects future ELO movement only;
 * a full re-snapshot is a separate ingestion action.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyValueConfigEditor, type FieldSpec } from "@/components/admin/KeyValueConfigEditor";
import { ConfigTableEditor, type ColumnSpec, type EditableRow } from "@/components/admin/ConfigTableEditor";

export const metadata = { title: "ELO" };

const YES_NO = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const ELO_FIELDS: FieldSpec[] = [
  { key: "Starting_ELO", label: "Starting ELO", help: "Default ELO for a brand-new player.", group: "Core" },
  { key: "Default_New_Player_ELO", label: "Default new-player ELO", help: "Usually the same as starting ELO.", group: "Core" },
  { key: "K_Factor", label: "K-factor", help: "Base team-result movement before match-size scaling.", group: "Core" },
  { key: "Elo_Divisor", label: "ELO divisor", help: "Standard ELO curve divisor (400).", group: "Core" },
  { key: "Max_Total_ELO_Change", label: "Max total change / match", help: "Cap on total ELO movement in one match.", group: "Core" },
  { key: "Min_Resolved_Players", label: "Min resolved players", help: "Safety check before snapshotting a match.", group: "Core" },
  { key: "Team_Builder_Unknown_ELO", label: "Team-builder unknown ELO", help: "ELO given to unknown players in the team builder.", group: "Core" },

  { key: "Performance_K", label: "Performance K", help: "Base personal-performance modifier before scaling.", group: "Personal performance" },
  { key: "Max_Performance_Adjustment", label: "Max performance adjustment", help: "Cap on personal bonus/penalty before scaling.", group: "Personal performance" },

  { key: "Match_Size_Adjustment_Enabled", label: "Match-size scaling", kind: "select", options: YES_NO, help: "Weight movement by how big the match is.", group: "Match-size scaling" },
  { key: "Match_Size_Baseline", label: "Baseline match size", help: "Neutral size (about 6v6).", group: "Match-size scaling" },
  { key: "Team_K_Min_Multiplier", label: "Team K min ×", help: "Lowest team-result weighting (large matches).", group: "Match-size scaling" },
  { key: "Team_K_Max_Multiplier", label: "Team K max ×", help: "Highest team-result weighting (small matches).", group: "Match-size scaling" },
  { key: "Performance_Min_Multiplier", label: "Performance min ×", help: "Lowest personal-performance weighting.", group: "Match-size scaling" },
  { key: "Performance_Max_Multiplier", label: "Performance max ×", help: "Highest personal-performance weighting.", group: "Match-size scaling" },

  { key: "Resnapshot_Mode", label: "Re-snapshot mode", kind: "text", help: "Reminder of how a re-snapshot script behaves.", group: "Other" },
];

const TIER_COLUMNS: ColumnSpec[] = [
  { key: "tier_name", label: "Tier", kind: "text" },
  { key: "min_elo", label: "Min ELO", kind: "number", align: "right" },
  { key: "max_elo", label: "Max ELO", kind: "number", align: "right" },
  { key: "sort_order", label: "Order", kind: "number", align: "right", width: "5rem" },
  { key: "badge_url", label: "Badge", kind: "image", width: "5rem" },
];

export default async function AdminEloPage() {
  const supabase = await createClient();
  const [{ data: cfgRows }, { data: tierRows }] = await Promise.all([
    supabase.from("elo_config").select("key, value"),
    supabase
      .from("elo_tiers")
      .select("id, tier_name, min_elo, max_elo, sort_order, badge_url")
      .order("sort_order"),
  ]);

  const initial: Record<string, string> = {};
  for (const r of (cfgRows ?? []) as { key: string; value: string | number | null }[]) {
    initial[r.key] = r.value === null ? "" : String(r.value);
  }

  const tierInitial = ((tierRows ?? []) as EditableRow[]).map((r) => ({ ...r }));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-text sm:text-3xl">
            ELO
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            The skill-rating engine settings and tier bands.
          </p>
        </div>
        <Link
          href="/admin/changelog?g=progression"
          className="flex h-10 items-center border border-border-strong px-4 text-xs font-bold uppercase tracking-[0.12em] text-text-muted hover:border-accent hover:text-accent"
        >
          Change log
        </Link>
      </header>

      <div className="mb-6 border-l-4 border-amber-500 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
        <span className="font-semibold text-amber-300">Heads up —</span> these settings are finely
        tuned for balanced, fair skill ratings. Changing them affects how every future match moves
        players&apos; ELO, so adjust deliberately. Past matches keep the ELO they were snapshotted
        with; re-scoring history is a separate re-snapshot action.
      </div>

      <section className="mb-10">
        <KeyValueConfigEditor
          table="elo_config"
          columnKind="text"
          fields={ELO_FIELDS}
          initial={initial}
          gateAction="the ELO settings"
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-[0.12em] text-accent">Tier bands</h2>
        <p className="mb-4 text-xs text-text-muted">
          The named band a player&apos;s ELO falls into. Bands should be contiguous; the top band&apos;s
          max just needs to sit above any reachable ELO.
        </p>
        <ConfigTableEditor
          table="elo_tiers"
          columns={TIER_COLUMNS}
          initialRows={tierInitial}
          imageKind="tier"
          gateAction="the ELO tier bands"
          canAdd
          canDelete
          addLabel="+ Add tier"
          autoIncrement="sort_order"
          newRowTemplate={{ tier_name: "", min_elo: "", max_elo: "", sort_order: "", badge_url: null }}
        />
      </section>
    </div>
  );
}
