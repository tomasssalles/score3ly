// `analyze`'s artifacts and the forms that correct them (DESIGN.md §6): the metadata is MetadataView's, the
// observations ObservationsView's.

import type { Project } from "./api";
import { MetadataView } from "./MetadataView";
import { ObservationsView } from "./ObservationsView";
import type { Artifact } from "./pipeline";

export function AnalysisView({ project, artifact, onEdited }: { project: Project; artifact: Artifact; onEdited?: () => void }) {
  if (artifact.analysis!.view === "metadata") return <MetadataView project={project} artifact={artifact} onEdited={onEdited} />;
  return <ObservationsView project={project} artifact={artifact} onEdited={onEdited} />;
}
