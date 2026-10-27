// Undo and redo for a tool for manual work (docs/overview.md §5.4): the states something went through while the tool is
// open. A new state after an undo drops what could have been redone.

export type History<T> = { past: T[]; present: T; future: T[] };

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function pushState<T>(history: History<T>, next: T): History<T> {
  return { past: [...history.past, history.present], present: next, future: [] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

// The history one step back; unchanged when there is nothing to undo.
export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

// The history one step forward again; unchanged when there is nothing to redo.
export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
