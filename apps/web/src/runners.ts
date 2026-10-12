// The steps that can run in the browser, by step id (DESIGN.md §5.1). Ingest never runs.

import { runRasterize } from "./runRasterize";
import type { StageRun } from "./stageRunner";

export const RUNNERS: Record<string, (run: StageRun) => Promise<void>> = {
  rasterize: runRasterize,
};
