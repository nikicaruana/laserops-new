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

const inputStyles =
  "h-14 w-full rounded-none border border-border-strong bg-bg-elevated px-4 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none";

type Props = {
  opsTag: string | null;
  fullName: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  showFullName: boolean;
  showDateOfBirth: boolean;
  marketingOptIn: boolean;
  profilePicUrl: string | null;
  email: string | null;
  hasPassword: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-bg-elevated px-5 py-6 sm:px-7">
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
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ops_tag: opsTag,
        full_name: fullName,
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
          <AvatarUploader initialUrl={props.profilePicUrl} opsTag={props.opsTag} />
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
              Full name <span className="text-text-subtle">(optional)</span>
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

      {/* Danger zone */}
      <section className="border border-red-900/60 bg-red-950/10 px-5 py-6 sm:px-7">
        <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.12em] text-red-400">
          Danger zone
        </h2>
        {reclaimCode ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-text">
              Your account has been deleted. Save this <strong>reclaim key</strong> — it&apos;s the
              only way to restore your stats if you ever come back:
            </p>
            <div className="select-all border border-accent bg-bg px-4 py-4 font-mono text-lg font-bold tracking-widest text-accent">
              {reclaimCode}
            </div>
            <p className="text-xs text-text-subtle">
              We can&apos;t show this again. Store it somewhere safe (a note or password manager).
            </p>
            <Button type="button" size="md" onClick={() => window.location.assign("/")}>
              I&apos;ve saved it — done
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
                key so you can restore them if you ever come back — save it, or they&apos;re gone.
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
