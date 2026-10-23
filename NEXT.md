# Next steps (temporary list: delete it once its items are done or moved into DESIGN.md)

Written for the next session. Read DESIGN.md first, as usual. Work happens on the branch given by the session; fast-forward
main only when the project owner asks. The project owner decides the order; these are the items they listed, with what
is known about each.

## 1. Request keys by recipe
- **Decided, not built** (commit `503c449`, 2026-10-20; DESIGN.md §5.2 "Only recipes, never pixels, in any key", §7.2
  `POST .../llm`, task in §15 "Request keys by recipe"). The owner noticed that stage keys use recipe keys but LLM request
  keys use image hashes, so tiny pixel differences between devices make new (paid) requests. Decision: only recipes in
  every key, from the PDF to the final image; fingerprints only warn (item 2).
- **Today:** `apps/worker/src/llmRoutes.ts`, `withoutImages()` (~line 166) replaces each image by `sha256(bytes)`; the
  request key (~line 322) and the stored request use that.
- **To do:**
  - The browser sends each image's recipe key with the image (the LLM request type in `apps/web/src/api.ts` /
    the runners `runLayout.ts`, `runAnalyze.ts`, `runExtract.ts`; images come from `pageImages.ts`/crops, which know
    their recipe keys). The Worker's request key uses the recipe key instead of the hash; the stored request keeps
    both (recipe key and hash), as DESIGN.md says.
  - A cache lookup the browser can make **before** making the images (e.g. the request with images given only by
    recipe key; the Worker answers with the cached response or "not cached"). Only on a miss are the images made and
    the request sent.
  - Old `llm_calls` rows keyed by hash simply stop matching (fine: nothing is deployed).
  - Tests in `apps/worker/src/llmRoutes.test.ts`; update DESIGN.md, delete the task.

## 2. Fingerprints: built, stored, checked, warnings
- **Designed** in DESIGN.md §8.3 (and §5.2, §5.8 table `image_fingerprints`); task in §15 "Store the fingerprints".
  Commits `503c449` and `895e15e` (2026-10-20). The table exists (migration 0003), **nothing writes or reads it**.
- **Which images:** every image from which a stored result was computed: page images (`skew_analysis`, `fix_skew`),
  the straightened/scaled pages sent by `layout` and `analyze`, the straightened pages of `fix_layout`, the crops of
  `extract` (later `review`, `apply_review`, `human_review`). Stored when first used, with its recipe key and PDF:
  dimensions, hash of the raw pixels, a thumbnail.
- **Checked** wherever an image is made from its recipe because the device's cache doesn't have it, in the one place
  that does that (`apps/web/src/pageImages.ts`), whatever needed it (an artifact view, an editor, a stage). No image is
  made only to be checked. Three tiers in §8.3 (identical / "close" / different).
- **A warning, never a stop:** results are reused whatever the device (keys hold only recipes, item 1); a mismatch tells
  the user the coordinates or answers may not fit the image on this device. How the warning is shown: to design with
  the owner (it isn't specified yet).
- Needs Worker endpoints to store and fetch fingerprints, and the check in `pageImages.ts`. Tests; DESIGN.md; delete
  the task.

## 3. Showing that the pipeline is moving while the user looks at an artifact
- **Decided:** the artifact view **stays** on what the user picked when a new stage finishes (it already follows the
  pipeline only while nothing is picked: `defaultArtifactId` in `pipeline.ts`, used in `ProjectView.tsx`). Close the
  task "Decide whether the artifact view follows the pipeline while it runs" (§15) and update §5.6 (the sentence "Whether
  the view follows the pipeline while it runs is still to be decided").
- **Today:** the running stage's card has a progress bar (only on the device that runs it). The panel's head
  (`PipelinePanel.tsx`) has only the pipeline's bar, no stage name. The collapsed strip (`ProjectView.tsx` ~line 448)
  has two rings labelled just "Pipeline" and "Stage" (the stage ring only while this device runs a stage).
- **Options to discuss and pick (owner undecided):** the running stage's name in the panel's head; in the collapsed
  strip too, or the stage's icon there if names don't fit (icons per step: `STEP_ICONS` in `StageCard.tsx`); a small,
  dismissable hint in the artifact view when a new result is ready ("Layout is ready · Show"). Show screenshots at both
  widths before deciding.

## 4. Tempo marks
- The task "Tempo marks in the symbolic format" in DESIGN.md §15 has the whole proposal: LilyPond's `\tempo` in the
  lens (`\tempo "Allegro" 4 = 132`, `\tempo 4. = 60`, `\tempo 4 = 120-132`, `\tempo "Andante"`), parsed into text,
  note value with dots, number or range; MEI `<tempo>` with `@mm`, `@mm.unit`, `@mm.dots`. Changes: the `extract`
  prompt (`packages/prompts/src/extract.ts`), the parser and checks (`packages/notation/src/`), the MEI builder
  (`mei.ts`), tests (MEI validated against the schemas in `mei.test.ts`). The owner might implement it soon.

## 5. A back button in the app
- DESIGN.md §3 "Desktop version", "Navigation": back and forward buttons in the header, left of the wordmark, disabled
  when there is nowhere to go; the condition is "no browser bar", not "desktop". Shortcuts in Electron: Alt+←/→,
  Cmd+[/], mouse side buttons, macOS swipes.
- The app's navigation is the URL hash (`route.ts`): back closes an artifact or a stage's details, leaves a menu page.
- **To do:** build the button(s); take screenshots at 1400 px and 390 px wide to decide with the owner whether they
  clutter the header. If they do: hide them in a browser tab, show them in an installed app
  (`matchMedia("(display-mode: standalone)")`) and in Electron (a flag from the server, e.g. `GET /api/info`). **No
  difference between Android and iOS** (the owner's decision).

## 6. The installed app on phones (standalone)
- Task in DESIGN.md §15 "Decide whether the app opens like an installed app on a phone": **decided yes** by the owner.
  The manifest is `apps/web/public/manifest.webmanifest` (no `display` yet; set `"display": "standalone"`), linked
  from `apps/web/index.html` with credentials (Cloudflare Access). Needs the back button (item 5).
- Can be tried on desktop Chrome from `http://localhost` (installable there). Phones need the deployment (remote D1/R2,
  Cloudflare Access: tasks in §15).
- **Add a task:** test the installed app on a real Android phone and iPhone once deployed (back navigation, the wake
  lock, the image cache, touch in the editors).

## 7. The desktop app (Electron)
- Fully designed in DESIGN.md §3 "Desktop version (planned)": Electron's main process runs the Worker's Hono app on
  `127.0.0.1`; small Node adapters for D1 (Node's built-in SQLite, the same migration files at startup) and R2 (a
  folder of files); secrets in a `NAME=value` file in the app's data folder, opened from the settings via the server
  (`shell.openPath`), reread on change; `GET /api/info` says which host it is; back/forward buttons (item 5); no
  login. DESIGN.md says "When: after the first release": the owner now wants it built; update that.
- Out of scope for now: code signing, builds for three platforms, auto-updates (say so in DESIGN.md).
- **Add a task:** test the desktop app locally (the owner runs it on their machine: start, create a project, run the
  pipeline with the fake model, the secrets file, back/forward, restart keeps everything).

## 8. The logo in the README
- The logo is `apps/web/public/icon.svg` (PNGs next to it, made by `npm run icons`). Put it at the top of the root
  `README.md` (the owner wants the README written properly later; for now just the logo).

## 9. Carry manual stages through a re-run (all or nothing)
- Task in DESIGN.md §15 "Carry manual stages through a re-run" (§5.5, §5.8). Today `rewriteFrom()` in
  `apps/worker/src/pipeline.ts` drops every manual stage after a change at once (`if (isManual(row.step)) continue;`).
- **Basic form:** keep them in the pipeline; when the run reaches one, compare what it reads now with what it read
  (its `stage_inputs`, by content hash / recipe key): all identical → keep it as done; otherwise drop it (then the
  stages after it as usual). A WIP manual stage: decide with the owner (probably the same rule).
- **Update the confirmation dialogs** (`ProjectView.tsx`, `CONFIRM_TEXT`; DESIGN.md §5.5 "Confirmation before a
  re-run"): today "Manual fixes for later stages will be dropped entirely"; afterwards they're dropped only if their
  inputs change. Agree the new wording with the owner.
- Also related, in §15: "Decide on the report after a re-run" (which fixes were kept and which dropped).

## 10. Delete project
- Fully designed in DESIGN.md §4 "Deleting a project" and §5.8; task in §15 "Delete project". The menu item exists
  (`PipelinePanel.tsx`, "Delete project" in red) and does nothing.
- As if the project never existed, apart from costs and statistics: delete its outputs (rows and content), the full
  requests/responses of its LLM calls, its PDF and its fingerprints, in D1, R2 and the device cache, unless a project
  that isn't deleted still uses them (checked by query at deletion time); collect R2 orphans then; keep the project
  row, stages and LLM calls marked `deleted_at`; every cache lookup ignores marked rows; listing projects and
  numbering default names must filter deleted projects (they don't yet). A confirmation dialog (the owner wants this
  soon).

## 11. Light theme, and a screenshot script
- **Theme:** colours are CSS variables in `apps/web/src/styles.css` (`:root`), but about 36 literal colours remain
  (MEI highlighting, score backgrounds `#1a1b1e`, `#0d0e10`, …) and CodeMirror's theme (`MeiCode.tsx`) hard-codes
  colours. Follow the system via `prefers-color-scheme` (browsers pass the OS setting through and may override it),
  plus an Auto / Light / Dark setting stored on the device (default Auto). Replace every literal colour by a token
  and add a test that fails on colours outside the token blocks (like the existing test that keeps the icon's accent
  equal to `--accent`), so later views get both themes for free. Engraved pages and scans stay as they are (paper).
  Keep high contrast (§5.7).
- **Screenshot script:** the owner wants to compare versions cheaply, without me clicking through the app (tokens).
  Idea: a script (e.g. `npm run screenshots`) that starts the Worker and Vite with a **seeded local database and R2**
  (a fixed fixture project with every stage done, fake model), then visits a fixed list of URLs (the app's routes
  are hash URLs, so artifacts and stage details can be opened directly by URL, no clicking) at 1400 px and 390 px,
  in both themes (`colorScheme` in Playwright), and writes PNGs to a folder; optionally a contact sheet (one HTML
  page with all of them) to look at in one go. Playwright and Chromium are available in the cloud sessions
  (`/opt/pw-browsers`); locally the owner would install Playwright. Dialogs and menus that need a click: a few
  scripted steps, kept to a minimum.

## 12. The license
- Task in DESIGN.md §15 "Choose a license" (§5.6, the About page). Until then all rights are reserved. Verovio, bundled
  in the web app, is LGPL-3.0 (§9); other bundled libraries: CodeMirror (MIT), libxml2-wasm (MIT, libxml2 itself
  MIT), pdf.js (Apache-2.0), jsPDF (MIT), svg2pdf.js (MIT), fflate (MIT), React (MIT). Only a conversation for now:
  options (MIT, Apache-2.0, GPL/AGPL, …) and what each means for this project.
