# Next steps (temporary list: delete it once its items are done or moved into DESIGN.md)

Written for the next session. Read DESIGN.md first, as usual. Work happens on the branch given by the session; fast-forward
main only when the project owner asks. The project owner decides the order; these are the items they listed, with what
is known about each.

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
- **Telling it apart from the installed web app.** Someone can have both on one machine: the web app installed from
  the browser (projects on the server) and this one (projects on the computer). Same name and icon in the dock or
  taskbar means opening the wrong one and missing projects. Ideas: a different name (e.g. "score3ly (local)"), a
  variant icon (e.g. a different tile colour or a small badge), different window or header colours; think about
  others too and decide with the owner. Goes with the remote-storage wording task.
- **Add a task:** test the desktop app locally (the owner runs it on their machine: start, create a project, run the
  pipeline with the fake model, the secrets file, back/forward, restart keeps everything).

## 8. The logo in the README
- The logo is `apps/web/public/icon.svg` (PNGs next to it, made by `npm run icons`). Put it at the top of the root
  `README.md` (the owner wants the README written properly later; for now just the logo).

## 9. The report after a re-run
- Carrying manual stages is built (DESIGN.md §5.8, "A manual stage after a change is carried"); the confirmation's
  wording is updated. Left: the task in §15 "Decide on the report after a re-run" (which fixes were kept and which
  dropped); being discussed with the owner.
