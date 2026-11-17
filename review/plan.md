# The plan: the fixes, in batches

From level 4 and the level 3 notes A–F (findings cited by their ids: A1–A28, B1–B31, C1–C34, D1–D30, E1–E26, F1–F24; owner decisions by their number in level4.md §5, "dec. N"). Nothing here is fixed yet: the fixes wait for the project owner's review of this plan.

## The owner's decisions (2026-11-17, walking through the plan)

These override the recommendations below where they differ.
- **The paid release:** one release, as recommended; the owner won't review every prompt for it, and accepts the cost (the expensive stages aren't re-run often). Done stages stay done after the key change, and an exported and imported project arrives as it was; nothing is paid until a stage runs again.
- **No reader for old export formats:** there are no older exports to keep.
- **dec. 32, the review and reverts:** the review sees that `apply_review` reverted a change, and why. It keeps raising a problem that is still there, but adjusts that issue (and related ones) so that a solution *can* be applied, instead of repeating what was reverted.
- **dec. 10, dead calls:** decided by **no progress**, not by age: a call whose answer is still streaming is going normally; one with no progress for 15 minutes is dead. (Needs the call row to record its last progress, at most about once a minute.) The Worker's own timeout follows the same idea where it can.
- **dec. 14, unknown costs on a stage:** no change; the UI stays as it is.
- **dec. 1, error texts:** the Worker writes them. **Style:** start with a short sentence a user understands; end with what the developer needs to debug it (technical is fine there); not too long overall. Goes into `docs/style.md` with the batch.
- **dec. 25, same answer:** **case matters** everywhere ("schumann" and "Schumann" are different answers); the review's case-insensitive comparison changes to match the others.
- **dec. 33, a done `engrave` whose recipe can't be made again:** not marked; it stays shown as done.
- **dec. 7, a tab older than the deployed app:** at most a banner; the app stays visible and usable, never a dialog that forces a reload.
- **dec. 11, retired models:** configs of retired models never run (as `docs/llm.md`, "No longer supported", already says; done stages are still served from the stage cache). New configs naming a retired model's string are refused.
- **dec. 23, `imported_at`:** **kept** (`docs/database.md` 105: room for later choices about imported projects, e.g. their costs in the statistics).
- **E1, the import on the deployed instance:** the owner's test, in `docs/tasks.md` ("Check export and import on a large project"); nothing to do in the review.
- **Still to answer** (questions asked, 2026-11-17): the run id (dec. 2–3), the binding's rename (dec. 4), the orphan collection (dec. 18, a "free up storage" button in the settings proposed by the owner), the home card's spinner (dec. 44).

## Summary for review

### Decisions to make (important first, each with the recommendation)

**1. The paid release** (it changes request keys: every LLM call is paid again on one re-run of the projects the owner keeps testing on)
- Release it as **one release**, together with the open §16 tasks "Check the prompt and the response schema of …", which re-key every call anyway. Rec: yes (level 4 §4).
- dec. 6: drop `DESKEW_VERSION` from straightened-page recipes (B8; the docs decided to keep it). Rec: drop, in the paid release.
- dec. 29, 31, 32 (prompt content): "pieces only on this page" in analyze's page call *and* drop others silently; rename `startEndRepeat` → `bothRepeats`; let the review see reverts. Rec: all three yes.
- dec. 27: `prompts` imports notation's lens types and enums (ends the copies). Rec: yes.
- dec. 5: no Zod; our own schema builder and validator, docs corrected. Rec: own (Zod would re-key every call).

**2. LLM calls and money**
- dec. 15–17, call ownership (E4): a row for the serving stage on every cache hit (`served_from`, cost 0); statistics label them "from the cache" in Usage and leave them out of paid-call counts; call places become required (after the fill script ran on both databases) and placeless files are refused. Rec: all three as stated. Needed before the first real project's fixture.
- dec. 9, Claude SDK retries (C2): `maxRetries: 0` now; the stage's Retry is the policy. Rec: yes.
- dec. 10, zombie limit (C4): derived from the longest call timeout + a margin (not the docs' 15 min). Rec: derived.
- dec. 14, unknown costs: show "+ N calls of unknown cost" beside a stage's cost and in the run report. Rec: show.

**3. Contracts and runs**
- dec. 1, error texts (A7): the Worker's `error` is the text the user sees for refusals a person can cause; the web overrides only by `code`. Rec: Worker owns it; the ~110 refusals audited against style.md in the same batch.
- dec. 2–3, run protocol (A11): a run id, a conditional start, a "release" on leaving; errors before `start` recorded as the stage's failure. Rec: yes, after the save queue; database.md "Interrupted runs" rewritten.
- dec. 4: rename the `PDFS` binding to `STORE` with the storage module (config change on the two deployed instances). Rec: rename now.
- dec. 18: orphan collection scheduled (cron on Cloudflare, start-up on the desktop). Rec: scheduled.
- **No code, the owner:** export a real project on the deployed instance and import it there (E1). If D1 refuses the batches, dec. 19: a chunked import with an `importing` mark. Rec: chunked, only if it fails.

**4. Music rules**
- dec. 25 same answer case-insensitive; dec. 26 code issues identified by stored `kind` + places; dec. 28 two-systems rule enforced for extract too; dec. 35 answer keys "a, b, c in order" for every creator; dec. 30 a piece's `page` is its system's page; dec. 33 a done `engrave` whose stored recipe can't be made is marked stale; dec. 34 a test pins each prompt's text and schema hash to its version. Rec: all as stated.

**5. Statistics**
- dec. 38 manual rows in Run times follow Effort's rule; dec. 39 Run times and Effort keep separate fetches; dec. 40 `pageCount` = "the selected pages" for every stage; dec. 41 run time on a card = summed run durations; dec. 42 a failed rasterize doesn't count in Costs' pages. Rec: as stated.

**Accept the recommendations unless you object:** dec. 7 (reload prompt after a deploy), 8 (note "N at the angle limit"), 11 (retired models kept, new configs of them refused), 12 (`fake-dev` without `DEV_PROVIDERS` refused), 13 (OpenRouter's `raw` kept whole), 20 (PDF page count stored at ingest), 21 (`util.parseEnv` for secrets files on both hosts), 22 (seedStats dates relative to now), 23 (drop `imported_at`), 24 (`engines: ">=22.18"` + `.nvmrc`), 36–37 (body size and radii: whichever the CSS has now becomes the guide's, unless you say otherwise), 43 (ask the leave question before creating a project while a run goes), 44 (home spinner grey).

### The bugs that matter (P1)
- **A1** The Worker's refusal text never reaches the screen ("HTTP 409"); thrown errors become text/plain 500s.
- **A2** A stale-version refusal is shown twice (dialog and banner).
- **A3** `resolve` binds > 100 parameters: a carried human review on a 100-system score fails on D1 only.
- **A4 = B1, D2** The version lock refuses the app's own parallel saves (SkewEditor per page, FixMeiView's two debounces).
- **B2, D3** Editors' and forms' caches set before the save and never cleared; a form row being typed vanishes on reload.
- **D1** Finishing `fix_mei` loses the last 2 s of typing; the editor stays editable on a done stage.
- **B3** Bar lines at, past or on the box edges accepted: inverted or empty stretches, MEI zones inverted.
- **B4 = D5** A box near a system's edge counts for the neighbour: valid clarifications refused, apply_review misses a system.
- **B5** `checkMeiText` can wait forever (no error listener): Apply and Finish of `fix_mei` hang.
- **B6, D6** Notes of layout, skew, analyze and engrave counted from this run's items only (wrong after a resume).
- **C1** A malformed answer crashes the check, stays `ok` and cached, and every Retry fails the same way.
- **C2** Claude calls retried invisibly by the SDK, up to 3 billed requests per recorded call.
- **C3** "Calls of unknown cost" misses 524s and converted configs' calls.
- **C4** `ZOMBIE_MS` 15 min vs 60-min call timeouts: live calls shown as interrupted, of unknown cost.
- **C5** Cloning a config unchanged offers to rename it to its own numbered name.
- **C6** The model list's "as of" date is the fake files' date, forever.
- **C7** Wrong small texts in the config Test and the cap refusal.
- **D4** A tempo or segno in a resting voice makes a valid answer unusable (multi-rest defined three ways).
- **E1** Import may not run on the deployed instance (D1 batch limits); verify first.
- **E2 = F2** Esc while a dialog is busy (delete, create) leaves the app on a deleted project or loses the error.
- **E3** Numbered names exceed the 200-character limit.
- **F1** A `location.replace` breaks the history numbering; a held back/forward lands elsewhere.
- **F3** A new or imported project first flashes "This project doesn't exist".
- **F4** Durations read "1 min 60 s"; four duration formats.
- **F5** Run times count an edited manual stage twice.

### Structural changes, in a few lines
- **`@score3ly/core` becomes the home of every shared shape and small rule** (level 4 §2): wire types under `core/api/`, keys, base64, box geometry, steps, items, names, time, money, errors, the JSON Schema validator. imaging, notation, prompts and desktop depend on it.
- **One error contract** (`refuse` → `{error, code}` → one `ApiError` → `errorText`), **one write path** for edits (per-project queue, monotonic versions, a saver that Finish awaits), **Worker-derived pipeline state** and later a **run id**.
- **The Worker's big files split by concern:** `llmCalls`, `modelConfigs`, `settings`, `spending`, `callRecords`, `pipelineRules`, `projects`, `storage`, `statsSql`, `node/`.
- **notation owns the whole score** (`splitPieces`, `checkSystems`, the stretch walk); **web gains** `recipes`, `crops`, `workerClient`, `stageInputs`, `issues`, `files`, `format`, `ui/`, `editor/`, `saving`.
- **Tests at the seams and on both hosts:** NodeD1 with D1's limits, root `scripts/` typechecked, an adapter contract test, the replay's request snapshots as the guard for every move.

### The paid batch
B7 (`PAGE_IMAGE_VERSION`), B8 (`DESKEW_VERSION` out), B3 (`normalizeBarLines`, `layout` version), C31 (`lilypond` of reading issues to the model), D18a–d, D9's prompt sentence, D19, D7/D8 if the prompts state the rules; all version constants bumped once. **When:** after every batch that must keep requests byte-identical (schemas, model form, recipes) and after call ownership (E4) and the replay fix (E5), merged together with the §16 prompt-check tasks; then `npm run replay -- --update` reviewed as the diff of every request, and one re-run of the owner's projects. Stored formats change in other batches too (`llm_calls.served_from`, `EXPORT_FORMAT` 2, places required, `projects.page_count`, `StoredIssue.code`, `PdfRecipe.options`); none needs a migration of old data.

### The order of the batches
1. **Guards first:** tooling under checks and a replay that survives a second fixture (1).
2. **Bugs that need no structure** (2–6).
3. **Core ground, wire types, the error contract, the write path, D1 limits** (7–11).
4. **The Worker's modules, step facts, the run protocol** (12–16).
5. **LLM answers, adapters, configs, the model list** (17–21).
6. **Images** (22–24), **the UI kit and the editor kit** (25–26).
7. **Music** (27–31), **call ownership** (32).
8. **The paid release** (33–34), then **statistics, ProjectView, tooling, CSS, cleanups** (35–39).

## How every batch is done

- Read `review/README.md`, this plan's batch, and the level 3 entries it cites (they cite level 2; go down only where a step needs it). The batch's scope is a guide: follow the finding to wherever it lives.
- **A bug is reproduced in a test first,** then fixed and the test seen to pass (CLAUDE.md). Structural moves keep behaviour; where a move has no test at its seam, write one before moving.
- **The replay guards requests:** a batch that touches prompts, schemas, recipes, image making or how requests are built runs `npm run replay` (with `CHROMIUM_PATH` in a cloud session) and must leave the request snapshots unchanged. Only the paid release (33–34) may run `-- --update`.
- End: `npm run typecheck --workspaces` (and the root typecheck once batch 1 added it), `npm test`, the replay where it applies; anything writing `package-lock.json` through `npx npm@12.2.2`; update the docs named under "Docs to update"; commit (one commit per batch, or a few). Mark the batch done in the table at the end.
- A batch marked **waits on dec. N** starts only once the owner has decided; where it says "else", the rest of the batch can go ahead.

## The batches

Size: S (an hour or so), M (a session), L (a long session; split at the marked seam if needed). Keys: **R** request keys (paid), **S** stage keys only (free from the call cache), **F** stored format, **–** none.

### 1. Tooling under checks; replay safe for many fixtures
- **Scope:** root `tsconfig.json` + root `typecheck` script and CI step (`.github/workflows/tests.yml`); `scripts/syntax.test.ts` removed; `scripts/appServers.ts` `stopAll`; `parseArgs` in every script; `scripts/screenshots.ts`, `seedStats.ts` deletion guards; `apps/desktop/src/server.ts`, `main.ts` failure paths.
- **Closes:** E18, E5, E10, E11.
- **Depends on:** nothing. **Keys:** –. **Size:** M.
- **Tests:** `stopAll` then `startServers` on the same ports (E5); a script given a missing flag value refuses (E10); `serve()` on a taken port rejects (E11). The root typecheck will find errors in scripts: fix them here.

### 2. LLM call and cost bugs
- **Scope:** `apps/worker/src/llm/index.ts` (`maxRetries`), `costs.ts`, `failures.ts`, `llmRoutes.ts` (cap text, Test texts, abort kind), `llm/generateModelList.ts`/`scripts/generate-model-list.ts` (`asOf`), web `NewModelConfig.tsx` (`offerRename`), `itemTiming.ts`.
- **Closes:** C2, C3, C4 (one `ZOMBIE_MS`, derived; put it where C24 will look for it, e.g. a small `callRecords.ts`), C5, C6, C7, C25, C8's abort kind only (the rest is batch 13).
- **Waits on:** dec. 9 (C2), dec. 10 (C4); else the others. **Keys:** – (C6 changes `price_json.asOf` of new calls). **Size:** M.
- **Tests:** rows as `runCall` writes them (524, converted config) counted by Costs (C3); a running call at 20 min not a zombie (C4); `asOf` ignores fake files (C6); clone unchanged offers no rename (C5); abort + network error → `aborted` (C8); itemTiming with an older item (C25).

### 3. Page, MEI and worker-hang bugs
- **Scope:** `meiValidation.ts` (error listener + timeout, the quick form of B20), `renderWorker.ts` (reset a failed Verovio load), `imageCache.ts` (memory fallback read), `runLayout.ts`, `runSkewAnalysis.ts`, `runAnalyze.ts`, `runEngrave.ts` (notes from final outputs), `meiChecks.ts` (`idProblems` on the parsed tree), `spans.ts`/`mei.ts` (token lists total), `review.ts` 198 and `fixSkew.ts` 28–36.
- **Closes:** B5 (quick fix), B15, B12, B6, D6, D16, D17, B17, B30 (the note).
- **Waits on:** dec. 8 for B30 only. **Keys:** –. **Size:** M.
- **Tests:** a worker that never answers → `checkMeiText` rejects (B5); notes after a resumed run (B6, D6: needs `runPlan` to pass the stage's final outputs); `color="#ff0000"` and `xml:id='n1'` accepted (D16); an unknown event token is a type error or refused, not "fine" (D17); string boxes refused (B17).

### 4. One navigation module
- **Scope:** `useHash.ts`, `navigation.ts`, `App.tsx` (navigation parts), `StatsPage.tsx`/`SettingsPage.tsx` tab hashes, `route.ts`.
- **Closes:** F11, F1, F3; `tabFromHash`/`hashForTab`; dec. 43 (ask before creating while a run goes).
- **Waits on:** dec. 43 for that part only. **Keys:** –. **Size:** L.
- **Tests:** a fake `history`: numbering across replace, a held back/forward undone by the right amount, create/import navigates after the list has the project.

### 5. The dialog shell
- **Scope:** new `apps/web/src/ui/Dialog.tsx`; Confirm, Rename, Delete, Export, KnownPdf, Config, NewModelConfig, TestConfig dialogs.
- **Closes:** F2 (= E2), C15, the Dialog part of F12 (`busy`, `useId` titles, `onClose(result?)`).
- **Depends on:** nothing (4 for E2's navigation part). **Keys:** –. **Size:** M.
- **Tests:** a pure `closeAllowed(busy, how)` or the dialog's cancel handler tested; NewModelConfig's failure path reloads the list (C15).

### 6. The formatting module and small UI fixes
- **Scope:** `time.ts` → `format.ts` (+ `money.ts`), every `plural` site (~30), `runTimes.ts`, `testResult.ts`, `pricing.ts`; one `cssRules(path)` test helper for the four CSS tests; `styles.css` `.head-state`, `.home-card-spinner`; TimeChart, `Filmstrip` ref, `createdBefore`, `pruneNow`, `ago`; `errorText.test.ts`.
- **Closes:** F14 (calendar out of costs.ts included), F4, C27, F6, F8, F9, F10, A27.
- **Waits on:** dec. 44 (F9's colour); else the rest. **Keys:** –. **Size:** L (seam: F14 + F4 + C27 | the rest).
- **Tests:** `duration` at 59.6 s, 119.6 s, 3599.6 s, days; `count`; each CSS test fails when its selector is missing (F6); TimeChart's tap reset.

### 7. Core ground
- **Scope:** `packages/core` (`keys.ts`, new `base64.ts`, `names.ts`, `items.ts`, `time.ts`, `texts.ts`, `money.ts`); `package.json` of imaging, notation, prompts, desktop gain core; private copies removed in imaging, worker, web, desktop.
- **Closes:** A5, A28, A22 (incl. `modelKeyOf`), B25, A20's `normalized`, A18's `isSha256Hex`, E16's names part with **E3** (`firstFreeName(base, taken, max)` cutting the base), D23/F16's `items.ts`, F16's `QUARTER_MS`, `LEAVING_A_RUN` (F23), `roundUsd` (C24's ×4).
- **Depends on:** nothing. **Keys:** – (canonicalJson changes only invalid output; `modelKeyOf` same three fields: verify with the replay). **Size:** L.
- **Tests:** canonicalJson with `undefined` in arrays and at top level (A5); a 200-character base numbered (E3); items round trip; replay snapshots unchanged.

### 8. Wire types into core
- **Scope:** `core/api/{project,pipeline,errors,llmCall,modelConfigs,settings,outcomes,stats,projectExport,host,fingerprint}.ts`; Worker routes annotated (`c.json<T>`); web `api.ts` `Api*` become imports; `Stage.call`/`CallProgress` removed.
- **Closes:** A8, A9 (types: `StepId`, `STEP_KINDS`, `RECIPE`), A7's `ErrorCode`/`ApiErrorBody` types, C28, C21's vocabulary (`PROVIDER_NAMES`, `SECRET_LABELS`, `sameConfigValues` = A21), C23's dead fields, E16's export-format and host types (the source-reading test goes), F16's stats types, F17's `Outcome` type, A24 (API status without `stopped`).
- **Depends on:** 7. **Keys:** – (type-only; `sameConfigValues` behaviour pinned by a test). **Size:** L (seam: pipeline/errors/llmCall | configs/stats/export/host).
- **Tests:** compile-time mostly; a test that `STEP_KINDS` agrees with the web's `STEPS` replaces the regex over the Worker's source (A9).

### 9. The error contract
- **Scope:** Worker `app.onError`, `refuse(c, status, error, code)` at every refusal (~110 sites, texts audited against style.md), `prepareCall` (`bad_secret`), export's unfilled places (409), R2 put errors at the three sites; web one `ApiError` + `checked` + `errorText` (core), every `${err}`/`err.message` site.
- **Closes:** A1, A6, A7, A2, A15, E8 (at today's sites; batch 14 moves them).
- **Waits on:** dec. 1. **Depends on:** 8. **Keys:** – (stored stage error texts change, cosmetic). **Size:** L (seam: Worker side | web side).
- **Tests:** a thrown D1 error → JSON `{error, code: "internal"}`; a Vertex key file that doesn't parse → 409 `bad_secret` in the Test; `ApiError` carries the body's text; stale refusals not shown twice (A2); a full-disk R2 error is a 500, not "doesn't match its SHA-256" (E8).

### 10. One write path for edits
- **Scope:** `api.ts` (per-project queue of checked requests, monotonic version map, `putJson`); new `apps/web/src/saving.ts` (`useSaver(stageId)`, the pending-edits registry Finish awaits); SkewEditor, LayoutEditor, pageEditor, FixMeiView, MeiCode, fieldList (`useFieldList`), finishers.
- **Closes:** A4, A20 (`putJson`), B1, B2, B28 (LayoutEditor's "Saving failed" after a recorded output; fingerprint once per page per session), D1, D2, D3; B21's saver and shell parts (the rest of B21 is batch 26).
- **Depends on:** 9. **Keys:** –. **Size:** L.
- **Tests:** two checked requests in parallel → both succeed (A4); a refresh answer arriving after a save doesn't lower the version; Finish awaits a pending save (D1); a form doesn't reload what it saved (D3); a failed save leaves the cache as the server has it (B2).

### 11. The Node host as a test platform, with D1's limits
- **Scope:** `apps/desktop/src/d1.ts`, `r2.ts` → `apps/worker/src/node/` (+ `nodeEnv()` used by server.ts); `testPlatform(host)` returning a migrated database; route tests on both hosts; NodeD1 limits mode; `server.test.ts`; `resolve`, `stage_inputs`, `output_inputs` with `json_each(?)`; the import's lookups (and chunking if E1 failed).
- **Closes:** E17, A3, E1 (as the verification decides), A23's `resolve` gap.
- **Waits on:** the owner's E1 verification; dec. 19 only if it failed. **Depends on:** 7. **Keys:** –. **Size:** L.
- **Tests:** `resolve` with 150 input ids under the limits mode (fails today); `startServer` on port 0 serves `/api/info`, creates a project, refuses a traversal.

### 12. Worker: pipeline rules, run-route middleware, lock table
- **Scope:** `apps/worker/src/pipeline.ts` → `pipelineRules.ts` + routes; a middleware on `/api/projects/:pid/stages/:sid/*`; `versions.ts` lock class declared at registration (or a test over `app.routes`).
- **Closes:** A19, A12 (the `config` route refuses while another stage runs), A25's grouping by spread (and 14 #13's).
- **Depends on:** 8, 9. **Keys:** –. **Size:** M.
- **Tests:** every route has a lock class (walk `app.routes`); `config` while another stage runs → 409.

### 13. Worker: the LLM routes split; what a call row means
- **Scope:** `llmRoutes.ts` → `llmCalls.ts`, `throttle.ts`, `modelConfigs.ts`, `settings.ts`, `spending.ts` (`vat.ts` grown), `callRecords.ts`; `modelGroupOf`/`resolvedModel` → `llm/models.ts`; `PLACEHOLDER_ITEM` once.
- **Closes:** C19 (move-only first, then fixes), C24, C8 (record in a second step), C9 (skip a cached row whose object is missing), C7's `capRefusal` without `.replace`.
- **Depends on:** 2, 8, 9. **Keys:** – (request keys untouched: replay snapshots unchanged). **Size:** L (seam: the move | C8, C9, C24).
- **Tests:** provider ok + R2 put failure → call `ok` with its tokens (C8); a cached row with a missing answer is skipped (C9); one outcome CASE shared by Costs and Usage, pinned on rows written by `runCall`.

### 14. Worker: projects and storage modules
- **Scope:** `index.ts` project routes → `projects.ts` (one `insertProject` name loop, also for the import); `storage.ts` (`pdfKey`, `contentKey`, `storePdf`, `putContent`/`putJson`, error split, `collectOrphans` from deletion.ts); create = `PUT /api/pdfs/:sha` + a JSON create; `projects.page_count`; binding rename; orphan collection scheduled.
- **Closes:** E14, E15, A18, E8 (final home), E12, E9, E23 (import progress, parallel heads).
- **Waits on:** dec. 4 (rename), dec. 18 (E9), dec. 20 (page count); else the moves. **Depends on:** 7, 9, 11. **Keys:** – (F: `page_count` column; binding rename = config change on both instances, say so in the commit). **Size:** L.
- **Tests:** create after the PDF's last project was deleted meanwhile (E12); `content/missing` treats an unnamed object as missing (E9); the name loop shared by create and import.

### 15. Step facts in use; the Worker derives pipeline state
- **Scope:** Worker `pipelineRules.ts` (`readPipeline` sends `interrupted`/`staleAt`), `PipelinePosition`; web `pipeline.ts` (`firstNotDone`), `steps.ts` (`STEPS: Record<StepId, …>`, `optional` removed), `home.ts`, ProjectView's `resolveCarried`; the ~8 step lists (Worker runTimes, web effort, runTimes, costs incl. dead `STEP_TITLES`).
- **Closes:** A9 (logic), A10, A17, A25's `later` and `canRun`, F16's step lists.
- **Depends on:** 8, 12. **Keys:** –. **Size:** M.
- **Tests:** a browser clock 5 min ahead doesn't show a live run interrupted (A10); home and panel agree on "current" (A23).

### 16. The run protocol with a run identity
- **Scope:** `start` as a conditional UPDATE returning a `runId` sent with heartbeat/outputs/finish; `start` drops outputs whose `stage_key` differs; a "release" on leaving; version raise as `UPDATE … WHERE version = ?`; web `stageRunner.runPlan`, ProjectView's leaving; errors before `start` recorded; run time on cards.
- **Closes:** A11, A16, 06 #8 (D's `CannotStart`), A23's `runPlan` gap.
- **Waits on:** dec. 2, 3, 41. **Depends on:** 10, 12, 15. **Keys:** – (may re-run items on a key mismatch, from the cache). **Size:** L.
- **Tests:** two starts at once → one 409 (A11); a late output from a stale run refused; `runPlan` resume, abort, finish on error.

### 17. Schemas and the lens's model form, byte-identical
- **Scope:** `core/jsonSchema.ts` (union of `shapeProblem` and `schemaProblems`; Worker `llm/jsonSchema.ts` goes); `packages/prompts/src/schema.ts` (builders; casts go); `lensForm.ts` grows the whole model form (system converters ×5, `LENS_SCHEMA_PARTS`, `issueForModel` *placement only*); prompts imports notation's enums (stretch-class enum **in today's order**), `Apply*Unit` derived; prompts `analyze.ts` split (texts / types+conversion / checks), `places.ts`; `probe-schemas.ts` through the adapter.
- **Closes:** C20, D22, C31 (placement; the `lilypond` fix is batch 34), D26's prompts part, C18's strictness test over all six schemas.
- **Waits on:** dec. 5, 27. **Depends on:** 7. **Keys:** **must stay byte-identical**: the acceptance test is `npm run replay` with snapshots unchanged. **Size:** L (seam: validator + builders | model form + analyze split).
- **Tests:** emitted schemas deep-equal to today's (snapshot before moving); round trip of the model form for every system converter.

### 18. Checked answers
- **Scope:** web `llm.ts` `ask(…, {check})` (validate → convert → check → a throw is unusable → mark, retried once → item prefixed), `llmStart`, `requestLimits` incl. `imageLimit`; the eight mark-and-throw blocks and five start prologues in the runners; `checkSystem`, `checkReview`, `checkPatch`, `checkLayoutAnswer` non-throwing.
- **Closes:** C1, C23 (rest), D11, 06 #4 #7, B11's limit placement, C18's `ask` tests.
- **Depends on:** 17. **Keys:** S (step versions of changed checks bumped; an answer now refused is re-asked, intended). **Size:** M.
- **Tests:** a null system entry in a layout answer → unusable, not a TypeError (C1); an extract answer missing `groups` refused (D11); `ask` with api.test's fake fetch.

### 19. Provider adapters: one skeleton, one contract test
- **Scope:** `apps/worker/src/llm/http.ts`; google.ts/Vertex one class; openrouter.ts; anthropic.ts; `adapters.ts`/`ProviderId` removed; factory switches on (Provider, Family); `core/sse.ts` `sseData` + `reader.cancel()`; per-adapter effort mapping; token fetch and endpoint fetch with timeouts.
- **Closes:** C17, C18 (contract test, `sseData` in tests), C10, C11, C16 (token, endpoints, Test abort), C29, decision on `raw`.
- **Waits on:** dec. 13 (keep `raw`). **Depends on:** 2, 9 (`bad_secret`). **Keys:** –. **Size:** L.
- **Tests:** `adapters.contract.test.ts` through all four adapters: abort, 401, 429, 524, cut stream, broken JSON, refusal, cache usage → the same `LlmError.kind`.

### 20. Model configs on both sides
- **Scope:** NewModelConfig's submit flow into `configForm.ts`; `SettingsPage` configs part its own file; Worker `modelConfigs.ts` (`secretsOf`, `configProblem` used by the import), `pipeline.ts`'s aliased config rebuild; import's config path.
- **Closes:** C21 (rest), C14, E7 (configs + the content hash check in `importArchive`), C32, C5's move.
- **Depends on:** 5, 8, 13, 14. **Keys:** –. **Size:** M.
- **Tests:** the form's `requestOf` round-tripped through `configProblem` with `modelOptions`; one config per `PROVIDERS`/`EFFORTS` value inserted (pins the CHECKs); an import with bad `secrets_json` refused with a 409 (E7); a damaged object in an archive refused.

### 21. The model list inside the checks
- **Scope:** `apps/worker/model-list/gather/*` in the tsconfig, `gather/common.ts`, `satisfies ProviderFile`; `generate-model-list.ts` import failure handling; `npm run model-list -- --check`; schema.json enums pinned; `llm/prices.ts` gets OpenRouter's range; `fake-dev` without `DEV_PROVIDERS`.
- **Closes:** C22, C13, C30, C33 (prices part), C16 (`fake-dev`, `onlyOn`).
- **Waits on:** dec. 11, 12. **Depends on:** 13. **Keys:** –. **Size:** M.
- **Tests:** a failed import of the old list isn't "no previous list" (C13); `--check` re-parses committed excerpts.

### 22. Geometry in core; imaging internals
- **Scope:** `core/box.ts` (`Box`, `boxProblem`, `LayoutSystem`, `normalizeBarLines` *written and tested, not yet used where it would change stored layouts*, `stretchEdges`, `area`, `intersection`, `overlaps`, `onPage`, `onCrop`, `clamp`, `roundTo`); its users in imaging, notation (`mei.ts` `partBox`), prompts, web (`extract.ts`, `review.ts`, `transcription.ts`, HumanReviewCards' `toPage`/`toCrop`); imaging `grayToRgba`, `pngSize`, skew.ts split.
- **Closes:** B22, B24.
- **Depends on:** 7. **Keys:** – (rounding digits kept: 5 for layouts and lines, 6 for crop recipes; replay unchanged). **Size:** M.
- **Tests:** `onPage`/`onCrop` inverses; `stretchEdges` shared by extract.ts and mei.ts; fingerprints unchanged.

### 23. One Web Worker client; image cache and pdf.js plumbing
- **Scope:** `apps/web/src/workerClient.ts` (`workerClient`, `serve`) for the three clients and workers; in-flight dedupe in `cachedOr` and `renderMei`; a damaged entry remade; `cacheLru.ts`/`imageCache.ts` one LRU; `deleteCachedPdf`; pdf.js folder table, `drawPages`, `loadPdf` in core `/pdf`; one `fetchPdf`; PdfView lazy drawing; the image worker closing PDFs; eval's PdfPane on core; a build id in `/api/info` and a reload prompt.
- **Closes:** B20 (B5 for good), B13, B14, B16, B18, B23, B26, B27, E22's PdfPane.
- **Waits on:** dec. 7 (B18). **Depends on:** 5 (reload prompt dialog), 8 (`Info`), 22. **Keys:** –. **Size:** L (seam: worker client + cache | pdf.js + B18).
- **Tests:** `workerClient` with a fake Worker: error rejects all pending and resets; two requests for one recipe make it once.

### 24. The recipes module
- **Scope:** `apps/web/src/recipes.ts` (all recipe types, constructors `pageRecipe`, `straightRecipe`, `modelPageRecipe`, `cropRecipe`, `markedCropRecipe`, `IMAGE_VERSIONS`); `crops.ts` out of `extract.ts`; the 17 recipe literals replaced; one `llmStageKey`.
- **Closes:** B19, B10, B11, A13 (keep `modelConfigId` out), 06 #7.
- **Depends on:** 22, 23. **Keys:** – (shapes kept exactly; replay unchanged); A13: S. **Size:** M.
- **Tests:** each constructor gives today's literal (canonical JSON equal); a null angle gives the page recipe.

### 25. The UI kit
- **Scope:** `apps/web/src/ui/` (`Picker` replacing the hand-built ones, `Tabs`, `FilterSection`, `CheckList` with `out`/`onOut`, `Info` block variant, `CostLine`, `ProjectOption`, `Wordmark`, icons with `Svg`), `ui/hooks.ts` (`useClickOutside`, `useMediaQuery`, `useNear`, `useObjectUrl`), `deviceStorage.ts` (`useRemembered` out of ExtractionView; keys exported for screenshots.ts); naming items.
- **Closes:** F12 (rest), F13, F23, the a11y part of F10.
- **Depends on:** 4 (navigation.ts settled before `useNoBrowserBar` moves), 5, 6. **Keys:** – (localStorage keys unchanged). **Size:** L.
- **Tests:** picker grouping as a pure function; `useRemembered` read/write with storage throwing.

### 26. The page-editor kit and generic views
- **Scope:** `apps/web/src/editor/` (`pageEditor.tsx`, `usePageEditorShell`, `boxEdit.ts` out of `fixLayout.ts`, `handles.ts`, `viewBounds.ts`, `marks.tsx`, `PageViews.tsx`); `ui/Filmstrip.tsx` (+ `PagesFilmstrip` merged); `PageView.tsx` → `MenuPage.tsx`; `numberSystems` in web `layout.ts`; `fixNote`.
- **Closes:** B21 (rest), F21, B29, B31, 17 #5.
- **Depends on:** 10, 25. **Keys:** –. **Size:** L.
- **Tests:** `numberSystems` (a page whose layout isn't loaded); `resizeBox` in each coordinate space.

### 27. notation owns the whole score
- **Scope:** `packages/notation/src/structure.ts` (`splitPieces`, `checkSystems`, `CheckedSystem`, `firstMeasureStretch`, `trailingNoneStretches`, `multiRest`, `measureStep`, one stretch walk); `lens.ts` `check` split; `score.ts` takes checked systems; links.ts and mei.ts endings on the walk; `issueRules.ts` (`nextAnswerKey`, key rule, `systemsRuleProblem`, not yet enforced); `MEI_BUILDER_VERSION`; notation dead code.
- **Closes:** D21, D4, D9 (the walk; the prompt sentence is batch 34), D14, D27's notation seams, D28's notation part, D29's notation items.
- **Depends on:** 7. **Keys:** S (`LENS_VERSION`/extract step version for D4, D9). **Size:** L.
- **Tests first:** lens's final count = score.ts's measures; `\tempo "Allegro" R1*4` beside `R1*4` usable, `R1*2 c4` refused (D4); an ending ending on a "none" stretch through lens, links and mei (D9).

### 28. Music stage inputs
- **Scope:** `apps/web/src/stageInputs.ts` (`PRODUCERS`, `latestOutput`, `musicSources`, `recordedContent`); `musicInputs.ts` fetching only, pure parts tested; `musicStage.ts` (review and apply_review shared loading, marked crops, log); `numberIssues`; `scoreInput`; the ~25 "latest stage of X" lookups (finishers, steps.ts artifacts, `engraveSources`, toasts, leaveGuard).
- **Closes:** D23, 06 #1 #2 #6 #17, D30's stage plumbing items.
- **Depends on:** 15, 24, 27. **Keys:** – (`musicSources` must give today's ids: test against `reviewInputIds`). **Size:** L.
- **Tests:** `musicSources` vs today's derivations on the fake fixture's pipeline; `numberIssues` keeps the counter's `above` semantics (the replay relies on it).

### 29. The issues module and its rules
- **Scope:** `apps/web/src/issues.ts` (`StoredIssue` family, `latest`, `addChoice`, `sameAnswer`, `codeIssue`, `freshCodeIssues`, `isNewCodeIssue`, `needsApplying`, the folds, `systemsOf`/`homeOf` on core's `intersection`); HumanReviewCards' `AnswerPicker`; lens.ts applying the answer-key and two-systems rules; `StoredIssue.code`.
- **Closes:** D24, **B4 = D5**, D7, D8, D12, D27's issue-chain seams.
- **Waits on:** dec. 25, 26, 28, 35. **Depends on:** 22, 27, 28. **Keys:** R only where apply_review's window was wrong (rare; may land before the paid release); S for the checks; F (`StoredIssue.code`). **Size:** L.
- **Tests first:** a box at the top of system 5 is on 5 only (B4); keys "a","c" + new; the extract → review → apply_review → human_review → apply_review chain on the pure folds; a reworded question doesn't re-raise an answered code issue (D12).

### 30. Analyze's rules in prompts; the forms call them
- **Scope:** prompts `places.ts` and checks; web `analyze.ts` (`StoredMetadata`, `normalizeMetadata`, `shownConfidence`, pure `scoreObservations`), runAnalyze, fixMetadata/fixObservations, `fieldList.tsx` (`FieldListView`, `FieldRow`, `EditorRow`, `committed`), MetadataView/ObservationsView on the UI kit; `pieceTitle` in mei.ts.
- **Closes:** D26 (rest), D10, D20.
- **Waits on:** dec. 30. **Depends on:** 17, 25. **Keys:** S (analyze's checks, D10); F (meaning of `page`). **Size:** L.
- **Tests:** one table of items through analyze's checks and the forms' (two titles at one system; a span ending before it starts) (D10); `meiMetadata` on the form's output.

### 31. MEI modules, the PDF's keys, the prompt-version guard
- **Scope:** mei.ts split (`meiHeader.ts`, `facsimile.ts`), `measureRange`, `unescapeAttr`; web `engrave.ts` split (`engravePage.ts`, imported by eval), `files.ts` (`saveFile`, `fileBase`, `zipFiles`, shared with projectFile/ExportDialog); `PdfRecipe.options`, the stored recipe read back; a test pinning each stage's text+schema hash to its prompt version; eval's `verovio.d.ts` from the web.
- **Closes:** D25, D13, D15, E22 (rest), D29's MEI items.
- **Waits on:** dec. 33, 34. **Depends on:** 27. **Keys:** S (engrave key, PDF cache: local); F (`PdfRecipe`); MEI text identical (mei.test). **Size:** L.
- **Tests:** `meiString(richScore)` → `checkMei` = [], every measure found by Go to; a changed page option changes the PDF key (D13); the version guard fails when a text changes alone.

### 32. Call ownership
- **Scope:** migration `llm_calls.served_from`; `llmCalls.ts` inserts a served row on a cache hit (cache lookup skips served rows); export = own rows (`servedTo` goes), `EXPORT_FORMAT` 2; import maps calls to served rows/revived originals; places required (migration after the script ran on both databases), `callPlaces.ts`/`fill-call-places.ts`/`PLACEHOLDER_ITEM`/`placeProblem` removed; statistics' predicate in `callRecords.ts`; the fake fixture remade (`npm run fixture:fake`).
- **Closes:** E4 (= C12), F18, E6, E24's lost `call_id`.
- **Waits on:** dec. 15, 16, 17 (and the owner running fill-call-places on both databases). **Depends on:** 1 (E5), 13, 14. **Keys:** – (F: `llm_calls`, export format). **Size:** L.
- **Tests:** export/import/replay of a project whose layout was served from another project's calls; delete A, B keeps its rounds; a placeless file refused.

### 33. Paid release, part 1: image versions
- **Scope:** imaging `PAGE_IMAGE_VERSION`, `FIND_SKEW_VERSION` into `IMAGE_VERSIONS` and the page recipe; `DESKEW_VERSION` out of straight recipes (into `layout`'s stage key only); `LAYOUT_ROUNDS` in `layout`'s key; then the pending `parseColor` fix in pdfPages.
- **Closes:** B7, B8, B9, A14.
- **Waits on:** dec. 6, and the owner's go for the paid release. **Depends on:** 24, 31 (version guard), 32. **Keys:** **R: every request key.** **Size:** S.
- **Tests:** a recipe change in pdfPages changes the page recipe key; the fingerprint check doesn't warn on a fresh image.

### 34. Paid release, part 2: prompts and layout rules
- **Scope:** `normalizeBarLines` used by `checkLayoutAnswer`, `addBarLine`/`moveBarLine`/`withinBox`, `layout` version bumped; `issueForModel` sends `lilypond` for reading issues; `MUSIC` on rests (D18a); analyze page call "only this page" and other pieces dropped (D18b); `bothRepeats` (D18c); review sees reverts (D18d); start-repeat sentence (D9); linking stops at piece starts (D19); the answer-key and two-systems rules stated where the prompts need them (D7, D8); every prompt version bumped once; combined with the §16 "Check the prompt …" tasks; `npm run replay -- --update` reviewed as the diff of every request.
- **Closes:** B3, C31 (the fix), D18 a–d, D9 (sentence), D19, D7/D8 (wording).
- **Waits on:** dec. 29, 31, 32, and the owner's go. **Depends on:** 17, 18, 22, 27, 29, 33. **Keys:** **R** (extract, review, apply_review, analyze; layouts where normalized). **Size:** M.
- **Tests first:** a line at the box's end, past it, and two at one place → normalized (B3); a piece on another page dropped (D18b); a span across a piece start stops (D19). Afterwards: the owner's re-run of his projects.

### 35. Statistics
- **Scope:** Worker `statsSql.ts` (`FINISHED`, `bucketOf`, `rasterizedPages`, `CONFIG_COLUMNS`, `configSummary`), the stats routes typed with core; web `REASONS: Record<Outcome, string>` and one label table with Costs; `useLoaded`; `CostsTab.tsx` out of StatsPage; dead fields; manual rows; `pageCountOf(pipeline)` for every runner and the run report; unknown cost on cards and in the report.
- **Closes:** F15, F16 (wiring), F17, F19, F5, F7, C26, 14 #14 (check).
- **Waits on:** dec. 14, 38, 39, 40, 42. **Depends on:** 8, 13, 32. **Keys:** – (`page_count` values of new stages). **Size:** L.
- **Tests:** an edited manual stage counted once (F5); a stage of unknown cost shows the count (C26); the outcome labels total over `Outcome`.

### 36. ProjectView split
- **Scope:** `usePipelineRun`, `useToasts`; `replacesWork`/`replacesLater`/`fixReplaces` pure in web `pipeline.ts`; `KIND_LABELS`/`STATUS_LABELS` there.
- **Closes:** F20, F24's ProjectView items.
- **Depends on:** 10, 15, 16. **Keys:** –. **Size:** M.
- **Tests:** the re-run confirmation rules (§5.5), untested today.

### 37. Tooling helpers and scripts
- **Scope:** `apps/worker/scripts/config.ts` (`BUCKET`, `DATABASE`, `wrangler()`, `deployConfigText`); `scripts/appServers.ts` (`FIXTURES`, `until`, `stageActions`, `turns`, `REPLAY_MODEL` from core); secrets files by `util.parseEnv`; seedStats on the Worker's prices and cost functions, with places, served rows and relative dates; desktop serve-static; testsetServer; small script items; Node version.
- **Closes:** E19, E20, E13 (+ C33's seedStats part), E21, E25, E26.
- **Waits on:** dec. 21, 22, 24. **Depends on:** 1, 13, 32. **Keys:** –. **Size:** M.
- **Tests:** `.dev.vars` and `secrets.env` parse one example the same; seedStats rows read by Costs and Usage like `runCall`'s.

### 38. The CSS follows the components
- **Scope:** `styles.css`, `themes.css`: one disabled-opacity token, duplicate and unused rules, literals to tokens, body size and radii per the decision, styles split per kit component and screen, the CSS tests on F6's helper.
- **Closes:** F22.
- **Waits on:** dec. 36, 37. **Depends on:** 6, 25, 26. **Keys:** –. **Size:** M. Screenshots of the changed screens only (a small script, CLAUDE.md).

### 39. Cleanups
- **Scope:** what the batches above leave: A26, B27/B31 leftovers, C29/C30 leftovers, D28/D29/D30 leftovers, E24 (`imported_at` dropped, 0001's comment, `UNUSED_OUTPUTS`), F24, stale comments found on the way.
- **Waits on:** dec. 23. **Depends on:** everything it touches. **Keys:** –. **Size:** M.

## Docs to update (notes for the batches)

- **Batch 2:** docs/llm.md and statistics.md: the zombie limit (C4, "15 minutes" goes), SDK retries off (C2).
- **Batch 9:** style.md if the error-text rule is written down; the Worker's texts as the user's.
- **Batch 11, 16:** database.md "Interrupted runs" (A11), D1 limits in tests; the overview's §12 (tests on both hosts).
- **Batch 14:** database.md "Deleting a project" (scheduled collection), "Deploying" (binding renamed), page count at ingest; overview §2 table if `STORE`.
- **Batch 17:** Zod named in four places (overview §3 table and §7.1, llm.md, notation.md): "JSON Schema with our own validator" (C34).
- **Batch 13, 35:** statistics.md "the costs view marks borrowed prices" (unbuilt) and "Migration 0012" (C34); unknown costs shown; served rows labelled.
- **Batch 29, 34:** notation.md 173 prompt versions (6/5/6 in the docs, 7/7/7 in code, then bumped), 212 two-systems rule for extract (D8); answer keys in order; code-issue identity.
- **Batch 30:** stages/analyze.md: what a piece's `page` means (D20); pieces only on this page.
- **Batch 31:** stages/engrave.md: the PDF recipe holds the page options; a stale `engrave` (D13); the prompt-version guard.
- **Batch 32:** database.md (served rows, export format 2), overview §12 (places required; the fill script and placeholders gone).
- **Batch 33:** images.md (§8.6): `PAGE_IMAGE_VERSION` in page recipes, `DESKEW_VERSION` only in `layout`'s key.
- **Batch 37:** desktop.md: `parseSecrets` dotenv parity (E20); the Node version; screenshots' "§5.7" → §12 (E25).
- **Batch 39:** 0001's "NULL once the project is deleted" comment (E24).
- **Batch 38:** style.md: body size and control radii as decided.

## Status

| # | Batch | Status |
|---|---|---|
| 1 | Tooling under checks; replay safe | |
| 2 | LLM call and cost bugs | |
| 3 | Page, MEI and worker-hang bugs | |
| 4 | One navigation module | |
| 5 | The dialog shell | |
| 6 | Formatting module and small UI fixes | |
| 7 | Core ground | |
| 8 | Wire types into core | |
| 9 | The error contract | |
| 10 | One write path for edits | |
| 11 | Node host as a test platform, D1 limits | |
| 12 | Worker: pipeline rules, middleware, lock | |
| 13 | Worker: LLM routes split, call rows | |
| 14 | Worker: projects and storage | |
| 15 | Step facts; Worker-derived state | |
| 16 | Run protocol with a run identity | |
| 17 | Schemas and model form, byte-identical | |
| 18 | Checked answers | |
| 19 | Provider adapters | |
| 20 | Model configs on both sides | |
| 21 | The model list inside the checks | |
| 22 | Geometry in core; imaging internals | |
| 23 | Worker client, image cache, pdf.js | |
| 24 | The recipes module | |
| 25 | The UI kit | |
| 26 | Page-editor kit and generic views | |
| 27 | notation owns the whole score | |
| 28 | Music stage inputs | |
| 29 | The issues module and its rules | |
| 30 | Analyze's rules in prompts | |
| 31 | MEI modules, PDF keys, version guard | |
| 32 | Call ownership | |
| 33 | Paid release 1: image versions | |
| 34 | Paid release 2: prompts and layout rules | |
| 35 | Statistics | |
| 36 | ProjectView split | |
| 37 | Tooling helpers and scripts | |
| 38 | The CSS follows the components | |
| 39 | Cleanups | |
