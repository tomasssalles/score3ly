import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import { closesOnClick, onCancelEvent, onKeyDown, ownEvent, resultSlot } from "./dialogRules";

// The one dialog of the app (docs/style.md, "Dialogs"): a modal <dialog>, opened when it mounts, with its head (the
// title, named by a `useId` id, and ×) and the content given. Escape, × and a click on the backdrop close it, except
// while `busy` (dialogRules.ts); the content's own Cancel is disabled by the content then.
//
// What it ended with: `handle.close(result)` closes it with a result, which `onClose` gets; closed any other way (Escape,
// ×, the backdrop, `close()` without one), `onClose` gets undefined. Unmounting it doesn't call `onClose`.
export type DialogHandle<R> = {
  ref: React.RefObject<HTMLDialogElement | null>;
  close: (result?: R) => void;
  take: () => R | undefined;
};

export function useDialog<R = never>(): DialogHandle<R> {
  const ref = useRef<HTMLDialogElement>(null);
  return useMemo(() => {
    const slot = resultSlot<R>();
    return {
      ref,
      close(result?: R) {
        slot.set(result);
        // Closing (rather than just disappearing) puts the focus back where it was, e.g. on the button that opened it.
        ref.current?.close();
      },
      take: slot.take,
    };
  }, []);
}

export function Dialog<R>({
  handle,
  title,
  className = "",
  busy = false,
  closeLabel = "Cancel",
  closeIcon = <CloseIcon />,
  onSubmit,
  onClose,
  children,
}: {
  handle: DialogHandle<R>;
  title: ReactNode;
  className?: string;
  busy?: boolean; // a request is on its way: the dialog can't be closed but by `handle.close`
  closeLabel?: string; // ×'s name
  closeIcon?: ReactNode;
  onSubmit?: (e: React.FormEvent) => void; // the content is a form, with the head inside it
  onClose: (result: R | undefined) => void;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    handle.ref.current?.showModal();
  }, [handle]);

  const head = (
    <div className="dialog-head">
      <h2 id={titleId}>{title}</h2>
      <button type="button" className="dialog-close" aria-label={closeLabel} disabled={busy} onClick={() => handle.close()}>
        {closeIcon}
      </button>
    </div>
  );

  return (
    <dialog
      ref={handle.ref}
      className={`app-dialog ${className}`.trim()}
      aria-labelledby={titleId}
      // A nested dialog's (a confirmation's) `cancel` and `close` reach here through React's tree: not this one's.
      onCancel={(e) => ownEvent(e.target, handle.ref.current) && onCancelEvent(busy, e)}
      onKeyDown={(e) => onKeyDown(busy, e)}
      onClose={(e) => ownEvent(e.target, handle.ref.current) && onClose(handle.take())}
      onClick={(e) => closesOnClick(busy, e.target, handle.ref.current) && handle.close()}
    >
      {onSubmit ? (
        <form onSubmit={onSubmit}>
          {head}
          {children}
        </form>
      ) : (
        <>
          {head}
          {children}
        </>
      )}
    </dialog>
  );
}
