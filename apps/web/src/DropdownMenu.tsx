import { type ReactNode, useEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  href?: string; // a link, or else a button that calls onSelect
  onSelect?: () => void;
  current?: boolean; // the page that is open, or the choice that is set
  danger?: boolean; // shown in red, e.g. deleting something
};

// A button that opens a short menu of items, in groups separated by a line. Closes on a pick, on Esc, and on a
// tap or click outside. The arrow keys move between the items.
export function DropdownMenu({
  icon,
  label,
  groups,
  className = "",
  buttonClassName = "icon-button",
}: {
  icon: ReactNode; // the button's content: an icon, or e.g. the current choice and a chevron
  label: string; // the button's accessible name
  groups: MenuItem[][];
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const items = () => [...(list.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      all[(i + 1) % all.length]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      all[(i - 1 + all.length) % all.length]?.focus();
      e.preventDefault();
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={`dropdown ${className}`} ref={root}>
      <button
        ref={button}
        type="button"
        className={`${buttonClassName} dropdown-button`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {icon}
      </button>
      {open && (
        <div className="dropdown-list" role="menu" ref={list} onKeyDown={onKeyDown}>
          {groups.map((group, g) => (
            <div className="dropdown-group" role="group" key={g}>
              {group.map((item) => {
                const className = item.danger ? "danger" : undefined;
                return item.href ? (
                  <a
                    key={item.label}
                    role="menuitem"
                    className={className}
                    href={item.href}
                    aria-current={item.current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={className}
                    aria-current={item.current ? "true" : undefined}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
