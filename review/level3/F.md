# Level 3, component F: UI and statistics

Level 2 groups 14 (statistics and time), 22 (the UI kit and styles), 23 (routing, navigation, the desktop shell), plus every other group's references to them (03 `formatSize`/plurals; 05 #14; 07 tab errors; 08 #8, 09 #4, 13 #1 #7 (Usage reasons); 12 effort.ts, dialogs, `onCancel`; 15 #13 #14; 17 #6 items; 19 #12 #15, `TAP_SLOP`, chevrons, `useRemembered`; 20 `CheckList`, `PagesFilmstrip`; 21 plurals, `Picker`, `useRemembered`; 24 #4 `Host`, #17 seedStats) and the level 3 notes A–E (cited A1–A28, B1–B31, C1–C34, D1–D30, E1–E26). Code re-read for this note: useHash.ts (whole), the `location.replace`/`useHash()` sites, stageCardStyles.test.ts with styles.css 878–886, docs/style.md 67/72/127/164/233, `page_count` in worker pipeline.ts (not in any key).

## Map

- **Navigation (web):** route.ts (hash grammar, pure, tested) → useHash.ts (the one owner of `history.state.score3lyIndex` and the leave *hold*; untested) → App.tsx (router + shell: `navigate`, `selectArtifact`, `showStage`, `closeArtifact`, create/import flows, every app dialog) → leaveGuard.ts (`runningProject` set by ProjectView, read at `hashchange`). Five ways to change the URL (`go`, `location.hash =`, `location.replace` ×4, `history.back()`, `<a href>`); `useHash()` instantiated ×3 (App, StatsPage, SettingsPage).
- **Project screen:** ProjectView.tsx (726 lines: run controller, toasts, re-run confirmation rules, the screen) → ArtifactView.tsx (pane + dispatcher + generic `Filmstrip`/`PageImageView`/`LayoutFilmstrip`) → StageDetails.tsx (exports `KIND_LABELS`).
- **Desktop shell:** apps/desktop main.ts (keys/mouse/swipe → `navigationHistory`, `will-prevent-unload` → leaving.ts's native question). Its start-failure path is E11.
- **UI kit (exists once):** DropdownMenu, CheckList, FittedText, Info, ProgressBar/Ring, icons.tsx, StatHead, ConfirmDialog, TimeChart. **Exists several times:** dialog shell ×8, pickers 2 components + 5 by hand, "i" toggle ×6, tabs ×2, filter section ×2, out-set toggle ×3, click-outside ×2, matchMedia ×2, `useNear` + object-URL load ×2 (+2), device storage ×4, `plural` ~30, project option ×2, wordmark ×2.
- **Styles:** styles.css (4242 lines) + themes.css; four CSS-reading tests (stageCardStyles, checkListStyles, colors, themes), each with its own regex parser.
- **Statistics:** Worker `activity.ts`, `activeTime.ts`, `projectStats.ts`, `failures.ts`, `runTimes.ts` (+ costs.ts, C's) — read-only `db.batch` routes; web `usage.ts`, `runTimes.ts`, `effort.ts` (pure), tabs `StatsPage` (= tab bar + the whole Costs tab), `UsageTab`, `RunTimesTab`, `EffortTab`, `TimeChart` + chart.ts, `statsParts`, `ProjectFilter`; the calendar and labels borrowed from web costs.ts; dates from time.ts.
- **Contracts:** (1) hash grammar (route.ts both ways; App 260 `"#/"` by hand); (2) history numbering ↔ every URL change; (3) `runningProject` ↔ App's hold; (4) leave text: App 281 ↔ leaving.ts 11 ↔ docs ×2; (5) `beforeunload` ↔ `will-prevent-unload`; (6) quarters: Worker floors ms to 15 min, web counts `/4` by local day; (7) item string `""`/`p3`/`p3/s2` parsed by SQL `LIKE` and web `kindOf`; (8) "finished" = last pipeline entry done (SQL ×3); (9) failure reason keys (failures.ts CASE ↔ usage.ts `REASONS`, typed `string`); (10) lists arrive time-sorted (UsageTab takes element 0); (11) `stages.page_count` (each runner) as Run times' denominator; (12) style.md ↔ components and CSS; (13) CSS tests ↔ styles.css.

## Corrections and settlements across groups

- **23 #15 (`will-quit` not awaiting `server.close()`) dropped:** 24 dropped it (WAL recovers on the next open). 23 #14's start failure is E11; not repeated here.
- **23 #7 leave text:** A's layout puts `LEAVING_A_RUN` in `core/texts.ts`; desktop gains core as a dependency in A step 1 (E16). Settled: core, not "duplicates + a test".
- **14 #17 item string: settled for core** — D23 puts `systemItem`/`systemOfItem` in core `items.ts`, and the Worker parses items (runTimes SQL, callPlaces), so A's `items.ts` check holds; F's `kindOf` and the SQL `LIKE` use it (SQL: a comment naming the helper, or the kind computed in JS).
- **13 #6 vs 14 #5 bucket SQL:** C settled it for F: `statsSql.ts` owns `bucketOf`; C24's `callRecords.ts` owns the row-meaning predicates (outcome CASE, `ZOMBIE_MS`, `UNKNOWN_COST`) that failures.ts and costs.ts both use.
- **14 #9 Usage reasons:** the upstream causes are C's (C4 `ZOMBIE_MS` 15 min vs 60-min timeouts, C10 per-provider kinds, 08 #8 → C "aborted" kind, C24 one outcome vocabulary). F keeps only the typing of `REASONS` (F17).
- **E4 adds a duty:** if served call rows land, every statistics query that counts calls (Usage, run times' `calls`/`cached`, activity spans) must use C24's predicate to skip or label them (F18).
- **22 #8's "check" on body size and radii is the owner's** (decisions below); re-read style.md: 14 px running text (67), 8 px controls (72), 45 % disabled (127), grey spinner when progress unknown (164), middle-shortening only (233). CSS: `body` 15 px + 6 `font:` rules at 15 px; 6 px ×8, 7 px ×3 radii.
- **22 #1 confirmed by re-reading:** the comment above `.stage-card.planned` (styles.css 880–881) contains a comma, so the test's last split piece is `not as a whole: … */\n.stage-card.planned` and never matches.
- **23 #1 confirmed by re-reading useHash.ts:** a replaced entry has null state → `isNew` → `index += 1` (38–40); the numbering then drifts for good.
- **B's boundary for 22:** the editor kit (pageEditor, handles, viewBounds, DrawLayer gestures, `TAP_SLOP`) is a sibling of `ui/`, owned by B (B21); it takes `useNear`/`useObjectUrl` from F's hooks and the chevron icons' new names (F23).

## Findings

**P1** bugs that hurt now, **P2** will hurt, **P3** structural, **P4** cleanup. **Keys:** nothing in F changes request keys, stage keys or stored formats (F7 changes the *value* written to `stages.page_count` for new stages; it is in no key). Source in brackets.

### P1: bugs that hurt now
- **F1. A `location.replace` breaks the history numbering; a held back/forward then lands elsewhere** [23 #1, #2, #3]. Replaces at StatsPage 70, SettingsPage 93 (tabs), App 188 (`closeArtifact`), App 260 (after delete) give the replaced entry `index + 1`; afterwards `history.go(-delta)` undoes a held Forward/Back by the wrong amount (can leave the app), URL and view disagree, Leave does nothing. Three `useHash` instances each number entries (they agree by luck of listener order). Fix: one navigation hook (F11) whose `go(hash, {replace})` uses `history.replaceState({score3lyIndex: index})`; every site uses it; pages get `hash` from App (prop/context); tests with a fake `history`. certain. Keys: none.
- **F2. Dialogs: Esc while busy, and "closed" called "cancel"** [22 #2; 15 #13; E2; C15]. Esc mid-delete fires `onCancel` → App keeps showing the deleted project; Export blocks ×/backdrop but not Esc; Rename and NewModelConfig block nothing (Esc mid-create loses the error and the "rename instead?" offer while the create goes on). Fix: one `Dialog` shell (F12) with `busy` (cancel event `preventDefault`ed, ×/backdrop/Cancel disabled), `useId` titles (also fixes duplicate `confirm-title` when two ConfirmDialogs are open, check), `onClose(result?)` instead of `onCancel`. certain.
- **F3. New or imported project flashes "This project doesn't exist (any more)."** [23 #5; 15 #14; E2]. App 148/161 navigate before `refresh()`. Fix in F11's hook: put the returned project in the list (or await `refresh`) before navigating; refresh once before declaring a URL's project missing (pasted link from another device: check, minor). certain.
- **F4. `duration` says "1 min 60 s"; four duration formats** [14 #1]. web runTimes.ts 156–160 floors whole and rounds the rest (119.6 s, 3599.6 s, 59.6 s); its "3 min 12 s" breaks style.md ("3min 12s", "1h 5min"), which time.ts `duration` follows with quirks ("3min 0s", no days); testResult.ts 6 and the card are third/fourth. One `duration(ms, {subSecond?})` in the formatting module (F14), rounding first; tests with the edges. certain. 
- **F5. Run times count an edited manual stage twice; Effort once** [14 #2]. `manualPerPage` sums every done manual stage of the step and their `pageCount`; an edit copies `page_count` and leaves the old stage done, dropped ones count too → "Fix layout per page" halves per edit and disagrees with Effort (which walks `replaces_stage_id`, final pipeline). Arithmetic certain; owner: Run times takes Effort's rule, or shows no manual rows (decision 3).

### P2: bugs that will hurt
- **F6. `stageCardStyles.test.ts` guards nothing** [22 #1]. Comments not stripped; negative assertion passes when nothing matches; the 2026-11-02 regression (`opacity` on `.stage-card.planned`) would pass. Fix: one `cssRules(path)` test helper (comments stripped, at-rules descended) for the four CSS tests, each asserting its selector was found (postcss as devDependency: plan's check). certain.
- **F7. `page_count` means different pages per stage** [14 #3; A16]. extract: pages with systems; review/apply_review: all layout pages; build_mei: page images; manual stages copy their predecessor's. `estimatePerPage` adds per-page times over different denominators (cover page: 11 vs 12). Decide "the selected pages" everywhere, one `pageCountOf(pipeline)` used by every runner (C's run report reads it too). certain (inconsistency), small effect. Stored: values of new stages only.
- **F8. Status cut at the end can read as "running"** [22 #8]. `.head-state` (styles.css 762) uses `text-overflow: ellipsis`: "Extraction failed" → "Extraction…", the guide's "in progress" form. Fix: `FittedText` (middle) or no cut. certain (rule), check (reachable widths).
- **F9. Second spinner ignores reduced motion** [22 #8]. `.home-card-spinner` (4189) lacks `.spinner`'s reduced-motion slowdown (certain) and is green where style.md 164 wants grey for unknown progress (check: owner). Fix: use `.spinner`.
- **F10. Small UI bugs** [14 #15, #18, settled; 23 #11; 22 #3; SettingsPage]: TimeChart `down` never reset on `pointerup`/`pointercancel` (stale tap start, certain) and O(n²) running total (minor); `Filmstrip` focus observes the spacer when an overlay is passed (ArtifactView 343, latent: ref on `film-items`); every Picker's `aria-label` hides the value picked (check, a11y: value in the name, `menuitemradio`); `createdBefore("30d")` removes projects 29–30 days old (certain, trivial); SettingsPage 245 `pruneNow` unhandled `cacheUsage` rejection (certain, minor); `ago` rounds 6.6 days to "7d ago" (cosmetic).
- **F18. Statistics and E4's served rows** [E4; C24]: if cache hits get rows, Usage/run times/activity must use C24's predicate (skip or show "from the cache"). Owner with E4. check (depends on E4).

### P3: structural
- **F11. One navigation module** [23 #1–#3, #5, #6, #8, #4]. useHash + navigation.ts (`useBackForward`) + App's navigation (`holds`, `navigate`, `selectArtifact`, `showStage`, `closeArtifact`, `openedArtifactHere`, the leaving dialog state) → `useAppNavigation()`: sole owner of `history`, `go(hash, {replace})`, pages get `hash` by prop/context; unit tests over a fake history (numbering, hold, replace, go). Same pass: `tabFromHash(page, hash)`/`hashForTab(page, tab)` over `TABS_OF`, first tab without suffix for both pages (Stats' first tab has two URLs today); `leavesProject` = `projectIdFromHash(hash) !== id` (redundant clause, export used only by its test); App 260's `"#/"` via a builder; whether to ask before creating a project while a run goes (23 #6: owner, decision 6). `useNoBrowserBar` leaves navigation.ts for `useMediaQuery` (F13) **after** this. certain.
- **F12. The UI kit, `apps/web/src/ui/`** [22 #2–#6, #9–#11; 20; 21; 19; C15, C27; D26]: `Dialog` (F2) for the 8 dialogs incl. ConfigDialog/NewModelConfig/TestConfigDialog; one `Picker` (fieldList's `MenuItem`-group base, statsParts' options→groups as a pure tested function) replacing PipelinePanel's and SettingsPage's ×4 hand-built ones; `Tabs` (with `tabpanel` + arrow keys), `FilterSection`, `CheckList` taking `out`/`onOut` (toggle written once), `projectItem(p, now)` + `AGE_ACTIONS` beside `ProjectChecks`; `Info` with a `block` variant, `StatHead` on it, `UnknownCosts`/`TestCosts` → one `CostLine`; `ProjectOption`, `Wordmark`; `icons.tsx` with an `Svg` wrapper, inline SVGs (ProjectPicker 132, KnownPdfDialog 44) replaced; moves: `FinishedProjectsFilter` to statsParts, `Picker` out of statsParts, `CheckList` into `ui/`. D26's form views and C27's `SpendingCap` build on it. certain.
- **F13. Hooks and device storage** [22 #6; 23 #10]: `useClickOutside` (DropdownMenu, ProjectPicker), `useMediaQuery` (useWide, `useNoBrowserBar`), `useNear` + `useObjectUrl(load, deps)` (ExtractionView/ArtifactView, pageEditor 302, EngravingView 36: B's and D's users), `deviceStorage.ts` (`readDevice`, `writeDevice`, `useRemembered` out of ExtractionView; themes, cacheLru, ProjectView flags; the `score3ly.*` keys listed once and exported for screenshots.ts, E25). Keys unchanged (per-device conveniences). certain.
- **F14. A web formatting module** [14 #1, #10, "for level 3"; 22 #7; 03; C27]: `format.ts` (time.ts grown): `duration`, `shortDate`/`fullDate`/`MONTHS` (×2 today), `ago`/`when`, `percent(n, of)` (effort `share`, StatsPage 217, UsageTab), `count(n, word, plural?)`/`plural` (~30 sites + 3 local lambdas; "staffs" → "staves", ObservationsView 412), `formatSize` (cacheLru); money.ts beside it (C27's `dollars`/`amount`). Calendar out of web costs.ts into `calendar.ts` (ranges, buckets, `axisLabel`, `bucketTitle`), notes (`deletedNote`, `endedNote`, `dateOf` = `fullDate`) beside dates; dead `STEP_TITLES` and costs.ts `STEPS` go with A9. B29 and D's notes use `count`. certain.
- **F15. Statistics routes share their SQL** [14 #5, #6, #13; C19; C24]: `apps/worker/src/statsSql.ts`: `FINISHED` (×3), `bucketOf(column)` from core `QUARTER_MS` (×4 incl. costs.ts), `rasterizedPages(configJson)` (×3), `CONFIG_COLUMNS` + `configSummary(row)` (×3); `modelGroupOf`/`resolvedModel` imported from `llm/models.ts` (C19), not llmRoutes.ts; grouping by push (×3, same as A25). The three meanings of "a project's pages" (Costs: every started rasterize, Usage: done ones per PDF, Effort: final pipeline) stay as the docs give them; a failed rasterize counting in Costs is unexplained (check, owner). certain.
- **F16. Statistics contracts in core** [14 #4, #8, #17, "no shared types"; A layout]: core `time.ts` `QUARTER_MS`/`quarterOf` (6 copies, floors ×4 JS + ×4 SQL, seedStats via E13), `api/stats.ts` (four answers), `items.ts` (`itemKind`), step lists from A9's `STEP_KINDS` (Worker runTimes `MANUAL` + its `manual` SQL list holding `ingest`; web runTimes `STEPS`/`MANUAL`/`LLM`; effort `MANUAL`; costs `STEPS`). Worker routes annotated with the types. certain.
- **F17. Usage reasons typed** [14 #9; 13 #7; C24]: `REASONS: Record<Outcome, string>` from core `api/outcomes.ts`, `FailureData.points[].reason: Outcome`; one label table with Costs' `STATUSES` ("wrong_model" vs "unexpected_model" today). certain; after C24.
- **F19. Statistics tabs' shells** [14 #7, #11, #12, #16]: `useLoaded(fetcher, message)` (×4, with A6's `errorText` instead of a fixed message); `value` and `selected` into statsParts; whether Run times and Effort share one fetch and selection, lifted to StatsPage (owner, decision 4); `CostsTab.tsx` out of StatsPage (494 lines). Dead fields `stages[].kept` (an `EXISTS` per stage), `createdAt`, `finishedAt` dropped (or `kept` used by effort.ts instead of the walk, one of the two); stale comments api.ts 459, index.test 1574; effort.ts 59–60 dead condition and comment; runTimes `ranAnew`'s unused `calls`. certain.
- **F20. ProjectView split** [23 #9, #12; A17; A10]: `usePipelineRun` (run, finish, `resolveCarried`, stop, abort, the leave/`beforeunload`/wake-lock trio), `useToasts` beside toasts.ts, `replacesWork`/`replacesLater`/`fixReplaces` pure into web pipeline.ts with tests (the decided §5.5 rule, untested today); `KIND_LABELS`/`STATUS_LABELS` from StageDetails into pipeline.ts. After A step 6. certain.
- **F21. Generic views out of view files** [23 #10; B; 20; 19 #15]: `Filmstrip.tsx` (used by ExtractionView, MetadataView; with F10's ref fix and `PagesFilmstrip` = ArtifactView 84–97 merged), page views to `PageViews.tsx` (B's marks, 19 #7); PageView.tsx → `MenuPage.tsx`, its Help text without "LilyPond". certain.
- **F22. The CSS follows the components** [22 #8, "CSS follows"]: after F12/F13, one pass: disabled opacity one token (0.35/0.4/0.45/0.6 over 14 rules → about 45 %); rules defined twice or split (`.app-header .actions`, `.analysis-strip-text`, `.editor-mode[…]`, `.toggle-dot` = `.inline-dot`, button rules); unused `.details-calls`, stale `.settings-section-head h3`; icon-button variants, card shells, field inputs, shadows and dash pattern as literals, Georgia stack ×2; breakpoints 479/480 (check); split styles.css per kit component and screen, the CSS tests reading the right file through F6's helper; body size and radii per decision 1–2. certain (cleanup).
- **F23. Small typed/naming items** [22 #10, #12; 23 #13; 19]: `ThemeChoice = "auto" | Theme`; `CollapseIcon`/`ExpandIcon` → `ChevronLeftIcon`/`ChevronRightIcon`; `MeiIcon` = `PdfIcon` but for text; history.ts `History` → `UndoStack`; leave text into core `texts.ts` (23 #7); SettingsPage's `Host` key type from core `api/host.ts` (E16); SettingsPage configs part its own file (C21). certain.

### P4: cleanup
- **F24.** Stale or orphan comments: ArtifactView 22, ProjectView 57–59, statsParts header, icons' double comments (`LineIcon`/`BoxIcon`/`BarLineIcon`), main.ts "§3" ×3 (name docs/desktop.md); ProjectView 503 `else` and "`undefined` has nothing to set", 542/546 `configForm.read` twice, 442 `find` by id instead of position; StageDetails' two identical `<dl>`s; `.stats-tabs` comment; desktop main.ts 128/134 "open outside" twice → `openOutside(url)`; leaving.ts 4 long line; ProjectPicker ArrowDown stops where DropdownMenu wraps (check); RenameDialog `maxLength + 50` comment (E24); `/api/activity` reads every row of three tables per visit (14 #14: check, scale only). certain except as marked.

**Total: 24 findings** (F1–F24). Owned elsewhere, listed: F18 (with E4), F17's upstream (C), E11 (desktop start).

## Shared modules (F's part of A's layout)

```
packages/core/src/time.ts             QUARTER_MS, quarterOf                                      [F16; A layout]
packages/core/src/items.ts            pageItem/systemItem, itemKind                              [F16; D23]
packages/core/src/texts.ts            LEAVING_A_RUN (web App, desktop leaving.ts)                [F23; 23 #7]
packages/core/src/api/stats.ts        Activity, ProjectStats, Failures, RunTimes answers         [F16]
packages/core/src/api/outcomes.ts     (C24) Outcome union — REASONS/STATUSES typed by it         [F17]
apps/worker/src/statsSql.ts           FINISHED, bucketOf, rasterizedPages, CONFIG_COLUMNS, configSummary  [F15]
apps/web/src/navigation.ts            useAppNavigation (useHash merged), useBackForward          [F11]
apps/web/src/ui/                      Dialog, Picker, Tabs, FilterSection, CheckList, Info, DropdownMenu,
                                      FittedText, ProgressBar/Ring, icons, ProjectOption, Wordmark, Filmstrip  [F12, F21]
apps/web/src/ui/hooks.ts              useClickOutside, useMediaQuery, useNear, useObjectUrl      [F13]
apps/web/src/deviceStorage.ts         readDevice, writeDevice, useRemembered, the score3ly.* keys [F13]
apps/web/src/format.ts (+ money.ts)   duration, dates, ago/when, percent, count/plural, formatSize [F14; C27]
apps/web/src/calendar.ts              ranges, buckets, axis/bucket labels (out of costs.ts)      [F14]
apps/web/src/statistics/              CostsTab, UsageTab, RunTimesTab, EffortTab, statsParts, TimeChart,
                                      usage.ts, runTimes.ts, effort.ts, chart.ts, useLoaded      [F19] (folder: optional)
apps/web/src/pipeline.ts              + replacesWork/replacesLater/fixReplaces, KIND/STATUS labels [F20]
```
Sibling, not F's: B's editor kit (pageEditor, handles, viewBounds, DrawLayer gestures).

## Order of fixes and dependencies

1. **Test first, no structure needed:** F6 (CSS test helper, so F22 is guarded), F4 (duration edges + one format), F10's small bugs, F8/F9.
2. **Navigation** (F11 → F1, F3; F23's leave text after A step 1): before F13 touches navigation.ts; independent of the pipeline work.
3. **Formatting module** (F14) before the kit and before B29/D's notes use `count`.
4. **UI kit and hooks** (F12 → F2; F13), then the users: C15/C21/C27 (configs, SpendingCap), D26 (forms), B21 (editor kit takes the hooks), F21 (Filmstrip, page views).
5. **CSS pass** (F22) after 4 and after decisions 1–2.
6. **Statistics:** after A step 2 (core types) and C19/C24 (`llm/models.ts`, `callRecords.ts`, outcomes): F16 → F15 → F17 → F19; F5/F7 after the owner's decisions 3 and the `pageCountOf` rule (with C's run report); F18 with E4.
7. **ProjectView split** (F20) after A step 6 (step facts, `firstNotDone`, Worker-sent `interrupted`) and A4's save queue.
8. **Cleanups** F23 rest, F24.

**Keys and stored formats:** none changed. F7 changes the `page_count` written for new stages (in no key); F13 keeps the localStorage keys as they are.

## What crosses into other components

- **A:** core `time.ts`, `items.ts`, `texts.ts`, `api/stats.ts` in A's layout; A6's `errorText` in the tabs' `useLoaded`; A9's `STEP_KINDS` replaces the statistics' step lists; F20 waits for A step 6 and A4.
- **B:** editor kit sibling of `ui/`, using F13's hooks and F23's chevron names; `Filmstrip` and page views out of ArtifactView (F21, with B's marks); B18's reload prompt is a UI piece (F's `Dialog` or a toast; trigger is E's `/api/info`); B29's `fixNote` on `count`.
- **C:** C24 outcomes + predicates (F17, F18), `statsSql.ts` owns `bucketOf`, C19 `llm/models.ts` for `modelGroupOf`; C15 NewModelConfig on F's `Dialog`; C21 configs' file out of SettingsPage on F's `Tabs`/`FilterSection`/`Picker`; C27 money.ts beside `format.ts`; C26 unknown cost shown in StageDetails.
- **D:** D26 form views on `Picker`/`CheckList`; `useRemembered` (MeiWorkspace, LayoutEditor); `Filmstrip` for ExtractionView/MetadataView; `count` for notes; D29's `APP_INFO` (About page).
- **E:** E2 is fixed by F2/F3; E4's served rows in the statistics (F18); E13 seedStats on core `quarterOf`; E16's `Host` type in SettingsPage; E11 desktop start failure (from 23 #14); E25's localStorage keys exported by F13.

## Decisions for the project owner

1. **Body text size:** style.md 14 px vs CSS 15 px (`body` + 6 rules) — which is current?
2. **Control radii:** style.md 8 px vs CSS 6 px ×8 / 7 px ×3.
3. **Manual rows in Run times** (F5): adopt Effort's rule (one piece of work per edit chain, final pipeline), or drop manual rows from Run times and leave them to Effort.
4. **Run times and Effort** (F19): one fetch and one project selection shared, lifted to StatsPage (forgotten on leaving the page), or separate as now.
5. **A stage's `pageCount`** (F7): "the selected pages" for every stage?
6. **Create before the leave question** (F11, 23 #6): ask before creating a project while a run goes here?
7. **Home spinner colour** (F9): grey per the guide, or green on purpose.
8. **Served call rows in statistics** (F18, with E's decision 1): hidden or labelled "from the cache".
9. **Failed rasterize in Costs' pages** (F15): intended?

## Patterns (merged, with counts)

| Pattern | Count | Likely cause |
|---|---|---|
| UI part rebuilt by hand instead of using or extending the existing one | 12 kinds, ~40 copies (dialog ×8, pickers 5+1, "i" ×6, tabs ×2, filter section ×2, out-set ×3, click-outside ×2, matchMedia ×2, lazy load ×2+2, storage ×4, project option ×2, inline SVG ×2, wordmark ×2) | each screen built in its own session from the nearest similar screen; the guide says "one component" but names few |
| Constant or helper written again in the next module of a feature | ~30 (quarter ×6, floors ×8, finished SQL ×3, bucket SQL ×4, pages parse ×3, config select ×3, `MONTHS`/`dateOf`, `value`, `selected`, tab shells ×4, group-by spread ×3) | each statistics tab built by copying the previous route/component, nothing lifted when a second user appeared |
| Generic helper written inline at every use | 1 kind, ~33 sites (`plural`) | too small to look for; no formatting module to put it in |
| Helper placed in the first file that needed it | 6 (`useRemembered`, `Picker` in statsParts, `FinishedProjectsFilter`, `Filmstrip`/page views, `KIND_LABELS`, `CheckList` in forms' group) | written for one screen, imported later instead of moved |
| Invariant kept by one function, bypassed elsewhere | 1 (history numbering vs 4 replaces, 2 direct writes) + hook owning global state instantiated ×3 | hold added to `useHash` after the sites existed; pages called the hook for the hash, not seeing it writes `history.state` |
| Two formats/rules for one notion | 7 (durations ×4, tab hashes ×2, "a project's pages" ×3, `pageCount` ×4 meanings, manual time per page ×2, outcome keys ×2, leave text ×2+docs) | each tab/runner/page decided locally; the guide's format not enforced |
| CSS drifting from the guide | 5 (opacity ×4 values, sizes, radii, end ellipsis, second spinner) | values typed per rule, no tokens, no test as colours have |
| Lint-like test that silently tests nothing | 1 here (+ A27 errorText) | regex over source + negative assertion; no "target found" check |
| Rounding/edge bugs in hand-written formatters | 3 (`duration` 60 s, `ago` 7d, 30-day boundary) | happy-value tests only |
| Stale comments, dead fields after a redesign | ~12 (4 comments + 3 fields + 1 condition in stats; 5 stale texts in the kit; 4 pointers in routing) | redesigns changed computation and tests, not shapes' comments; no check flags unread response fields |
| Pure logic buried in a component, untested | 3 (re-run confirmation rules, toasts' gathering, picker grouping) + no component tests at all | written where first needed; no DOM test library, so seams must be pure functions |
| Async order in a flow / small UI races | 3 (navigate before list, create before asking, TimeChart tap start) | "do it, then show it" without the route depending on the list |
| Dead or redundant code | 3 (`projectIdFromHash`, `leavesProject` clause, `ranAnew`'s `calls`) | code changed, callers not revisited |
