// Saving a manual stage's edits (docs/style.md, "Confirmations, saving and undo"; docs/project-view.md, "Saving edits"):
// one saver per stage, kept here rather than in an editor, so that it outlives the editor's pages and the editor
// itself (a page flipped, the editor closed while a save is on its way).
// - Saves go one after the other; for each item (a page, or "" for the whole stage) only its latest value is saved.
// - What this device saved is kept for the session: an editor opened again before the pipeline the app has shows it
//   (the pipeline is fetched again after each save, but may not have come yet).
// - A save that fails keeps its value, marked not saved with the error; it is tried again with the next edit, or by
//   Retry. Finish waits for every save (`settled`) and is refused while one has failed; leaving the editor then asks
//   (`hasUnsaved`, App.tsx), and leaving after all forgets the edits that weren't saved (`discardUnsaved`).
// What doesn't need React is the saver itself; `useSaver` is its hook.

import { useEffect, useRef, useSyncExternalStore } from "react";
import { failure } from "./api.ts";

export type SaverState = {
  saving: boolean; // a save is on its way, or waits
  unsaved: boolean; // a save failed: its edits aren't stored yet
  error: string | null; // why, the Worker's text (null for a change refused as made elsewhere: the dialog says it)
};

type Write = { value: unknown; store: () => Promise<void> };

const IDLE: SaverState = { saving: false, unsaved: false, error: null };

export class StageSaver {
  private saved = new Map<string, unknown>(); // what this device saved, by item
  private waiting = new Map<string, Write>(); // the latest edit of each item not yet saved
  private chain: Promise<void> = Promise.resolve();
  private flushers = new Set<() => void>();
  private listeners = new Set<() => void>();
  state: SaverState = IDLE;

  // Saves `value` as the item's latest, by `store`, after the saves before it. A failed save waiting is tried again.
  save(item: string, value: unknown, store: () => Promise<void>): void {
    this.waiting.set(item, { value, store });
    this.set({ ...this.state, saving: true });
    this.run();
  }

  // Tries the failed saves again.
  retry(): void {
    if (this.waiting.size === 0) return;
    this.set({ ...this.state, saving: true });
    this.run();
  }

  // The item's latest value on this device: not saved yet, or saved and perhaps not yet in the app's pipeline.
  value<T>(item: string): T | undefined {
    return (this.waiting.get(item)?.value ?? this.saved.get(item)) as T | undefined;
  }

  // Something the editor holds back to save later (text being typed): `flush` saves it now. Returns the removal.
  holding(flush: () => void): () => void {
    this.flushers.add(flush);
    return () => this.flushers.delete(flush);
  }

  // Waits for every save, the held back ones sent first. True if everything is saved.
  async settled(): Promise<boolean> {
    for (const flush of this.flushers) flush();
    let chain: Promise<void>;
    do {
      chain = this.chain;
      await chain;
    } while (chain !== this.chain);
    return this.waiting.size === 0;
  }

  // Forgets the edits that couldn't be saved (the user left the editor after being asked).
  discard(): void {
    if (!this.state.unsaved) return;
    this.waiting.clear();
    this.set(IDLE);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(state: SaverState) {
    this.state = state;
    for (const listener of this.listeners) listener();
    notifyAll();
  }

  private run() {
    this.chain = this.chain.then(() => this.drain());
  }

  // Saves what waits, in the order the items were first edited; stops at a failure, keeping it and the rest.
  private async drain() {
    if (this.waiting.size === 0) return;
    for (const [item, write] of [...this.waiting]) {
      try {
        await write.store();
      } catch (err) {
        this.set({ saving: false, unsaved: true, error: failure(null, err) });
        return;
      }
      this.saved.set(item, write.value);
      if (this.waiting.get(item) === write) this.waiting.delete(item);
    }
    if (this.waiting.size === 0) this.set(IDLE);
  }
}

const savers = new Map<string, StageSaver>();
const anyListeners = new Set<() => void>();

function notifyAll() {
  for (const listener of anyListeners) listener();
}

export function saverOf(stageId: string): StageSaver {
  let saver = savers.get(stageId);
  if (!saver) savers.set(stageId, (saver = new StageSaver()));
  return saver;
}

// Finish's wait: every save of the stage done. False if one failed.
export function settled(stageId: string): Promise<boolean> {
  return savers.get(stageId)?.settled() ?? Promise.resolve(true);
}

// Whether an edit failed to save, in any stage.
export function hasUnsaved(): boolean {
  return [...savers.values()].some((s) => s.state.unsaved);
}

export function discardUnsaved(): void {
  for (const saver of savers.values()) saver.discard();
}

// Hears when any stage's saving changes (for the question before leaving).
export function onSavingChange(listener: () => void): () => void {
  anyListeners.add(listener);
  return () => anyListeners.delete(listener);
}

// While an edit isn't saved, closing or reloading the tab asks first (the browser's own text).
function warn(event: BeforeUnloadEvent) {
  if (!hasUnsaved()) return;
  event.preventDefault();
  event.returnValue = "";
}
globalThis.addEventListener?.("beforeunload", warn as EventListener);

// When a form's list is loaded again (fieldList.tsx): a form being edited once per stage (its own saves change the document's hash, and
// reading them back would replace the rows, a row being typed included); a view whenever its document changes.
export function loadKey(source: { sha256: string }, form: { stageId: string } | null): string {
  return form ? `form ${form.stageId}` : `view ${source.sha256}`;
}

// The stage's saver, and its state as it changes. `onSaved` (the pipeline fetched again) runs after each save.
export function useSaver(stageId: string, onSaved?: () => void) {
  const saver = saverOf(stageId);
  const state = useSyncExternalStore(
    (listener) => saver.subscribe(listener),
    () => saver.state,
  );
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  return {
    state,
    value: <T,>(item: string) => saver.value<T>(item),
    save: (item: string, value: unknown, store: () => Promise<void>) =>
      saver.save(item, value, async () => {
        await store();
        onSavedRef.current?.();
      }),
    retry: () => saver.retry(),
    saver,
  };
}

// While mounted, `flush` is how the stage's saver gets what the editor holds back (Finish, leaving).
export function useHolding(stageId: string, flush: () => void) {
  const latest = useRef(flush);
  latest.current = flush;
  useEffect(() => saverOf(stageId).holding(() => latest.current()), [stageId]);
}
