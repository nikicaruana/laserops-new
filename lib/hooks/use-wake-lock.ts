import { useEffect } from "react";

/**
 * useWakeLock — keep the device screen on while this component is mounted
 * (Screen Wake Lock API). The lock is dropped by the browser when the tab is
 * hidden, so we re-acquire it whenever the page becomes visible again. Safe
 * no-op where unsupported (older browsers / insecure origins).
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: { release: () => Promise<void>; released?: boolean } | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sentinel = await (navigator as any).wakeLock.request("screen");
      } catch {
        // Denied (page not visible, low battery, unsupported) — ignore.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !cancelled) void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) void sentinel.release().catch(() => {});
    };
  }, [enabled]);
}
