"use client";

/**
 * components/admin/BroadcastComposer.tsx
 * --------------------------------------------------------------------
 * Admin composes a one-off notification and sends it to everyone, one or more
 * players (searchable multi-select), or a squad - each shown in the bell and
 * optionally emailed. A fourth "Email only" mode skips the bell entirely and
 * emails the whole opted-in mailing list via a queued campaign. When email is
 * involved the admin can pick the From address. Posts to /api/admin/broadcast
 * (bell modes) or /api/admin/email-campaign (email-only).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { renderEmailTemplate, sampleEmailTokens, type EmailConfig } from "@/lib/email-tokens";
import { senderDomainError } from "@/lib/email-domains";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

type Mode = "all" | "player" | "squad" | "email";

export function BroadcastComposer({
  squads,
  opsTags,
  emailTemplate,
  config,
  defaultFromEmail,
  defaultSenderName,
  mailingListCount,
}: {
  squads: { id: string; name: string }[];
  opsTags: string[];
  emailTemplate: string;
  config: EmailConfig;
  defaultFromEmail: string;
  defaultSenderName: string;
  mailingListCount: number;
}) {
  const [mode, setMode] = useState<Mode>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [squadId, setSquadId] = useState(squads[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [templateKey, setTemplateKey] = useState("admin_broadcast");
  const [msg, setMsg] = useState("");
  const [href, setHref] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [fromEmail, setFromEmail] = useState(defaultFromEmail);
  const [senderName, setSenderName] = useState(defaultSenderName);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailWillSend = mode === "email" || sendEmail;
  const fromErr = emailWillSend ? senderDomainError(fromEmail) : null;
  const launchTemplate = mode === "email" && templateKey === "launch_announcement";

  // The mailboxes the admin can send from (all on the verified domain).
  const mailboxes = useMemo(() => {
    const known = [defaultFromEmail, "bookings@laseropsmalta.com", "scores@laseropsmalta.com", "info@laseropsmalta.com", "noreply@laseropsmalta.com"];
    return Array.from(new Set(known.map((m) => m.trim()).filter(Boolean)));
  }, [defaultFromEmail]);

  // Recipient picker suggestions: match the query, exclude already-chosen.
  const suggestions = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    const chosen = new Set(selectedTags);
    return opsTags.filter((t) => !chosen.has(t) && (q === "" || t.toLowerCase().includes(q))).slice(0, 8);
  }, [tagQuery, opsTags, selectedTags]);

  function addTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagQuery("");
  }
  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }

  // Live previews.
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
    if (!launchTemplate && !title.trim()) return setError("A title is required.");

    if (mode === "email") {
      // Email-only blast to the whole mailing list - irreversible, so require a typed confirm.
      if (mailingListCount === 0) return setError("Nobody is on the mailing list yet (no opted-in accounts with an email).");
      if (confirmText.trim().toUpperCase() !== "SEND") return setError('Type SEND in the confirm box to email the whole mailing list.');
      if (!window.confirm(`Email this to all ${mailingListCount} opted-in recipients? This cannot be undone.`)) return;
      setBusy(true);
      const res = await fetch("/api/admin/email-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim() || title.trim(), title, body: msg, href, fromEmail, senderName, typeKey: templateKey }),
      });
      const data = (await res.json()) as { ok?: boolean; total?: number; error?: string };
      setBusy(false);
      if (!res.ok || !data.ok) return setError(data.error || "Couldn't queue the campaign.");
      setResult(`Queued ${data.total} email${data.total === 1 ? "" : "s"} - sending now (a few minutes for large lists).`);
      setTitle(""); setSubject(""); setMsg(""); setHref(""); setConfirmText("");
      return;
    }

    // Bell modes (optionally emailed).
    const recipients = mode === "all" ? "everyone" : mode === "player" ? `${selectedTags.length} player${selectedTags.length === 1 ? "" : "s"}` : squads.find((s) => s.id === squadId)?.name ?? "the squad";
    if (mode === "player" && selectedTags.length === 0) return setError("Pick at least one player.");
    if (!window.confirm(`Send this notification to ${recipients}${sendEmail ? " (with email)" : ""}?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, opsTags: selectedTags, squadId, title, body: msg, href, sendEmail, fromEmail, senderName }),
    });
    const data = (await res.json()) as { ok?: boolean; sent?: number; emailed?: boolean; error?: string };
    setBusy(false);
    if (!res.ok || !data.ok) return setError(data.error || "Couldn't send.");
    setResult(`Sent to ${data.sent} player${data.sent === 1 ? "" : "s"}${data.emailed ? " (emails queued)" : ""}.`);
    setTitle(""); setMsg(""); setHref("");
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}
      {result && <p className="border border-accent bg-accent/10 px-4 py-3 text-sm text-accent">{result}</p>}

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>Recipients</p>
        <div className="flex flex-wrap gap-2">
          {(["all", "player", "squad", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`border px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] ${mode === m ? "border-accent bg-accent text-bg" : "border-border-strong text-text-muted hover:border-accent hover:text-accent"}`}
            >
              {m === "all" ? "Everyone" : m === "player" ? "Players" : m === "squad" ? "A squad" : "Email only (mailing list)"}
            </button>
          ))}
        </div>

        {mode === "player" && (
          <div className="mt-4">
            <label className={lbl}>Players (search ops tags, add as many as you like)</label>
            {selectedTags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedTags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 border border-accent bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                    {t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remove ${t}`} className="text-accent hover:text-text">×</button>
                  </span>
                ))}
              </div>
            )}
            <input className={input} value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="Start typing an ops tag…" />
            {tagQuery.trim() !== "" && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.length === 0 ? (
                  <span className="text-xs text-text-subtle">No matching ops tag.</span>
                ) : (
                  suggestions.map((t) => (
                    <button key={t} type="button" onClick={() => addTag(t)} className="border border-border-strong px-2 py-1 text-xs text-text-muted hover:border-accent hover:text-accent">
                      {t}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
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

        {mode === "email" && (
          <p className="mt-4 border border-border-strong bg-bg px-4 py-3 text-xs text-text-muted">
            Emails <span className="font-bold text-text">{mailingListCount}</span> account{mailingListCount === 1 ? "" : "s"} on your mailing list (opted into email). <span className="text-text-subtle">No bell notification is created.</span>
          </p>
        )}

        {mode === "email" && (
          <div className="mt-4">
            <label className={lbl}>Email template</label>
            <select className={input} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              <option value="admin_broadcast">Custom announcement (your title + message)</option>
              <option value="launch_announcement">Launch announcement (fixed go-live email)</option>
            </select>
            {launchTemplate && <p className="mt-1.5 text-[0.6rem] leading-relaxed text-text-subtle">Uses the fixed launch email. The title, message and link below are ignored - only the subject is used. Preview or edit the copy at Notifications &rarr; Launch announcement.</p>}
          </div>
        )}
      </section>

      <section className="border border-border bg-bg-elevated px-5 py-5 space-y-4">
        {!launchTemplate && <div><label className={lbl}>Title</label><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The new LaserOps site is live" /></div>}
        {mode === "email" && (
          <div><label className={lbl}>Email subject (optional)</label><input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Defaults to the title" /></div>
        )}
        {!launchTemplate && <div><label className={lbl}>Message</label><textarea className={`${input} h-24 py-2`} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Shown under the title." /></div>}
        {!launchTemplate && <div><label className={lbl}>Link (optional)</label><input className={input} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/player-portal/games or https://…" /></div>}
        {mode !== "email" && (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-accent" />
            Also email recipients (uses the Admin announcement email template)
          </label>
        )}
      </section>

      {/* Sender picker - only relevant when an email actually goes out. */}
      {emailWillSend && (
        <section className="border border-border bg-bg-elevated px-5 py-5">
          <p className={lbl}>Send from</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={lbl}>From address</label>
              <input className={input} value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} list="lo-mailboxes" placeholder="name@laseropsmalta.com" />
              <datalist id="lo-mailboxes">
                {mailboxes.map((m) => <option key={m} value={m} />)}
              </datalist>
              {fromErr && <p className="mt-1 text-[0.6rem] text-red-400">{fromErr}</p>}
            </div>
            <div>
              <label className={lbl}>Display name</label>
              <input className={input} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="LaserOps" />
            </div>
          </div>
          <p className="mt-2 text-[0.65rem] text-text-subtle">Recipients see: {senderName.trim() || "LaserOps"} &lt;{fromEmail.trim()}&gt;</p>
        </section>
      )}

      {/* In-app preview: only for bell modes. */}
      {mode !== "email" && (
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
      )}

      {/* Email preview: whenever an email will be sent (not for the fixed launch template). */}
      {emailWillSend && !launchTemplate && (
        <section className="border border-border bg-bg-elevated px-5 py-5">
          <p className={lbl}>Email preview</p>
          <p className="mb-3 text-[0.65rem] text-text-subtle">
            Uses the Admin announcement template (editable under Notifications → Admin announcement). Your title, message and link fill it in.
          </p>
          <iframe title="Email preview" sandbox="" className="h-[30rem] w-full border border-border-strong bg-white" srcDoc={emailPreview} />
        </section>
      )}

      {/* Mailing-list blast needs a typed confirmation. */}
      {mode === "email" && (
        <section className="border border-red-900/60 bg-red-950/20 px-5 py-5">
          <label className={lbl}>Type SEND to confirm the mailing-list blast</label>
          <input className={input} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SEND" />
          <p className="mt-2 text-[0.65rem] text-text-subtle">This emails {mailingListCount} opted-in recipient{mailingListCount === 1 ? "" : "s"} and cannot be recalled.</p>
        </section>
      )}

      <Button type="button" size="md" onClick={send} disabled={busy || Boolean(fromErr)}>
        {busy ? "Sending…" : mode === "email" ? "Send email blast" : "Send notification"}
      </Button>
    </div>
  );
}
