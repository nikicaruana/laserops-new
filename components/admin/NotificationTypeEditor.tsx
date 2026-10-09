"use client";

/**
 * components/admin/NotificationTypeEditor.tsx
 * --------------------------------------------------------------------
 * Edit one notification type: label/description (admin-only), priority, active,
 * the IN-APP BELL copy (title + body), whether it also emails (subject + HTML),
 * whether it pushes, and an optional delay. Bell + email copy both support the
 * {{token}} system ({{title}}/{{body}} = the auto-generated default, {{nickname}},
 * {{matchLabel}}, ...), substituted when the notification fires. Saving any change
 * requires a 2FA (TOTP) step-up, enforced by the aal2 RLS policy.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TotpGate } from "@/components/admin/TotpGate";
import { createClient } from "@/lib/supabase/client";
import { renderEmailTemplate, sampleEmailTokens, TOKEN_REFERENCE, type EmailConfig } from "@/lib/email-tokens";
import { senderDomainError } from "@/lib/email-domains";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export type NotificationType = {
  key: string;
  label: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  bell_title: string | null;
  bell_body: string | null;
  sends_email: boolean;
  email_subject: string | null;
  email_html: string | null;
  sends_push: boolean;
  delay_hours: number;
  email_from: string | null;
  email_sender_name: string | null;
  email_reply_to: string | null;
};

export function NotificationTypeEditor({ initial, config }: { initial: NotificationType; config: EmailConfig }) {
  const router = useRouter();
  const [f, setF] = useState<NotificationType>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  const set = <K extends keyof NotificationType>(k: K, v: NotificationType[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  // Live email preview: every supported token filled with sample content.
  const sample = sampleEmailTokens(config);
  const emailPreview = renderEmailTemplate(f.email_html ?? "", {
    ...sample,
    title: f.label || sample.title,
    body: f.description || sample.body,
  });

  // Bell preview: render the bell templates against sample tokens.
  const bellSample: Record<string, string> = {
    nickname: "Kini", opsTag: "Kini",
    title: "Auto-generated title", body: "Auto-generated message",
    matchLabel: "LO-2026-10", matchDate: "Sat, 13 Sep 2026", matchTime: "14:00", matchTimeRange: "14:00 - 17:00",
  };
  const bellTitlePreview = renderEmailTemplate(f.bell_title ?? "", bellSample);
  const bellBodyPreview = renderEmailTemplate(f.bell_body ?? "", bellSample);
  const fromErr = f.sends_email ? senderDomainError(f.email_from) : null;

  async function doSave() {
    if (fromErr) { setError(fromErr); return; }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("notification_types")
      .update({
        label: f.label.trim(),
        description: f.description?.trim() || null,
        priority: Number(f.priority) || 3,
        is_active: f.is_active,
        bell_title: f.bell_title?.trim() || null,
        bell_body: f.bell_body?.trim() || null,
        sends_email: f.sends_email,
        email_subject: f.email_subject?.trim() || null,
        email_html: f.email_html || null,
        email_from: f.email_from?.trim() || null,
        email_sender_name: f.email_sender_name?.trim() || null,
        email_reply_to: f.email_reply_to?.trim() || null,
        sends_push: f.sends_push,
        delay_hours: Math.max(0, Number(f.delay_hours) || 0),
      })
      .eq("key", f.key);
    setBusy(false);
    if (err) return setError(err.message);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="max-w-4xl space-y-6">
      {error && <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</p>}

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>Notification</p>
        <p className="mb-4 font-mono text-[0.65rem] text-text-subtle">{f.key}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={lbl}>Label (admin only)</label><input className={input} value={f.label} onChange={(e) => set("label", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Description (admin only)</label><input className={input} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Internal note about when this fires" /></div>
          <div><label className={lbl}>Priority (1 = top)</label><input type="number" min="1" className={input} value={f.priority} onChange={(e) => set("priority", Number(e.target.value))} /></div>
          <div><label className={lbl}>Delay (hours, 0 = immediate)</label><input type="number" min="0" className={input} value={f.delay_hours} onChange={(e) => set("delay_hours", Number(e.target.value))} /></div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text sm:col-span-2">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 accent-accent" />
            Active (this notification is sent)
          </label>
        </div>
      </section>

      {/* In-app bell copy (what the player sees in their notification bell). */}
      <section className="border border-border bg-bg-elevated px-5 py-5">
        <p className={lbl}>In-app bell</p>
        <p className="mb-4 text-[0.6rem] leading-relaxed text-text-subtle">
          What the player sees in their notification bell. Use <code className="text-text-muted">{"{{title}}"}</code> /
          <code className="text-text-muted"> {"{{body}}"}</code> to keep the auto-generated text, or write your own
          (tokens like <code className="text-text-muted">{"{{nickname}}"}</code>, <code className="text-text-muted">{"{{matchLabel}}"}</code> are filled when it fires). Leave a field blank to fall back to the built-in text.
        </p>
        <div className="grid gap-4">
          <div><label className={lbl}>Bell title</label><input className={input} value={f.bell_title ?? ""} onChange={(e) => set("bell_title", e.target.value)} /></div>
          <div><label className={lbl}>Bell message</label><textarea className={`${input} h-20 py-2`} value={f.bell_body ?? ""} onChange={(e) => set("bell_body", e.target.value)} /></div>
          <div>
            <label className={lbl}>Preview</label>
            <div className="w-72 max-w-full border border-border-strong bg-bg">
              <div className="border-b border-border px-4 py-2.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-text-muted">Notifications</div>
              <div className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-text">{bellTitlePreview || "(empty - uses built-in title)"}</span>
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">{bellBodyPreview || "(empty - uses built-in message)"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-text">
          <input type="checkbox" checked={f.sends_email} onChange={(e) => set("sends_email", e.target.checked)} className="h-4 w-4 accent-accent" />
          Also send an email
        </label>
        {f.sends_email && (
          <div className="mt-4 grid gap-4">
            <div><label className={lbl}>Email subject</label><input className={input} value={f.email_subject ?? ""} onChange={(e) => set("email_subject", e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={lbl}>From email</label><input className={`${input} ${fromErr ? "border-red-500" : ""}`} value={f.email_from ?? ""} onChange={(e) => set("email_from", e.target.value)} placeholder={config.fromEmail || "scores@laseropsmalta.com"} />{fromErr && <p className="mt-1 text-[0.6rem] text-red-400">{fromErr}</p>}</div>
              <div><label className={lbl}>Sender name</label><input className={input} value={f.email_sender_name ?? ""} onChange={(e) => set("email_sender_name", e.target.value)} placeholder={config.senderName || "LaserOps"} /></div>
              <div><label className={lbl}>Reply-to email</label><input className={input} value={f.email_reply_to ?? ""} onChange={(e) => set("email_reply_to", e.target.value)} placeholder={config.replyToEmail || "scores@laseropsmalta.com"} /></div>
            </div>
            <p className="-mt-2 text-[0.6rem] text-text-subtle">Leave any blank to use the global default from Email settings.</p>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Email HTML</label>
                <textarea
                  className={`${input} h-80 py-2 font-mono text-xs leading-relaxed`}
                  value={f.email_html ?? ""}
                  onChange={(e) => set("email_html", e.target.value)}
                  spellCheck={false}
                />
                <details className="mt-2">
                  <summary className="cursor-pointer text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-subtle hover:text-accent">Available tokens (click)</summary>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {TOKEN_REFERENCE.map((t) => (
                      <li key={t.token} className="text-[0.65rem] text-text-subtle">
                        <code className="text-text-muted">{`{{${t.token}}}`}</code>: {t.desc}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[0.6rem] text-text-subtle">Match-specific tokens (matchId, matchReportUrl) are filled per email when that notification is fired.</p>
                </details>
              </div>
              <div>
                <label className={lbl}>Preview (with sample content)</label>
                <iframe
                  title="Email preview"
                  sandbox=""
                  className="h-[40rem] w-full border border-border-strong bg-white"
                  srcDoc={emailPreview}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="border border-border bg-bg-elevated px-5 py-5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-text">
          <input type="checkbox" checked={f.sends_push} onChange={(e) => set("sends_push", e.target.checked)} className="h-4 w-4 accent-accent" />
          Also send a push notification
        </label>
        <p className="mt-1.5 text-[0.65rem] text-text-subtle">Push delivery is a later phase; this flag is stored ready for it.</p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="button" size="md" onClick={() => { setError(null); setGateOpen(true); }} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        {saved && <span className="text-xs text-accent">Saved.</span>}
        <span className="text-[0.6rem] text-text-subtle">Saving requires a 2FA code.</span>
      </div>

      <TotpGate
        open={gateOpen}
        action="this notification change"
        onCancel={() => setGateOpen(false)}
        onVerified={async () => { setGateOpen(false); await doSave(); }}
      />
    </div>
  );
}
