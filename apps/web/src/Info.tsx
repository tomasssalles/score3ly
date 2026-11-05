import { useState } from "react";
import { InfoIcon } from "./icons";

// An "i" that shows and hides a short explanation on a line of its own below (docs/style.md).
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="reason-toggle" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(!open)}>
        <InfoIcon />
      </button>
      {open && <span className="info-text">{children}</span>}
    </>
  );
}
