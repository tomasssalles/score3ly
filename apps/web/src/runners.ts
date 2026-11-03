// The steps that can run in the browser, by step id (docs/overview.md §5.1). Ingest never runs.

import { runAnalyze } from "./runAnalyze";
import { runBuildMei } from "./runBuildMei";
import { runApplyReview } from "./runApplyReview";
import { runEngrave } from "./runEngrave";
import { runExtract } from "./runExtract";
import { runLayout } from "./runLayout";
import { runRasterize } from "./runRasterize";
import { runReview } from "./runReview";
import { runSkewAnalysis } from "./runSkewAnalysis";
import type { StageRun } from "./stageRunner";

export const RUNNERS: Record<string, (run: StageRun) => Promise<void>> = {
  rasterize: runRasterize,
  skew_analysis: runSkewAnalysis,
  layout: runLayout,
  analyze: runAnalyze,
  extract: runExtract,
  review: runReview,
  apply_review: runApplyReview,
  build_mei: runBuildMei,
  engrave: runEngrave,
};
