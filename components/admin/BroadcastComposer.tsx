"use client";

/**
 * components/admin/BroadcastComposer.tsx
 * --------------------------------------------------------------------
 * Admin composes a one-off notification and sends it to everyone, a single
 * player (by ops tag), or a squad. Optional email. Posts to /api/admin/broadcast.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { renderEmailTemplate, sampleEmailTokens, type EmailConfig } from "@/lib/email-tokens";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export function BroadcastComposer({ squads, emailTemplate, config }: { squads: { id: string; name: string }[]; emailTemplate: string; config: EmailConfig }) {
  const [mode, setMode] = useState<"all" | "player" | "squad">("all");
  const [opsTag, setOpsTag] = useState("");
  const [squadId, setSquadId] = useState(squads[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [href, setHref] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live previews so it's clear how the notification and email will look.
  const previewTitle = title.trim() || "Your title here";
  const previewBody = msg.trim() || "Your message shows here.";
  const emailPreview = renderEmailTemplate(emailTemplate, {
    ...sampleEmailTokens(config),
    title: title.trim() || "Your title here",
    body: msg.trim() || "Your message shows here.",
    link: href.trim() || "#",
  });

  async function send() {
    setError(null);
    setResult(null);
    if (!title.trim()) return setError("A title is required.");
    const recipients = mode === "all" ? "everyone" : mode === "player" ? `@${opsTag.trim()}` : squads.find((s) => s.id === squadId)?.name ?? "the squad";
    if (!window.confirm(`Send this notification to ${recipients}${sendEmail ? " (with email)" : ""}?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, opsTag, squadId, title, body: msg, href, sendEmail }),
    });
    const data = (await res.json()) as { ok?: boolean; sent?: number; emailed?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !data.ok) return setError(data.error || "Couldn't send.");
    setResult(`Sent to ${data.sent} player${data.sent === 1 ? "" : "s"}${data.emailed ? " (emails queued)" : ""}.`);
    setTitle("");
    setMsg("");
    setHref("");
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      {result && <p className="border border-accent bg-accent/10 px-4 py-3 text-sm text-accent">{result}</p>}

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>Recipients</p>
        <div className="flex flex-wrap gap-2">
          {(["all", "player", "squad"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`border px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] ${mode === m ? "border-accent bg-accent text-bg" : "border-border-strong text-text-muted hover:border-accent hover:text-accent"}`}
            >
              {m === "all" ? "Everyone" : m === "player" ? "A player" : "A squad"}
            </button>
          ))}
        </div>
        {mode === "player" && (
          <div className="mt-4"><label className={lbl}>Player ops tag</label><input className={input} value={opsTag} onChange={(e) => setOpsTag(e.target.value)} placeholder="e.g. Kini" /></div>
        )}
        {mode === "squad" && (
          <div className="mt-4">
            <label className={lbl}>Squad</label>
            <select className={input} value={squadId} onChange={(e) => setSquadId(e.target.value)}>
              {squads.length === 0 && <option value="">No squads</option>}
              {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </section>

      <section className="border border-border bg-bg-elevated px-5 py-5 space-y-4">
        <div><label className={lbl}>Title</label><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Double XP this Saturday" /></div>
        <div><label className={lbl}>Message</label><textarea className={`${input} h-24 py-2`} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Optional detail shown under the title." /></div>
        <div><label className={lbl}>Link (optional)</label><input className={input} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/player-portal/games or https://…" /></div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-accent" />
          Also email recipients (uses the Admin announcement email template)
        </label>
      </section>

      {/* In-app preview: how it shows in the bell. */}
      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>How it shows in the bell</p>
        <div className="w-72 max-w-full border border-border-strong bg-bg">
          <div className="border-b border-border px-4 py-2.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Notifications</div>
          <div className="px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-text">{previewTitle}</span>
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">{previewBody}</span>
          </div>
        </div>
      </section>

      {/* Email preview: only relevant when emailing. */}
      {sendEmail && (
        <section className="border border-border bg-bg-elevated px-5 py-5">
          <p className={lbl}>Email preview</p>
          <p className="mb-3 text-[0.65rem] text-text-subtle">
            Uses the Admin announcement template (editable under Notifications → Admin announcement). Your title, message and link fill it in.
          </p>
          <iframe title="Email preview" sandbox="" className="h-[30rem] w-full border border-border-strong bg-white" srcDoc={emailPreview} />
        </section>
      )}

      <Button type="button" size="md" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send notification"}</Button>
    </div>
  );
}
