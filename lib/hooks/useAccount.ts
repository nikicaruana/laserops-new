"use client";

/**
 * lib/hooks/useAccount.ts
 * --------------------------------------------------------------------
 * Client hook that reports the current player's sign-in state + a little
 * display info (ops_tag, avatar). Reading this in the browser (rather than
 * server-side in the root layout) keeps the marketing pages statically
 * cacheable. Re-fetches on any auth change (this tab or another).
 *
 * For anonymous visitors getUser() short-circuits with no network call, so
 * this is cheap on public pages.
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AccountState = {
  loading: boolean;
  signedIn: boolean;
  opsTag: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const EMPTY: AccountState = {
  loading: false,
  signedIn: false,
  opsTag: null,
  email: null,
  avatarUrl: null,
};

export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({ ...EMPTY, loading: true });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        setState(EMPTY);
        return;
      }

      const { data: account } = await supabase
        .from("accounts")
        .select("ops_tag, profile_pic_url")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!active) return;

      setState({
        loading: false,
        signedIn: true,
        opsTag: account?.ops_tag ?? null,
        email: user.email ?? null,
        avatarUrl: account?.profile_pic_url ?? null,
      });
    }

    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

/** 1:1 Cloudinary delivery transform for avatar thumbnails. */
export function avatarThumb(url: string, w = 64): string {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/c_fill,ar_1:1,g_auto,w_${w},q_auto,f_auto/`);
}
