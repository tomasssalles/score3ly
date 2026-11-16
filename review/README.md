# The code review

The working notes of the task "Clean up the codebase" (`docs/tasks.md`): a review in levels, bottom-up, then a plan, then the fixes. This folder is deleted when the work is done.

## How it runs

- **One orchestrating session, one fresh subagent per batch, strictly one after the other** (the project owner's rule: subagents in parallel all hit the session's usage limit at once, and their work is lost). The orchestrator gives a subagent its batch (the instructions below and the batch's file list), checks that the notes arrived, marks the batch done here, and commits and pushes to the working branch after each batch. Only notes go up a level, never the code; a higher level re-reads code selectively, where a finding needs it.
- **After a `/clear`:** read this file and continue with the first batch not done.
- **Levels:** 1, every file on its own (below); 2, groups of files chosen by what has to agree with itself; then components; then the whole app. Each level writes its own instructions here before it starts.

## What is reviewed

The code of `packages/`, `apps/` and `scripts/`, tests included, about 2.6 MB (about 650k tokens). Left out: `apps/worker/worker-configuration.d.ts` (generated), `apps/worker/src/llm/modelList.ts` and the JSON under `apps/worker/model-list/` (data), `packages/notation/schemas/` (MEI's schemas), `scripts/licenses/`, `apps/worker/model-list/gather/sources/`, `package-lock.json`, `THIRD_PARTY_NOTICES.md`, `testset/`, `fixtures/`.

## The final summary

**At the end of the review** (after the plan, and updated after the fixes), `review/summary.md` sums it up for the project owner, for two uses: judging how effective the review was, and deciding the rules that go into CLAUDE.md. It holds: the most important findings and their fixes; the most common kinds of problem, with counts across all levels; the most problematic ones (bugs, things that misled); how many findings each level made, confirmed and dropped (how many of level 1's checks held); the likely causes in how the code was written; and the CLAUDE.md rules proposed. So **every level keeps what this needs:** findings marked certain or check, checks settled later recorded with their outcome, and each level's notes end with its patterns. `summary.md` is kept (moved out of `review/` before the folder is deleted) until it has been discussed.

## Level 1: every file on its own

**The main worry is duplication.** Coding agents tend to write what they need from scratch, so the same functionality exists in several places, and code is written by hand that a small package or the platform provides. Level 1 reads one batch and can't see the other files, so its job is mainly to take the notes from which the later levels can see it: they will ask "these two modules need similar functionality; do they share code as they should?".

### The note of each file
One note per source file, its test file in the same note (in the batch's file, below):
- **What it does,** in a few sentences: the functionality it implements, described plainly enough that the same functionality written elsewhere, under other names, can be recognized. Name the generic parts apart from the domain (e.g. "canonical JSON with sorted keys", "retry with backoff", "a pointer-drag handler", "LRU eviction", "formats a duration", "parses SSE").
- **Exports:** every exported function, type, constant and component, with a few words each where the name doesn't say it.
- **Imports:** from which modules of the repo, and which packages; the platform APIs it leans on (OPFS, Web Workers, `crypto.subtle`, D1, `node:` modules).
- **Notable internal helpers:** functions that aren't exported but look generic or likely written elsewhere too.
- **Findings,** each with a line number, one sentence, and **certain** or **check** (a doubt that the next level confirms or drops, e.g. "looks racy", "this export seems unused", "probably duplicates X elsewhere").
- **Tests** (a light pass): what the test file covers, gaps that matter, tests that test the same thing twice.

### What to look for
- **Duplication within the file:** repeated blocks, copy-pasted branches, near-identical functions. Certain.
- **Code that the platform or a dependency already provides:** built-ins (`structuredClone`, `Object.groupBy`, `toSorted`, `Intl`, `URLSearchParams`, `AbortSignal.timeout`, `crypto.subtle`, `node:` modules in Node-only code), or a package already in a `package.json` of the repo (Zod, Hono, pdf.js, CodeMirror, ...).
- **Code a new small package could replace:** only one that is small, has few or no dependencies, is maintained, runs wherever the code runs (browser, Workers, Node), and replaces real code, not three lines. A candidate, marked check; the plan decides.
- **Not flagged as reinventions:** what the docs say is ours on purpose: the image operations, decoding and PNG encoding (`docs/images.md`, for identical pixels on every device), the lens parser and checks, the MEI builder.
- **Bugs:** race conditions, off-by-ones, overflows, unhandled errors and promise rejections, wrong types and casts, missing cleanup (listeners, workers, timers, object URLs).
- **Dead code:** unused parameters, branches that can't happen; unused exports are a check (another file may use them).
- **Names and comments that lie,** or no longer say what the code does.
- **Files too large,** or doing two jobs.
- **`styles.css` and `themes.css`:** against `docs/style.md`: unused rules, values that should be tokens, duplication. Not for bugs.

### How a subagent works
- Read the batch's files in full, in the order given; read nothing else at length. A quick `grep` across the repo to settle a doubt is fine (is this export used? is there already a helper for this?); note what it found.
- Don't read the docs beyond what a comment points to (the docs have their own review). `docs/overview.md` is the background.
- Change no code, run no tests.
- Write the notes to `review/level1/<batch number>.md`, one `##` section per file, in the batch's order, and nothing else. Keep them concise: notes, not prose.

## Level 1: the batches

About 45–80k tokens each. Grouped by area, so that a subagent reads related files together, though each is reviewed on its own.

| # | Batch | Status |
|---|---|---|
| 01 | core, imaging, notation | done |
| 02 | prompts | done |
| 03 | worker: routes and storage | done |
| 04 | worker: LLM routes and scripts | done |
| 05 | worker: LLM providers and models | done |
| 06 | web: running the pipeline | done |
| 07 | web: stage logic | done |
| 08 | web: project screens | done |
| 09 | web: settings, statistics, styles | done |
| 10 | web's shell, desktop, eval, scripts | done |

**01 core, imaging, notation:** packages/core/src/callEvents.ts packages/core/src/index.ts packages/core/src/keys.ts packages/core/src/keys.test.ts packages/core/src/sha256.test.ts packages/core/src/pageSelection.ts packages/core/src/pageSelection.test.ts packages/core/src/pdf.ts packages/core/src/pdfjsAssets.ts packages/core/src/project.ts packages/core/src/sse.ts packages/core/src/sse.test.ts packages/imaging/src/index.ts packages/imaging/src/image.ts packages/imaging/src/regions.ts packages/imaging/src/crop.ts packages/imaging/src/crop.test.ts packages/imaging/src/draw.ts packages/imaging/src/draw.test.ts packages/imaging/src/fingerprint.ts packages/imaging/src/fingerprint.test.ts packages/imaging/src/pdfPages.ts packages/imaging/src/pdfPages.test.ts packages/imaging/src/png.ts packages/imaging/src/png.test.ts packages/imaging/src/rotate.ts packages/imaging/src/rotate.test.ts packages/imaging/src/scale.ts packages/imaging/src/scale.test.ts packages/imaging/src/skew.ts packages/imaging/src/skew.test.ts packages/imaging/src/testPages.ts packages/imaging/scripts/common.ts packages/imaging/scripts/crops.ts packages/imaging/scripts/pages.ts packages/notation/src/index.ts packages/notation/src/fraction.ts packages/notation/src/durations.ts packages/notation/src/xml.ts packages/notation/src/symbolic.ts packages/notation/src/symbolic.test.ts packages/notation/src/lens.ts packages/notation/src/lens.test.ts packages/notation/src/score.ts packages/notation/src/spans.ts packages/notation/src/links.ts packages/notation/src/links.test.ts packages/notation/src/scoreChecks.ts packages/notation/src/scoreChecks.test.ts packages/notation/src/mei.ts packages/notation/src/mei.test.ts

**02 prompts:** packages/prompts/src/index.ts packages/prompts/src/lensForm.ts packages/prompts/src/lensForm.test.ts packages/prompts/src/layout.ts packages/prompts/src/layout.test.ts packages/prompts/src/analyze.ts packages/prompts/src/analyze.test.ts packages/prompts/src/extract.ts packages/prompts/src/extract.test.ts packages/prompts/src/review.ts packages/prompts/src/applyReview.ts

**03 worker: routes and storage:** apps/worker/wrangler.jsonc.template apps/worker/migrations/0001_initial.sql apps/worker/migrations/0002_imported.sql apps/worker/migrations/0003_vat.sql apps/worker/migrations/0004_call_place.sql apps/worker/src/index.ts apps/worker/src/index.test.ts apps/worker/src/names.ts apps/worker/src/versions.ts apps/worker/src/testPlatform.ts apps/worker/src/requestLog.ts apps/worker/src/requestLog.test.ts apps/worker/src/pipeline.ts apps/worker/src/failures.ts apps/worker/src/fingerprints.ts apps/worker/src/fingerprints.test.ts apps/worker/src/activity.ts apps/worker/src/activeTime.ts apps/worker/src/activeTime.test.ts apps/worker/src/runTimes.ts apps/worker/src/projectStats.ts apps/worker/src/costs.ts apps/worker/src/vat.ts apps/worker/src/deletion.ts apps/worker/src/projectFile.ts

**04 worker: LLM routes and scripts:** apps/worker/src/llmRoutes.ts apps/worker/src/llmRoutes.test.ts apps/worker/scripts/config.ts apps/worker/scripts/config.test.ts apps/worker/scripts/setup-cloudflare.ts apps/worker/scripts/callPlaces.ts apps/worker/scripts/callPlaces.test.ts apps/worker/scripts/fill-call-places.ts apps/worker/scripts/generate-model-list.ts apps/worker/scripts/probe-schemas.ts apps/worker/scripts/try-llm.ts

**05 worker: LLM providers and models:** apps/worker/src/llm/index.ts apps/worker/src/llm/types.ts apps/worker/src/llm/adapters.ts apps/worker/src/llm/jsonSchema.ts apps/worker/src/llm/timeouts.ts apps/worker/src/llm/timeouts.test.ts apps/worker/src/llm/anthropic.ts apps/worker/src/llm/anthropic.test.ts apps/worker/src/llm/bedrock.test.ts apps/worker/src/llm/google.ts apps/worker/src/llm/google.test.ts apps/worker/src/llm/vertex.test.ts apps/worker/src/llm/googleServiceAccount.ts apps/worker/src/llm/openrouter.ts apps/worker/src/llm/openrouter.test.ts apps/worker/src/llm/fake.ts apps/worker/src/llm/replay.ts apps/worker/src/llm/models.ts apps/worker/src/llm/models.test.ts apps/worker/src/llm/prices.ts apps/worker/src/llm/generateModelList.ts apps/worker/src/llm/generateModelList.test.ts apps/worker/model-list/gather/anthropic.ts apps/worker/model-list/gather/bedrock.ts apps/worker/model-list/gather/ai-studio.ts apps/worker/model-list/gather/vertex.ts apps/worker/model-list/gather/openrouter.ts

**06 web: running the pipeline:** apps/web/src/api.ts apps/web/src/api.test.ts apps/web/src/steps.ts apps/web/src/steps.test.ts apps/web/src/pipeline.ts apps/web/src/pipeline.test.ts apps/web/src/stageRunner.ts apps/web/src/runners.ts apps/web/src/llm.ts apps/web/src/callProgress.ts apps/web/src/callProgress.test.ts apps/web/src/itemTiming.ts apps/web/src/itemTiming.test.ts apps/web/src/runRasterize.ts apps/web/src/rasterize.ts apps/web/src/rasterize.test.ts apps/web/src/runSkewAnalysis.ts apps/web/src/skewAnalysis.ts apps/web/src/skewAnalysis.test.ts apps/web/src/runLayout.ts apps/web/src/layout.ts apps/web/src/runAnalyze.ts apps/web/src/runExtract.ts apps/web/src/runReview.ts apps/web/src/runApplyReview.ts apps/web/src/runBuildMei.ts apps/web/src/runEngrave.ts apps/web/src/runReport.ts apps/web/src/runReport.test.ts apps/web/src/finishers.ts apps/web/src/finishFixSkew.ts apps/web/src/finishFixLayout.ts apps/web/src/finishFixMetadata.ts apps/web/src/finishFixObservations.ts apps/web/src/finishHumanReview.ts apps/web/src/pdf.ts apps/web/src/pageImages.ts apps/web/src/pageImageWorker.ts apps/web/src/renderWorker.ts apps/web/src/imageCache.ts apps/web/src/cacheLru.ts apps/web/src/cacheLru.test.ts apps/web/src/projectFile.ts apps/web/src/projectFile.test.ts apps/web/src/runTimes.ts apps/web/src/runTimes.test.ts apps/web/src/host.ts apps/web/src/toasts.ts apps/web/src/toasts.test.ts apps/web/src/errorText.test.ts apps/web/src/route.ts apps/web/src/route.test.ts apps/web/src/navigation.ts apps/web/src/history.ts apps/web/src/history.test.ts apps/web/src/useHash.ts apps/web/src/useWide.ts apps/web/src/leaveGuard.ts apps/web/src/leaveGuard.test.ts apps/web/src/wakeLock.ts

**07 web: stage logic:** apps/web/src/names.ts apps/web/src/names.test.ts apps/web/src/fit.ts apps/web/src/fit.test.ts apps/web/src/handles.ts apps/web/src/handles.test.ts apps/web/src/viewBounds.ts apps/web/src/viewBounds.test.ts apps/web/src/fixSkew.ts apps/web/src/fixSkew.test.ts apps/web/src/fixLayout.ts apps/web/src/fixLayout.test.ts apps/web/src/analyze.ts apps/web/src/analyze.test.ts apps/web/src/fixMetadata.ts apps/web/src/fixMetadata.test.ts apps/web/src/fixObservations.ts apps/web/src/fixObservations.test.ts apps/web/src/linking.ts apps/web/src/musicInputs.ts apps/web/src/extract.ts apps/web/src/extract.test.ts apps/web/src/review.ts apps/web/src/review.test.ts apps/web/src/applyReview.ts apps/web/src/applyReview.test.ts apps/web/src/humanReview.ts apps/web/src/humanReview.test.ts apps/web/src/transcription.ts apps/web/src/transcription.test.ts apps/web/src/rendering.ts apps/web/src/rendering.test.ts apps/web/src/verovioRender.ts apps/web/src/verovioRender.test.ts apps/web/src/metronomeFont.ts apps/web/src/metronomeFont.test.ts apps/web/src/meiView.ts apps/web/src/meiView.test.ts apps/web/src/meiChecks.ts apps/web/src/meiChecks.test.ts apps/web/src/meiCheckWorker.ts apps/web/src/meiSchema.ts apps/web/src/meiValidation.ts apps/web/src/fixMei.ts apps/web/src/engrave.ts apps/web/src/engrave.test.ts apps/web/src/engraving.ts apps/web/src/attribution.ts apps/web/src/attribution.test.ts apps/web/src/downloads.ts

**08 web: project screens:** apps/web/src/ProjectView.tsx apps/web/src/PipelinePanel.tsx apps/web/src/StageCard.tsx apps/web/src/stageCardStyles.test.ts apps/web/src/StageDetails.tsx apps/web/src/ProgressBar.tsx apps/web/src/ProgressRing.tsx apps/web/src/ArtifactView.tsx apps/web/src/PdfView.tsx apps/web/src/PageView.tsx apps/web/src/ImagesDiffer.tsx apps/web/src/pageEditor.tsx apps/web/src/SkewEditor.tsx apps/web/src/LayoutEditor.tsx apps/web/src/AnalysisView.tsx apps/web/src/MetadataView.tsx apps/web/src/ObservationsView.tsx apps/web/src/fieldList.tsx apps/web/src/CheckList.tsx apps/web/src/checkListStyles.test.ts apps/web/src/ExtractionView.tsx apps/web/src/HumanReviewCards.tsx apps/web/src/MeiWorkspace.tsx apps/web/src/MeiCode.tsx apps/web/src/FixMeiView.tsx apps/web/src/EngravingView.tsx apps/web/src/FittedText.tsx apps/web/src/icons.tsx

**09 web: settings, statistics, styles:** apps/web/src/SettingsPage.tsx apps/web/src/ConfigDialog.tsx apps/web/src/NewModelConfig.tsx apps/web/src/configForm.ts apps/web/src/configForm.test.ts apps/web/src/configList.ts apps/web/src/configList.test.ts apps/web/src/TestConfigDialog.tsx apps/web/src/testResult.ts apps/web/src/testResult.test.ts apps/web/src/effort.ts apps/web/src/effort.test.ts apps/web/src/pricing.ts apps/web/src/pricing.test.ts apps/web/src/money.ts apps/web/src/money.test.ts apps/web/src/time.ts apps/web/src/time.test.ts apps/web/src/StatsPage.tsx apps/web/src/statsParts.tsx apps/web/src/costs.ts apps/web/src/costs.test.ts apps/web/src/UsageTab.tsx apps/web/src/usage.ts apps/web/src/usage.test.ts apps/web/src/RunTimesTab.tsx apps/web/src/EffortTab.tsx apps/web/src/TimeChart.tsx apps/web/src/chart.ts apps/web/src/chart.test.ts apps/web/src/themes.ts apps/web/src/themes.test.ts apps/web/src/colors.test.ts apps/web/src/themes.css apps/web/src/styles.css

**10 web's shell, desktop, eval, scripts:** apps/web/index.html apps/web/vite.config.ts apps/web/src/main.tsx apps/web/src/buildInfo.d.ts apps/web/src/verovio.d.ts apps/web/src/App.tsx apps/web/src/Header.tsx apps/web/src/Menu.tsx apps/web/src/DropdownMenu.tsx apps/web/src/Info.tsx apps/web/src/Home.tsx apps/web/src/home.ts apps/web/src/home.test.ts apps/web/src/ProjectPicker.tsx apps/web/src/ProjectFilter.tsx apps/web/src/ConfirmDialog.tsx apps/web/src/RenameDialog.tsx apps/web/src/DeleteProjectDialog.tsx apps/web/src/ExportDialog.tsx apps/web/src/KnownPdfDialog.tsx apps/web/src/AboutPage.tsx apps/web/src/about.ts apps/web/src/about.test.ts apps/web/src/icon.test.ts apps/web/scripts/icons.ts apps/web/scripts/leipzig.ts apps/web/scripts/metronomeFont.ts apps/desktop/build.ts apps/desktop/src/main.ts apps/desktop/src/server.ts apps/desktop/src/d1.ts apps/desktop/src/d1.test.ts apps/desktop/src/r2.ts apps/desktop/src/r2.test.ts apps/desktop/src/secrets.ts apps/desktop/src/secrets.test.ts apps/desktop/src/leaving.ts apps/desktop/src/leaving.test.ts apps/desktop/src/version.test.ts apps/eval/index.html apps/eval/vite.config.ts apps/eval/src/main.tsx apps/eval/src/verovio.d.ts apps/eval/src/Viewer.tsx apps/eval/src/PdfPane.tsx apps/eval/src/engrave.ts apps/eval/src/lilypond.ts apps/eval/src/lilypond.test.ts apps/eval/src/highlighter.ts apps/eval/src/highlighter.test.ts apps/eval/src/marks.ts apps/eval/src/marks.test.ts apps/eval/src/useMarks.ts apps/eval/src/scrollAnchor.ts apps/eval/src/scrollAnchor.test.ts apps/eval/src/testset.ts apps/eval/src/testset.test.ts apps/eval/src/testsetServer.ts scripts/appServers.ts scripts/make-fixture.ts scripts/replay.ts scripts/screenshots.ts scripts/seedStats.ts scripts/notices.ts scripts/notices.test.ts scripts/syntax.test.ts

## Level 2: groups of files that have to agree

A group is code that has to agree with itself: both sides of a request (the web app and the Worker), the writer and the readers of a stored format, the code that computes a key and the code that looks it up, or the copies of one piece of functionality. Level 1 saw each file alone; level 2 sees them together.

### What to look for
1. **Contracts:** do both sides agree (request and response, writer and readers of a stored format, key computed and key looked up, a DB `CHECK` and the type that restates it)? A type or constant written on both sides (the Worker's and the web's `Stage`, `StageStatus`, `STALE_MS`, error kinds, …): should it live in one place, e.g. `@score3ly/core`?
2. **Duplication across files,** confirmed: level 1 flagged it, level 2 says whether the copies must really behave the same, and where one shared version would live, given what each package may depend on (e.g. `imaging` doesn't depend on `core`) and where it runs (browser, Worker, Node).
3. **Level 1's "check" findings** for the group's files: confirmed (then certain) or dropped, with a word why.
4. **Structure:** files doing two jobs and how they would split; logic buried in components or routes that could be pure and tested; dependencies going the wrong way; modules in the wrong place.
5. **Tests at the seams:** is each side of a contract tested, does any test pin the two together, tests that test the same thing twice across files.
6. **Bugs** that only show when the files are read together.

### How a subagent works
- Read first the level 1 notes of the group's files (`review/level1/<batch>.md`, the `##` section of each file, and the batch-wide notes at the top), then re-read the code only where a question needs it: the parts, not whole files, especially of the large ones (`apps/worker/src/index.ts`, `llmRoutes.ts`, `apps/web/src/api.ts`, `steps.ts`), which several groups share, each for its own part.
- A quick `grep` across the repo to settle a doubt is fine. Files outside the group are read only as far as a question needs.
- Don't read the docs beyond what a comment or a question points to. `docs/overview.md` is the background.
- Change no code, run no tests.
- Write the notes to `review/level2/<group number>.md`, and nothing else:
  - **Map:** the group's modules in a few lines each, what depends on what, the contracts between them.
  - **Findings,** each with file and line, one or two sentences, and **certain** or **check** (for level 3). For duplication: where the shared version would live and who would use it.
  - **Level 1 checks settled:** one line each, confirmed or dropped.
  - **For level 3:** what this group's notes suggest about the components above it (what crosses into other groups).
  - **Patterns:** the kinds of problem found in this group (e.g. a helper written again, a type restated on both sides, a stale comment, a race), each with a count and the likely cause in how the code came to be written (e.g. "a stage's code written without looking for the helper the previous stage used"). These feed the final summary and the new rules for CLAUDE.md.
  - Concise: notes, not prose.

## Level 2: the groups

One subagent per group, strictly one after the other. A large file appears in several groups, each for the part named.

| # | Group | Status |
|---|---|---|
| 01 | Hashes, keys, canonical JSON | done |
| 02 | Boxes and geometry | done |
| 03 | Page images and the image cache | done |
| 04 | Web Worker RPC | done |
| 05 | Pipeline state, both sides | |
| 06 | Running a stage | |
| 07 | Errors and request plumbing | |
| 08 | The LLM request path | |
| 09 | Provider adapters | |
| 10 | JSON Schemas and validating answers | |
| 11 | The model list and prices | |
| 12 | Model configs | |
| 13 | Costs and money | |
| 14 | Statistics and time | |
| 15 | Projects: names, export, import, deletion | |
| 16 | The lens and its writers | |
| 17 | Score structure and linking | |
| 18 | Issues across the stages | |
| 19 | Layout and skew, from analysis to editors | |
| 20 | Analyze and its forms | |
| 21 | MEI: build, view, edit, engrave, render | |
| 22 | The UI kit and styles | |
| 23 | Routing, navigation, the desktop shell | |
| 24 | Hosts, deployment, scripts, eval | |

**01 Hashes, keys, canonical JSON.** What agrees: content keys and recipe keys (computed and looked up), the hex-64 checks (four copies), `canonicalJson` (two), `sha256Hex` (four). Files: packages/core/src/keys.ts (+test, sha256.test.ts), packages/imaging/src/fingerprint.ts, apps/worker/src/fingerprints.ts, apps/worker/src/index.ts (`isSha256`), apps/worker/src/pipeline.ts (`isKey`, the stage key), apps/worker/src/projectFile.ts (`isSha256`, `canonicalJson`), apps/worker/src/llmRoutes.ts (the request key, hex check, `sameValues`), apps/web/src/imageCache.ts (keys), apps/web/src/steps.ts (stage key parts), apps/web/src/fixLayout.ts (`systemsChanged`), apps/web/scripts/leipzig.ts.

**02 Boxes and geometry.** What agrees: `Box` (three definitions), box validation, area and overlap, crop↔page mapping, clamp and round to N digits. Files: packages/imaging/src/crop.ts, draw.ts, regions.ts; packages/notation/src/lens.ts (Box); packages/prompts/src/layout.ts (LayoutBox), review.ts (ReviewBox); apps/web/src/fit.ts, handles.ts, viewBounds.ts, transcription.ts, review.ts, extract.ts (`onPage`), fixSkew.ts, fixLayout.ts (clamp, round); the box parts of HumanReviewCards.tsx and ExtractionView.tsx.

**03 Page images and the image cache.** What agrees: recipe → pixels → OPFS, two LRU evictions, the pdf.js entry points, the PDF's URL written in three places, gray-to-RGBA expansion (three). Files: packages/imaging/src/image.ts, pdfPages.ts, png.ts, rotate.ts, scale.ts, skew.ts (`rotateGray`), fingerprint.ts (`asStored`), testPages.ts; packages/core/src/pdf.ts, pdfjsAssets.ts; apps/web/src/pdf.ts, pageImages.ts, pageImageWorker.ts, imageCache.ts, cacheLru.ts, rasterize.ts, runRasterize.ts, PdfView.tsx, ImagesDiffer.tsx; apps/eval/src/PdfPane.tsx.

**04 Web Worker RPC.** What agrees: three clients with an id counter and a pending Map, and their workers; error handling, termination, cleanup. Files: apps/web/src/pageImages.ts, rendering.ts, meiValidation.ts, pageImageWorker.ts, renderWorker.ts, meiCheckWorker.ts.

**05 Pipeline state, both sides.** What agrees: stage statuses, planned/carried/dropped stages, the "first stage not done" rule, the `Stage` type on both sides, `modelConfig.unsupported`, `STALE_MS`. Files: apps/worker/migrations/0001_initial.sql (stages, pipeline_entries, outputs), apps/worker/src/pipeline.ts (types, reading the pipeline), failures.ts; apps/web/src/api.ts (types), pipeline.ts, steps.ts (state and artifacts); packages/core/src/project.ts.

**06 Running a stage.** What agrees: the start/output/heartbeat/end requests, marking an answer unusable, resuming from recorded outputs, "the latest stage of step X before this one" (about 20 copies), the step lists (`LAYOUT_STEPS`, `PIECE_STEPS`/`METADATA_STEPS`, `EXTRACTION_STEPS`, `MANUAL`), putting JSON content. Files: apps/web/src/stageRunner.ts, runners.ts, finishers.ts, steps.ts, musicInputs.ts (lookups), engrave.ts (`withOutput`, step lists), leaveGuard.ts, wakeLock.ts, toasts.ts (lookups), the run*.ts and finish*.ts files for those patterns only; apps/worker/src/pipeline.ts (the routes), index.ts (the lock's route table).

**07 Errors and request plumbing.** What agrees: the four ways a failed response becomes an error (`ApiError`/`checked`, `LlmRefused`, `WorkerRefusal`/`refusedOr`, plain `Error`), what the Worker sends on failure, error text in the UI, toasts, the request log, `err instanceof Error ? …` idioms. Files: apps/web/src/api.ts (error paths), llm.ts (refusals), toasts.ts, errorText.test.ts; apps/worker/src/requestLog.ts, the error responses of index.ts, pipeline.ts and llmRoutes.ts.

**08 The LLM request path.** What agrees: browser ↔ Worker ↔ provider: SSE, call events, progress, cache lookup before images, item and round places, the replay model. Files: packages/core/src/sse.ts, callEvents.ts; apps/web/src/llm.ts, callProgress.ts, itemTiming.ts; apps/worker/src/llmRoutes.ts (the call route, the cache, recording), llm/index.ts, llm/types.ts, llm/fake.ts, llm/replay.ts.

**09 Provider adapters.** What agrees: one request/answer shape for every provider, timeouts, streaming, usage and cost, base64 and JWT. Files: apps/worker/src/llm/adapters.ts, anthropic.ts, google.ts, openrouter.ts, googleServiceAccount.ts, timeouts.ts, types.ts, and their tests (anthropic, bedrock, google, vertex, openrouter, timeouts).

**10 JSON Schemas and validating answers.** What agrees: the schema builders (four copies), the two hand-written validators (`shapeProblem`, `schemaProblems`), `layout`'s own validation, the `*FromModel` conversions, Zod named in the docs but not a dependency, Claude's schema limits. Files: packages/prompts/src/* (schemas and conversions), apps/worker/src/llm/jsonSchema.ts, apps/worker/scripts/probe-schemas.ts.

**11 The model list and prices.** What agrees: gather → generate → `modelList.ts` → lookups; dollar parsers (three), HTML table scrapers (two), `priceKey` (two). Files: apps/worker/src/llm/models.ts, prices.ts, generateModelList.ts (+tests), apps/worker/model-list/gather/*.ts, apps/worker/scripts/generate-model-list.ts.

**12 Model configs.** What agrees: config rows ↔ the browser's shape ↔ the form; secrets' labels (three), routing labels (two), `secrets_json` parsed three times, the providers' `CHECK`. Files: apps/worker/src/llmRoutes.ts (configs, Test), migration 0001 (`model_configs`); apps/web/src/configForm.ts, configList.ts, ConfigDialog.tsx, NewModelConfig.tsx, TestConfigDialog.tsx, testResult.ts, effort.ts, SettingsPage.tsx (the configs part), api.ts (config types).

**13 Costs and money.** What agrees: costs computed, rounded to micro-dollars and shown; the spending cap; VAT; the run report; `ZOMBIE_MS` (two). Files: apps/worker/src/costs.ts, vat.ts, migration 0003, llmRoutes.ts (cost, cap); apps/web/src/costs.ts, money.ts, pricing.ts, runReport.ts; scripts/seedStats.ts (its cost).

**14 Statistics and time.** What agrees: active time (quarters), run times, usage and its reasons vs the Worker's error kinds, the two `duration`s, `MONTHS` (two), the "finished" subquery and rasterize page parse (duplicated), the tab and filter state. Files: apps/worker/src/activity.ts, activeTime.ts, runTimes.ts, projectStats.ts; apps/web/src/runTimes.ts, usage.ts, time.ts, chart.ts, StatsPage.tsx, UsageTab.tsx, RunTimesTab.tsx, EffortTab.tsx, TimeChart.tsx, statsParts.tsx.

**15 Projects: names, export, import, deletion.** What agrees: names (the retry loop twice, `isNameConflict`, `MAX_NAME_LENGTH` twice), the PDF upload (twice), the `.s3l` writer and reader, deletion and the orphans, call places. Files: apps/worker/src/names.ts, index.ts (projects), projectFile.ts, deletion.ts, migrations 0002 and 0004, scripts/callPlaces.ts, fill-call-places.ts; apps/web/src/names.ts, projectFile.ts, api.ts (projects), ExportDialog.tsx, DeleteProjectDialog.tsx, KnownPdfDialog.tsx, RenameDialog.tsx, App.tsx (picking a PDF or a project file).

**16 The lens and its writers.** What agrees: the lens's types and constants and the prompts that restate them (`*_VALUES`, `Apply*Unit`), the symbolic format and its description in the prompt, measure building (lens.ts vs score.ts), the dynamics list. Files: packages/notation/src/lens.ts, symbolic.ts, durations.ts, fraction.ts; packages/prompts/src/lensForm.ts, extract.ts, applyReview.ts (types).

**17 Score structure and linking.** What agrees: piece splitting (three), the first measure stretch (two), spans and links, the score checks, system numbering (three). Files: packages/notation/src/score.ts, spans.ts, links.ts, scoreChecks.ts; apps/web/src/linking.ts, musicInputs.ts, fixLayout.ts (`firstNumbers`), humanReview.ts (`placedSystems`).

**18 Issues across the stages.** What agrees: issue numbering, answer letters (four), `latest(issue)` (three), the two-systems rule (two), the review and apply-review logs (two), code's issues (two copies in runExtract), the issue boxes on crops. Files: packages/prompts/src/review.ts, applyReview.ts; apps/web/src/review.ts, applyReview.ts, humanReview.ts, transcription.ts, extract.ts, runExtract.ts, runReview.ts, runApplyReview.ts, finishHumanReview.ts, HumanReviewCards.tsx, ExtractionView.tsx.

**19 Layout and skew, from analysis to editors.** What agrees: `skew_analysis` and `layout`, their notes and finishers, the page editors' shared parts, `LINE_REACH` (two), the save chain (four copies, with group 20). Files: packages/imaging/src/skew.ts; packages/prompts/src/layout.ts; apps/web/src/skewAnalysis.ts, runSkewAnalysis.ts, layout.ts, runLayout.ts, fixSkew.ts, fixLayout.ts, finishFixSkew.ts, finishFixLayout.ts, pageEditor.tsx, SkewEditor.tsx, LayoutEditor.tsx, PageView.tsx.

**20 Analyze and its forms.** What agrees: metadata and observations from the prompt through the checks to the forms and views; confidence shown three ways; place labels (two). Files: packages/prompts/src/analyze.ts; apps/web/src/analyze.ts, runAnalyze.ts, fixMetadata.ts, fixObservations.ts, finishFixMetadata.ts, finishFixObservations.ts, AnalysisView.tsx, MetadataView.tsx, ObservationsView.tsx, fieldList.tsx, CheckList.tsx.

**21 MEI: build, view, edit, engrave, render.** What agrees: the builder ↔ the view ↔ the checks ↔ Verovio; measure ranges parsed twice; `verovio.d.ts` (web and eval). Files: packages/notation/src/mei.ts, xml.ts; apps/web/src/runBuildMei.ts, meiView.ts, meiChecks.ts, meiSchema.ts, fixMei.ts, engrave.ts, engraving.ts, runEngrave.ts, verovioRender.ts, rendering.ts, metronomeFont.ts, downloads.ts, attribution.ts, MeiWorkspace.tsx, MeiCode.tsx, FixMeiView.tsx, EngravingView.tsx, verovio.d.ts; apps/eval/src/engrave.ts, verovio.d.ts.

**22 The UI kit and styles.** What agrees: the dialog shell (five), tabs (two), filter panels (two), pickers (four or more), the info toggle (three), click outside (two), `useMediaQuery` (three), `useNear` (two), the save chain, `plural` (ten or more), `styles.css` against `docs/style.md`, the CSS-regex tests (two). Files: apps/web/src/DropdownMenu.tsx, ProjectPicker.tsx, ProjectFilter.tsx, Info.tsx, ConfirmDialog.tsx, RenameDialog.tsx, DeleteProjectDialog.tsx, ExportDialog.tsx, KnownPdfDialog.tsx, Header.tsx, Home.tsx, icons.tsx, FittedText.tsx, ProgressBar.tsx, ProgressRing.tsx, useWide.ts, themes.ts, navigation.ts (`useNoBrowserBar`), StatsPage.tsx and SettingsPage.tsx (tabs, filters, pickers), fieldList.tsx (`Picker`), styles.css, themes.css, stageCardStyles.test.ts, checkListStyles.test.ts, errorText.test.ts.

**23 Routing, navigation, the desktop shell.** What agrees: hash routes and tabs from the hash, history, the leave guard, the "leave while running" text (web and desktop). Files: apps/web/src/route.ts, navigation.ts, history.ts, useHash.ts, App.tsx, Menu.tsx, ProjectView.tsx, ArtifactView.tsx, StageDetails.tsx, leaveGuard.ts; apps/desktop/src/main.ts, leaving.ts.

**24 Hosts, deployment, scripts, eval.** What agrees: the Worker on Cloudflare and on Node (D1, R2, secrets, `/api/info`, versions), `wrangler()` (three), argument parsing (four), the seeded PRNG (two), `FIXTURES` (two), eval vs web (`PdfPane`/`PdfView`). Files: apps/desktop/build.ts, src/server.ts, d1.ts, r2.ts, secrets.ts; apps/worker/src/testPlatform.ts, versions.ts, wrangler.jsonc.template, scripts/config.ts, setup-cloudflare.ts, try-llm.ts; scripts/appServers.ts, replay.ts, make-fixture.ts, screenshots.ts, seedStats.ts, notices.ts; apps/eval/src/* (its own coherence, and what it shares with the web app).
