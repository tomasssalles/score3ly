// The steps that can run in the browser, by step id (DESIGN.md §5.1). Ingest never runs.

import { runAnalyze } from "./runAnalyze";
import { runExtract } from "./runExtract";
import { runLayout } from "./runLayout";
import { runRasterize } from "./runRasterize";
import { runSkewAnalysis } from "./runSkewAnalysis";
import type { StageRun } from "./stageRunner";

export const RUNNERS: Record<string, (run: StageRun) => Promise<void>> = {
  rasterize: runRasterize,
  skew_analysis: runSkewAnalysis,
  layout: runLayout,
  analyze: runAnalyze,
  extract: runExtract,
};
