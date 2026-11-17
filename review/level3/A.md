# Level 3, component A: Foundations and contracts

Level 2 groups 01 (hashes, keys, canonical JSON), 05 (pipeline state, both sides), 07 (errors and request plumbing), plus every other group's references to them and every "move it to `@score3ly/core`" proposal.

**Group 06 (running a stage) is in no component** (README table: A 01/05/07, B 02/03/04/19, C 08–13, D 16–18/20/21, E 15/24, F 14/22/23). Its run-protocol, lock-table and D1 findings are contracts and are merged here (A11–A15, A19); its web-side lookups and runner helpers are listed under "Group 06, the rest" so they aren't lost. Orchestrator: confirm, or hand them to another component.

## Map

- **`@score3ly/core` today** (no dependencies; main entry runs in browser, Worker, Node): `keys.ts` (`sha256Hex`, `canonicalJson`, `keyOf`), `project.ts` (`Project`, `RunMode`, `PipelinePosition`, `ListedProject`), `pageSelection.ts`, `sse.ts` (`readSse`), `callEvents.ts` (`CallEvent`); entries `/pdf` (DOM) and `/pdfjs-assets` (Vite, Node). Imported by web, worker, eval. **Not** by imaging, notation, prompts (no dependency) nor declared by desktop (it bundles the worker).
- **Keys** (group 01): content key = SHA-256 of bytes (verified by R2's `sha256` on put); recipe key = `keyOf(recipe)` (OPFS file, fingerprint row, image in an LLM request); stage key computed only by the web (`*StageKey` per step), trusted blindly by the Worker for reuse across projects and on import; request key computed only by the Worker (`keyedRequest`).
- **Pipeline state** (group 05): D1 `stages.status` CHECK ↔ Worker `pipeline.ts` types and rules (`RECIPE`, `MANUAL_STEPS`, `LLM_STEPS`, `isStale`, `rewriteFrom`, `readPipeline`, the run routes) ↔ web `api.ts` `Api*` mirrors ↔ web `pipeline.ts` `toPipeline` (UI `Stage`, `ready`, stale → failed) and `steps.ts` (registry, `carriedInputs`). Only `PipelinePosition` is shared via core.
- **Run protocol** (group 06): `start` → `outputs`* → `heartbeat` (60 s) → `finish` | `stop`; `resolve` for carried stages; `versions.ts` optimistic lock (`X-Project-Version`, hand-written route table `whatOf`); web `stageRunner.runPlan`, `projectFetch` (version map).
- **Errors** (group 07): Worker answers `{error, code?}` at ~110 sites, 11 untyped codes, no `app.onError`; web turns failures into exceptions four ways (`ApiError` via `checked`, `LlmRefused`, `WorkerRefusal`, plain `Error`) plus two outside api.ts, and into text ~60 ways (`${err}` ×21, `err.message` ×32+10).
- **Contracts in this component:** (1) `{error, code}` body; (2) stage status set ×4; (3) `ApiStage` ↔ `readPipeline`; (4) step facts (kinds, recipe, droppable) both sides; (5) stale rule both sides, two clocks; (6) "first stage not done" ×7; (7) stage key (web) ↔ reuse (Worker); (8) content key ↔ R2 verification; (9) model part of keys ×2; (10) lock classes ↔ routes; (11) heartbeat period ↔ `STALE_MS`.

## Corrections and extensions from later groups

- **07 #10 narrowed wrongly:** group 09 #1 shows adapter constructors also throw in `prepareCall` (Vertex `parseServiceAccount`), so a bad key file in the config's Test shows "HTTP 500", not only a D1 failure. Merged into A1.
- **05 #9 (resolve over 100 params):** group 06 #12 gives the one-statement fix (`json_each(?)`) and extends to statements per invocation (start/outputs: one INSERT per input id); group 15 #10 adds the import's huge batches; group 24 #3 offers `NodeD1` as the place to enforce D1's limits in tests. Merged into A3.
- **Optimistic locking found broken from outside:** group 19 #1 (SkewEditor per-page save chains), #2 (version map can go backwards), group 21 #2 (FixMeiView draft saves unchained, StrictMode double save) all end in self-inflicted `stale_version`. The fix belongs with the lock (api.ts). Merged into A4.
- **01's open check on configForm 387** (hand-built canonical secrets): dropped by group 12 #5 (both sides of that comparison use the same function).
- **01 #6 `sameConfig`/`sameValues`:** group 12 #5 adds a third copy in the web (configForm 384); group 12 #6 shows import writes `secrets_json` unchecked. C's.
- **01 #15 base64:** settled by group 09 #15 (one `core/base64.ts`; `Uint8Array.toBase64` not yet, Node 22 lacks it).
- **07 #1's consequence:** group 08 #11 (the web restates the deleted/unsupported config texts because the Worker's don't reach the screen); group 15 #13/#15, 12 (`${err}`), 14 #11 (tab errors dropped) all lean on it.
- **05 #6 step lists:** groups 06 #18 (effort.ts `MANUAL`) and 14 #8 (runTimes `MANUAL`/`STEPS`/`LLM`, costs.ts `STEPS`, dead `STEP_TITLES`) add copies: about 8 step lists in all.
- **05 "derived state the Worker could send":** group 06 "run protocol is implicit" asks for the same state machine; merged into A11.

## Findings

Priority: **P1** bugs that hurt now, **P2** bugs that will hurt, **P3** structural (prevents bugs), **P4** cleanup. Source in brackets.

### P1: bugs that hurt now
- **A1. The Worker's refusal text never reaches the user, and thrown errors break `{error}`** [07 #1, #2, #10; 09 #1; 08 #11]. `checked` (api.ts 65) makes every refusal "HTTP 409"; ~50 screens and every failed stage's stored error show it (style.md forbids codes). Export with unfilled call places answers 500 (projectFile 450) with the fix lost. No `app.onError`: D1 failures and adapter constructor errors (Vertex key file, in Test too) become Hono's text/plain 500. Fix: `onError` → `{error, code: "internal"}` and log; `prepareCall` turns `LlmError` from `createAdapter` into a 409 `bad_secret`; export's condition → 409 with code; then A6 (one `ApiError` carrying the body's text). certain.
- **A2. Stale refusals shown twice** [07 #4]: `checked` dispatches `STALE_EVENT` (App's dialog) and throws; callers show their own banner ("Dropping the stage failed: Error: HTTP 409"). Only App's rename special-cases it. Fix within A6/A7: `errorText` returns null for stale, or catches ignore `isStale`. certain.
- **A3. D1 limits only production has** [05 #9; 06 #12; 15 #10; 24 #3]. `resolve` binds every input id (pipeline.ts 819; the only unchunked `IN (…)` in the Worker, grep confirmed): a carried `human_review`/further review on a 100-system score fails on D1 (> 100 params), not locally → pipeline stuck. `start`/`outputs`/`fix`/`edit` write one statement per input id (statements-per-invocation limit, counting to verify), import uses batches of hundreds–thousands. Fix: `json_each(?)` (one parameter, one statement) for `resolve`, `stage_inputs`, `output_inputs`; verify batch counting on the deployed instance; a D1-limits mode in the test D1 (NodeD1, crossing E). certain (resolve), check (statement counting, import).
- **A4. The lock refuses the app's own saves** [19 #1, #2; 21 #2]. `projectFetch` stores whatever version arrives last (api.ts 84–86), so a refresh answer arriving after a save sets it back → next save 409; editors that fire checked requests in parallel (SkewEditor per-page chains, FixMeiView flush + MeiCode flush, StrictMode double `mei_base` save) refuse their own second save → "changed on another device" dialog and lost typing. Fix in api.ts: monotonic version map (`max`) and one queue per project serializing checked requests; the editors' own chains then go (B, D). certain (mechanism), check (frequency).

### P2: bugs that will hurt
- **A5. `canonicalJson` edge cases** [01 #1, #2]: `undefined`/function in an array → `"[1,]"` (invalid JSON, stored content unparseable or `JSON.parse(canonicalJson(x))` throws); top-level `undefined` returns `undefined` typed as `string`; `toJSON`, typed arrays, Maps ignored. Fix: `null` in arrays like JSON; document "plain JSON only"; tests. No valid existing key changes. certain (bug), check (any caller passing such a value).
- **A8. API types restated and already drifted** [05 #1, #2; 08 #1]: `Stage.modelConfig.unsupported` returned but not typed on the Worker; `LlmAnswer` lacks `vatPercent`; the status union ×4 (CHECK, Worker, core inline, web). Web types are casts of `res.json()`. Fix: core layout below, Worker routes annotated (`c.json<T>`), web `Api*` become imports. certain.
- **A9. Step facts on both sides, pinned by a regex over source** [05 #6, #7, #8; 06 #18; 14 #8]: `LLM_STEPS` checked by steps.test reading the Worker's text; `MANUAL_STEPS` (carrying, dropping) unpinned against the web's `kind: "manual"`; ~8 step lists (Worker pipeline, runTimes; web steps, effort, runTimes, costs ×2 incl. dead `STEP_TITLES`); `StepInfo.optional` ≡ manual; drop rule twice. Fix: `core/steps.ts` `StepId`, `STEP_KINDS`, `RECIPE`, `isDroppable({step, inRecipe})`; web `STEPS: Record<StepId, …>`. certain.
- **A10. Stale rule decided on the browser's clock, four copies** [05 #4; 06 c]: `STALE_MS` ×2, `isStale`/`toPipeline`/`nextStaleAt`/`home.positionState`. A clock 2+ min ahead shows a live run as "Interrupted", Run enabled, start 409. Fix: the Worker sends `interrupted`/`staleAt` in `readPipeline` and `PipelinePosition` (preferred), else `isInterrupted` in core. certain (dup), check (skew in practice).
- **A11. The run protocol has no run identity** [05 #10; 06 #9, #13, #16; 06 "versions.ts check-then-raise"]. Stale run and its restart share the stage id (late writes from the first accepted, heartbeat un-stales it); `start` is read-decide-write (two tabs both run and pay); leaving keeps "running" up to 3 min; a failed stage retried after a deploy keeps old outputs under the new stage key (mixed versions reused later); the lock's check-then-raise isn't atomic. One design: `start` = conditional `UPDATE … WHERE status IN (…) OR heartbeat_at < ?` checking `meta.changes`, returns a `runId` sent with heartbeat/outputs/finish; `start` drops outputs when `stage_key` differs; a "release" on leaving (failed "interrupted", outputs kept); version raise as `UPDATE … WHERE version = ?`. Needs a docs decision (database.md "Interrupted runs"). check (design; each case rare).
- **A12. The lock table restates the routes by hand** [06 #11, #14]: `versions.ts whatOf` by path segments; a new route is silently unlocked; `config` route doesn't refuse while another stage runs (the others do). Fix: lock class declared at registration (`locked("checked", h)`) or a test walking `app.routes`; with A19's middleware. certain (fragile), check (which form).
- **A13. LLM stage keys leave out the stage config beyond the model** [01 #8]: fine while `LLM_CONFIG` has only `modelConfigId`; a second setting would have to be added to five keys by hand, else wrong reuse (Worker trusts keys blindly). One `llmStageKey(step, version, {config minus modelConfigId, model, imageRecipe, inputs})`. Keep `modelConfigId` out so configs with the same model still share. check (design risk).
- **A14. Imaging versions missing from keys** [01 #9; 03 #1 (B)]: `findSkew` has no version in `skew_analysis`'s key; `pdfPages.ts` none in page recipes. Rule: every pixel-producing or measuring function has a version, collected in one `IMAGE_VERSIONS`. B owns the fix; A owns the rule in keys. certain.
- **A15. Status codes read as meanings** [07 #9]: any 409 → "a stage is running" (Delete, Export), any non-stale 409 → "name taken" (rename). Fix with A6/A7: show the Worker's text or match on `code` (delete's 409 needs one). check (not wrong yet).
- **A16. Run time on the card spans retries and manual work** [05 #11; 13 runReport]: `finishedAt − startedAt` with `started_at` kept across retries. Decide the meaning (summed `duration_ms`?), compute once. check (owner).

### P3: structural
- **A6. One error class, one error-to-text** [07 #3, #6, #13; 06 stageRunner 69]: four classes → one `ApiError(status, body)` (message = `body.error`, `code`, `body` extras, stale dispatch) built by one `checked` that parses every non-ok body; `refusedOr`, `LlmRefused`, importRows' branch go; `errorText(err)` (core: platform-free; also used by worker call recorder and worker-thread shells, group 04 #3); `ask` prefixes the item uniformly. certain.
- **A7. Error codes and who writes user text** [07 #5, #7, #8, #11; 08 #11; 12 "error texts"]: `ErrorCode` union + `ApiErrorBody` in core; Worker `refuse(c, status, error, code?)` that also logs the reason (request log today sees only the status). Decide one rule: the Worker's `error` is the user-facing text for refusals a person can cause (audit ~110 sites against style.md), the web overrides only by `code`; stale and name-taken texts then live once. Do the audit together with A1, not after. certain (contract), check (owner: the rule).
- **A17. "First stage not done" ×7, two variants** [05 #5]: correct only because `toStage` maps carried → planned first; `ProjectView.resolveCarried` remembers `carried` by hand. One `firstNotDone(ApiStage[])` in web pipeline.ts; one SQL fragment on the Worker. Goes away largely with A10's "Worker sends derived state". certain.
- **A18. Storage conventions as literals** [01 #3, #4, #5; 15 #6; 24 #19]: hex-64 check ×5 → `isSha256Hex` in core; R2 key layout in six files → `apps/worker/src/r2Keys.ts` (`pdfKey`, `contentKey`, prefixes) with `storePdf` (two PDF uploads) and `putJson` (vs `PUT /api/content`); `PDFS` binding name lies (holds content too) — rename with it or not at all (owner). certain; rename check.
- **A19. Worker run routes' prologue ×12 and `pipeline.ts` two jobs** [06 #10; 05 level-1 split]: a middleware on `/api/projects/:pid/stages/:sid/*` loading the entry into `c.var` (404, carried 409, `anyRunning`, lock class from A12); split `pipelineRules.ts` (`rewriteFrom`, `readPipeline`, `isCarried`, …) from the routes. certain.
- **A20. Web content puts** [01 #5, #12; 06 #5]: 8–16 local `json`/`*Bytes` helpers → `putJson(value)` in api.ts (editors stop importing from finishers); `JSON.parse(canonicalJson(x))` ×6 → `normalized()` in core keys. certain.
- **A21. Config equality decided three times** [01 #6; 12 #5]: projectFile's private `canonicalJson` (different function, same name) + `sameConfig`, llmRoutes `sameValues`, web configForm `sameValues`. One `sameConfigValues` driven by `CONFIG_VALUES` in the Worker; the web's kept with a test or dropped (C decides). certain.
- **A22. Copies of `sha256Hex`, base64, `Fingerprint`, model key part** [01 #7, #10, #14, #15; 09 #15]: imaging's private copies go once imaging depends on core; tests import core's; leipzig.ts's sync one renamed; `Fingerprint` type in core (imaging imports it); `modelKeyOf({provider, model, effort})` in core used by web `modelKey` and the Worker's request key. certain (sha, base64), check (fingerprint, model key: minor).
- **A23. No test pins the two sides** [05 tests; 06 tests; 01 tests]: `runPlan` (resume, abort, finish on error) untested; content PUT mismatch untested; `keyedRequest` ignoring `cacheUpTo` untested; home vs panel labels; `resolve` >100 ids. Most become compile-time with core types (A8, A9). certain (gaps).

### P4: cleanup
- **A24.** `stopped` handled by four readers but never in a pipeline [05 #3]: narrow the API's status type, keep it on the row type. check.
- **A25.** `toStage`'s unused `later` (quadratic) [05 #12]; `ProjectView.run` restates `canRun` [05 #13]; `readPipeline` groups by spreading (quadratic) [05 #14; 14 #13]. certain.
- **A26.** `listKey` hashes `JSON.stringify` by hand [01 #11]; `systemsChanged` by `JSON.stringify` [01 #13]. certain / check.
- **A27.** `errorText.test.ts` misses PdfView's `pdf-status` (also `String(e)`) [07 #12]. certain.
- **A28.** keys.test.ts + sha256.test.ts → one file, with the array/undefined cases [01 tests]. certain.

## Proposed layout of `@score3ly/core`

Merged from groups 01, 02, 03, 05, 07, 08, 09, 10, 11, 12, 13, 14, 15, 17, 23, 24. Rules: **no runtime dependencies, no React, no DOM in the main entry**; `imaging`, `notation`, `prompts` and `desktop` gain a dependency on core (core depends on nothing, so no cycle). Wire shapes under `api/`, platform-free logic at the top.

```
packages/core/src/
  index.ts           re-exports the main entry
  keys.ts            sha256Hex, canonicalJson (fixed), keyOf, isSha256Hex, normalized   [01 #1 #3 #12; 06 #5]
                     modelKeyOf({provider, model, effort})                               [01 #10]  (check)
  base64.ts          bytes <-> base64, base64url                                         [09 #15; 01 #15; 08]
  box.ts             Box, boxProblem; area, intersection, clamp/round                    [02 #1 #2, "box module"]  (B decides what beyond Box)
  steps.ts           StepId, STEP_KINDS, RECIPE, isDroppable                             [05 #6 #8; 06 #18; 14 #8]
  time.ts            QUARTER_MS, quarterOf                                               [14 #4]
  items.ts           pageItem/systemItem, itemKind, parse                                [14 #17; 17 #6]  (check: core only if the Worker parses items; it does in runTimes SQL and callPlaces)
  names.ts           MAX_NAME_LENGTH, firstFreeName                                      [15 #2]
  pageSelection.ts   (as today)
  sse.ts             readSse + sseData (encoder)                                         [08 #12]
  errors.ts          errorText(err)                                                      [07 #6]
  texts.ts           LEAVING_A_RUN                                                       [23 #7]  (or: duplicates + a test; owner)
  jsonSchema.ts      one validator of the schema subset, Problem type                    [10 #2 #14]  (placement check; or a package)
  api/
    project.ts       Project, RunMode, ListedProject, PipelinePosition {status: StageStatus, interrupted?}  [05 #2 #4]
    pipeline.ts      Pipeline, Stage, Output, Dropped, StageStatus (API: without "stopped"), staleAt/interrupted  [05 #1 #2 #3 #4]
    errors.ts        ApiErrorBody, ErrorCode                                             [07 #8]
    llmCall.ts       (grown from callEvents.ts) CallRequest, CallContent, CallPlace, CallStatus, CallAnswer,
                     StreamEvent, CallEvent, IMAGE_MEDIA_TYPES, MAX_CACHE_MARKS          [08 #1]
    modelConfigs.ts  Provider, Family, Effort, Routing, Place, Price, ModelOptions, PROVIDER_NAMES,
                     ModelConfig, NewModelConfig, config summary, Settings, isVatPercent, isCapUsd  [11; 12 #2 #8; 13 #9]
    outcomes.ts      call outcome / failure reason union                                 [13 #7; 14 #9]
    stats.ts         the four statistics answers                                         [14 "no shared types"]
    projectExport.ts EXPORT_FORMAT, ProjectExport, formatProblem                         [15 #7]
    host.ts          Host, WindowTheme, isWindowTheme, Info (/api/info)                  [24 #4]
    fingerprint.ts   Fingerprint, StoredFingerprint                                      [01 #14]  (check)
  pdf.ts (entry /pdf)          drawPage, drawPages, loadPdf, the pdf.js data-folder table  [03 #10 #12]
  pdfjsAssets.ts (entry)       imports the folder table from pdf.ts                        [03 #10]
```

**Stays out of core:** `ApiError` and `checked` (web api.ts: only the web reads errors); `refuse()` (Worker); R2 keys, `storePdf`, `putJson` on the Worker (`r2Keys.ts`); web `putJson` (api.ts); `PRODUCERS`/`latestOutput` (web "stage inputs", group 06 #1; the Worker doesn't need them); `useSettledWidth` (React; two copies or a `core/react` entry, group 03 #12, check); the notation exports for MEI (group 21: nothing there needs core); `LayoutSystem` (imaging, group 02).

**Choice to make (owner):** Workers' routes annotated with core types (`c.json<T>`) is enough to pin both sides at compile time; Zod (named in the docs, not a dependency, group 10) is not needed for this.

## Order of fixes and dependencies

1. **Core's ground, no behaviour change:** A5 (canonicalJson fix + tests, A28), `isSha256Hex`, `base64.ts`; add core as a dependency of imaging, notation, prompts, desktop; remove copies (A22). First, because B, C, D, E import from it.
2. **Wire types into core** (A8, A9 types, A7's `ErrorCode`, and the other groups' `api/*` files): type-only moves, then annotate the Worker's routes; fixes the drift at compile time. Before C/D/E/F refactor their api.ts parts.
3. **Error contract** (A1 → A6 → A7 → A2, A15): Worker side first (`onError`, `refuse`, codes, export 409, `prepareCall`), then the web's one `ApiError` + `errorText`, with the text audit of A7 in the same batch (fixing A1 alone shows ~110 terse texts).
4. **Locking** (A4): monotonic versions + per-project queue in api.ts; then B and D remove their editors' own chains.
5. **D1 limits** (A3): `json_each` in `resolve` and the input tables; test D1 enforcing limits (with E's NodeD1 move, group 24 #3); verify the import on the deployed instance.
6. **Step facts and derived state** (A9 logic, A17, A10): `STEP_KINDS` in use on both sides, `optional` removed, `firstNotDone`; Worker sends `interrupted`/`staleAt`. Before group 23's ProjectView split (23 says so) and before group 06's stage-inputs module.
7. **Run protocol** (A11, A12, A19, A16): one design after a docs decision; touches the routes, `runPlan`, ProjectView leaving.
8. **Storage and keys** (A18, A20, A21, A13, A14 with B).
9. **Cleanups** (A24–A27).

**What changes keys or stored formats:** A5: none (only values that were invalid). A14: `skew_analysis` stage keys and page recipe keys change → images and skew recomputed, free. A13: LLM stage keys change → stages re-run but every request is served from the call cache (request keys unchanged), free, if `modelConfigId` stays out. A11 (drop outputs on key mismatch): may re-run items, cached. A22 `modelKeyOf`: no change if the same three fields. **Nothing in A changes request keys** (no paid re-runs). A7 changes the texts stored as stages' errors (cosmetic). A18 binding rename: config change on deployed instances (owner).

## What crosses into other components

- **B:** `Box`/`boxProblem` into core (02); `IMAGE_VERSIONS`, `findSkew` and page-image versions (A14); pdf.js table and `drawPages`/`loadPdf` in core/pdf (03); editors' save chains removed after A4 (19, 21 is D); `Fingerprint` type (A22).
- **C:** `llmCall.ts`, `modelConfigs.ts`, `outcomes.ts` in core; `bad_secret` refusal (A1, 09 #1); `sameConfigValues` (A21); `secrets_json` on import (12 #6, with E); `ask` prefixing and unusable helper (06 #4, 07 #13).
- **D:** FixMeiView saves (21 #2) on A4's queue; items/system numbering in core or web (17 #6, A's `items.ts` check).
- **E:** R2 keys and `storePdf` (A18) belong with the Worker's storage; `projectExport.ts` and `names.ts` in core; D1 limits test via NodeD1 moved to `apps/worker/src/node/` (24 #3); `host.ts`; the import's batch sizes (A3).
- **F:** `stats.ts`, `time.ts` (quarters), `outcomes.ts`; `errorText` in the tabs (14 #11); `LEAVING_A_RUN` (23 #7); ProjectView split after step 6.
- **Unassigned group 06:** see below.

## Group 06, the rest (not in any component)

Web-side runner findings, not merged above: #1 "latest stage of X" ~25× with diverging rules → `PRODUCERS` + `latestOutput` in a web `stageInputs.ts` (pairs with A9); #2 review inputs derived twice (`reviewInputIds` vs runReview) → pure `musicSources`; #3 notes count only this run's items (layout visible); #4 `markUnusable().catch(() => {})` ×8 → one helper; #6 preload block ×4; #7 LLM start prologue ×5; #8 errors before `start` never recorded (rule to decide); #15 itemTiming's tracker reset by an older item (certain, one-line fix); #17 content loaded before a reuse; #18 finisher shapes. Suggest: component A takes the run protocol (done above), a later "stage inputs" pass or D takes #1/#2, C takes #4/#7.

## Patterns (merged, with counts)

| Pattern | Count (this component) | Seen elsewhere | Likely cause |
|---|---|---|---|
| Type or constant restated across the API instead of shared | 11 (pipeline types, status ×4, `STALE_MS`, step lists ~8, drop rule, model key part, `Fingerprint`, config equality list, error codes, stale text ×3, name-taken text) | 08, 11, 12, 13, 14, 15, 23, 24: ~12 more shapes | core began with keys and `Project`; later shapes written where first needed (Worker), mirrored in api.ts with "Mirrors…"; core not seen as the home |
| Helper written again instead of imported | 9 kinds (hex ×5, sha256 ×4, canonicalJson ×2, JSON bytes ×8–16, error classes ×4, error→text ~60 sites, base64 ×3, unusable ×8, preload ×4) | most groups | quick inline version faster than finding the shared one; package boundaries (imaging ↛ core) |
| One rule re-derived at each reader | 4 (first-not-done ×7, stale ×4, latest stage ~25, review inputs ×2) | 17, 18 | each screen/runner written for its own data shape; copied from the neighbour |
| Contract kept equal by a regex over source or a comment | 3 (steps.test on `LLM_STEPS`, export-format test (15), errorText class names) | 22 (CSS tests) | the cheap check instead of a shared import |
| Convention spelled as literals | 2 (R2 keys in six files, 409 read as a meaning ×3) | | entry module can't export helpers; no codes on refusals |
| Error lost, swallowed or mis-statused | 5 (`checked` drops the text, 500 for a known condition, no `onError`, `markUnusable` swallowed, errors before `start` unrecorded) | 09 #1, 14 #11 | each new request kind patched locally instead of fixing `ApiError` |
| Concurrency of runs and saves not designed | 8 (run identity, double start, stale wait, version mix on retry, non-atomic lock, version map backwards, parallel save chains ×2 incl. 21) | | protocol designed for one tab running one stage to its end; Stop, leaving, retries, editors added around it |
| Platform limit enforced only in production | 3 (D1 params, statements per invocation, import batches) | | local SQLite (wrangler dev, desktop, tests) has no D1 limits; learned once in projectFile.ts, not made a helper or test |
| Versioning rule kept by hand | 2 (`findSkew`, hand-picked stage key inputs) | 03 (page images), 16, 20 | rule followed per module as written; no single list |
| Edge case in a generic helper | 1 (+1 undocumented limit) | | tested only on the cases at hand |
| Dead or defensive code | 4 (`stopped` ×4 readers as one, `optional`, `later`, `canRun` restated) | | code changed, callers not revisited; types include every DB value |
| Comparison by `JSON.stringify` | 1 | | quick local check, safe only by where data comes from |

**Total findings: 28** (A1–A28), plus 10 of group 06 listed for reassignment.
