import { type ReactNode } from "react";
import { pdfUrl, type Project } from "./api";
import { CloseIcon } from "./ui/icons";
import type { Artifact } from "./pipeline";
import { PdfView } from "./PdfView";
import { SkewEditor } from "./SkewEditor";
import { AnalysisView } from "./AnalysisView";
import { EngravingView } from "./EngravingView";
import { ExtractionView } from "./ExtractionView";
import { FixMeiView } from "./FixMeiView";
import { LayoutEditor } from "./LayoutEditor";
import type { EditorPage } from "./editor/pageEditor";
import { LayoutFilmstrip, PagesFilmstrip } from "./editor/PageViews";

// Shows one output or a stage's details, and nothing else: what is shown can be seen in the pipeline panel.
// In narrow mode it covers the whole app and has a close button floating over it.
export function ArtifactView({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={onClose ? "artifact-view overlay" : "artifact-view"} aria-label={label}>
      {onClose && (
        <button type="button" className="artifact-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      )}
      {children}
    </section>
  );
}

// An artifact: the original PDF, the page images, a manual stage's editor, or, for the kinds no stage produces yet, a note saying it can't
// be shown.
export function ArtifactContent({
  project,
  artifact,
  onEdited,
}: {
  project: Project;
  artifact: Artifact;
  onEdited?: () => void; // an editor saved something
}) {
  if (artifact.engraving) return <EngravingView key={artifact.id} artifact={artifact} />;
  if (artifact.fixMei) return <FixMeiView key={artifact.id} project={project} artifact={artifact} onEdited={onEdited} />;
  if (artifact.kind === "pdf") return <PdfView key={project.pdfSha256} url={pdfUrl(project.pdfSha256)} />;
  const pages = artifact.pages;
  if (artifact.analysis) return <AnalysisView key={artifact.id} project={project} artifact={artifact} onEdited={onEdited} />;
  // A WIP human review's screen is its Transcription, editable (docs/stages/music.md, `human_review`).
  if (artifact.extraction) {
    const edit = artifact.editor?.step === "human_review" ? { project, stageId: artifact.editor.stageId, onEdited } : undefined;
    return <ExtractionView key={artifact.id} artifact={artifact} edit={edit} />;
  }
  // A WIP manual stage's artifact is its editor (docs/project-view.md): its pages, each with the content it edits.
  const editable = (content: "linesSha256" | "layoutSha256"): EditorPage[] =>
    (pages ?? []).flatMap(({ page, recipe, item, parentId, [content]: contentSha256 }) =>
      contentSha256 && item && parentId ? [{ page, recipe, item, parentId, contentSha256 }] : [],
    );
  if (artifact.editor?.step === "fix_skew" && pages) {
    return <SkewEditor key={artifact.id} project={project} stageId={artifact.editor.stageId} pages={editable("linesSha256")} onEdited={onEdited} />;
  }
  if (artifact.editor?.step === "fix_layout" && pages) {
    return <LayoutEditor key={artifact.id} project={project} stageId={artifact.editor.stageId} pages={editable("layoutSha256")} onEdited={onEdited} />;
  }
  if (artifact.kind === "images" && pages?.some((p) => p.layoutSha256)) {
    return <LayoutFilmstrip key={artifact.id} pages={pages.flatMap((p) => (p.layoutSha256 ? [{ ...p, layoutSha256: p.layoutSha256 }] : []))} />;
  }
  if (artifact.kind === "images" && pages) return <PagesFilmstrip key={artifact.id} pages={pages} />;
  return (
    <div className="text-view">
      <p>This artifact can't be shown yet.</p>
    </div>
  );
}
