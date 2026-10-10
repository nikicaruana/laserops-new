"use client";

/**
 * components/portal/ProfileManager.tsx
 * --------------------------------------------------------------------
 * Account-management UI for the signed-in player: avatar, ops tag, full
 * name, date of birth (with per-field "show publicly" toggles), and a
 * password section (change if they have one, set if they don't). Stats live
 * on the player-stats page, not here. Saves via /api/profile and
 * /api/profile/password.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarUploader } from "@/components/portal/AvatarUploader";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { MARKETING_CONSENT_TEXT } from "@/lib/waiver";
import { createClient } from "@/lib/supabase/client";

const inputStyles =
  "h-14 w-full rounded-none border border-border bg-bg-overlay px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

type Props = {
  opsTag: string | null;
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  showFullName: boolean;
  showDateOfBirth: boolean;
  marketingOptIn: boolean;
  profilePicUrl: string | null;
  email: string | null;
  hasPassword: boolean;
  /** OAuth/email providers currently linked to this login, e.g. ["email","google"]. */
  linkedProviders: string[];
  /** Photos this player is tagged in – selectable as their avatar. */
  taggedPhotos?: { id: string; url: string }[];
  /** Server-rendered game-token wallet, slotted in above the password section. */
  tokenWallet?: React.ReactNode;
};

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.92v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.92a9 9 0 0 0 0 8.1l3.06-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .92 4.95l3.06 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="portal-card px-5 py-6 sm:px-7">
      <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-accent">{title}</h2>
      {children}
    </section>
  );
}

function VisibilityToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-xs text-text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      {label}
    </label>
  );
}

export function ProfileManager(props: Props) {
  const router = useRouter();

  // Account fields
  const [opsTag, setOpsTag] = useState(props.opsTag ?? "");
  const [fullName, setFullName] = useState(props.fullName ?? "");
  const [phone, setPhone] = useState(props.phone ?? "");
  const [dob, setDob] = useState(props.dateOfBirth ?? "");
  const [showFullName, setShowFullName] = useState(props.showFullName);
  const [showDob, setShowDob] = useState(props.showDateOfBirth);
  const [marketingOptIn, setMarketingOptIn] = useState(props.marketingOptIn);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  // Connected accounts (OAuth identity linking)
  const googleLinked = props.linkedProviders.includes("google");
  // Supabase forbids unlinking the last identity; require a second sign-in
  // method so the player can't lock themselves out.
  const canUnlinkGoogle = googleLinked && props.linkedProviders.length >= 2;
  const [connBusy, setConnBusy] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);

  async function linkGoogle() {
    setConnError(null);
    setConnBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/player-portal/profile`,
      },
    });
    if (error) {
      setConnError(error.message || "Couldn't start the Google connection.");
      setConnBusy(false);
    }
    // On success the browser redirects to Google; nothing more to do here.
  }

  async function unlinkGoogle() {
    setConnError(null);
    setConnBusy(true);
    const supabase = createClient();
    const { data, error: listErr } = await supabase.auth.getUserIdentities();
    if (listErr || !data) {
      setConnError(listErr?.message || "Couldn't load connected accounts.");
      setConnBusy(false);
      return;
    }
    const google = data.identities.find((i) => i.provider === "google");
    if (!google) {
      setConnBusy(false);
      router.refresh();
      return;
    }
    const { error } = await supabase.auth.unlinkIdentity(google);
    setConnBusy(false);
    if (error) {
      setConnError(error.message || "Couldn't disconnect Google.");
      return;
    }
    router.refresh();
  }

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reclaimCode, setReclaimCode] = useState<string | null>(null);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setSavedNotice(false);
    if (fullName.trim().length < 2) {
      setFieldError({ field: "full_name", message: "Please enter your full name." });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ops_tag: opsTag,
        full_name: fullName,
        phone: phone || null,
        date_of_birth: dob || null,
        show_full_name: showFullName,
        show_date_of_birth: showDob,
        marketing_opt_in: marketingOptIn,
      }),
    });
    const data = (await res.json()) as { ok: boolean; field?: string; error?: string };
    setSaving(false);
    if (!data.ok) {
      setFieldError({ field: data.field, message: data.error || "Couldn't save." });
      return;
    }
    setSavedNotice(true);
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwDone(false);
    if (newPw !== confirmPw) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: props.hasPassword ? currentPw : undefined,
        newPassword: newPw,
      }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setPwBusy(false);
    if (!data.ok) {
      setPwError(data.error || "Couldn't update password.");
      return;
    }
    setPwDone(true);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  async function deleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/delete", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string; reclaimCode?: string | null };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't delete account.");
      setDeleting(false);
      if (data.reclaimCode) {
        // Show the key so they can save it before leaving.
        setReclaimCode(data.reclaimCode);
      } else {
        window.location.assign("/");
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete account.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar + identity */}
      <Section title="Photo">
        <div className="flex flex-col items-center gap-4">
          <AvatarUploader initialUrl={props.profilePicUrl} opsTag={props.opsTag} taggedPhotos={props.taggedPhotos ?? []} />
          {props.email && (
            <p className="text-xs text-text-subtle">
              Signed in as <span className="text-text-muted">{props.email}</span>
            </p>
          )}
        </div>
      </Section>

      {/* Account details */}
      <Section title="Account details">
        <form onSubmit={saveAccount} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Ops tag
            </label>
            <input
              value={opsTag}
              onChange={(e) => setOpsTag(e.target.value)}
              maxLength={24}
              placeholder="Your callsign"
              className={inputStyles}
              aria-invalid={fieldError?.field === "ops_tag"}
            />
            <p className="mt-1.5 text-xs text-text-subtle">
              Shown on leaderboards. 3–24 characters. Updates elsewhere after the next stats refresh.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Full name <span className="text-accent">*</span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
              placeholder="Your name"
              className={inputStyles}
            />
            <VisibilityToggle checked={showFullName} onChange={setShowFullName} label="Show on my public profile" />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Phone <span className="text-text-subtle">(optional)</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={32}
              placeholder="e.g. +356 7900 0000"
              className={inputStyles}
            />
            <p className="mt-1.5 text-xs text-text-subtle">So we can reach you about your games. Never shown publicly.</p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Date of birth <span className="text-text-subtle">(optional)</span>
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={inputStyles}
            />
            <VisibilityToggle
              checked={showDob}
              onChange={setShowDob}
              label="Show my birthday (day & month only) on my public profile"
            />
          </div>

          <div className="border-t border-border pt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Emails
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-text-muted">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              <span>{MARKETING_CONSENT_TEXT}</span>
            </label>
          </div>

          {fieldError && (
            <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
              {fieldError.message}
            </p>
          )}
          {savedNotice && (
            <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">Saved.</p>
          )}

          <Button type="submit" size="md" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Section>

      {/* Game-token wallet – slotted above the password section */}
      {props.tokenWallet}

      {/* Password */}
      <Section title={props.hasPassword ? "Change password" : "Set a password"}>
        {!props.hasPassword && (
          <p className="mb-4 text-xs text-text-muted">
            You sign in with Google or a magic link. Set a password to also sign in with your email.
          </p>
        )}
        <form onSubmit={savePassword} className="space-y-4">
          {props.hasPassword && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Current password
              </label>
              <PasswordInput
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              New password
            </label>
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
              Confirm new password
            </label>
            <PasswordInput
              autoComplete="new-password"
              minLength={8}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>

          {pwError && (
            <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">{pwError}</p>
          )}
          {pwDone && (
            <p className="border border-accent bg-bg px-4 py-3 text-sm text-accent">
              Password {props.hasPassword ? "changed" : "set"}.
            </p>
          )}

          <Button type="submit" size="md" disabled={pwBusy}>
            {pwBusy ? "Saving…" : props.hasPassword ? "Change password" : "Set password"}
          </Button>
        </form>
      </Section>

      {/* Connected accounts */}
      <Section title="Connected accounts">
        <p className="mb-4 text-xs text-text-muted">
          Link your Google account to sign in with one tap. Connect or disconnect it anytime.
        </p>
        <div className="flex items-center justify-between gap-4 border border-border-strong bg-bg px-4 py-3.5">
          <div className="flex items-center gap-3">
            <GoogleGlyph />
            <div>
              <p className="text-sm font-semibold text-text">Google</p>
              <p className="text-xs text-text-subtle">
                {googleLinked ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          {googleLinked ? (
            <button
              type="button"
              onClick={unlinkGoogle}
              disabled={connBusy || !canUnlinkGoogle}
              className="border border-border-strong px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connBusy ? "…" : "Disconnect"}
            </button>
          ) : (
            <button
              type="button"
              onClick={linkGoogle}
              disabled={connBusy}
              className="border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
            >
              {connBusy ? "…" : "Connect"}
            </button>
          )}
        </div>
        {googleLinked && !canUnlinkGoogle && (
          <p className="mt-2 text-xs text-text-subtle">
            This is your only sign-in method. Set a password above before disconnecting Google.
          </p>
        )}
        {connError && (
          <p className="mt-3 border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {connError}
          </p>
        )}
      </Section>

      {/* Danger zone */}
      <section className="border border-red-900/60 bg-red-950/10 px-5 py-6 sm:px-7">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-red-400">
          Danger zone
        </h2>
        {reclaimCode ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-text">
              Your account has been deleted. Save this <strong>reclaim key</strong> – it&apos;s the
              only way to restore your stats if you ever come back:
            </p>
            <div className="select-all border border-accent bg-bg px-4 py-4 font-mono text-lg font-bold tracking-widest text-accent">
              {reclaimCode}
            </div>
            <p className="text-xs text-text-subtle">
              We can&apos;t show this again. Store it somewhere safe (a note or password manager).
            </p>
            <Button type="button" size="md" onClick={() => window.location.assign("/")}>
              I&apos;ve saved it – done
            </Button>
          </div>
        ) : !deleteOpen ? (
          <div>
            <p className="mb-4 text-sm text-text-muted">
              Permanently delete your account, profile, and photo.
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="border border-red-800 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-red-400 transition-colors hover:bg-red-950/50"
            >
              Delete account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-red-800 bg-red-950/30 px-4 py-3 text-sm">
              <p className="font-semibold text-red-300">This deletes your account.</p>
              <p className="mt-2 text-red-400/90">
                Your personal details (email, name, photo) and login are permanently removed. Your
                game stats stay in the records but become unclaimed. We&apos;ll give you a reclaim
                key so you can restore them if you ever come back – save it, or they&apos;re gone.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                Type DELETE to confirm
              </label>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                className={inputStyles}
                autoComplete="off"
              />
            </div>
            {deleteError && (
              <p className="border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteText("");
                  setDeleteError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleteText !== "DELETE" || deleting}
                className="h-11 bg-red-700 px-6 text-sm font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sign out */}
      <div className="border-t border-border pt-6 text-center">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle hover:text-accent"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
