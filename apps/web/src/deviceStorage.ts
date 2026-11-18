// What this device remembers (docs/database.md, "Two kinds of settings": the device's, in the browser): conveniences
// kept in the browser's localStorage, every key listed here once (the screenshots set two of them, scripts/screenshots.ts).
// Storage may be missing or refuse (some private windows, a Web Worker): a read then gives nothing, and a write is lost,
// so what is chosen applies until the page is reloaded.

import { useState } from "react";

export const DEVICE_KEYS = {
  theme: "score3ly.theme", // themes.ts
  imageCacheMb: "score3ly.imageCacheMB", // cacheLru.ts
  pipelinePanelCollapsed: "pipelinePanelCollapsed", // ProjectView
  transcriptionView: "score3ly.transcription.view", // ExtractionView: rendered or raw
  transcriptionBoxes: "score3ly.transcription.boxes", // ExtractionView: the boxes of issues and warnings
  fixLayoutMarks: "score3ly.fixLayout.marks", // LayoutEditor
  meiScore: "score3ly.mei.score", // MeiWorkspace
} as const;

export type DeviceKey = (typeof DEVICE_KEYS)[keyof typeof DEVICE_KEYS];

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// The browser's storage; reading `localStorage` itself can throw.
const browserStore = (): Store | undefined => globalThis.localStorage;

// The value kept under `key`, or null (none, or no storage).
export function readDevice(key: DeviceKey, store: () => Store | undefined = browserStore): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// Keeps `value` under `key` (null removes it); whether it was kept.
export function writeDevice(key: DeviceKey, value: string | null, store: () => Store | undefined = browserStore): boolean {
  try {
    const s = store();
    if (!s) return false;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// The value kept under `key` if it is one of `values`, else `initial`.
export function rememberedValue<T extends string>(key: DeviceKey, initial: T, values: readonly T[], store?: () => Store | undefined): T {
  const stored = readDevice(key, store) as T | null;
  return stored !== null && values.includes(stored) ? stored : initial;
}

// A toggle remembered on this device: the Transcription's view and boxes, the layout editor's marks, the MEI view's score.
export function useRemembered<T extends string>(key: DeviceKey, initial: T, values: readonly T[]): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => rememberedValue(key, initial, values));
  const set = (v: T) => {
    setValue(v);
    writeDevice(key, v);
  };
  return [value, set];
}
