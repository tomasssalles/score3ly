import type { Project } from "./api";
import { CloseIcon } from "./icons";
import type { Artifact } from "./pipeline";
import { PdfView } from "./PdfView";

// Shows one artifact. In narrow mode it covers the whole app and has a close button.
export function ArtifactView({
  project,
  artifact,
  onClose,
}: {
  project: Project;
  artifact: Artifact;
  onClose?: () => void;
}) {
  return (
    <section className={onClose ? "artifact-view overlay" : "artifact-view"} aria-label={artifact.title}>
      <div className="artifact-head">
        <div className="artifact-title">
          <h2>{artifact.title}</h2>
          <p>{project.pdfFilename}</p>
        </div>
        {onClose && (
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </div>
      {artifact.kind === "pdf" && <PdfView key={project.pdfSha256} url={`/api/pdfs/${project.pdfSha256}/file`} />}
    </section>
  );
}
