import { type ReactNode, useState } from "react";
import { InfoIcon } from "../icons";

// The "i" (docs/style.md): a button that shows and hides a short explanation. Inline (a form's field, an issue's
// answer): a small toggle in the text; `block` (the head of a statistics block, a line of costs): an icon button, its
// explanation a block of its own under the line. `title` where the tooltip says less than the name.
export function InfoButton({ open, onToggle, label, title = label, block = false }: { open: boolean; onToggle: () => void; label: string; title?: string; block?: boolean }) {
  return (
    <button type="button" className={block ? "icon-button stat-info" : "reason-toggle"} aria-expanded={open} aria-label={label} title={title} onClick={onToggle}>
      <InfoIcon />
    </button>
  );
}

// An "i" that shows and hides a short explanation on a line of its own below.
export function Info({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <InfoButton open={open} onToggle={() => setOpen(!open)} label={label} />
      {open && <span className="info-text">{children}</span>}
    </>
  );
}
