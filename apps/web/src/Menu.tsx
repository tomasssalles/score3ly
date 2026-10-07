import { useEffect, useRef, useState } from "react";
import { MenuIcon } from "./icons";
import { hashForPage, type Page } from "./route";

// Groups of pages, separated by a line: what you look at, what you change, help about the app.
const GROUPS: { page: Page; label: string }[][] = [
  [{ page: "stats", label: "Statistics" }],
  [{ page: "settings", label: "Settings" }],
  [
    { page: "help", label: "Help" },
    { page: "about", label: "About" },
  ],
];

// The menu button at the right of the header, with links to the app's pages.
export function Menu({ current }: { current: Page | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const items = () => [...(list.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    // A tap or click outside closes the menu.
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
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
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
    <div className="menu" ref={root}>
      <button
        ref={button}
        type="button"
        className="icon-button menu-button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="menu-list" role="menu" ref={list} onKeyDown={onKeyDown}>
          {GROUPS.map((group, g) => (
            <div className="menu-group" role="group" key={g}>
              {group.map(({ page, label }) => (
                <a
                  key={page}
                  role="menuitem"
                  href={hashForPage(page)}
                  aria-current={page === current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
