/**
 * components/admin/ChangeLogList.tsx
 * --------------------------------------------------------------------
 * Renders a list of admin_audit_log entries (who / when / what). Server
 * component — display only.
 */
import {
  actionVerb,
  tableLabel,
  targetName,
  type AuditEntry,
} from "@/lib/admin/audit";

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChangeLogList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">No changes recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-border border border-border">
      {entries.map((e) => {
        const name = targetName(e);
        return (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-accent">{e.actor_ops_tag ?? "System"}</span>{" "}
              <span className="text-text-muted">{actionVerb(e.action)}</span>{" "}
              <span className="text-text">{tableLabel(e.table_name)}</span>
              {name && <span className="text-text-muted"> · {name}</span>}
            </div>
            <span className="shrink-0 font-mono text-xs text-text-subtle">{when(e.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
