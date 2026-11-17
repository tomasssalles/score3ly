# Level 4: the whole app

From the level 3 notes A–F (cited A1–A28, B1–B31, C1–C34, D1–D30, E1–E26, F1–F24), level 2 only for counts. No code re-read beyond file sizes (llmRoutes.ts 1317 lines, worker pipeline.ts 987, mei.ts 1055, api.ts 749, ProjectView.tsx 726, steps.ts 579, styles.css 4242; core today ~230 lines in 8 files).

## 1. Architecture

### How the components fit
```
packages:  core (keys, Project, sse, callEvents, /pdf)      ← web, worker, eval   (not imaging, notation, prompts, desktop)
           imaging (pixels; no deps)   notation (lens, score, MEI; no deps)   prompts → notation (/symbolic only)
apps:      web → core, imaging, notation, prompts     worker → core (+ prompts in a script)
           desktop → bundles worker (Node adapters)   eval → core, web's metronomeFont, copies of web parts
           scripts/ (root, untyped) → app servers, replay, fixtures, screenshots, seedStats
```
- **The browser does the work** (images, checks, MEI, rendering, every stage's logic, the stage key); **the Worker records** (pipeline rows, outputs, content, locks, LLM calls and their cache, costs, statistics, export/import). Held up (see §6).
- **Hosts:** one Hono app on Cloudflare, Wrangler local (dev, tests, scripts) and Node (desktop). Small adapters; the Node one untested (E17).

### What crosses between them
| Crossing | Today | Problem | Fix |
|---|---|---|---|
| HTTP API (≈60 routes) | `Project`, `PipelinePosition`, `CallEvent` shared; ~25 other shapes mirrored in api.ts as casts of `res.json()` | drifted (`unsupported`, `vatPercent`), enums ×4–6 | core `api/*`, routes annotated (A8, C28, C21, E16, F16) |
| Errors | `{error, code?}` at ~110 sites, 11 untyped codes, no `onError`; web: 4 error classes, ~60 error→text sites | Worker's text never shown ("HTTP 409"), 500s text/plain | A1, A6, A7 |
| Step facts | Worker `RECIPE`/`LLM_STEPS`/`MANUAL_STEPS`, web `STEPS`, ~8 lists | pinned by a regex over source | core `steps.ts` (A9) |
| Derived pipeline state | stale, first-not-done, droppable computed by the browser (×4, ×7, ×2) on its own clock | clock skew, disagreeing screens | Worker sends `interrupted`/`staleAt` (A10, A17) |
| Run protocol | start/outputs/heartbeat/finish/stop/resolve, per-project version lock | no run identity, non-atomic start and lock, parallel saves refuse themselves | A4, A11, A12 |
| Keys | stage key by the web (trusted blindly by the Worker); request key by the Worker, containing the web's recipe keys; recipe keys nested page → straight → crop | a recipe change re-keys every LLM call (B, corrects A14); versions kept by hand | B7, B19, A13, D13–D15 |
| Stored formats | outputs written by web stage modules, read by other stages, views, attribution, run report; `llm_calls` written by the recorder, read by costs, failures, cap, export, replay, seedStats | meanings live in comments; three writers of `llm_calls` (recorder, import, seedStats) | C24, E13, D24 |
| LLM call ownership | cache serves across stages and projects without a row | export, import, replay, deletion each guess (4 rules) | E4 (= C12) |
| prompts ↔ notation | enums, `Apply*Unit`, `CheckedSystem` restated; enum test in apps/web | drift | D22 |
| notation ↔ web | web composes the check chain ×5, piece splitting ×4, issues folds ×4 | rules diverge (multi-rest, endings, which system) | D21, D24 |
| Worker ↔ D1 | local SQLite has no D1 limits | `resolve` > 100 params, import batches | A3, E1, E17 |

### Where the boundaries are wrong
1. **No home for the wire contract.** core was born with keys and `Project`; every later shape went where first needed (Worker) and was mirrored ("Mirrors…"). Single biggest source of findings (§7, pattern 1).
2. **Derived state on the wrong side.** The Worker owns the rows and the clock but the browser derives "interrupted", "current", "droppable". Move derivations to the Worker's `readPipeline`; keep the browser driving runs.
3. **Concurrency has no owner.** The lock is per project, but writes come from per-page and per-editor chains (5 editors), two tabs can both start a stage, a stale run's late writes are accepted. Needs one client-side write queue and a run id.
4. **The call cache crosses stage and project boundaries invisibly** (E4). Every feature built after it (export, import, replay, deletion, statistics) had to infer what a stage consumed.
5. **Stage modules host generic code.** Crops in extract.ts, box editing in fixLayout.ts, `StoredIssue` in extract.ts, folds in review.ts, `EXTRACTION_STEPS`/`saveFile` in engrave.ts, page views and `Filmstrip` in ArtifactView, `useRemembered` in ExtractionView. Missing web modules: `recipes`, `crops`, `stageInputs`, `issues`, `files`, `format`, `ui/`, `editor/`, `workerClient`.
6. **notation stops at the system.** Whole-score entry points (`checkSystems`, `splitPieces`, stretch walk, issue rules) are missing, so web and mei.ts each walk the score.
7. **God modules on the Worker.** llmRoutes.ts (calls, cache, recorder, configs, settings, Test, cap), pipeline.ts (rules + routes). index.ts's "export only handlers" rule made its helpers sticky (name loop, PDF upload copied, E14).
8. **Second host and tooling outside the checks:** Node adapters tested against their author's idea of D1/R2; root `scripts/` only parsed (E17, E18).

## 2. The final shape of `@score3ly/core` and the shared modules

**Rules for core:** no runtime dependencies, no React, no DOM in the main entry; only what two or more packages/apps need; wire shapes under `api/`, platform-free logic at the top. **Everyone depends on core** (imaging, notation, prompts, desktop gain it). Direction: core ← imaging; core ← notation ← prompts; web → all; worker → core (+ prompts as a dev dependency for probe-schemas); desktop → worker, core; eval → core, web parts. No cycles.

```
packages/core/src/
  index.ts           re-exports
  keys.ts            sha256Hex, canonicalJson (fixed: arrays, undefined), keyOf, isSha256Hex, normalized,
                     modelKeyOf({provider, model, effort})                          [A5 A18 A20 A22]
  base64.ts          bytes <-> base64/base64url                                     [A22 C29]
  box.ts             Box, boxProblem, LayoutSystem {box, barLines}, normalizeBarLines, stretchEdges,
                     area, intersection, overlaps, onPage, onCrop({clip}), clamp, roundTo  [B3 B22]
  steps.ts           StepId, STEP_KINDS, RECIPE, isDroppable({step, inRecipe})       [A9]
  items.ts           pageItem/pageOfItem, systemItem/systemOfItem, itemKind          [D23 F16]
  names.ts           MAX_NAME_LENGTH, defaultName, firstFreeName(base, taken, max)   [E3 E16]
  time.ts            QUARTER_MS, quarterOf                                           [F16]
  money.ts           roundUsd (×4 today)                                             [C24]
  errors.ts          errorText(err)                                                  [A6]
  texts.ts           LEAVING_A_RUN                                                   [F23]
  jsonSchema.ts      JsonSchema, Problem, validate(schema, value)                    [C20]
  pageSelection.ts   (as today)
  sse.ts             readSse (+ reader.cancel in finally), sseData encoder          [C18]
  api/
    project.ts       Project, RunMode, ListedProject, PipelinePosition {status, interrupted}   [A8 A10]
    pipeline.ts      Pipeline, Stage (no `call`), Output, Dropped, StageStatus (API: no "stopped"), staleAt  [A8 A24 C23]
    errors.ts        ApiErrorBody, ErrorCode                                         [A7]
    llmCall.ts       CallRequest, CallContent, CallPlace, CallStatus, CallAnswer (+vatPercent), StreamEvent,
                     CallEvent, IMAGE_MEDIA_TYPES, MAX_CACHE_MARKS, REPLAY_MODEL      [C28]
    modelConfigs.ts  Provider, Family, Effort, Routing, Place, Price, PricingKind, EFFORTS, PROVIDER_NAMES,
                     FAMILY_NAMES, ACCOUNT_NAMES, SECRET_LABELS, isFake, ModelConfig, NewModelConfig,
                     ModelOptions, ConfigSummary, sameConfigValues, TestResult        [C21 A21]
    settings.ts      Settings, isVatPercent, isCapUsd                                [C24]
    outcomes.ts      Outcome (call outcome / failure reason)                         [C24 F17]
    stats.ts         the four statistics answers                                     [F16]
    projectExport.ts EXPORT_FORMAT, ProjectExport, formatProblem                     [E16]
    host.ts          Host, WindowTheme, isWindowTheme, Info (+ build id, for B18)    [E16 B18]
    fingerprint.ts   Fingerprint, StoredFingerprint                                  [A22 B25]
  pdf.ts  (entry /pdf)          drawPage, drawPages, loadPdf, PDFJS_FOLDERS          [B23]
  pdfjsAssets.ts (entry)        imports PDFJS_FOLDERS                                [B23]
```

**Conflicts resolved:**
| Item | Proposals | Resolution | Why |
|---|---|---|---|
| `LayoutSystem` | A: stays in imaging; B: core | core `box.ts` | prompts, notation, imaging, web all need it; prompts would otherwise depend on imaging |
| Settings types | A: in `modelConfigs.ts`; C: own file | `api/settings.ts` | used by Settings page and cap, not by configs |
| `roundUsd` | C: `api/settings.ts` | core `money.ts` | not a setting; used by Worker costs, web run report, seedStats |
| `LEAVING_A_RUN` | A: core or duplicate + test | core `texts.ts` | desktop gains core anyway (E16) |
| `items.ts` | A: check | core | the Worker parses items (runTimes SQL, callPlaces) |
| `jsonSchema.ts` | A: core or a package; C: core | core | prompts and the Worker's model-list generation both need it; no deps |
| `STALE_MS`/`isInterrupted` | A10: Worker sends, else core | Worker sends; nothing in core | one clock |
| `REPLAY_MODEL` | C: core; E19: import from llm/replay.ts | core `api/llmCall.ts` | root scripts shouldn't import Worker internals |
| quarter bucket SQL | 13 #6 vs 14 #5 | `QUARTER_MS` in core; `bucketOf` in Worker `statsSql.ts` | SQL is Worker-only |
| R2 keys | A18 `r2Keys.ts`; E15 `storage.ts` | one Worker `storage.ts` | same concern |
| `useSaver` | B21: in `editor/` | web `saving.ts` (beside api.ts's queue) | forms and FixMeiView (D1–D3) use it too, not only page editors |
| `Filmstrip` | B: own file; F21: `ui/` | `ui/Filmstrip.tsx`; page views in `editor/PageViews.tsx` | generic list, used by Extraction and Metadata views |
| `APP_INFO` | D29: F/E | web `about.ts` | web-only (About, export manifest) |
| Zod | docs say Zod | no Zod; own schema builder + core validator | `z.toJSONSchema` would re-key every call; types via `FromSchema` or tests (C20) |

**Stays out of core:** `ApiError`/`checked`/write queue (web api.ts), `refuse()` (Worker), lookups over `MODEL_LIST` (Worker), crop margins (web `crops.ts`), "which system" (web `issues.ts`), MEI exports (notation), `useSettledWidth` (two copies).

**Other shared modules (final list):**
- **Worker:** `pipelineRules.ts` + a run-route middleware (A19); `projects.ts` (one name loop, E14); `storage.ts` (keys, `storePdf`, `putContent`/`putJson`, error split, `collectOrphans`; E15); `llmCalls.ts`, `throttle.ts`, `modelConfigs.ts`, `settings.ts`, `spending.ts`, `callRecords.ts` (C19, C24); `statsSql.ts` (F15); `llm/http.ts` (C17); `node/` (NodeD1 with a D1-limits mode, NodeR2, `nodeEnv`; E17); `testPlatform(host)`.
- **notation:** `structure.ts` (`splitPieces`, `checkSystems`, `CheckedSystem`, `multiRest`, `measureStep`, stretch walk), `issueRules.ts`, `meiHeader.ts`, `facsimile.ts`, `MEI_BUILDER_VERSION` (D21, D25, D14).
- **prompts:** `schema.ts` (builders), `lensForm.ts` (whole model form), `places.ts`, `analyze/` split (C20, D22, D26).
- **imaging:** + `PAGE_IMAGE_VERSION`, `FIND_SKEW_VERSION`, `grayToRgba`, `pngSize` (B7, B24).
- **web:** `recipes.ts` (+`IMAGE_VERSIONS`), `crops.ts`, `workerClient.ts`, `editor/`, `saving.ts`, `stageInputs.ts`, `musicStage.ts`, `issues.ts`, `files.ts`, `engravePage.ts` (eval imports), `ui/` + `ui/hooks.ts`, `deviceStorage.ts`, `format.ts` + `money.ts`, `calendar.ts`, `statistics/`, `navigation.ts` (`useAppNavigation`), `llm.ts` (`ask(…, {check})`, `llmStart`, `requestLimits` incl. `imageLimit`).
- **tooling:** root `tsconfig.json`; `apps/worker/scripts/config.ts` (`BUCKET`, `DATABASE`, `wrangler()`); `scripts/appServers.ts` (`FIXTURES`, `until`, `stageActions`, awaited `stopAll`); `model-list/gather/common.ts`.

## 3. Cross-component conflicts and corrections

**Settled by level 3 (recorded so the plan doesn't reopen them):** 08 #5 dropped (export reassigns served calls); 07 #10 widened by 09 #1 (constructor throws → A1 `bad_secret`); A14 "free" corrected by B (page recipe is nested in every request key → paid); 02 #7 refined by 19 #5 (normalize, not clamp); A21 settled by C (`sameConfigValues` in core); C12 = E4 = F18 (one design); E2 = F2/F3; 23 #14 = E11; 23 #15 dropped; 01's configForm 387 check dropped; 13 #6 vs 14 #5 → `statsSql.ts`; group 06 fully distributed (A: run protocol #8–#14, #16; B: #3 layout/skew, #7; C: #4, #7, #15; D: #1, #2, #3 analyze/engrave, #6, #17, #18; A20: #5).

**Resolved here:**
- **One save design for every editor** (A4, B1, B2, B21, D1, D2, D3, 20 #1): api.ts per-project write queue + monotonic version map → web `saving.ts` `useSaver(stageId)` with `flush()` registered in a pending-edits registry → Finish awaits the registry; caches set after success, forms don't reload what they saved; views keyed by stage status. One batch, B and D implement their users.
- **Recipes read back** (D13 beside A14/B7): rule for all stored recipes (images, PDF): the stored recipe is read typed and compared with what today's code would make; a mismatch shows a warning (images: fingerprints already; PDF: mark stale, owner decision).
- **Check functions** (C1, D11, 10 #1, B3): C owns `ask(…, {check})` (validate against schema → convert → check → a throw is unusable → mark, retried once); D and B make their checks non-throwing anyway. Order: C20 validator → C1 → D11/B3.
- **The replay as the guard** for C20/D22 (byte-identical schemas and texts): E5 (`stopAll`) must land before a second fixture; D15's version guard complements it (snapshots catch request changes, the guard catches missing version bumps).
- **Stale tab after deploy** (B18): trigger E (`Info` with a build id, compared on a chunk-load failure), UI F (`Dialog`), users B5/B15 (`workerClient` rejects instead of hanging).
- **Statistics meanings** (A16, F5, F7, C26, F15): one owner decision set (below); `pageCountOf(pipeline)` used by runners and the run report.
- **D1 limits** (A3, E1, E17): E17's NodeD1 limits mode first, then A3's `json_each` and (if E1's verification fails) E1's chunking, tested on it.

**Still open, for the plan:**
- E1's verification on the deployed instance (owner, no code) decides E1's priority and what NodeD1's limits mode counts.
- C2's retry policy before C17 (the adapter skeleton carries it).
- E6 (places required) together with E4's `EXPORT_FORMAT` 2.
- The ProjectView split (F20) waits for A step 6 (Worker-derived state) and the save design.
- Docs drift, for the docs review: Zod ×4 (C34), "the costs view marks borrowed prices", "Migration 0012" (C34), notation.md prompt versions 6/5/6 vs 7/7/7 and the two-systems rule for extract (D), "15 minutes" for zombies (C4), `parseSecrets` dotenv parity (E20), §5.7 in screenshots (E25), 0001's "NULL once deleted" (E24), database.md "Interrupted runs" (A11).

## 4. The paid batch

**Key fact:** the open §16 tasks "Check the prompt and the response schema of layout/analyze/extract/review/apply_review" will change every stage's prompts and so every request key anyway. Every request-key change below rides on that re-keying for no extra cost. The replay answers by place, not by request hash (overview §12), so fixtures survive; only their snapshots are updated (`--update`).

**What a "paid" change costs:** nothing until a project re-runs; then the calls it re-keys are asked again (the cache misses). No data matters (CLAUDE.md), so the real cost is one re-run of the owner's projects he wants to keep testing on, ≈ a full run each for B7/B8 (every LLM call: ~12 pages × (≤3 layout rounds + analyze) + 1 whole-score analyze + ~50 systems × extract, review, apply_review).

| Change | Re-keys | Calls paid again on a re-run | Worth now? |
|---|---|---|---|
| B7 `PAGE_IMAGE_VERSION` in `PageRecipe` | every image and every LLM request (all stages) | all | **yes**: without it an imaging fix serves stale images and false "images differ"; the pending `parseColor` fix waits on it |
| B8 `DESKEW_VERSION` out of straight recipes | every request downstream of a straightened page (all) | all (with B7, nothing extra) | yes, if the owner agrees (docs decided it); otherwise every rotation-neutral deskew bump re-pays everything |
| B3 `normalizeBarLines` + `layout` version | layout stage key (free from cache); stored layouts change where normalized → those systems' extract/review/apply_review | few | yes (P1 path) |
| B4/D5 one "which system" rule | apply_review windows where wrong | rare | yes (P1) |
| C31 `issueForModel` sends `lilypond` for reading issues | review, apply_review | all reviews | yes, with D18 |
| D18a `MUSIC`: no marks on rests stated | extract, review, apply_review | all | yes (prompt task) |
| D18b analyze: pieces only on this page | analyze page calls | all analyze | yes (or drop silently: free) |
| D18c `startEndRepeat` → `bothRepeats` | analyze schema, extract hints | all analyze, extract where used | yes in the batch; free alternative: translate in `systemHints` |
| D18d review sees reverts | review, apply_review | all | yes (owner) |
| D9 sentence on start repeats at system breaks | extract | all extract | yes (prompt task) |
| D19 linking stops at piece starts | extract hints | only where a span crossed | yes |
| D7/D8 rules stated in prompts | extract (and review) | all extract | only if the wording changes; checks alone are stage-key only |
| C20/D22 schema builders, model form | **must stay byte-identical** | none | guard: replay snapshots unchanged |

**Stage keys only (free, served from the call cache):** A13 `llmStageKey` (keep `modelConfigId` out), A14/B7 `FIND_SKEW_VERSION`, B9 `LAYOUT_ROUNDS`, D4 `multiRest`, D9 stretch walk, D10, D11, D14 `MEI_BUILDER_VERSION`, D13 (engrave key, PDF cache: local), C1's check versions (answers now refused are re-asked: intended, paid only where a cached answer was bad).

**Stored formats (no migration needed now):** E4 `llm_calls.served_from` + rows on cache hits + `EXPORT_FORMAT` 2 (fake fixture remade free); E6(a) places required; E15 `projects.page_count`; D12 `StoredIssue.code`; D13 `PdfRecipe.options`; D20 meaning of a piece's `page`; D26 type rename; A18/E15 `PDFS` → `STORE` (config change on two deployed instances); C6 `price_json.asOf` (new calls); F7 `page_count` values; A7 stored error texts (cosmetic).

**Recommendation:** one release "keys and formats": all of the above together with the prompt-check tasks, version constants bumped once, `npm run replay -- --update` reviewed as the diff of every request, then one re-run of the owner's projects. Do it before recording the first real project's fixture (needs E4, E5 first).

## 5. Owner decisions

Deduplicated from A–F. Rec = recommendation.

**Contracts and runs**
1. Error texts (A7, 09 #7): Worker's `error` is the user text for refusals a person can cause, web overrides by `code` only / web owns all texts. Rec: Worker owns; audit ~110 sites with A1.
2. Run protocol (A11): run id + conditional start + "release" on leaving, docs updated / leave as is (each case rare). Rec: do it, after the save queue.
3. Errors before `start` (06 #8, D's `CannotStart`): record as the stage's failure / toast only. Rec: record (the card then explains a Retry).
4. `PDFS` binding (A18, E15): rename to `STORE` with the storage module / never. Rec: rename now (two instances, no data).
5. Zod (A, C20, C34): adopt / own builder + validator, docs corrected. Rec: own; fix the docs.

**Images**
6. `DESKEW_VERSION` in recipes (B8): drop (paid once) / keep (docs). Rec: drop, in the paid batch.
7. Stale tab after a deploy (B18): build id in `/api/info` + reload prompt / nothing. Rec: prompt.
8. Pages at the angle limit (B30): a note "N at the limit" / nothing. Rec: note; keep the fields.

**LLM and money**
9. Claude SDK retries (C2): `maxRetries: 0` (the stage's Retry is the policy) / one retry policy for every adapter (429/529). Rec: 0 now.
10. Zombie limit (C4): derived from the longest call timeout + margin / the docs' 15 min. Rec: derived; update docs.
11. Retired models (C13): keep their strings so old configs read and run, refuse new configs of them / remove. Rec: keep, refuse new.
12. `fake-dev` configs without `DEV_PROVIDERS` (C16): refuse as unsupported / run. Rec: refuse.
13. OpenRouter `raw` (C29): keep reasoning / strip. Rec: keep everything received (provenance).
14. Unknown costs in a stage's cost and the run report (C26): show "+ N calls of unknown cost" / hide. Rec: show.
15. Call ownership (E4 = C12): served rows on cache hits (one row per paid call carries the cost) / patch each reader. Rec: served rows, before real fixtures.
16. Served rows in statistics (F18): labelled "from the cache" / hidden. Rec: labelled in Usage, hidden in counts of paid calls.

**Projects and hosts**
17. Call places (E6): run the script on both DBs, then places required, placeless files refused / fill on import. Rec: required.
18. Orphan collection (E9): scheduled (cron on Cloudflare, start-up on desktop) / `waitUntil` / as today. Rec: scheduled; `content/missing` treats unnamed objects as missing.
19. Non-atomic import (E1), only if D1 refuses today's batches: chunked with an `importing` mark / keep atomic and limit size. Rec: chunked, after verifying.
20. PDF page count at ingest (E15): column / parse each time. Rec: column.
21. Secrets file rule (E20): `util.parseEnv` for both hosts / desktop's richer rule, documented. Rec: `parseEnv`.
22. seedStats dates (E13): relative to now / fixed. Rec: relative.
23. `imported_at` (E24): drop / keep. Rec: drop.
24. Node version (E26): `engines: ">=22.18"` + `.nvmrc` / none. Rec: declare.

**Music**
25. Same answer (D24): case-insensitive everywhere / case counts. Rec: case-insensitive.
26. Code-issue identity (D12): stored `kind` + places / text + boxes. Rec: kind + places.
27. prompts imports notation's lens types (D22): yes / keep copies + test. Rec: yes.
28. Two-systems rule for extract (D8): enforce / document the exception. Rec: enforce.
29. Pieces in the page call (D18b): prompt says "only this page" (paid) / drop others silently (free). Rec: both.
30. A piece's `page` (D20): its system's page / where it was read. Rec: its system's page.
31. `startEndRepeat` (D18c): rename in analyze (paid) / translate in hints (free). Rec: rename, in the batch.
32. Review sees reverts (D18d): yes / no. Rec: yes.
33. Done `engrave` whose stored recipe can't be made (D13): mark stale / remake with a warning. Rec: stale (re-run is free).
34. Prompt-version guard (D15): test pinning text+schema hashes to versions / none. Rec: yes.
35. Answer keys (D7): "a, b, c in order" for every creator / first unused letter. Rec: in order.

**UI and statistics**
36. Body text size (F): guide 14 px / CSS 15 px. Rec: whichever the owner looks at daily; then guide = CSS.
37. Control radii (F): guide 8 px / CSS 6–7 px. Rec: as 36.
38. Manual rows in Run times (F5): Effort's rule / drop the rows. Rec: Effort's rule.
39. Run times and Effort (F19): one shared fetch and selection / separate. Rec: separate (simpler).
40. `pageCount` of a stage (F7): "the selected pages" for every stage / per stage. Rec: selected pages.
41. Run time on a card (A16): summed run durations / wall span across retries. Rec: summed.
42. Failed rasterize in Costs' pages (F15): count / only done. Rec: only done.
43. Create a project while a run goes (F11): ask the leave question first / no. Rec: ask.
44. Home spinner (F9): grey per guide / green. Rec: grey.

## 6. Draft answer: "if we started from scratch, anything big we'd do differently?"

**Short answer:** the big decisions held. What we'd change is the **contracts between the pieces** (API, run state, saves, call records, versions), which were added one feature at a time and never designed as a whole. Most of the ~170 level 3 findings trace back to five of them, and all five can still be reached from here.

### What we would do differently
1. **A typed API contract from the first route.** Wire types, enums and error codes in core (or Hono's typed client `hc<AppType>`), every route annotated, errors as `{error, code}` with user-facing text.
   - Would have avoided: ~25 shapes mirrored and drifting, six enums in four places, four error classes, the Worker's refusal text never reaching the screen (A1, one of the most visible bugs), regex-over-source tests.
   - Evidence: A1, A6–A9, C21, C28, E16, F16; pattern 1 (§7), the largest.
   - Now: **yes**, cheap and type-only first (A steps 1–3). Hono's `hc` was considered: it ties the web to the Worker's module graph and its large route files; core types do the same job.
2. **The pipeline as a server-side state machine with run identity.** The browser still does the work, but the Worker decides transitions with conditional updates (`start … WHERE status IN … RETURNING runId`), derives "interrupted/current/droppable" and sends them.
   - Would have avoided: two tabs paying for one stage, late writes from a dead run, clocks disagreeing, "first not done" ×7, step facts on both sides, a hand-kept lock table.
   - Evidence: A9–A12, A17, F20 (ProjectView 726 lines carrying run control).
   - Considered: a Durable Object per project (single writer); rejected because the desktop host has no equivalent and conditional SQL suffices.
   - Now: **yes**, in two steps (Worker-derived state: cheap; run id: a docs decision first).
3. **One write path for a project's edits.** A client-side store per project with a serialized queue, monotonic versions, a pending-edits flush on Finish, instead of a lock plus per-editor debounced chains.
   - Would have avoided: three P1 bugs (A4/B1 self-refused saves, D1 lost edits on Finish, D3 vanishing form rows) and B2, D2, across five editors.
   - Now: **yes**, high value, contained in api.ts + one hook.
4. **LLM calls consumed, not only paid, recorded per stage.** A stage→call relation (or a row per cache hit) from the day the cross-project cache was built.
   - Would have avoided: four ownership rules, replay failing on a real fixture at layout round 1, deletion collecting what a live project consumed, `servedTo` guessing.
   - Evidence: C12, E4, F18.
   - Now: **yes, before the first real fixture**; small migration, no data matters.
5. **Versions and keys derived, never hand-kept; schemas single-sourced.** Each package exports the version of what it computes; keys built from typed recipe constructors; a test pins prompt text and schema hashes to their versions; one schema definition giving the emitted JSON, the validator and the type.
   - Would have avoided: missing image versions (B7), a redundant one that re-keys everything (B8), hand-built recipe literals ×17 (B10), stage keys missing inputs (A13, B9, D13, D14), prompts changed without a version (D15), four schema builders, two validators and checks that crash on malformed answers (C1, C20, D11).
   - Note on Zod: from day one it would have been fine (keys built from its output from the start); now it would re-key every call, so our own builder stays.
   - Now: **yes**, in the paid batch.
6. **notation owning the whole score, not just a system.** `checkSystems`, `splitPieces`, the stretch walk and the issue rules in the package with the parser, called by web and MEI alike.
   - Would have avoided: multi-rest defined three ways (D4, a P1 making valid answers unusable), endings read three ways (D9), "which system" five ways (B4/D5, P1), the check chain ×5, issue folds ×4.
   - Now: **yes**, behaviour-preserving with the seam tests first.
7. **Tests on every host at production limits, and every script typechecked.** NodeD1 enforcing D1's limits, Worker tests on both hosts, root `scripts/` in CI.
   - Would have avoided: `resolve` failing on D1 only (A3), an import that may not run on the deployed instance (E1), untested desktop server (E11, E17), argument-parsing hazards (E10).
   - Now: **yes**, cheap.

### What held up well (keep)
- **Browser does the work, thin Worker:** free tier kept, desktop port cheap (NodeD1/NodeR2 are small), no findings against the split itself.
- **Content-addressed, immutable storage (R2 by SHA-256, rows in D1):** only one bug class (R2 put errors misreported, E8).
- **Recipes, not pixels, in keys; deterministic imaging:** bugs were missing version constants, not the idea.
- **Two-level cache and replay by place:** fixtures survive key changes; the request snapshots are the guard every refactor here relies on.
- **Lens in, MEI out, code builds MEI:** MEI bugs are small (`idProblems` regex, multi-rest); notation is the best-tested package.
- **Linear history, manual stages as stages, carried stages:** no findings against the model; the problems are the concurrency around it.
- **One Hono app on three hosts behind ports;** Access instead of auth code.

### Not big, but would do from the start
- A UI kit (`ui/`), a formatting module and a "home for shared web code" before the second screen; split route files by concern. These are cleanups now (F12–F14, C19, A19).

## 7. Patterns

### Counts by level
- **Level 1:** 10 batches, every file; findings marked certain or check (~510 and ~610 marker mentions in the notes; mentions, not unique findings).
- **Level 2:** 24 groups, ~373 findings (12–21 per group). Level 1 checks settled: ~457 settlement lines; tokens: **~440 confirmed, ~145 dropped, ~26 kept as check**, ~130 handed to another group. **About 3 in 4 level 1 checks held, 1 in 4 dropped** (rough: a line can settle several checks). Drops were mostly "a guard exists elsewhere" or "harmless in this use" (e.g. pdf.js `objs.get` hang, png CRC, `will-quit`, `Math.atan`).
- **Level 3:** 173 merged findings (A 28 + 10 of group 06 reassigned, B 31, C 34, D 30, E 26, F 24): **P1 31** (A 4, B 6, C 7, D 6, E 3, F 5), **P2 61**, the rest structural and cleanup. Level 3 corrected level 2 several times (08 #5 dropped, 07 #10 widened, A14's cost corrected, 23 #15 dropped, a configForm check dropped).

### Merged patterns (level 3 counts; "kinds" = distinct findings, copies in brackets)
| # | Pattern | A | B | C | D | E | F | Total | Likely cause |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Type, enum, constant or label restated across a boundary | 11 | 5 | 12 | 3 | 12 | – | **43 kinds** (≈120 copies) | core seen as "keys and Project", not the home for shapes; web can't import the Worker; "Mirrors…" comments accepted |
| 2 | Helper, skeleton or UI part written again instead of imported/extended | 9 | 13 | 19 | 3 | 14 | 14 | **72 kinds** (≈300 copies incl. `plural` ×33, dialogs ×8) | each feature built in its own session by copying the nearest neighbour; quicker to write than to find; package walls (imaging ↛ core), index.ts exporting only handlers |
| 3 | One rule computed in several places, diverging | 4 | 1 | 2 | 9 | 4 | 7 | **27** | each reader written for its data shape; rule's first copy private; variants copied instead of parameterized |
| 4 | Concurrency, ordering and resource lifetime not designed | 8 | 9 | – | 3 | – | 3 | **23** | written and tried with one tab, one device, one stage running to its end, the dev server always serving the chunk |
| 5 | Error path assumes the happy path (lost, swallowed, mis-kinded, misreported, throwing check) | 5 | 3 | 7 | – | 2 | – | **17** | each error branch written for the case at hand; failure paths not exercised (browser-only, untested) |
| 6 | Input trusted (import file, script arguments, URLs) | – | – | – | – | 7 | – | **7** | import trusts its own export; dev tools for the author's happy path |
| 7 | Key or version kept by hand, missing an input or redundant | 2 | 4 | – | 3 | – | – | **9** | versions added per module as written; no single list; prompts generated but versioned by convention |
| 8 | Rule whose premise a later feature changed | – | – | 7 | – | 4 | – | **11** | a column's meaning in comments, not in one module writer and readers share; features designed one after another |
| 9 | Prompt text and code's rules out of step | – | – | – | 3 | – | – | **3** (6 cases) | prose and checks edited separately; only token lists tied |
| 10 | Tests on one side of a seam; pure logic buried untested | 1 | – | 8 | 2 | – | 3 | **14** (≈25 seams) | tests written with the module under construction; no DOM tests, so logic in components goes untested |
| 11 | Lint-like test that tests nothing / contract pinned by regex | 3 | – | – | – | – | 1 | **4** | the cheap check; no "target found" assertion |
| 12 | Platform limit only production enforces; second host tested by hand | 3 | – | – | – | 3 | – | **6** | local SQLite lacks D1 limits; desktop added around Wrangler-bound tests |
| 13 | Code outside every check (untyped scripts, gather scripts) | – | – | 4 | – | 1 | – | **5** | Node scripts placed outside tsconfig/test globs; `syntax.test.ts` as the cheapest guard |
| 14 | Generic code homed in the first module that needed it | – | 4 | – | 3 | – | 6 | **13** | written for the first stage/screen; later ones imported instead of moving it |
| 15 | Literal object instead of a constructor | – | 2 | – | – | – | – | **2** (17 copies) | type exported, constructor never written |
| 16 | Dead code, unread fields, plumbing of a changed design | 4 | 6 | 8 | 1 | 1 | 3 | **23** (+~10 items in D28) | refactor added the new path, left the old "for now"; nothing flags unread fields; tests keep dead helpers alive |
| 17 | Comment, name or doc that lies | – | 7 | 2 | 4 | 5 | ~12 | **~30** | code moved/renamed without grepping comments; docs written before code (Zod) |
| 18 | Identity or equality by wording / `JSON.stringify` | 1 | – | 2 | 1 | – | – | **4** | dedup added later, keyed on what was at hand |
| 19 | Edge cases in generic helpers and formatters | 1 | 1 | – | – | 1 | 3 | **6** | tested on the values at hand only |
| 20 | CSS drifting from the style guide | – | – | – | – | – | 5 | **5** | values typed per rule, no tokens or tests (as colours have) |
| 21 | SDK default taken unknowingly; sums hiding unknowns | – | – | 3 | – | – | – | **3** | tests set the safe value; SQL `SUM` skips NULL |

### Root causes (across patterns)
1. **Feature-by-feature sessions copying the nearest neighbour** (patterns 2, 3, 14, 15): the second user of a piece of code copied it rather than moving it to a shared home. Strongest single cause.
2. **No designated home for shared things** (1, 2): core's scope never widened; web had no `ui/`, `format`, `issues`, `recipes`; index.ts's export rule kept helpers private.
3. **Happy-path, single-tab development** (4, 5, 6, 12): local platform kinder than production; failure paths and concurrent use never exercised.
4. **Tests built with the module, not at its seams** (10, 11): each side well tested, the agreement between them guarded only by the replay.
5. **Conventions instead of mechanisms** (7, 8, 9, 17): versions, meanings of columns, prompt/check agreement and comments maintained by memory.

### Candidate CLAUDE.md rules (short enough to follow)
1. **Look before writing.** Before writing a helper, type, constant or UI part, grep for it. When a second user appears, move the code to a shared home and import it; never copy.
2. **Shared homes.** What two packages or the web and the Worker both use lives in `@score3ly/core` (wire shapes in `core/api/`); the Worker's routes are typed with it. In the web: `ui/` for components, `format.ts` for text formatting. Never write "mirrors X".
3. **One rule, one function.** A rule (which system, first stage not done, same answer, stale) is computed in one place; a variant is a parameter, not a copy.
4. **Keys and versions.** Every function that makes pixels, prompts or stored results has a version constant exported by its package, used in the keys. A recipe is built by its constructor, never as a literal. A prompt change bumps its version (a test checks).
5. **Errors.** The Worker refuses with `refuse(status, text, code)`, the text written for the user; the web shows it. Never decide by a status code. A check returns a problem; it never throws on malformed input.
6. **Writes.** Every write to a project goes through api.ts's queue; editors and forms use the shared saver; Finish awaits pending saves.
7. **Test the seam.** When two modules must agree (writer and reader, both sides of a request, key computed and looked up), one test runs both. A test that reads source or CSS must assert it found its target.
8. **Production limits locally.** Worker tests run on both hosts, with D1's limits on; every script is typechecked and parses its arguments with `parseArgs`.
9. **Leave it clean.** When changing code, grep its names in comments and docs; delete what nothing uses.
