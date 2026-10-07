import { useEffect, useRef, useState } from "react";
import type { Project } from "./api";
import { ago } from "./time";

// Shows the current project's name, if a project is open. Opening it turns the name into a filter field
// over all projects, most recently opened first.
export function ProjectPicker({
  projects,
  current,
  onPick,
}: {
  projects: Project[];
  current: Project | null;
  onPick: (project: Project) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const nameButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const q = query.trim().toLowerCase();
  const shown = projects.filter((p) => p.name.toLowerCase().includes(q));
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1));

  function show() {
    if (projects.length === 0) return;
    setQuery("");
    setActive(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    // Wait for the name button to be shown again.
    requestAnimationFrame(() => nameButton.current?.focus());
  }

  function pick(project: Project) {
    close();
    onPick(project);
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // A tap or click outside closes the picker.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      setActive(Math.min(activeIndex + 1, shown.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive(Math.max(activeIndex - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter" && shown[activeIndex]) {
      pick(shown[activeIndex]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  return (
    <div className={open ? "picker open" : "picker"} ref={root}>
      <div className="picker-field" onClick={() => !open && show()}>
        {open ? (
          <input
            ref={input}
            className="picker-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-label="Find a project"
            aria-controls="project-list"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={shown.length ? `project-option-${activeIndex}` : undefined}
            placeholder={current ? current.name : "Find a project"}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
        ) : (
          <button
            ref={nameButton}
            type="button"
            className="picker-name"
            aria-haspopup="listbox"
            aria-expanded="false"
            disabled={projects.length === 0}
          >
            {current ? current.name : projects.length > 0 ? "Open a project" : "No project yet"}
          </button>
        )}
        {projects.length > 0 && (
          <button
            type="button"
            className="chevron"
            aria-label={open ? "Close" : "Show projects"}
            onClick={(e) => {
              e.stopPropagation();
              if (open) close();
              else show();
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <ul
          className="picker-list"
          id="project-list"
          role="listbox"
          ref={list}
          // Keeps the focus in the filter field.
          onMouseDown={(e) => e.preventDefault()}
        >
          {shown.length === 0 && <li className="empty">No project matches "{query.trim()}".</li>}
          {shown.map((project, i) => (
            <li
              key={project.id}
              id={`project-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={project.id === current?.id ? "current" : undefined}
              onClick={() => pick(project)}
            >
              <span className="option-name">
                <Highlighted text={project.name} query={query.trim()} />
              </span>
              <span className="option-time">{ago(project.lastOpenedAt)}</span>
              <span className="option-file">{project.pdfFilename}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}
