import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  note?: string; // after the label, muted and in italics, e.g. "(deleted)"
  key?: string; // where labels can repeat (two projects' names, one of them deleted)
  href?: string; // a link, or else a button that calls onSelect
  onSelect?: () => void;
  current?: boolean; // the page that is open, or the choice that is set
  danger?: boolean; // shown in red, e.g. deleting something
  disabled?: boolean; // shown dimmed, and can't be picked
};

// A button that opens a short menu of items, in groups separated by a line, each with an optional heading. Closes on a pick, on Esc, and on a
// tap or click outside. The arrow keys move between the items. It opens with the current choice in view, and always
// within the window: below the button, or above it where there is more room there, scrolling inside what it gets.
export function DropdownMenu({
  icon,
  label,
  groups,
  headings,
  className = "",
  buttonClassName = "icon-button",
  disabled = false,
}: {
  icon: ReactNode; // the button's content: an icon, or e.g. the current choice and a chevron
  label: string; // the button's accessible name
  groups: MenuItem[][];
  headings?: string[]; // a heading above each group
  className?: string;
  buttonClassName?: string;
  disabled?: boolean; // the button can't be pressed
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Within the window (found 2026-11-09: in "Change config", a long list of configs went below the window's edge, where
  // its last configs couldn't be reached): as tall as the room below the button allows, or opening upwards when there
  // is more room above; scrolled inside. Before the browser paints, so it doesn't jump.
  useLayoutEffect(() => {
    const el = list.current;
    const at = button.current?.getBoundingClientRect();
    if (!open || !el || !at) return;
    const gap = 6 + 8; // from the button, and from the window's edge
    const below = window.innerHeight - at.bottom - gap;
    const above = at.top - gap;
    const height = el.getBoundingClientRect().height;
    if (height <= below) return;
    const up = above > below;
    el.classList.toggle("dropdown-up", up);
    // The height given is the list's whole box: its padding and border come off (not by `box-sizing`, which would make
    // a list with a set width narrower).
    const style = getComputedStyle(el);
    const frame = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce((sum, k) => sum + parseFloat(style[k as "paddingTop"]), 0);
    el.style.maxHeight = `${Math.max((up ? above : below) - frame, 0)}px`;
    el.style.overflowY = "auto";
  }, [open]);

  const items = () => [...(list.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];

  useEffect(() => {
    if (!open) return;
    (items().find((item) => item.hasAttribute("aria-current")) ?? items()[0])?.focus();
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
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {icon}
      </button>
      {open && (
        <div className="dropdown-list" role="menu" ref={list} onKeyDown={onKeyDown}>
          {groups.map((group, g) => (
            <div className="dropdown-group" role="group" key={g} aria-label={headings?.[g]}>
              {headings?.[g] && <div className="dropdown-heading">{headings[g]}</div>}
              {group.map((item) => {
                const className = item.danger ? "danger" : undefined;
                return item.href ? (
                  <a
                    key={item.key ?? item.label}
                    role="menuitem"
                    className={className}
                    href={item.href}
                    aria-current={item.current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    {item.note && <span className="menu-note"> {item.note}</span>}
                  </a>
                ) : (
                  <button
                    key={item.key ?? item.label}
                    type="button"
                    role="menuitem"
                    className={className}
                    aria-current={item.current ? "true" : undefined}
                    disabled={item.disabled}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {item.label}
                    {item.note && <span className="menu-note"> {item.note}</span>}
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
