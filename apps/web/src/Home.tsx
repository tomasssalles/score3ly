// The home (docs/project-view.md, "The home"): what the app shows with no project open. Cards of the most recently
// opened projects, each opening its project, with where its pipeline is; with no projects yet, how to start one.

import type { ReactNode } from "react";
import type { ListedProject } from "./api";
import { FittedText } from "./FittedText";
import { HOME_CARDS, positionState, recentProjects } from "./home";
import { CheckIcon, PauseIcon, WarningIcon } from "./icons";
import { stateLabel } from "./pipeline";
import { hashForProject } from "./route";
import { when } from "./time";

export function Home({
  projects,
  notice,
  onOpen,
  onNewProject,
}: {
  projects: ListedProject[];
  notice: ReactNode; // a message above the cards (a project just deleted), or null
  onOpen: (project: ListedProject) => void;
  onNewProject: () => void;
}) {
  if (projects.length === 0) {
    return (
      <div className="home home-empty">
        {notice}
        <p>Start with a PDF of printed music. The app reads it into MEI, step by step.</p>
        <button type="button" className="button-primary" onClick={onNewProject}>
          + New project
        </button>
      </div>
    );
  }
  const shown = recentProjects(projects);
  return (
    <div className="home">
      {notice}
      <h2>Recent projects</h2>
      <ul className="home-cards">
        {shown.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} onOpen={() => onOpen(project)} />
          </li>
        ))}
      </ul>
      {projects.length > HOME_CARDS && <p className="home-more">All {projects.length} projects are in the picker above.</p>}
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
