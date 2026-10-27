// Keeping the screen on while this device runs a stage (docs/tasks.md, the browser's Screen Wake Lock): the browser
// drives the pipeline, so a phone that goes to sleep pauses the run. The browser drops the lock whenever the page is
// hidden (another tab or app), so it is asked for again each time the page comes back. Where the API is missing or
// refuses (e.g. low battery), nothing else changes.

import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let asking = false;
    let done = false;
    const request = () => {
      if (asking || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      asking = true;
      navigator.wakeLock
        .request("screen")
        .then(
          (sentinel) => {
            if (done) sentinel.release().catch(() => {});
            else lock = sentinel;
          },
          () => {}, // refused: the screen may sleep
        )
        .finally(() => {
          asking = false;
        });
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
