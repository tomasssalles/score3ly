// The toasts about the pipeline as the project view shows them (docs/project-view.md, "Progress"; what they say: toasts.ts):
// the events of a moment gathered into one toast, shown for a while, and none for a while after the user's own change.

import { useEffect, useRef, useState } from "react";
import { eventsBetween, toastText, type Segment, type Snapshot, type ToastEvent } from "./toasts";

// The events of this moment make one toast; it shows this long; the user's own changes make none for this long (what
// follows from them is what they asked for).
const GATHER_MS = 500;
const TOAST_MS = 4000;
const QUIET_MS = 3000;

export type QuietTime = {
  quiet: () => void; // the user changed something: no toasts for a while
  isQuiet: () => boolean;
};

// The quiet time after the user's own changes: kept apart from the toasts, since the run controller marks it too, and
// the toasts read the pipeline that its run makes.
export function useQuietTime(): QuietTime {
  const until = useRef(0);
  const time = useRef<QuietTime | null>(null);
  time.current ??= {
    quiet: () => {
      until.current = Date.now() + QUIET_MS;
    },
    isQuiet: () => Date.now() < until.current,
  };
  return time.current;
}

export type Toast = { key: number; text: Segment[] };

// The toast to show, or null. `snapshot` is the pipeline's (null while it loads); toasts are made only while `covered`
// (narrow mode, an artifact or a stage's details over the pipeline), outside the quiet time (`useQuietTime`).
export function useToasts(snapshot: Snapshot | null, covered: boolean, isQuiet: () => boolean): Toast | null {
  const coveredRef = useRef(covered);
  coveredRef.current = covered;
  const [toast, setToast] = useState<Toast | null>(null);
  const seen = useRef<Snapshot | null>(null);
  const gathered = useRef<ToastEvent[]>([]);
  const gathering = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotKey = JSON.stringify(snapshot);
  useEffect(() => {
    const before = seen.current;
    seen.current = snapshot;
    if (!before || !snapshot) return;
    const events = eventsBetween(before, snapshot);
    if (events.length === 0 || isQuiet()) return;
    gathered.current.push(...events);
    if (gathering.current) clearTimeout(gathering.current);
    gathering.current = setTimeout(() => {
      const text = toastText(gathered.current);
      gathered.current = [];
      gathering.current = null;
      if (text && coveredRef.current && !isQuiet()) setToast({ key: Date.now(), text });
    }, GATHER_MS);
  }, [snapshotKey]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => {
    if (gathering.current) clearTimeout(gathering.current);
  }, []);
  return toast;
}
