import type { Project } from "./api";
import { CloseIcon } from "./icons";
import type { Artifact } from "./pipeline";
import { PdfView } from "./PdfView";

// Shows one artifact, and nothing else: which artifact it is can be seen in the pipeline panel.
// In narrow mode it covers the whole app and has a close button floating over it.
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
      {onClose && (
        <button type="button" className="artifact-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      )}
      {artifact.kind === "pdf" && <PdfView key={project.pdfSha256} url={`/api/pdfs/${project.pdfSha256}/file`} />}
    </section>
  );
}
