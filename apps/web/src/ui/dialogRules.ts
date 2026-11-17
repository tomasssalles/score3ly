// What every dialog does with a request to close it (docs/style.md, "Dialogs"), apart from React, so that it can be
// tested: Escape, ×, a click on the backdrop and Cancel close it, except while it is busy (deleting, saving, exporting):
// closing then would lose what the request ends with, its refusal or the step that follows it (review F2: Escape while a
// project was being deleted left the app on the deleted project).

type Cancellable = { preventDefault(): void };

// The dialog's `cancel` event (Escape, or the browser's own close request): refused while busy.
export function onCancelEvent(busy: boolean, event: Cancellable): void {
  if (busy) event.preventDefault();
}

// A key pressed in the dialog. Escape's default action is the close request: refused here too while busy, since the
// browser may fire a `cancel` that can't be refused (Chromium's, for a second Escape without a click in between).
export function onKeyDown(busy: boolean, event: Cancellable & { key: string }): void {
  if (busy && event.key === "Escape") event.preventDefault();
}

// Whether an event is the dialog's own. React passes a nested dialog's `close` and `cancel` on to the dialogs around it in
// its tree, although the browser doesn't: cancelling the confirmation inside "Clone model config" closed the form too
// (found 2026-11-17).
export function ownEvent(target: unknown, dialog: unknown): boolean {
  return dialog != null && target === dialog;
}

// Whether a click closes the dialog: one on the backdrop lands on the dialog element itself; not while busy.
export function closesOnClick(busy: boolean, target: unknown, dialog: unknown): boolean {
  return !busy && dialog != null && target === dialog;
}

// What the dialog ended with: set by the action that closes it, read once by the dialog's `close` handler. Nothing set
// means it was closed without one (cancelled).
export function resultSlot<R>() {
  let result: R | undefined;
  return {
    set(value: R | undefined) {
      result = value;
    },
    take(): R | undefined {
      const value = result;
      result = undefined;
      return value;
    },
  };
}
