"use client";

/**
 * components/admin/NotificationTypeEditor.tsx
 * --------------------------------------------------------------------
 * Edit one notification type: label/description, priority, active, whether it
 * also emails (with subject + HTML template), whether it pushes, and an optional
 * delay. Email HTML supports {{title}}, {{body}}, {{link}} tokens, substituted
 * when the email is sent. Saves to notification_types (admin RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { renderEmailTemplate, sampleEmailTokens, TOKEN_REFERENCE, type EmailConfig } from "@/lib/email-tokens";

const input = "h-11 w-full rounded-none border border-border-strong bg-bg px-3 text-sm text-text focus:border-accent focus:outline-none";
const lbl = "mb-1.5 block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted";

export type NotificationType = {
  key: string;
  label: string;
  description: string | null;
  priority: number;
  is_active: boolean;
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

  const set = <K extends keyof NotificationType>(k: K, v: NotificationType[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  // Live preview: every supported token filled with sample content so the admin
  // sees the real layout (nickname, matchId, brand links, etc.).
  const sample = sampleEmailTokens(config);
  const emailPreview = renderEmailTemplate(f.email_html ?? "", {
    ...sample,
    title: f.label || sample.title,
    body: f.description || sample.body,
  });

  async function save() {
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
          <div className="sm:col-span-2"><label className={lbl}>Label</label><input className={input} value={f.label} onChange={(e) => set("label", e.target.value)} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Description</label><input className={input} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Internal note about when this fires" /></div>
          <div><label className={lbl}>Priority (1 = top)</label><input type="number" min="1" className={input} value={f.priority} onChange={(e) => set("priority", Number(e.target.value))} /></div>
          <div><label className={lbl}>Delay (hours, 0 = immediate)</label><input type="number" min="0" className={input} value={f.delay_hours} onChange={(e) => set("delay_hours", Number(e.target.value))} /></div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text sm:col-span-2">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} className="h-4 w-4 accent-accent" />
            Active (this notification is sent)
          </label>
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
              <div><label className={lbl}>From email</label><input className={input} value={f.email_from ?? ""} onChange={(e) => set("email_from", e.target.value)} placeholder={config.fromEmail || "scores@laseropsmalta.com"} /></div>
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
        <Button type="button" size="md" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        {saved && <span className="text-xs text-accent">Saved.</span>}
      </div>
    </div>
  );
}
