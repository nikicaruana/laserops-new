"use client";

/**
 * components/admin/HomeHeroEditor.tsx
 * --------------------------------------------------------------------
 * Edits the home hero section (home_config): headline + accent, subhead, the
 * Google-reviews badge, the two CTAs, and the three stat tiles. Saves through
 * the admin-gated admin_set_home_config RPC. Marketing copy, so no 2FA step-up
 * (unlike pricing) – just admin RLS on the table + the RPC guard.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import type { HomeHeroConfig } from "@/lib/cms/home-config";

const input =
  "h-11 w-full rounded-none border border-border-strong bg-bg-elevated px-3 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const area =
  "min-h-[88px] w-full rounded-none border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-text-muted";
const card = "mb-6 border border-border bg-bg-elevated p-5 sm:p-6";
const cardH = "mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-accent";

export function HomeHeroEditor({ initial }: { initial: HomeHeroConfig }) {
  const router = useRouter();
  const supabase = createClient();

  const s0 = initial.stats[0] ?? { value: "", label: "" };
  const s1 = initial.stats[1] ?? { value: "", label: "" };
  const s2 = initial.stats[2] ?? { value: "", label: "" };

  const [f, setF] = useState({
    lead: initial.lead,
    highlight: initial.highlight,
    subhead: initial.subhead,
    rating: initial.rating,
    reviewsLabel: initial.reviewsLabel,
    reviewsUrl: initial.reviewsUrl,
    ctaPrimaryLabel: initial.ctaPrimaryLabel,
    ctaPrimaryHref: initial.ctaPrimaryHref,
    ctaSecondaryLabel: initial.ctaSecondaryLabel,
    ctaSecondaryHref: initial.ctaSecondaryHref,
    stat1Value: s0.value,
    stat1Label: s0.label,
    stat2Value: s1.value,
    stat2Label: s1.label,
    stat3Value: s2.value,
    stat3Label: s2.label,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("admin_set_home_config", {
      p_hero_lead: f.lead,
      p_hero_highlight: f.highlight,
      p_hero_subhead: f.subhead,
      p_hero_rating: f.rating,
      p_hero_reviews_label: f.reviewsLabel,
      p_hero_reviews_url: f.reviewsUrl,
      p_cta_primary_label: f.ctaPrimaryLabel,
      p_cta_primary_href: f.ctaPrimaryHref,
      p_cta_secondary_label: f.ctaSecondaryLabel,
      p_cta_secondary_href: f.ctaSecondaryHref,
      p_stat1_value: f.stat1Value,
      p_stat1_label: f.stat1Label,
      p_stat2_value: f.stat2Value,
      p_stat2_label: f.stat2Label,
      p_stat3_value: f.stat3Value,
      p_stat3_label: f.stat3Label,
    });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({ ok: true, text: "Saved. The homepage updates within a minute (ISR)." });
    router.refresh();
  }

  return (
    <div>
      {/* Headline */}
      <section className={card}>
        <h2 className={cardH}>Headline</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Lead (white)</label>
            <input className={input} value={f.lead} onChange={set("lead")} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Accent (yellow)</label>
            <input className={input} value={f.highlight} onChange={set("highlight")} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Subhead</label>
            <textarea className={area} value={f.subhead} onChange={set("subhead")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-text-subtle">
          Renders as: <span className="text-text">{f.lead}</span>{" "}
          <span className="text-accent">{f.highlight}</span>
        </p>
      </section>

      {/* Google reviews badge */}
      <section className={card}>
        <h2 className={cardH}>Google reviews badge</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Rating</label>
            <input className={input} value={f.rating} onChange={set("rating")} placeholder="5.0" />
          </div>
          <div>
            <label className={labelCls}>Label</label>
            <input className={input} value={f.reviewsLabel} onChange={set("reviewsLabel")} placeholder="on Google Reviews" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Reviews link (URL)</label>
            <input className={input} value={f.reviewsUrl} onChange={set("reviewsUrl")} />
          </div>
        </div>
      </section>

      {/* CTAs */}
      <section className={card}>
        <h2 className={cardH}>Call-to-action buttons</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="rounded-none border border-border p-4">
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Primary (filled)</p>
            <label className={labelCls}>Label</label>
            <input className={input} value={f.ctaPrimaryLabel} onChange={set("ctaPrimaryLabel")} />
            <label className={`${labelCls} mt-3`}>Link</label>
            <input className={input} value={f.ctaPrimaryHref} onChange={set("ctaPrimaryHref")} />
          </div>
          <div className="rounded-none border border-border p-4">
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Secondary (outline)</p>
            <label className={labelCls}>Label</label>
            <input className={input} value={f.ctaSecondaryLabel} onChange={set("ctaSecondaryLabel")} />
            <label className={`${labelCls} mt-3`}>Link</label>
            <input className={input} value={f.ctaSecondaryHref} onChange={set("ctaSecondaryHref")} />
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-xs text-text-subtle">
          The primary button stays the booking action (revenue). The secondary defaults to a free-profile sign-up
          (<code>/player-portal/login</code>) – a lower-friction entry for new visitors than the leaderboards. Change
          either here anytime. (The top-nav &ldquo;Book a Game&rdquo; button is separate and unaffected.)
        </p>
      </section>

      {/* Stat tiles */}
      <section className={card}>
        <h2 className={cardH}>Stat tiles (desktop)</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {([
            ["stat1Value", "stat1Label"],
            ["stat2Value", "stat2Label"],
            ["stat3Value", "stat3Label"],
          ] as const).map(([vk, lk], i) => (
            <div key={vk} className="rounded-none border border-border p-4">
              <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-text-subtle">Tile {i + 1}</p>
              <label className={labelCls}>Value</label>
              <input className={input} value={f[vk]} onChange={set(vk)} />
              <label className={`${labelCls} mt-3`}>Label</label>
              <input className={input} value={f[lk]} onChange={set(lk)} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-subtle">Leave a tile&rsquo;s value and label both blank to hide it.</p>
      </section>

      <div className="flex items-center gap-4">
        <Button variant="primary" size="md" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save homepage"}
        </Button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
