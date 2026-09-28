"use client";

/**
 * components/portal/FollowButton.tsx
 * --------------------------------------------------------------------
 * Self-contained follow / unfollow control. Given just an ops tag it loads its
 * own state (player_social RPC): renders nothing if the viewer is signed out,
 * is viewing themselves, or the ops tag has no account. Otherwise toggles
 * follow_player / unfollow_player. Droppable on any profile surface.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({ opsTag, className = "", size = "md" }: { opsTag: string; className?: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) return setShow(false);
      const { data } = await supabase.rpc("player_social", { p_ops_tag: opsTag });
      if (!active) return;
      const s = ((data ?? []) as { account_id: string | null; is_following: boolean; is_self: boolean }[])[0];
      if (s && s.account_id && !s.is_self) {
        setShow(true);
        setFollowing(Boolean(s.is_following));
      } else {
        setShow(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [opsTag]);

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc(following ? "unfollow_player" : "follow_player", { p_ops_tag: opsTag });
    setBusy(false);
    if (err) return setError(err.message);
    setFollowing((f) => !f);
    router.refresh();
  }

  if (!show) return null;

  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`${size === "sm" ? "h-7 px-3 text-[0.6rem]" : "h-9 px-5 text-xs"} border font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
          following
            ? "border-border-strong text-text-muted hover:border-red-500 hover:text-red-400"
            : "border-accent bg-accent text-bg hover:bg-accent-soft"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
      {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
    </span>
  );
}
