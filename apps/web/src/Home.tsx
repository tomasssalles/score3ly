// The home (docs/project-view.md, "The home"): what the app shows with no project open. Cards of the most recently
// opened projects, each opening its project, with where its pipeline is; with no projects yet, a welcome that shows
// where things are.

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import type { ListedProject } from "./api";
import { FittedText } from "./FittedText";
import { NewProjectLabel } from "./Header";
import { cardsThatFit, HOME_CARDS, positionState, recentProjects } from "./home";
import { CheckIcon, MenuIcon, PauseIcon, WarningIcon } from "./icons";
import { stateLabel } from "./pipeline";
import { hashForProject } from "./route";
import { when } from "./time";

export function Home({
  projects,
  notice,
  onOpen,
}: {
  projects: ListedProject[];
  notice: ReactNode; // a message above the cards (a project just deleted), or null
  onOpen: (project: ListedProject) => void;
}) {
  if (projects.length === 0) return <Welcome notice={notice} />;
  return <RecentProjects projects={projects} notice={notice} onOpen={onOpen} />;
}

// Teaches where things are, for when this text isn't shown any more: it names the buttons as they are, never links.
function Welcome({ notice }: { notice: ReactNode }) {
  return (
    <div className="home home-welcome">
      {notice}
      <p>Welcome to score3ly!</p>
      <p>
        To get started, click the{" "}
        <strong>
          <NewProjectLabel />
        </strong>{" "}
        button at the top right to pick a PDF and begin transcribing your first score. Or start by checking out the pages in
        the{" "}
        <span className="home-menu-icon" aria-label="menu">
          <MenuIcon />
        </span>{" "}
        menu next to it:
      </p>
      <ul>
        <li>
          <strong>About</strong> tells you what this app is.
        </li>
        <li>
          <strong>Help</strong> leads you to a quick-start guide, as well as the full documentation.
        </li>
        <li>
          <strong>Settings</strong> is where you need to go to set up your model configs, which drive the transcription
          pipeline.
        </li>
      </ul>
    </div>
  );
}

// As many cards as fit without scrolling (at most HOME_CARDS), in whole rows: three on a phone, two rows on a wide
// screen. Measured after each layout and whenever the home's size changes.
function RecentProjects({
  projects,
  notice,
  onOpen,
}: {
  projects: ListedProject[];
  notice: ReactNode;
  onOpen: (project: ListedProject) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [fitting, setFitting] = useState(HOME_CARDS);
  const shown = recentProjects(projects, fitting);

  useLayoutEffect(() => {
    const el = root.current!;
    const ul = list.current!;
    const fit = () => {
      const card = ul.firstElementChild as HTMLElement | null;
      if (!card) return;
      const style = getComputedStyle(el);
      const listStyle = getComputedStyle(ul);
      // Everything but the cards: the heading, a notice.
      let others = 0;
      for (const child of el.children) {
        if (child === ul) continue;
        const s = getComputedStyle(child);
        others += (child as HTMLElement).offsetHeight + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
      }
      const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - others;
      const columns = listStyle.gridTemplateColumns.split(" ").filter(Boolean).length;
      const gap = parseFloat(listStyle.rowGap) || 0;
      setFitting(cardsThatFit(height, card.offsetHeight, gap, columns));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="home" ref={root}>
      {notice}
      <h2>Recent</h2>
      <ul className="home-cards" ref={list}>
        {shown.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} onOpen={() => onOpen(project)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// A link, so that it can also be opened in a new tab; a plain click opens the project here, marking it as opened.
function ProjectCard({ project, onOpen }: { project: ListedProject; onOpen: () => void }) {
  const state = positionState(project.current);
  const label = stateLabel(state);
  return (
    <a
      className="home-card"
      href={hashForProject(project.id)}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onOpen();
      }}
    >
      <FittedText className="home-card-name" text={project.name} lines={1} />
      <FittedText className="home-card-file" text={project.pdfFilename} lines={1} />
      <span className={`home-card-state ${state.kind}`}>
        {state.kind === "done" && <CheckIcon />}
        {state.kind === "failed" && <WarningIcon />}
        {state.kind === "waiting" && <PauseIcon />}
        {state.kind === "running" && <span className="home-card-spinner" aria-hidden="true" />}
        <FittedText text={label} lines={1} />
      </span>
      <span className="home-card-opened">Opened {when(project.lastOpenedAt)}</span>
    </a>
  );
}
