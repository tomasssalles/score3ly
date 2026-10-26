# Design Document — Score-to-MEI Pipeline (v2)

> Status: draft. Progress is tracked in one place, the checklist of the first release (§16). This document records the architecture, the reasons behind it, and the known risks with proposed mitigations. Items marked **Proposed** are leading candidates, not final decisions. Concrete **tasks**, including the decisions still to be made, are in `docs/tasks.md` (§15).

## 1. What this app is

A web app that converts PDFs of music scores into a formal, text-based encoding of the music: **MEI** (`docs/notation.md`, "MEI").

- **Input:** a PDF, usually a scan of an old score, sometimes a digitally typeset (vector) PDF.
- **Output:** an MEI file (the **export format**), with an engraved rendering for side-by-side comparison with the original. Inside the pipeline, the models read and write a compact format built on LilyPond's notation instead (the **internal format**, `docs/notation.md`, "The lens").
- **Focus:** the **pipeline**, not just the end result.
  - Every step is configurable.
  - Every intermediate input and output can be inspected.
  - Any part of the pipeline can be re-run from the first stage that went wrong, with a different configuration.
  - Any intermediate artifact can be edited by hand, and the pipeline resumes from the edited version.
- **Recognition is done by vision LLMs** (e.g. Gemini, Claude), steered by programmatic steps and human assistance. Programmatic steps handle the deterministic work: image handling, structure, checks, assembly. Humans assist where machines are unreliable, for example cropping heavily ornamented old scores.

### Why a text encoding, and which one
Two goals decided what score3ly should produce:
- **A: work with a score that exists only as a PDF:** convert it, edit it, render it anew. Any good notation format would do, MusicXML with MuseScore included.
- **B: give the music to an LLM** for analysis or generation, e.g. a simpler version for a beginner. score3ly itself does neither, but its output should make them possible. MusicXML is a poor fit here: verbose, full of typesetting, and its durations are tick arithmetic (`<divisions>`, `<backup>`, `<forward>`).

**What models write** (the lens, §6) had to be compact and natural for a model:
- **ABC:** compact, and the format LLMs know best, but weak for dense piano polyphony and cross-staff notes.
- **kern** (Humdrum): a time grid, one column ("spine") per staff and one row per moment, used in research because image-to-sequence models need a compact linear target. Simultaneity is explicit, but melodic lines are scattered down the columns, and every row needs one token per column, which is fragile to generate.
- **LilyPond:** melodic lines stay contiguous and readable, for people and models alike; simultaneity needs duration sums, which code checks. **Chosen,** as a format of our own built on its notation (`docs/notation.md`, "The symbolic format").

**What users get** had other requirements:
- everything musical, as opposed to typesetting: pitches, durations, rests, ties, slurs, articulations, tremolo, dynamics, and what a player needs: voices, cross-staff notes, stem directions;
- room for editorial notes and alternatives, clearly separated from the music;
- unambiguous to parse, and, once what isn't musical is removed, one way to encode given music, or equivalences that are trivial to recognize. No format guarantees that by itself: it takes a normalizer, and ours is the conversion from the lens (§6);
- conversion to other formats. Lossless conversion to ABC or kern is impossible (they express less).

**MEI fits best** (`docs/notation.md`, "MEI"): XML from the musicology community, with the musical content apart from the layout, pitches as name and octave, durations as note values (no ticks), written and sounding values kept apart (`accid` and `accid.ges`), dynamics, slurs and the like attached to notes, irregular measures marked as such (`@metcon`), editorial markup (`app`/`rdg`, `choice`, `supplied`, `unclear`, `annot`), links to image regions (`facsimile`), and MEI Basic, an official subset with "one way of encoding for every feature". Verovio renders it in the browser and keeps the MEI's ids in its SVG. MusicXML was the fallback (the best ecosystem of tools, but heavy normalization and weak editorial markup); the other formats would be views derived from MEI. Export to them is a later question: no converter between MEI and LilyPond exists in either direction, and Verovio doesn't write MusicXML.

**Considered and dropped:** starting from an OMR tool's MusicXML, checking it in code, and letting an LLM fix only the measures that fail the checks. Cheap, but no OMR output tested is good enough to start from (§13, "Baselines"), and turning MusicXML into LilyPond (`musicxml2ly`) loses things: MusicXML moves a time cursor back and forth between voice numbers where LilyPond has continuous voices (and voice identity is musical information for piano), its data is redundant and often inconsistent (`<duration>` and `<type>`, `<alter>` and the printed accidental), and the converter has gaps (cross-staff notes, changing staff counts, pedal, ornaments, octave marks).

### Lessons from v1
v1 was Python-only, local-only and command-line-only.

**What failed:** heavy programmatic preprocessing (cropping, deskewing, stain removal) followed by Audiveris (MusicXML) and `musicxml2ly`.
- Ornamented old scores were impossible to handle with scripts.
- Audiveris failed badly on them.

**What carries over:**
- The stage-tracking system: detecting finished stages, resuming interrupted runs, re-running stages, with hash checks and JSON documentation. It is the basis for §5.
- Some LilyPond conventions, now part of the lens (§6): absolute pitches, so that an octave error doesn't propagate, and code, not the model, building the score's structure.

**Where v2 starts from:** experience from other projects shows that current vision LLMs read difficult material very well, at a cost of cents per call.

### Scope
- **The scope is music in conventional Western staff notation** (decided; also called common music notation): notes on staves of five lines, with clefs, key and time signatures, noteheads with stems, beams and flags, rests, bar lines, and the marks that go with them. For any instrument, voice or ensemble, and any genre: piano, voice and choir, chamber and orchestral music, lead sheets, Baroque continuo, popular music. **Unpitched percussion is in it too** (decided), since orchestral music needs it from Beethoven's Ninth on (bass drum, cymbals, triangle, …): one-line staves, or five-line staves with a percussion clef, where a note's position means an instrument rather than a pitch. Every decision about the format and the stages is made with all of it in mind.
- **Outside the scope:** other notations. Tablature (decided); probably also, by the same reasoning, chant neumes, early music's mensural notation and graphic scores.
- **Reached step by step:** what the scope holds is covered release by release, not all in the first one. Lyrics, chord symbols, alternative versions and much else come later (§15). Until something is covered, the model writes its best workaround and raises a format issue (`docs/notation.md`, "Issues"), and the format gap report shows what to cover next.
- **Piano music is the project owner's background, not the scope:** it is where most of the examples, the knowledge and the test set come from, and when something has to wait for a later release, what piano music needs tends to come first. It is also hard enough to test the design: multiple voices per staff, the staff count changing mid-piece (e.g. 3 staves in a passage, 2 elsewhere), lyrics below systems, editorial notes, ossia and alternative versions, a reduction staff for an orchestral part, two-piano double systems.
- **Possible later: image input (PNG, JPEG)** in addition to PDFs. It is almost no extra work: an image is a page image, so it skips PDF extraction and joins the same pipeline at `rasterize` (§6), with JPEGs going through the same bundled decoder (§8.1).

### Goals
- **Quality first:** the measure of success is how good the transcription is and how little human correction it needs. Infrastructure only exists to serve that.
- **Cheap:** runs on free tiers. Paid LLM calls are the only expected running cost.
- **Transparent:** open source, simple deployment, documented strategy (this file).
- **Runnable from anywhere:** start on the desktop, continue on the phone. Every pipeline stage should work on both.
- **Reproducible and testable:** every stage output (§5.2) can be traced back to its inputs, code version, prompt version, model and configuration. Non-deterministic parts (LLM calls, human input) are recorded so they can be replayed (§12).

### Non-goals (for now)
- Multiple users, sharing, collaboration. Each person deploys their own instance to their own Cloudflare account, or runs the desktop version (§3), with their own secrets, so the app has no user accounts and none are planned.
- MusicXML output, or any export but MEI (§9).
- Other input formats (LilyPond, MusicXML), with score3ly as a normalizer that turns music written in any of them into its well-behaved MEI, a starting point for further work by machines.
- Fixing printing mistakes: the transcription is as printed (`docs/notation.md`, "Issues").
- Offline-first operation.

## 2. Architecture overview

```mermaid
flowchart LR
  subgraph Device["Browser (desktop or mobile)"]
    UI[React UI]
    WW["Web Workers:<br/>PDF decoding, image processing,<br/>fingerprints, lens checks,<br/>MEI building, rendering (Verovio)"]
    OPFS[("OPFS:<br/>derived images (cache)")]
    UI <--> WW
    WW <--> OPFS
  end

  subgraph CF["Cloudflare (EU jurisdiction)"]
    W["Worker (Hono):<br/>API, auth boundary, LLM proxy"]
    D1[("D1 (SQLite):<br/>projects, configs, stages,<br/>provenance, LLM call records")]
    R2[("R2:<br/>original PDFs and stage<br/>outputs, by SHA-256")]
    W <--> D1
    W <--> R2
  end

  Drive["Google Drive<br/>(source + export target)"]
  LLM["Vision LLMs<br/>(Gemini, Claude, ...)"]

  UI <-->|HTTPS, behind Cloudflare Access| W
  UI <-->|Picker + drive.file| Drive
  W <--> LLM
```

### Where data lives

| Data | Location | Why |
|---|---|---|
| Original PDFs | R2, key = SHA-256 of the file bytes | Source of truth. About 0.66 GB for 200 PDFs, well within R2's 10 GB free tier. Identifying PDFs by content makes deduplication and "resume an existing project?" trivial. |
| Projects, step configs, stages, one row per stage output (§5.2), provenance, fingerprints | D1 | Small, structured, relational. SQLite is easy to inspect and migrate. |
| The content of stored stage outputs (analysis JSON, extractions in the internal format, issues, MEI files, human operations) | R2, key = SHA-256 of the content | Small, must never be lost, often not reproducible. One storage mechanism and one rule for everything stored (see below), plain files in the desktop version (§3), and far more room than D1 has. Content can't be queried there, so whatever the app filters or sums on (costs, counts, types of findings) is also a column in D1. |
| LLM call records (full request + response) | D1 (large payloads in R2) | Needed for provenance, cost tracking and replay tests (§12). |
| Derived images (page images, preprocessed pages, system crops) | OPFS on the current device | Large (roughly 150–300 MB per PDF in colour, a third of that in grayscale) but regenerable from the PDF plus the recipe. Device-local means real deletion, no cloud quota, and no data residency issue. |
| Final exports (the MEI file, optionally its engraved PDF) | Download, or an app-created folder in Google Drive | The user's own file space. Browsable anywhere. |

### Why this split
- **No server-side compute.** Workers have tight CPU limits and no native libraries. All heavy processing happens in the browser, so the Worker stays a thin API and LLM proxy, and stays on the free tier. Waiting on an LLM response doesn't consume Worker CPU time.
- **Images are cache, not data.** This removes the biggest storage cost entirely. Switching devices costs some regeneration time, not storage.
- **Everything persistent is small** (rows in D1) or **content-addressed and immutable** (R2).
- **Every object in R2 is stored under the SHA-256 of its bytes,** not only the PDFs. Objects never change: changed content is a new object under a new key. So a repeated upload is harmless, the browser can cache every object for good, a fork (§15) copies no objects, and the hash that a stage's validity check needs anyway (§5.2) is also the key. The price is that an object can't simply be deleted with the row that refers to it, since other rows may refer to it too (§4).

## 3. Technology decisions

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript everywhere | One set of types shared by the UI, the processing code, the Worker and the DB rows. The v1 Python code is being rewritten anyway. |
| Frontend | React + Vite | Familiar. Deploys to Cloudflare as static assets without changes. |
| Backend | Cloudflare Worker, HTTP layer on Hono | Web-standard `Request`/`Response`, minimal and portable. |
| Database | Cloudflare D1, created with `--jurisdiction eu` | SQLite semantics, free tier, EU data residency. The jurisdiction can only be set at creation. |
| Object storage | Cloudflare R2, bucket created with EU jurisdiction | 10 GB free, no egress fees, native Worker binding. The jurisdiction can only be set at creation. |
| Auth | Cloudflare Access in front of the whole app | No auth code in the app. |
| Device storage | OPFS (Origin Private File System) | Supported by Firefox, Chrome and Safari. Fast binary access from Web Workers. |
| PDF handling | pdf.js, version pinned | Renders vector PDFs and decodes CCITT, JBIG2 and JPEG 2000 images in JS/WASM, deterministically. |
| JPEG decoding | pdf.js's own JavaScript decoder, not the browser's (pdf.js would use the browser's `ImageDecoder` where there is one; it is switched off, §8.1) | Browser JPEG decoders may differ by about ±1 gray level. A decoder in our bundle gives identical pixels everywhere. |
| Vision LLMs | The user's choice, per stage (§7.2). Recommended: Claude Opus 5.5 for everything. | In the manual run (§13) Opus did best at everything, layout included. Providers are swappable behind the `LlmProvider` port. |
| Structured LLM output | Provider-native schema-constrained output, validated with Zod | Machine-checkable outputs. No free-form parsing. |
| Schema validation | Zod (or similar) | Validates step configs, LLM outputs and DB payloads. The same schema generates the UI controls (toggles, sliders). |
| Rendering | Verovio (WASM) in the browser, rendering the MEI | Keeps rendering runnable everywhere, with no native program. See §9. |
| Google Drive | Google Identity Services + Google Picker + `drive.file` scope, entirely in the browser | `drive.file` is non-sensitive: no app verification, and access only to files the user picks or the app creates. |
| Local development | `wrangler dev` (local D1/R2 emulation) + Vite dev server, run as two processes. Vite proxies `/api` to Wrangler. No Cloudflare Vite plugin. | One code path from day 1. Keeps the app and the Worker as separate packages with a clear boundary. |
| Deployment | One Worker with static assets: `apps/worker`'s Wrangler config serves `apps/web`'s build output. `wrangler deploy` uploads both. | One origin: no CORS, one Access policy, app and API always deployed at the same version. |
| Tests | Vitest | Pure-TS core runs in Node for unit, golden-image and replay tests. |

### Repository layout (suggested)

```
packages/
  core/      What more than one app needs (built): content keys and SHA-256, the Project type; and as entry
             points of their own, drawing a PDF page in a browser (`/pdf`) and the Vite plugin serving
             pdf.js's data files (`/pdfjs-assets`). The main entry runs in browsers, Workers and Node.
             (The step definitions and the pipeline's logic live in apps/web for now: only it runs them.)
  imaging/   Page images from PDFs, deterministic image operations (skew, rotation, scaling, crops, PNG),
             fingerprints. Pure TS/WASM.
  notation/  Lens parser and checks, measure building from stretches,
             MEI builder (the frame from the structure and metadata, the music from the lens).
  prompts/   Versioned prompt templates and their output schemas.
apps/
  web/       React UI, Web Worker host, OPFS + Drive + local-file adapters.
  worker/    Hono API, D1 + R2 adapters, LLM provider adapters.
  desktop/   The desktop version (§3): the Worker on Node, in an Electron window.
  eval/      Local evaluation tooling: engrave command, side-by-side viewer (§13).
fixtures/    Recorded test projects (§12).
testset/     Evaluation test set (§13): inputs, their strokes and .ly/.musicxml candidates committed, rest ignored.
DESIGN.md
```

The Worker's entry module (`apps/worker/src/index.ts`) may only export handlers: the Workers runtime refuses to start otherwise, and the tests (which import the module directly) don't notice. Helpers live in their own modules (e.g. `names.ts`).

### License
**score3ly is licensed under the GNU Affero General Public License, version 3 or (at the user's option) any later version** (`AGPL-3.0-or-later`; decided, 2026-10-24; `LICENSE`, added by the project owner; the license's own notice in the README, and the SPDX id in the root `package.json`). **The license is done** (decided): nothing about it is left to decide or build; only the third-party notices are kept up to date, by their test. In short: anyone may use, change and share the code, but whoever shares it, or lets others use a changed version over a network, must offer its source code under the same license. Chosen over a permissive license (MIT, Apache-2.0) to keep options open: no one can run a closed copy as a service, and a paid hosted version or a commercial license stays possible for the copyright holder (who should then accept outside contributions only with a contributor agreement). Moving to a permissive license later is easy; the reverse isn't. "Or later" (decided) lets the code also be used under future versions of the AGPL that the Free Software Foundation may publish.

**What we use from others** sets conditions of its own, all met by passing on their notices: permissive licenses (MIT, Apache-2.0, BSD, 0BSD, the Unlicense) for the libraries; the SIL Open Font License for the fonts (Inter, JetBrains Mono, and Leipzig's metronome glyphs, §6, "Tempo marks"); the Educational Community License 2.0 for the MEI schema the web app loads (Fix MEI). **Verovio is LGPL-3.0:** the app may be under any license, as long as Verovio's license and source are offered and users can replace it with another build (it is a separate WebAssembly module), and changes to Verovio itself would have to be published under the LGPL.

**Third-party notices** (built): `THIRD_PARTY_NOTICES.md` lists every package the builds include (the production dependencies of `apps/web`, `apps/worker` and `packages/*`, and theirs, as installed; optional dependencies left out, since they are platform-specific or Node-only; `apps/eval`, a local tool, left out), each with its version, license and repository, then their license and notice files verbatim (packages with the same texts share one section), and the material that isn't a package. A package without a license file gets its license's standard text, kept in `scripts/licenses` (with the LGPL goes the GPL it supplements). Made by `npm run notices` (`scripts/notices.ts`); a test fails, saying to run it, whenever the file differs from what the installed packages give, so a dependency change can't go unnoticed. The About page links to it.

### Ports and adapters

The core depends only on interfaces. Adapters live in `apps/*`.

| Port | Adapters |
|---|---|
| `PdfSource` | Local file input, Google Drive (Picker) |
| `BlobStore` (original PDFs, stage outputs) | R2 via the Worker. A folder of files (desktop version). In-memory for tests. |
| `ProjectStore` (projects, stages, output rows, provenance) | D1 via the Worker. A SQLite file (desktop version). SQLite or in-memory for tests. |
| `DerivativeCache` (regenerable images) | OPFS. In-memory for tests. |
| `LlmProvider` | One adapter per provider (via the Worker). **Replay** adapter for tests. |
| `Renderer` | Verovio in the browser. See §9. |
| `ExportTarget` | Browser download, Google Drive folder |

### Desktop version

The app is built for the browser and Cloudflare, and that stays the focus. An optional **desktop version** wraps the same code, for people who prefer that trade-off:

| | Web app on Cloudflare | Desktop app |
|---|---|---|
| Setup | A Cloudflare account, a deployment, secrets in the dashboard | Install and run |
| Devices | Every device, phones included, with the important data synced | One computer |
| Data | D1 and R2 in the EU, images cached per device (sometimes missing and rebuilt) | Everything local and persistent; the disk is the only backup |
| Secrets | Worker secrets | A local file |
| Residency | EU storage at a US company (§10) | Local, apart from the LLM calls |

The project owner uses the web app. The desktop version mainly makes the app easier to share with people who would not set up Cloudflare (the API keys they have to bring remain a hurdle either way).

**The rule that keeps it cheap:** the web app only ever talks to the Worker's HTTP API, and the Worker only touches Cloudflare through its D1 and R2 bindings and its secrets. Anything Cloudflare-only beyond those (e.g. Workflows or Durable Objects, §15) goes behind a port with a desktop equivalent, or is a deliberate exception. Then the desktop version is a different host for the same server code, not a second app.

**How:**
- **Electron.** Its main process (Node) runs the Worker's Hono app as a local server on `127.0.0.1`, and the window shows that address. The React app doesn't change. Electron rather than Tauri because it ships Chromium: the system web views (WebKit on macOS) differ in canvas, OPFS and pdf.js behaviour, and Tauri would still need Node alongside for the server. The price is a download of about 150 MB.
- **Small adapters on Node, not Miniflare.** D1 is SQLite: the part of the D1 API we use (`prepare`, `bind`, `all`, `batch`) is a thin layer over Node's built-in SQLite, running the same migration files, at startup. R2 is a few calls (`get`, `put`, `head`, `delete`) over a folder of plain files. Miniflare would need no adapters but is a development tool, ships the `workerd` binary per platform and stores R2 objects in its own format.
- **No login:** the server only listens on localhost, so Cloudflare Access isn't needed.
- **The same server also runs without Electron,** as a plain local server, **strictly a development helper** (the project owner, 2026-10-25), like `dev:worker` with `dev:web`: e.g. to try the desktop version's server in a browser, or to run the screenshots against it. The products are the two editions below.

**Editions** (decided, 2026-10-25): the two have names, so that someone with both on one computer can tell them apart, kept within the brand and its music. The web app on Cloudflare is ***concerto*** (from *concertare*, to bring into agreement: every device in sync), the desktop app ***cadenza*** (the soloist alone, on one device); the plain local server, a development helper, shows *cadenza* too, being the desktop app's server. Chosen over tutti/solo (the clearest contrast, but "tutti" didn't appeal), sinfonia/solo, recital/symphony, loco ("in place", after an *8va*), da camera, da lontano and unplugged (which promises "offline", and the LLM calls aren't). Built: the window's title is "score3ly – concerto" or "score3ly – cadenza" (a tab, an installed app's title bar, the desktop app's window, which takes the page's title), and the About page has the edition under the wordmark, like a work's subtitle, and after the summary: "The *concerto* app uses cloud storage and remote servers. You can log into your account on different devices and your projects are kept in sync across them." / "The *cadenza* app runs and stores all files on your device. There's no account to log into. Installations on different devices share no data." The header shows the edition next to the wordmark, in muted italic serif, in wide mode only (decided): on a phone there is no room for it beside the wordmark and the header's button. (`host.ts`: the edition follows `GET /api/info`). **Cadenza's icon** (decided, 2026-10-25) is the mark on a light grey tile (#dfe1e5) with a black note and the same coral brackets (`apps/web/public/icon-cadenza.svg`, PNGs by `npm run icons`): chosen over a lighter grey (#ebedf0, which loses its edge on white), a coral tile with white or black marks, and a coral tile with coal brackets. It is the Electron window's icon (the taskbar's on Windows and Linux; the dock's on macOS, set at startup while the app runs from the repository) and the tab's icon of the plain local server; concerto keeps the coal icon.

**Packaging** (decided and built, 2026-10-26): **users build the app themselves,** on their own computer, for their own system and processor: an app started from its icon, with its own name in the dock, the taskbar and the app switcher, its data in the system's app data folder. No code signing (no paid certificates or developer accounts for an app that earns nothing), no downloadable builds per platform and release, no automatic updates; a little effort from the user is fine. No signing is needed: macOS blocks unsigned apps only when they were downloaded (the quarantine flag), and a locally built one is signed ad hoc, for free (`mac.identity: "-"`); Windows' SmartScreen warns only about files from the internet.
- **How:** Node.js, the code (a ZIP from GitHub or `git clone`), `npm install` and `npm run package:desktop` (electron-builder, configured in `apps/desktop/package.json`, after the usual build), then installing the result the usual way: macOS, the `.app` (target `dir`) dragged into Applications; Windows, an NSIS installer (a Start menu entry, no desktop shortcut (decided); the folder can be chosen); Linux, a `.deb` (`apt install ./…deb`), or an `.rpm` with `npm run package:rpm -w apps/desktop`. A new version: the same again, installed over the old one; the data stays. Step by step, for users: `apps/desktop/README.md`.
- **What the package holds:** the app's `dist/` (the two bundles, the web app, the migrations) and no `node_modules` (everything is bundled); our `LICENSE` and `THIRD_PARTY_NOTICES.md` as resources; Electron's and Chromium's licence files, which electron-builder adds. The product name is "score3ly cadenza" (decided), and the installed web app's, the manifest's `name`, "score3ly concerto" (decided; its `short_name`, for a phone's home screen, stays "score3ly"); the app ID `io.github.tomasssalles.score3ly.cadenza`, the icon cadenza's, the version the app's (a test keeps `apps/desktop/package.json`'s equal to the root's). On Linux the package and its launcher entry are `score3ly-cadenza`, which is also the window's class, so the dock links the window to its entry.
- **Tried** on Linux here: the `.deb` built, installed and started from its installed path (title "score3ly – cadenza", packaged, data in `~/.config/score3ly`). Not yet on macOS and Windows (§15).

**What differs in the app.** The server says which host it is (e.g. `GET /api/info`), so the web bundle stays the same for both; the UI asks the server, and nowhere else decides by host:
- **Secrets:** in the desktop version they are in a file in the app's data folder, in the same `NAME=value` format as `.dev.vars` (§10). The app creates it on first start, with a commented example and permissions for the user only. A button in the settings opens it in the system's default text editor: the page asks the server, which opens it (`shell.openPath`), since a web page can't. Changes take effect without a restart: the server reads the file again when it changes, and the secret names in the model configs (§7.2) update. In the web version, the same place in the settings explains that secrets are set in the Cloudflare dashboard, with a link to the user guide.
- **Navigation:** an Electron window has no browser bar, but the app relies on the back button (closing an artifact or a stage's details, leaving a menu page, §5.6). So: back and forward buttons in the header, left of the wordmark, disabled when there is nowhere to go (Electron knows: `navigationHistory.canGoBack()`), and the usual shortcuts, which Electron doesn't set by itself: Alt+←/→ (Windows, Linux), Cmd+[/] (macOS), the mouse's side buttons and swipes on macOS. The condition is "no browser bar", not "desktop": an installed app (§5.7) needs the same, on phones too, with no difference between Android and iOS (decided).
  - **Built in the web app** (`Header.tsx`, `navigation.ts`): the buttons, arrows (not chevrons, which collapse and expand), show when the display mode is `standalone`, `fullscreen` or `window-controls-overlay` (`minimal-ui` keeps the browser's back button), or when the server says it is the desktop host. In a browser tab they are hidden: the browser's own buttons do the same (decided by the project owner's "best judgement" brief, and approved from the screenshots). They go back and forward in the browser's history, which is the app's, since its navigation is the URL's hash. Whether there is somewhere to go comes from the Navigation API (`navigation.canGoBack`/`canGoForward`: Chromium, so Electron, Android and desktop installs, and Safari 26.2); without it, both stay enabled and do nothing at the ends. The shortcuts and mouse buttons need nothing in a browser's installed app (the browser handles them); Electron's are set in its main process. On a phone the arrows take the room of the header button's second word: "+ New" instead of "+ New project" (below 480 px, only with the arrows).
- **The data folder:** nothing in the app opens it. The user guide says where things are stored on each platform, with a strong warning that changing those files can invalidate pipelines that already ran (§5.2).
- **Easier on desktop:** no Worker limits on CPU time, no lost answers when a phone sleeps, no free-tier quotas. Running the whole pipeline on the server (§15) is simple there.

**The real costs** are outside the code:
- **Code signing:** unsigned apps get warnings (macOS Gatekeeper, Windows SmartScreen) that stop non-technical users. Notarizing for macOS needs an Apple Developer account ($99/year); a Windows certificate costs money too.
- **Builds for three platforms** (GitHub Actions) and updates (e.g. electron-updater from GitHub Releases).
- **Migrations on users' machines,** run at startup.

**When:** first version built on 2026-10-25, ahead of the first release, at the project owner's request. **Out of scope** (decided): code signing, downloadable builds per platform and automatic updates; users build the app themselves (below, "Packaging"). For development it also runs straight from the repository: `npm install`, then `npm run desktop`.

**Built** (`apps/desktop`):
- **`server.ts`:** the Worker's Hono app (`apps/worker/src/index.ts`, unchanged) on Node with `@hono/node-server`, on 127.0.0.1 and a free port. It serves the built web app as Cloudflare serves the assets (Vite's hashed `/assets/` cached for good, the rest revalidated) and answers two things itself: `GET /api/info` (the Worker answers `{ host: "cloudflare" }`; this server `"desktop"` in Electron, `"local"` alone) and `POST /api/secrets-file/open` (Electron only). It also runs alone, as the plain local server, for development: `npm run serve` (port 8790, data in `~/.score3ly`, or `--data`/`--port`), on 127.0.0.1 only.
- **`d1.ts`:** D1 over `node:sqlite` (`DatabaseSync`): `prepare`/`bind`/`first`/`all`/`run`/`raw`, `batch` in one transaction, `exec`, with D1's conversions (booleans as 1 and 0, blobs as ArrayBuffers) and foreign keys on. At startup it applies the Worker's migration files not applied yet, recording them in a `d1_migrations` table as Wrangler does.
- **`r2.ts`:** R2 over a folder: an object is a file at its key's path, its content type in a `.type` file next to it, its upload time the file's. `put` refuses content that doesn't match a given SHA-256, as R2 does, and writes through a temporary file; `list` goes by prefix in key order, a page at a time.
- **`secrets.ts`:** the secrets file, `secrets.env` (dotenv's format: comments, `export`, quotes, a double-quoted value over several lines for a service account's JSON); created with a commented example, mode 600; read again when its modification time or size changes, so a new key works without a restart. Its values are the environment's other entries, as a Worker's secrets are.
- **`main.ts`:** Electron's main process. The data folder is Electron's `userData` for the app name "score3ly" (e.g. `~/.config/score3ly` on Linux): `score3ly.sqlite`, `files/` and `secrets.env`. One instance at a time (a second start focuses the first window). The window is sandboxed, without Node. Its background before the page paints, the splash, is cadenza's icon tile, #dfe1e5 (decided). **The window's frame follows the app's theme** (decided), not the system's setting: the page says which (`POST /api/window/theme`, from `startDesktopWindow` in `host.ts`) and Electron sets `nativeTheme.themeSource`; the last one is kept in `window-theme.json` in the data folder, so the frame is right from the start. Auto hands the frame back to the system: in Electron, forcing the frame also forces the page's `prefers-color-scheme`, which Auto follows, so Auto would stay stuck on what it was forced to. Back and forward: Alt+←/→ (Windows, Linux), Cmd+[/] and Cmd+←/→ (macOS), the keyboards' Back and Forward keys, the mouse's side buttons (`app-command`) and a swipe on macOS (`swipe`, right for back: untested, no Mac here). Links to other sites open in the browser, never in the app's window. **No menu bar** (decided): none on Windows and Linux; macOS, which always has the global menu bar, keeps a minimal one (the app's menu, Edit for copy and paste by keyboard, Window). Reloading and the developer tools, which came with Electron's default menu, are bound without one: Ctrl+R or F5 and Ctrl+Shift+I or F12 (Cmd+R and Cmd+Alt+I on macOS).
- **`build.ts`:** esbuild bundles `main.js` and `server.js` (one file each, the Worker's code and dependencies included, Electron left outside) into `dist/`, with the web app's build and the migration files. Electron 44 (Node 24, where `node:sqlite` needs no flag).
- **Checked:** unit tests for the adapters and the secrets file; the screenshot script with `--desktop` seeds its projects through this server (whole pipelines with the fake model, a failed stage, a fix in progress) and takes every shot; Electron under Xvfb, driven by Playwright: a project created and run, back and forward by button, keyboard and mouse button, the settings, and the project still there after a restart.
- **In the app:** the back and forward buttons show for the `desktop` host too (§5.7). Settings has a "Secrets" section: a button that opens the file in the desktop app, where the file is with the plain server, and the Worker's secrets on Cloudflare; a model config's secret is labelled "Worker secret" only on Cloudflare. Texts that assumed a remote storage follow the host: after deleting a project, "was deleted" (not "from this device and from the remote storage"); a running stage that blocks the deletion isn't said to be "here or on another device".

## 4. Identity and projects

- A PDF is identified by the **SHA-256 of its bytes**, computed on the device with `crypto.subtle.digest` **before** uploading.
- When a PDF is selected, the app asks D1 whether the hash exists:
  - **Unknown:** upload to R2 at `pdfs/<sha256>.pdf` and create a project.
  - **Known:** offer to resume an existing project on this PDF, or start a new one. There can be several projects per PDF.
- The file name and source (Drive ID, local path) are stored as informational metadata only, never as identity.
- Each project has a **name**, so the user can tell projects on the same PDF apart (e.g. "Sonata, Claude run" vs "Sonata, Gemini run"). The name is a label, not the identity (that is the project ID), but it is unique so it can be relied on:
  - It defaults to the PDF's file name without ".pdf". If a project already has that name, the Worker appends " (1)", " (2)", ... and takes the first free one, like file managers do. A file that is already called `Sonata (1).pdf` becomes `Sonata (1) (1)`, also like file managers.
  - Uniqueness is case-insensitive ("Sonata" and "sonata" clash) and enforced by the database (a unique index, `COLLATE NOCASE`), so two projects created at once can't get the same name. Names are trimmed, never empty, and at most 200 characters.
  - The user can rename a project at any time ("Rename" in the project actions, §5.6). Renaming to a name that is taken is refused with a message, not numbered: numbering only applies to the default. Changing only the case of the project's own name is allowed.
  - Deleting a project frees its name.
- **Deleting a project** (built): apart from the costs and statistics, it must be **as if the project had never existed** (decided). In particular, a new project with the same PDF, name and config runs every stage from scratch and finds nothing of the deleted one in the cache.
  - **Deleted:** the project's stage outputs (their rows and their content), the full requests and responses of its LLM calls, its PDF and the PDF's image fingerprints, in D1, R2 and the device cache, unless another project that isn't deleted still uses them. That is checked with a query at deletion time, not with stored reference counts, which can drift.
  - **Orphans in R2 are collected then too:** objects that no row in D1 refers to any more, from any project. They are left behind when a manual stage in progress is saved again (the new content is a new object, §2) or when an upload isn't followed by its row in D1. Nothing else deletes them: a save doesn't delete the object it replaces. This lists the whole bucket and compares it with D1, which is acceptable because deleting a project is rare.
  - **Kept, but marked with a deletion time (`deleted_at`):** the project's row, its stages and their LLM calls, for the costs and statistics (§10). Every cache lookup ignores marked rows (§5.8), so they are never reused. A stage that a fork which isn't deleted still uses is not marked (§5.8).
  - A deleted project never appears in the UI again, except in the costs view. Picking its PDF again doesn't trigger the "already based on this file" dialog, unless other projects use that PDF.
  - Uniqueness of names only counts projects that aren't deleted: a partial unique index (`... WHERE deleted_at IS NULL`). *Built* (migration 0003, which rebuilt the table: the earlier constraint sat on the column and couldn't be dropped).
  - **Behind one dialog** (decided): it shows the project's full name, says what is deleted, and the user has to type the name, exactly (case included); pasting or dropping text into the field doesn't count. "Delete project" stays disabled until the name matches.
  - **Refused while a stage of the project runs,** here or on another device (an interrupted one doesn't count), with a message saying so.
  - **Its text** (the project owner's): "The project and all its files will be deleted, along with any data cached on this device (with the exception of files still in use by other projects). Only its costs will still be reported in the Statistics page. This action cannot be undone."
  - **Afterwards** the app shows a screen like the one without a project, saying that "<name>" was deleted from this device and from the remote storage; the URL is `#/` (the project's URL is replaced, so going back doesn't land on it), and a reload shows the usual empty screen.
  - **Built** (`apps/worker/src/deletion.ts`, `DELETE /api/projects/<id>`; `apps/web/src/DeleteProjectDialog.tsx`): marking as above; the outputs of marked stages are deleted unless a stage that isn't marked read them, or an output of one was made from them or corrects them (with the provenance rows of marked stages that point to them); the PDF's fingerprints when no project left uses the PDF. Content in R2 is deleted by collecting orphans: every object no row refers to (a stored output's content, the request or response of a call that isn't marked or that an output names, the PDF of a project that isn't deleted), **if it was uploaded more than an hour ago**: content is uploaded before the row that refers to it, e.g. by a stage running on another device, and must not be collected in between. On the device, the images made from the PDF are deleted when no project left uses it: they are cached in a folder per PDF (§8.6). Renderings of the Transcription and the engraving (SVG, keyed by the MEI's hash) stay until the cache's size limit is built. Tried in Chromium at both widths.
- Each project also has three timestamps, all set by the Worker (ISO 8601, UTC) so a wrong device clock can't scramble the order:
  - **created**
  - **last modified:** any change to the project's own data (pipeline results, manual stages, a rename). Opening or viewing doesn't count.
  - **last opened:** set by a dedicated request when the project is opened, so listing projects doesn't touch it.

  Both start equal to the creation time, so sorting needs no special case for "never".
- Concurrent edits from two devices are prevented by optimistic locking: each project has a version number, and stale writes are rejected with a reload prompt.

## 5. The pipeline model

The pipeline is designed like a small build system. The v1 stage-tracking system (hash checks, resumability, JSON documentation) is the starting point and is ported, not reinvented.

### 5.1 Steps and stages

- A **step** is a definition in the code: what is done, with which configuration options.
- A **stage** is one occurrence of a step in a project's pipeline, with its own configuration and its own results.
- A project's **pipeline** is the ordered list of its stages. It is stored in D1 and shown in the UI (in the pipeline panel, §5.6), so it has to stay short.

There are two sorts of stages:
- **Recipe stages** have a predefined order (§6, the recipe) and can run automatically, one after the other. (Not to be confused with the status `planned`, §5.8: a stage of any sort that hasn't run yet.)
- **Manual stages** are added by the user to intervene by hand (§5.4). They are recorded in the pipeline like any other stage.

The same step can occur more than once in a pipeline. Example: the review step run twice for extra accuracy, or once with one model and once more with another.

#### Run modes
A small drop-down in the pipeline panel sets, per project, how the pipeline runs:
- **Auto:** one click starts the pipeline (or resumes it), and it keeps going from stage to stage, following the recipe, until it is done or fails. If a model flags that it would like human input, the flag is recorded, but the pipeline goes on with the model's best guess. The spending cap (§10) also stops it.
- **Manual:** each stage is started by a click. This leaves time to look at the outputs and decide whether to step in with a manual stage or to run a stage again with other parameters.

The mode for new projects is a settings item. After installation it is "Auto". Built: `newProjectRunMode` in the settings (`/api/settings`), a drop-down like the panel's on the settings page, saved when picked; the Worker reads it when it creates a project.

The browser drives the pipeline, so in either mode a run only advances while the app is open (§15).

Each step declares:
- `id` and `version`, e.g. `extract@3` (see §11).
- A **config schema** (Zod), which is also the source of its UI controls.
- **Input** and **output types**.
- **Granularity:** per document, per page, or per system. Steps can fan out, e.g. one page becomes many systems.
- Its **kind:** `ingest`, `computed` (code), `llm` or `manual`, and nothing else (decided). `ingest` is the kind of the first stage only: it doesn't run (the PDF is given when the project is created), so the UI treats it apart (no run, progress or retry; it is done from the start), and its output is stored like LLM and manual outputs (§5.3).

Every stage runs in the browser, its heavy work in Web Workers; an LLM stage sends each of its requests through the Worker (§7.2), which makes the call.

While it runs, a stage **reports its own progress** as a fraction from 0 to 1, which the UI shows (§5.6):
- Only the code that performs the stage knows how far it is. It is handed a function to call whenever it has got further (e.g. after each system), and doesn't know about the bar or the circle that show the value. A stage running in a Web Worker can't call into the page, so there the function passes the value on as a message.
- **A single LLM call has nothing to report while it waits,** so its share of the bar fills with the time elapsed out of the call's timeout, and jumps to full when the answer arrives. If the timeout is reached, the call has failed. For a stage that is one call, the share is the whole bar; for a stage with a call per system, each call fills its own slice.

### 5.2 Outputs, artifacts and provenance

**Terminology** (decided):
- **Stage outputs** are internal: many and fine-grained, e.g. one per page, per system or per LLM request. They carry provenance and cache keys, have a row each in D1, and are what is stored or regenerated. They are saved as soon as each is done, so an interrupted or failed stage resumes where it stopped.
- **Stage artifacts** are what the user sees: few per stage, mostly for the whole score (the pages, the layout, the transcription so far, the MEI file, the issues), shown as tiles and in the artifact view (§5.6). A stage doesn't show 107 tiles for 107 systems. An artifact is built from the stage's outputs, as a view; some are stored as well for convenience (the MEI file for download), but an artifact never holds anything that isn't in, or computable from, the outputs. So provenance and caching live in one place, the outputs.
- **The export format** is what the user gets: MEI (`docs/notation.md`, "MEI"). **The internal format** is what the pipeline works with: the lens (`docs/notation.md`, "The lens"). There is no single storage format: the outputs may hold either or both, as the stages need; that is settled when they are built.

Every stage output has:
- `step id@version`
- a canonical config hash (JSON with sorted keys)
- the IDs of the outputs it was made from
- its `origin`: the kind of the stage that produced it (`ingest` | `computed` | `llm` | `manual`)
- for an image from which a stored result was computed, its fingerprint (§8.3)
- a timestamp

LLM outputs additionally reference their **call record**: prompt template version, filled-in context, the images' recipe keys and hashes, exact model ID, parameters, full response, token usage and cost.

**The cache has two levels** (decided):
- **Stage level:** the key is hash(step id, version, canonical config, the model's provider, model and effort for LLM stages, the content keys of the stage's inputs). An input's content key is the hash of its stored content, or the recipe key of a computed image (§8.6): content rather than row IDs, so a stage that produces identical content again (e.g. `layout` run again with the same boxes) doesn't invalidate what follows. If it matches, the stage is skipped and its outputs reused. Outputs of later stages may already exist when an earlier stage is run again with the same inputs and config: they are found through the key and reused.
- **Item level, when the stage's key doesn't match:** the stage runs, but each item checks its own key first: for an LLM request, the exact request including the model config (provider, model, effort; §7.2: an identical request is served from its record), with each image named by its recipe key; for an image, its recipe (§8.6). Cheap code just runs again. **Only recipes, never pixels, in any key** (decided): an image is identified by its recipe all the way from the PDF to the final crop, at the stage level and at the item level alike. Images made from the same recipe on different devices are taken to be the same, which our deterministic code makes them, or close enough (§8.1, §8.2); anything computed from an image is reused whichever device made the image. So a cached call is also found before its images are made, and a re-run on another device doesn't render and crop images only to find the answers stored. Fingerprints warn when an image turns out not to be close (§8.3). Requests contain only what they really use (§5.5), so fixing one page's boxes changes only the requests that depend on that page; a request that contains the whole score (`review`) changes with any change upstream, as it should.
- **What isn't part of any key:** a model config's plain parameters (the region, the project) and its secrets (§7.2). They choose where and with which credentials a request runs, not what the model is given. A parameter that some day does change the answer must be added to the keys.
- **Only usable answers are cached:** an error (no answer, a timeout) or an answer that fails to parse is recorded (call record, costs, §10) but never served from the cache, so a retry asks again.

Every output has a row in D1, which belongs to the stage that produced it and says whether its content is stored (in R2, under its hash, §2) or only its recipe (§5.3).

**Checking that stages are still valid:** a pipeline checks its stages against the hashes of their inputs and outputs. Stored content can change outside the app (e.g. files in the desktop version's data folder edited by hand), and a stage whose recorded inputs or outputs no longer match what is stored is not valid any more. How and when this is checked, and what the app does then, is still to be designed (§15).

### 5.3 Persisted vs. regenerable (important)

- **Computed** outputs (page images, straightened pages, crops) store only their **recipe** (and its key), plus a fingerprint for an image from which a stored result was computed (§8.3). Images live in OPFS and can be regenerated. Small text outputs may be stored anyway for convenience.
- **Ingest**, **LLM** and **manual** outputs **must be persisted**: everything that isn't computed. They cannot be regenerated: re-running an LLM call gives a different answer and costs money.
- Rule: *anything you would hate to lose must never exist only as a cached image.*
- **Regeneration is lazy, per device** (decided): a device computes a computed output only when something needs it, never the whole chain up front. Example: seven stages run on a laptop, and on the bus the user adds an eighth, manual stage on a phone. The phone has none of the laptop's images, but the eighth stage's inputs are there (stored outputs fetched from R2, or images regenerated from their recipes because the stage needs them), so the user simply continues. If the user then opens an earlier stage's images to inspect them, they are regenerated from their recipes then, and cached on the phone (§8.6).

### 5.4 Manual stages

The user intervenes by adding a manual stage to the pipeline. The manual stages foreseen so far:
- fix the lines that should be horizontal (`fix_skew`)
- fix the system boxes and bar lines (`fix_layout`)
- fix the metadata (`fix_metadata`) and the observations (`fix_observations`)
- answer the issues and correct the music (`human_review`, after any `apply_review`)

(The stages are listed in §6.)

Rules:
- **One manual stage covers the whole PDF,** however many items are fixed in it. Fixing the boxes on twelve pages is one `fix_layout` stage, not twelve. Otherwise the pipeline shown in the UI would get too long.
- The outputs of a manual stage have `origin = manual` and the corrected output as their parent.
- Edits to images are stored as **replayable operations**, not as edited pixels: lines that should be horizontal, boxes, bar line positions. Replaying them on the regenerated base image reproduces the edited result.
- Text outputs (metadata, observations) are stored whole, as edited, and name their parent (the output they correct); what changed is found by comparing the two.
- **Undo and redo exist only inside a tool for manual work,** while it is open. Leaving the tool saves, and after that nothing can be undone: the stage can only be edited further or dropped (§5.5).
- **A finished stage never changes.** Editing a finished manual stage creates a new manual stage, which starts from the finished state of the old one and takes its place in the pipeline. The old one becomes a replaced stage (§5.5) and stays in storage as it was. The reason is forking (§15): another project's pipeline can use the same stored stage, and it must not change there.

### 5.5 Resuming and re-running
- **The history of a project is linear.** There are no branches inside a project, and no undo.
- Changing something in the middle (e.g. the config of stage N, or a manual stage added there) means running everything after that point again. The later stages are replaced: they leave the pipeline and are no longer shown.
- To keep the old results and try something else, the project is forked (planned, §15), not branched.
- **Any stage that isn't part of the recipe can be dropped:** manual stages, and extra stages the user added, such as a further review. Dropping is a change in the middle like any other: after a confirmation, the pipeline continues from the stage before the dropped one, with the same rules (run mode, reuse where the inputs match). Recipe stages can't be dropped.
- **Execution is per item** (a page, a system), with each item's outputs saved as soon as it is done (§5.2).

#### What a re-run follows
A re-run follows **the pipeline as it was, not the standard recipe** of recipe stages, for as long as the outcomes stay the same. This is the intended behaviour, not yet a technical definition; the details are worked out when we get there.
- **A stage whose inputs and config are exactly the same is reused,** manual stages included. Example: the composer's name is corrected after a full run that also had a wrong note fixed by hand. Nothing that the note fix depended on changed, so the fix is still there after the re-run.
- **A manual stage whose input changed at all is dropped as a whole** (decided), even if only one page or system of its input changed, and none of its fixes is applied, and the pipeline continues with the planned stages. The typical manual fix is a better deskewing angle or better system crops on a difficult old score. The point of it is that the stages after it then produce very different, better output, which ideally no longer needs the manual fixes that the poor first attempt needed.
- **Stages must depend only on what they really use.** If an `extract` call got the whole metadata as context, composer included, correcting the composer would change the input of every `extract` call, and all of them would be paid for again.
- **A dropped stage leaves a card where it was** (decided, built, migration 0018: `dropped_stages`): a courtesy heads-up, since which stages are dropped depends on the outcome of the run, can't be said beforehand, and would otherwise go unnoticed. Kept stages need no report: they are in the pipeline.
  - **What it shows:** the stage's icon and name, the name struck through, and a second line "⚠️ Dropped: inputs have changed" (the usual yellow triangle, the text not struck through and in no warning colour); the whole card dimmed like a planned stage. Its only button is an "x" to dismiss it: no "⋮", no artifacts, no progress. Its artifacts can't be opened: they are gone from the pipeline. The cards aren't stages and don't count in the pipeline's progress.
  - **Where:** after the stage it came after (`after_stage_id`); several there are in the order they were dropped.
  - **Until:** the user dismisses it; or a change rewrites the pipeline at or before the stage it came after (a new config, a stage added, edited or dropped there; a change after it leaves it); or a stage of the same step is added there again (e.g. `fix_metadata` dropped after `analyze` ran with a new config, then "Fix metadata manually" in `analyze`'s "⋮"). Stored with the project, so a drop during an Auto run is still there when the user comes back; deleting the project deletes its cards.
- **Extra reviews are dropped like manual stages** (decided; to build with the reviews, §6): a review added after the recipe's one (and its `apply_review`) is carried through a re-run, kept at its turn if its inputs are the same (it would come from the cache anyway) and dropped otherwise, with one card for the pair. Re-running them would be right for a user who always runs several reviews, and wrong for one who added one because the first review missed problems on this score, which a re-run may have fixed. Dropping them means what runs after the first `apply_review` is either not an LLM stage (`human_review`, `fix_mei`, `engrave`) or comes from the cache, so it is fast and free; a user who wants them adds them back, having paid for no unnecessary calls.
- **An `apply_review` goes with its review** (decided): dropping an extra review or a `human_review`, by the user or at its turn, drops the `apply_review` that follows it too. **The recipe's review can't be dropped,** even with further reviews after it (decided: keeping it simple).

#### Replaced stages
- **Replaced stages are kept in storage,** with their outputs and full LLM call records (requests and responses). They are reused whenever possible: a stage that runs again with the same inputs and config, or an identical LLM request (§7.2), is served from what is stored and costs nothing.
- **They stay connected to their project in D1,** although the pipeline no longer shows them, so that deleting the project (§4) finds and deletes them too. Until then, a project's storage only grows.

#### Confirmation before a re-run
A dialog asks for confirmation before anything is replaced (decided, built in `ProjectView.tsx`). It shows when a change replaces stages that have already run (done, failed, WIP or running): a new config for a stage that has run or is followed by one that has; a manual stage added, or a finished one edited, where a stage after it has run. Dropping a stage always asks.
- **Simple and almost generic** (decided): it says that automated stages after the change may have to run again, that manual stages after it (and, once they exist, extra reviews) will be kept only if their inputs stay the same (§5.8, carried), and that it can't be undone, without working out which stages exactly.
- **Title:** "Are you sure?"
- **Text** (decided)**:** "Later pipeline stages may have to run again (if their inputs change). Manual fixes for later stages will be kept if their inputs stay the same, and dropped otherwise. This action cannot be undone." When extra reviews exist (§6), the middle sentence becomes "Manual fixes for later stages, and extra reviews, will be kept if their inputs stay the same, and dropped otherwise." For a new config, it starts with "This stage will have to run again with the new config." (In Manual mode it runs again only when the user runs it.)
- **Buttons:** "Cancel", and one naming the change, in the accent colour like every confirmation: "Change config", "Add stage", "Edit stage", "Drop stage".
- **No manual stage has a config.** If one ever has, the text for a new config must be adjusted.

### 5.6 How the app shows a project
- **The pipeline is the main attraction; the artifact view is secondary.** The usual use is: new project, let it run, take the final MEI and leave. So the pipeline gets the comfortable place on every screen, and inspecting artifacts is what gets less comfortable on small screens.
- **Two layout modes, nothing in between:** wide (from 1024 px, the same breakpoint as the header) and narrow. Resizing a window switches between them on the fly.
  - **Wide:** the **pipeline panel** on the left (project, run controls, the stages), the **artifact view** on the right, much larger. The panel collapses into a narrow strip that shows only an expand button (a chevron, like the one that collapses the panel) and the progress circles below it: "Pipeline" above the current stage's, each labelled below and without numbers (the stage's circle is labelled with its name; see "Progress" for what it shows in each state). The chevron sits at exactly the same height as the one that collapses the expanded panel. The collapsed state is remembered per browser.
  - **Narrow:** the pipeline panel is the only view. Picking an artifact (or a stage's details) opens it over the whole app, with a close button ("x") floating over its top right corner, white on translucent grey. The artifact is in the URL (`#/projects/<id>/artifacts/<artifact id>`), so the back button closes it too, and a reload keeps it open. A stage's details have a URL too (`#/projects/<id>/stages/<stage id>`). After closing, what was open stays selected in the panel, so the user sees what they last looked at (until the page is reloaded or another project is opened).
- **The artifact view has no header of its own,** in either mode: it is the most valuable space on the screen. Which artifact is shown can be seen in the pipeline panel, where it is selected.
- **Progress:** one indicator for the whole pipeline and one for the running stage, **never with numbers**. In the expanded panel, the pipeline's is a thin bar in the panel's head; the stage's is a bar in the running stage's card. The collapsed strip shows both as circles. The pipeline's total is a best guess (a second review round or a manual correction adds stages), and a change only moves the circle a little. The pipeline's progress is the finished stages out of all stages, so adding a manual stage moves it back a little (accepted). A stage is a big chunk of work: doing something to every system is still one stage.
  - **Where the pipeline is** (decided and built, 2026-10-26, `pipelineState` and `stateLabel` in `pipeline.ts`): the first stage that isn't done is running (on this device, with its progress, or on another, whose progress isn't known here), failed (or interrupted: a running stage whose heartbeat stopped, §5.8), or waits for the user (not started, in Manual mode or before the first run in Auto mode, or after a stop; or a manual stage in progress); or every stage is done.
    - **The expanded panel's head:** a line under the pipeline's bar, within the row's height, says it: "Analyze…" while it runs (here or elsewhere), in muted text; "Layout failed" or "Layout interrupted" in red, without an ellipsis; "Layout (not started)" or "Fix layout (WIP)" while it waits for the user (a manual stage is created WIP, so it is never "not started"); "Done". Under the bar, not over it, and with the ellipsis, so that it reads as a status rather than as the bar's title: the bar is the pipeline's. The longest ("Skew detection interrupted") fit on one line.
    - **The collapsed strip:** under the pipeline's circle, the current stage, its name below (two rows at most, cut with "…" beyond): its progress circle while it runs here; a grey spinner while it runs on another device (it turns; grey, so it doesn't read as progress); a red warning triangle if it failed or was interrupted; an empty circle with a grey pause sign while it waits for the user. When the pipeline is done, no stage: a green check inside the full pipeline circle.
    - **Following a stage on another device:** while one runs elsewhere, this device fetches the pipeline every 5 seconds, so that its end shows (and its toast), besides the fetch when its heartbeat would be too old.
  - **Toasts** (decided and built, 2026-10-26, `toasts.ts`): in narrow mode only, while an artifact or a stage's details covers the pipeline (none in wide mode, none on the narrow pipeline view), one short line near the bottom says what just happened without the user doing it right then, whichever device runs the stage. It disappears on its own after 4 seconds; one at a time, a new one replaces it; it may cover the corner's item counter. The stage names are bold; no period at the end.
    - "**Layout** done. Starting **Analyze**"; "**Layout** done. **Analyze** ready" (the next waits for Run, or is a manual stage in progress: "**Fix layout** ready"); "**Layout** failed. Pipeline stopped", "**Layout** interrupted. Pipeline stopped"; "Pipeline done".
    - Carried manual stages (§5.5) are named on the way: "**Skew detection** done. **Fix skew** applied. Starting **Layout**", "**Skew detection** done. **Fix skew** dropped (inputs changed). Starting **Layout**"; a kept one still in progress ends it: "**Skew detection** done. **Fix skew** ready".
    - **How:** two snapshots of the pipeline are compared on every change (the stages' statuses, the carried ones, the dropped cards); the events of half a second are joined into one text. The user's own changes (Run, Stop, Finish, adding, editing or dropping a stage, a config, the run mode) make no toasts for 3 seconds: what follows from them is what they asked for. Not toasted: a failure's reason (it is on the card), app errors.
- **Each stage declares its main artifact** (stages can have several). What the artifact view shows in wide mode, unless the user picked something:
  - a new project: the original PDF;
  - when the pipeline finishes: the final MEI;
  - when a project is opened: the latest stage's main artifact.

  While the pipeline runs, **the view stays on what the user picked** (decided): it follows the pipeline only while nothing is picked (`defaultArtifactId` in `pipeline.ts`). The panel's head, the strip and the toasts say what is happening meanwhile (above).
- **How it is built:** the pipeline panel shows the project's stages (`GET /api/projects/<id>/pipeline`, §5.8). Creating a project adds Ingest, done, with the PDF as its output, and the recipe's other stages, planned; a migration adds a new recipe stage, planned, to the projects created before. A step's config form is declared with the step (`steps.ts`) and shown by one dialog for all steps (`ConfigDialog.tsx`). **A config is checked when it is saved** (decided), before the confirmation that stages will be replaced, against the PDF too (a page selection beyond its last page): a stage must never be replaced by one that can't run, since the old config is then lost. Only if the PDF can't be opened on the device is the page count left unchecked until the stage runs. What the code declares about each step (title, kind, how its outputs become artifacts) is in `apps/web/src/steps.ts`; `pipeline.ts` turns the stored stages into what the panel shows; `runners.ts` lists the steps that can run. Running a stage works as described here: Run (and Retry), Stop, progress, Auto mode carrying on to the next stage, "Change config" with its dialog and the confirmation when stages that ran are replaced. Manual stages can be added, finished, edited and dropped (below, and §5.8). The run mode is stored with the project (`PATCH /api/projects/<id>` with `runMode`). The original PDF is shown with pdf.js (its legacy build: the modern one needs browser features many phones don't have yet). The Worker serves the PDF at `GET /api/pdfs/<sha256>/file`.

#### The header
- **Narrow screens** show the wordmark and "+ New project" on one row and the project picker on its own row below. From 1024 px, everything is on one row, with the picker in the middle.
- **New project:** the button picks a PDF (a local file; Drive later), and the browser hashes it. Its hash is looked up first (`GET /api/pdfs/<sha256>?filename=...`, which returns the PDF's projects, most recently opened first, and the name a new project would get). An unknown PDF is uploaded and gets a project right away, in one request (`POST /api/projects`) that stores it in R2 and adds the project to D1 with the default name (§4). A known PDF opens a dialog that lists its projects to open one, with "+ New project" as the last item, showing the name the new project would get; that project is created without uploading the file again (`POST /api/projects` with the `filename` instead of the `pdf`).
- **The open project is part of the URL** (`#/projects/<id>`), so it survives a reload, each tab has its own, and the back button and bookmarks work. Any other URL means no project is open, which is how a fresh tab or device starts. "Last opened" (§4) is shared by all devices and only sorts the list: a project created or opened elsewhere never changes what this tab shows.
- **The project picker** shows the open project's name, or "Open a project". Opening it turns the name into a filter field over all projects (name, how long ago it was opened, PDF file name), most recently opened first (`GET /api/projects`), fetched when the app loads. Picking a project opens it and marks it as opened (`POST /api/projects/<id>/opened`); creating a project opens it too. Loading a URL or going back doesn't mark the project as opened.

#### The pipeline panel
- **A small head stays in view,** and only what is below it scrolls: the project's name (one line, shortened in the middle) with its "⋮" and the collapse chevron, then the **run mode** (a small drop-down showing "Auto" or "Manual", §5.1, which takes less room than a switch), the pipeline's progress bar and, in Auto mode only, **Run** (green) or **Stop** (red) while a stage runs, and, when something went wrong that isn't a stage's own failure (a stage that can't start, a request that failed), the error: in the head, so the list scrolling to the current stage doesn't take it out of view. Below the head, scrolling away: when the project was created and changed.
- **The stages are stacked,** first at the top, as cards (rectangles). The original PDF is the artifact of the first stage, **Ingest**, so every card is a stage and every tile in it an artifact. There are no arrows between the cards: a stage's inputs are often not just the previous stage's outputs, and arrows would suggest they were.
- **A card shows:**
  - an **icon for its step,** not its kind (decided), for the automated stages: Ingest an upload arrow, `rasterize` the usual image icon (a frame with a mountain and a sun), `extract` a quarter note turning into a letter, `engrave` the other way round. **Manual stages all share one icon, a wrench** (decided): they all fix something by hand. A step without an icon of its own shows its kind's (computed, LLM, manual). The kind is in the icon's tooltip and in the details. Then its name and a "⋮";
  - for LLM stages, the model config on a line of its own: its name, or without one its model string as the config has it, shortened in the middle if it doesn't fit (§5.7, §7.2; built). Then one line of facts: once done, the run time and a short result ("54 systems", "3 boxes moved, 1 added"). **No costs, prices, providers or token counts on the cards** (decided): users shouldn't be worried about money while a project runs, and the panel has little room. They belong to the stage's details and the costs view (§10);
  - while running, its progress bar; when failed, the error;
  - its button, if it has one (below);
  - at the bottom, its **artifacts as tiles,** three per row, each with an **icon for its kind of artifact, never a thumbnail:** at a tile's size no content is recognizable, so a thumbnail adds nothing. The original PDF's tile shows a sheet with "PDF" on it (`PdfIcon`). Artifacts are **grouped logically:** all 54 system crops are one artifact, one tile with "×54", not 54 tiles (§5.2). The first artifact is the stage's main one. Tiles are what gets selected (highlighted in coral), not the card.
- **Stage states:**
  - **done**;
  - **running**: a green border and its progress bar;
  - **failed**: a red border and the error. It can run again;
  - **ready**: its turn has come. It looks like a done card, but without outputs;
  - **planned**: not its turn yet. Only the dimmed title (and the "⋮"), no outputs. It becomes ready, no longer dim, when its turn comes;
  - **WIP**: a manual stage being worked on (below).
  - A "needs you" state for a model asking for human input is left out for now; it will be easy to add (§5.1, §15).
- **Buttons:** in Manual mode, the ready stage has **Run** and, while it runs, **Stop** in the same place. In Auto mode the cards have no Run or Stop: those are in the head. When the stage whose turn it is has failed, Run reads **Retry**, with a circular arrow, in both modes. Stop throws away what the running stage did so far: the stage is marked as stopped and leaves the pipeline. Its LLM calls stay, for the costs and the cache.
- **Manual stages** are added from a stage's "⋮" ("Fix layout manually", "Fix skew manually": the manual stage's title and "manually", for whichever fixes fit after that stage; decided). They start as **WIP** (a badge next to the name): the user opens the stage's output as often as they like and works on it, and clicks **Finish** on the card when done. Then the next stage gets its turn. In Auto mode the pipeline carries on by itself; in Manual mode the next stage is ready. A finished manual stage can be edited again ("Edit" in its "⋮"): that continues from where the user left it, not from scratch, but like any change in the middle (§5.5) it replaces the later stages and needs confirming. In storage, the stage being edited is a new one that replaces the finished one (§5.4). There is no "Discard": a manual stage, WIP or finished, is removed with "Drop stage" (§5.5). Undoing single edits belongs to the tools for manual work (§5.4).
- **The stage's "⋮"** holds everything else, so the card stays clean: "Show details", "Change config", "Fix … manually", "Edit" (manual stages), "Drop stage" (stages that aren't part of the recipe, WIP ones included, §5.5; in red). Only what applies is listed, and while a stage runs only "Show details". There is no "Run again": running a stage again without changing its config only makes sense after it failed, and that is Retry. Whatever replaces stages that already ran asks first (§5.5).
- **Show details** opens the stage in the artifact view: step and version, kind, status, run time, cost, result, its config, and for LLM stages its tokens. Costs are per stage and higher, never per call (decided): a stage makes many calls, mostly costing fractions of a cent.
- **Groups are shown as a filmstrip:** the items one below the other with a small gap, scrolling continuously, with a counter in a corner ("12 / 54"). That way the end of one system and the start of the next are on screen together, which helps when checking musical content. `extract` shows each system's crop with its music below it.
- **Auto-scroll:** the list scrolls to the current stage (the first that isn't done) when the project is opened, when an Auto run starts, and whenever another stage gets its turn, in both modes: as an Auto run moves on, and in Manual mode when a stage finishes and the next one becomes ready. The stage is brought to about the middle of the view, or as far up as the list goes when few stages follow it.

- **The menu** (☰, at the far right of the header, after "+ New project") leads to the app's own pages: Statistics (including costs, §10), Settings, Help and About, in three groups separated by lines (what you look at, what you change, help). Each page has its own URL (`#/stats`, `#/settings`, `#/help`, `#/about`) and replaces the project view while it is open, so the back button returns to the project. Help will not be a page of its own: it will lead to a user guide, a Markdown file in the repository on GitHub. Anything urgent (the spending cap reached, a missing key) must not hide in the menu: it is shown where the user is.
- **The settings page has a "Developer" section** (decided) with a button that downloads **the format gap report:** one file (e.g. a zip) built in the browser, so that access to D1 and R2 is the app's own. It goes through every project not deleted, reads the latest list of issues in its pipeline where there is one, and keeps the format issues. Nothing extra is stored for it, no table and no images: the crops are rebuilt from their recipes on demand, as for every other issue. Per issue: the crop with its boxes, the whole page image, the issue itself, the project's name, the PDF's name, the metadata, and the stage that raised it (step and version, model config, the prompt's and the lens's versions, the call). The script that groups and counts them for analysis works on that file.
- **Project actions:** a "⋮" button next to the project's name in the pipeline panel opens a menu of things to do with the project: "Rename", then a line, then "Delete project" in red (`--danger`, kept apart from the coral accent), which opens the dialog of §4.
  - **Rename** opens a dialog with the name selected. "Rename" stays disabled while the name is empty (after trimming) or unchanged; a name over 200 characters gets a message right away. A name another project has (ignoring case) is refused by the Worker (409) with "A project with that name already exists. Names must be unique (case-insensitive).", and the dialog stays open. The field has no visible label (the dialog's title says it all), only one for screen readers. Both menus share one component (`DropdownMenu`).
- **The About page:** the wordmark (centered), what the app does ("A music transcription tool, driven by vision LLMs, that converts printed scores into MEI, an open, XML-based standard for encoding music notation."), its version (§11), the author (Tomás Silveira Salles), a link to the repository on GitHub, the license (§3, "License": its name, linking to `LICENSE` on GitHub, and what it means in one sentence), and a link to the third-party notices.
- **Leaving a project loses nothing,** whether for a page from the menu, another project or a closed tab, because manual work is saved as it happens (§5.4). Once editing exists, changes not saved yet are saved or confirmed before the project view goes away.

### 5.7 Look and feel
The look of the app (colours and themes, type, components, the brand: wordmark, accent, fonts, icon) is in the style guide, `docs/style.md`. What is built around it:
- **Screenshots** (built, `npm run screenshots`, `scripts/screenshots.ts`): to compare versions and themes at a glance, without clicking through the app. It starts its own Worker and Vite on the test ports (8887 and 5273, §12), with a database and storage in a temporary folder, seeds them through the app with the fake model (a finished project, one with the card of a dropped stage (§5.5), one with `fix_layout` in progress, one whose `layout` failed, one whose page images differ from their fingerprints, §8.3), and takes, for every theme and three layouts (wide with the pipeline panel expanded, wide collapsed, narrow at 390 px), each artifact, a stage's details, the editor, the failed card, the warning, the menu pages, and, by a few scripted clicks, the open menus (the project picker, the header's menu, the project's and a stage's "⋮") and dialogs (rename, delete, a config, the confirmation before a re-run, a PDF already known), and the project as an installed app, with its back and forward buttons (Chromium can't emulate the display mode, so the script answers the app's `matchMedia` question). `--only <text>` takes only the shots whose names contain it. `--desktop` runs them against the desktop version's server (§3) instead of Wrangler, which tests it end to end. `screenshots/<theme>/<layout>/<shot>.png` (ignored by git) and `index.html`, a contact sheet of all of them. Needs Playwright's Chromium (`npx playwright install chromium` once locally). About four minutes; 146 shots with both themes.
- **Installed, the app opens as an app** (decided, built: the manifest's `"display": "standalone"`, with `id`, `start_url` and `scope` "/"): from a phone's home screen, or installed from a desktop browser, it gets its own window or the whole screen, without the browser's bar. It then shows its own back and forward buttons (§3, "Navigation"). Opened in a browser tab, nothing changes.

### 5.8 The database
The D1 schema for the pipeline (decided; built in `apps/worker/migrations/0003_pipeline.sql`, which has the columns and their comments, and changed by the later migrations). Artifacts have no table: a step's code defines them as views over its outputs (§5.2), and an artifact that is stored for convenience (the MEI file) is an output for the whole score.

| Table | One row per | Holds |
|---|---|---|
| `projects` | project | Besides §4: the run mode (§5.1), a version for optimistic locking (§4), the number the next issue gets (§6, "Issue ids"), `deleted_at`. |
| `pipeline_entries` | stage in a pipeline | Project, position (1, 2, 3, ... without gaps) and the stage. Nothing else: the pipeline is a list of pointers. |
| `stages` | stage, planned ones included | The project it was created in, the step and its version, the status (`planned`, `running`, `failed`, `done`, `wip`, `stopped`), the step's config, the model config (LLM stages), the stage key, its page count, error, a short result, the stage it replaces (an edited manual stage, §5.4), times, a heartbeat, `deleted_at`. |
| `stage_inputs` | input of a stage | The outputs a stage read. |
| `outputs` | item a stage produced | The stage, the item, the type (`pdf`, `layout`, `lens`, `mei`, ...), the content's hash (stored, in R2) or the recipe and its key (computed), the corrected output (manual), the call that produced it (LLM). One per stage, item and type. |
| `output_inputs` | input of an output | The outputs an output was made from (§5.2). |
| `llm_calls` | LLM call | The stage, the model config, the request key, the model the response names (`response_model`), the full request and response (in R2), the status (`running`, `ok`, `error`, `unparseable`, `refused`, `cut_off`), the error, tokens (output tokens include thinking: Gemini reports thinking apart, and its adapter adds it), the cost, times, `deleted_at`. |
| `model_configs` | version of a model config | Optional name, provider, model, effort, plain parameters (region, project), secrets as `{field: secret name}` (Bedrock with a key pair needs two), the free-tier mark, the row it supersedes, `deleted_at`. Append-only (§7.2). |
| `image_fingerprints` | image from which a stored result was computed (§8.3) | Its recipe key, its PDF, and the fingerprint (§8.3): dimensions, the hash of the raw pixels, the thumbnail. |
| `settings` | user setting | A key and a JSON value. |

- **Planned stages have a row** (status `planned`), so all there is to know about a stage lives in `stages`, and a pipeline entry is only a pointer. A planned stage is unfinished, so it may change: its config is NULL while it takes the settings' choice (§7.2), or what the user picked for it. When it starts, its config is the resolved one (what it actually used), and its version and stage key are set. "Ready" isn't stored: it is the first planned stage after the done ones.
- **The kind isn't stored:** it follows from the step, declared in code (§5.1). A step's kind never changes, which a unit test guarantees (§15).
- **Stages are shared, not owned by a pipeline.** A fork (§15) copies the pipeline entries up to its stage, and the issue counter, and no stages or outputs. `created_in` says which project a stage was created in.
- **Item names:** `''` for the whole score, `p3` for page 3, `p3/s2` for the second system on page 3. A system's number in the whole score (system 17) is derived, not stored.
- **A manual stage has an output for every item** of what it corrects, not only for the items changed: an unchanged one points to the same content (the same hash, so nothing is copied in R2). The next stage's inputs are then simply the outputs of the stages before it, with no falling back to an earlier stage per item.
- **Running a stage:** resolve its config and inputs and compute the stage key. If a stage that is done and not deleted has that key, the entry points to it and nothing runs. Otherwise the stage runs, each item first looks in the cache (`llm_calls` for an LLM request, a successful call with the same request key that isn't deleted; the device's image cache for an image), and each output's row is written as soon as it is done.
- **Retry** runs the failed stage again in the same row: the items already saved stay, the missing ones run.
- **Stop** marks the stage `stopped` and takes it out of the pipeline. Its outputs are deleted; its calls stay, for the costs and the cache.
- **A change in the middle** (§5.5) points the later entries to new planned stages, each with the config of the stage it replaces (a re-run follows the pipeline as it was). The replaced stages stay as they are, for the stage key to find; a dropped manual stage's entry is removed.
- **An interrupted run** (a tab closed mid-stage) leaves a stage `running`. A running stage writes a heartbeat **once a minute**, no more: each one is a write to the remote database. A running stage whose heartbeat is older than about three minutes counts as interrupted, and is resumed like a failed one. **Losing an LLM answer that was paid for** when the tab is closed or a phone suspends the page mid-call is **accepted** (decided), even if its cost doesn't reach the records; while this device runs a stage, closing or reloading the tab asks first (built; browsers show their own wording, not ours).
- **The requests while a stage runs** (built, `apps/worker/src/pipeline.ts`; the browser does the work, the Worker records it), all under `/api/projects/<id>/stages/<stage id>/`:
  - `PUT config`: sets a stage's config. A planned stage gets it in place; a stage that has run is replaced by a new planned one, and every stage after it by a planned copy of itself.
  - `POST start`: the browser sends what it resolved (the step's version, the resolved config, the stage key, the page count and the outputs it reads). If a finished stage that isn't deleted has the same key, the entry points to it, the planned stage's row is deleted (nothing ran in it), and nothing runs. A planned, failed or interrupted stage can start; a running one can't.
  - `POST outputs`: records outputs as each is done; an item recorded already is left as it is (a retry skips them anyway).
  - `POST heartbeat`, `POST finish` (done with a short result, or failed with the error), `POST stop`.
- **Manual stages** (built, same file), under the same path:
  - `POST fix` with the step (and its version, page count and inputs), on a done stage: adds a WIP stage right after it. Refused if the next stage is already that step, or if a stage is running.
  - `POST outputs` while WIP: saves outputs as the user works; a WIP stage's item saved again is overwritten (a running stage's is left as it is). Outputs name their parent (the output they correct).
  - `POST finish` on a WIP stage: done, with a short result.
  - `POST edit` on a done manual stage: a new WIP stage takes its place, with the same outputs and inputs, and `replaces_stage_id` pointing to the old one, which stays as it was (§5.4).
  - `POST drop` on a manual stage, WIP or done: its entry is removed and the later ones move up.
  - Each of them, like a config change, replaces the stages after it: a planned one stays as it is, one that ran gets a planned copy.
  - **A manual stage after a change is carried** (built, migration 0017: `pipeline_entries.carried`): it stays in the pipeline, WIP or done, as it is, and waits for its turn. Then it is kept if what it would read now holds what it read (the same items and types, each with the same content hash or recipe key: `stage_inputs`), and dropped otherwise, with the stages after it moving up (`POST resolve` with the outputs it would read now, as when it was added: `carriedInputs` in `steps.ts`, the outputs of the stage it fixes). A kept stage keeps its status: a WIP one stays WIP (decided). While it waits, it looks like a planned stage (dimmed, the wrench, no artifacts; decided), it can be dropped, and it can't be edited, saved or finished. Its turn comes when every stage before it is done: it is resolved at once, in Auto and Manual mode alike (decided), and an Auto run carries on. Tried in Chromium: a `fix_skew` kept after `rasterize` ran again on a scan at another resolution (the same lines), and dropped on a vector PDF (other lines).
  - The Worker knows which steps are manual (`MANUAL_STEPS`): a step's kind is declared in the web app's code, but the Worker needs it for these rules.
  - **The recipe's stages are listed in the Worker** (`RECIPE`), which creates them, planned, with every new project.
- **A stage that seems to run, but not on this device** (another device, or this one before a reload) shows as running, without progress, and can be stopped. Once its heartbeat is about three minutes old it shows as failed ("Interrupted"), and can run again. The panel fetches the pipeline again at the moment its heartbeat would be too old (a heartbeat may have come meanwhile), so it turns "Interrupted" without a reload (built: `nextStaleAt` in `pipeline.ts`).
- **Progress isn't stored:** only the device that runs a stage knows it (§5.1). Another device sees the stage running, without a bar.
- **Deleting a project** (§4) marks rows instead of deleting them, for the costs and statistics, and every cache lookup ignores marked rows (partial indexes `... WHERE deleted_at IS NULL`). Marking in the rows, rather than filtering every lookup by the projects that aren't deleted, keeps the rule in one place. When project P is deleted:
  - a stage is marked if no other project that isn't deleted has it in its pipeline, and it was created in P or in a project already deleted. A stage a fork still uses stays, and is marked when that fork is deleted; a stage created in a project that isn't deleted is never marked;
  - the calls of a marked stage are marked with it;
  - the outputs of marked stages, the content of stages and calls that nothing else uses, and the fingerprints of a PDF nothing else uses are deleted (§4).
- **Each stage records its page count** (decided), when it starts, and it never changes: the number of pages its inputs cover. `rasterize`: the pages selected; `layout` and `analyze`: the same; per-system stages (`extract`, `review`, `apply_review`): the pages their systems are on; `engrave`: all selected pages, since it also builds the header from the metadata, which `analyze` read from every page, cover included. Pages without music aren't discounted: pages aren't classified (§6, `layout`). NULL for Ingest, which doesn't read the PDF.
  - **Why on the stage, and not the project's:** the selection of pages can change within a project (`rasterize`'s config, then a re-run), and the replaced stages keep their statistics. A replaced `extract` is no longer in any pipeline, so "the `rasterize` stage in the same pipeline" can't give its count. Following its inputs back to its `rasterize` (`stage_inputs`, `output_inputs`) would, but for every statistics query; a column makes per-page averages one query over `stages` (§10).
- **Two kinds of settings:** the user's, in the `settings` table (the default model config, the run mode for new projects, the spending cap, ...), and the device's, in the browser (`localStorage`), for what may differ between a phone and a laptop: screen size, touch or mouse, bandwidth. The collapsed pipeline panel (§5.6) is the first device setting.

## 6. Pipeline stages

### The stages

Stages marked **[manual]** are optional and added by the user (§5.4). The last column lists each stage's artifacts, what the user sees (§5.2); its outputs are finer, e.g. one per page or per system. Everything else is the recipe. Each stage has a short identifier, used throughout this document.

| # | Id | Stage | Kind | Artifacts |
|---|---|---|---|---|
| 1 | `ingest` | Ingest | ingest | The PDF (R2) |
| 2 | `rasterize` | Rasterize | computed | All page images, as one artifact. Not stored: reproduced from the config (§5.3) |
| 3 | `skew_analysis` | Skew detection | computed | The pages, not rotated, with the staff lines found drawn in red, each labelled with its angle. Stored per page: at most 5 lines, the page's angle, the confidence and the staves (§8.4). No rotated images, and no decision whether to rotate |
| 4 | `fix_skew` | Fix the lines **[manual]**, after `skew_analysis` | manual | The lines, as in `skew_analysis` |
| 5 | `layout` | Layout | LLM, per page | The layout: the straightened pages with the system boxes and the bar lines drawn over them. Stored per page as JSON |
| 6 | `fix_layout` | Fix system boxes and bar lines **[manual]**, after `layout` | manual | The layout, as in `layout`; the editor while it is WIP |
| 7 | `analyze` | General analysis | LLM, per page and for the whole score | Metadata (including the pieces and where they start) and Observations, as views. Stored as JSON: the metadata, the observations (one document: the pages' items as the whole-score call corrected them, including the special bar lines, and the score-wide items), and `pieces`, where the pieces start, taken from the metadata as an output of its own for `extract` |
| 8 | `fix_metadata` | Fix metadata **[manual]**, after `analyze` | manual | JSON: metadata |
| 9 | `fix_observations` | Fix observations **[manual]**, after `analyze` | manual | JSON: observations |
| 10 | `extract` | Extraction | LLM, per system | The Transcription (see "The Transcription"): each system's crop with its rendering, the issues and the warnings on it. Stored per system: its answer in the lens, its issues and warnings |
| 11 | `review` | Review | LLM, per system | The Transcription, with the issues as the review left them |
| 12 | `apply_review` | Apply review | LLM, per system | The Transcription, as the review's answers changed it, with the issues (what was applied) and the warnings |
| 13 | `human_review` | Human review **[manual]**, after any `apply_review` | manual | The Transcription as a form: the issues answered and added by the user. An `apply_review` is added after it automatically |
| 14 | `fix_mei` | Fix MEI **[manual]**, after the latest stage that produces the extraction, right before `engrave` | manual | The MEI, edited as text: the MEI view, editable while WIP |
| 15 | `engrave` | Engrave | computed | The full score's MEI (with syntax highlighting and navigation) and its engraving as a PDF; the card has a download button for both. Always the last stage |

- **No manual fixes of the music before the first review.** The first point where the user corrects the music is `human_review`.
- **The recipe has exactly one review** (`review`, followed by `apply_review`). **Further reviews** can be added by hand after it, as many as the user wants, with the same or another config. Adding a review, by hand or after a human review, always adds its `apply_review` after it. Further reviews are dropped with their `apply_review`, and carried through a re-run like manual stages, kept only if their inputs stay the same; the recipe's review can't be dropped (§5.5).
- **Manual stages after an LLM stage** are added from its "⋮": `fix_layout` after `layout`; `fix_metadata` and `fix_observations` after `analyze`. "Fix X manually" is only in the "⋮" of the stage that creates X (decided), so both are in `analyze`'s. **The second of the two goes right after the first** (decided, built): nothing needs an order between them (they edit different outputs of `analyze`), and inserting it directly after `analyze` would carry the first (§5.8), for no reason. It can be added while the first is still WIP. Dropping the first carries the second, which is kept if its input comes out the same (§5.8).
- **Two stages read the pages** (decided): `layout` finds where things are, `analyze` says what they are. `analyze` runs after `fix_layout`, so it sees the final layout: code draws the systems and bar lines on each page, numbered, and the observations refer to those labels. Each has its own model config (§7.2: finding layout boxes, extracting metadata), and a better prompt for one doesn't re-run the other. The price is that every page is sent twice, small next to one `extract` call per system.
- **No skeleton stage** (decided; an earlier draft had one, an MEI file with a placeholder per measure). What it was for (a fixed structure, assembly as filling in, a check that the extraction returns exactly the measures asked for) needs no stored MEI: code builds the MEI frame from the structure whenever it is needed (see `docs/notation.md`, "MEI" below).
- **A stage exists where there is a config or a decision** (decided). A pure function of other stages' results is a view, not a stage. So there is no skeleton stage (above), and no stages for the straightened pages or the crops: the angles and boxes are decisions of other stages, and rotating and cropping are fixed operations (§8.2). Those images are computed when something needs them (a view, an LLM request) and cached on the device (§8.6); stages wouldn't add anything but cards in the pipeline and a second copy of every page on the device. They are shown as views of other stages' outputs: `extract` shows each system's crop with its music below it (the filmstrip, §5.6). `rasterize` stays a stage: its config (the resolution for vector pages, perhaps colour or grayscale, §15) changes every image after it, and its pages are the natural first view.
- **The structure is final before `extract`.** The structure is what decides which pixels the models see: the skew angles (`fix_skew`), where the systems are on each page and where the bar lines are on each system (`fix_layout`). `extract` is shown system crops and stretch crops, and if it is shown the wrong part of the page, no model can make up for it. So every fix of the structure comes before `extract`, and no later stage changes it; a mistake in it found later is fixed by going back to `fix_layout`, which replaces everything after it (§5.5). The pieces or movements (`fix_metadata`) are fixed before `extract` too: nothing carries over a piece's boundary (see `extract`), and the MEI's sections and the numbering restart there. `extract` reads only where the pieces start (the `pieces` output, see `analyze`), not the rest of the metadata.
  - **Everything else is content,** read by `extract` and open to correction by the stages after it: how the stretches between bar lines form measures, the kinds of measure and of bar line, and so which measures exist and how they are numbered; and the `scoreDef` (clefs, keys, time signatures, staff labels and groups). Those are hard for a model to get right from a whole page (the stretches need the note durations read), and easy to correct later, now that no MEI is built in advance. A user of an automated app shouldn't be asked to transcribe them by hand before anything is extracted.

#### Details per stage
- **`rasterize`, `skew_analysis` and `fix_skew`:** in `docs/stages/pages.md`. In short: `rasterize` makes one image per selected page (a scan's own pixels, a vector page drawn at a chosen resolution); `skew_analysis` measures on each page up to 5 lines that should be horizontal and stores them, deciding nothing; `fix_skew` lets the user delete, move and draw those lines. Whether and by how much a page is straightened is a function of its lines, computed by the stage that first sends the page anywhere (`layout`).
- **`layout` and `fix_layout`:** in `docs/stages/layout.md`. In short: `layout` asks a model, page by page, for a box around each system and the positions of the bar lines inside it (not those at its start and end), in up to 3 rounds where code draws the answer on the page and the model corrects it; a page it isn't satisfied with is flagged for a person. `fix_layout` is the editor where the user draws, resizes and deletes boxes and bar lines. Both write one `layout` output per page. Three things that hold beyond them:
  - **Every box in the app is in our format:** `{ left, right, top, bottom }`, fractions of the image's width and height from 0 to 1 (systems, issues, zooms, crops), not a provider's.
  - **Boxes are tight** around everything that belongs to the system; **margins are code's,** added by one rule where crops are cut (`extract`).
  - **Systems are numbered top to bottom, continuing from page to page,** and drawn in 7 colours that colour-blind people can tell apart, cycling; a system's bar lines have its box's colour.
- **`analyze`, `fix_metadata` and `fix_observations`:** in `docs/stages/analyze.md`, with the metadata's fields and how they fill the MEI's header. In short: `analyze` reads every page with the final layout drawn on it, one call per page and then one for the whole score, and gives the metadata (what is printed about the work and the edition), the observations (a bird's-eye view of the music for `extract`: staves and instruments, changes, special bar lines, endings, directions, notes for the whole score) and `pieces` (the system where each piece starts). `fix_metadata` and `fix_observations` are forms in which the user corrects and confirms them. What holds beyond them:
  - **Confidence:** every item a model reports has a confidence, low, medium or high; a user's confirmation is stored beside it (`confirmed`), never instead of it. The views show ???, ?, a grey ✓ and a green ✓ (confirmed).
  - **Places are labels drawn on the page,** read by the model, never counted: a system's start, one of its inner bar lines (1 to n), a stretch (1 to n + 1), its end. A person picks them from the same list, by name.
  - **Observations are hints, not ground truth:** `extract` checks them against what it sees.
  - **Code links items when the links are needed, not before** (an end repeat to its start, an ending to its repeat, a span across systems): at the start of `extract` (from the observations), of `review` and of `apply_review` (from the current extraction), and in the checks of the whole score. No links are stored, by a model or a person.
  - **Pieces start at a system,** and `pieces` always starts with system 1. `extract` reads only `pieces`, not the rest of the metadata.
  - **The metadata reports only what is printed;** the user can add anything in `fix_metadata`.
- **`extract`, `review`, `apply_review`, `human_review` and the Transcription:** in `docs/stages/music.md`. In short:
  - **`extract`:** one call per system, in the score's order, with the system's crop and its stretch crops, the neighbouring systems' crops, all the observations, and what code carries over from the previous system (the state, the marks left open, whether the last measure continues); nothing carries over a piece's boundary. The model writes the lens (below), never MEI, and reports its doubts as issues. Each answer is checked as soon as it arrives; an answer that can't be used stops the run there, the answers before it kept.
  - **`review`:** one call per system, with the whole score in every call; it writes issues only (never the music), and sees what the earlier calls changed through an append-only log, which keeps prompt caching working.
  - **`apply_review`:** one call per system where an issue that needs applying begins; it answers with a typed patch of only what it changes, stretch by stretch. A change outside the issues' boxes needs a reason and becomes a warning.
  - **`human_review`:** the user answers the issues, and adds their own, on the original score. Every correction, the user's too, is applied by `apply_review`, an LLM call, never by code; nobody edits the source directly before `fix_mei`.
  - **The Transcription:** the artifact of all four, a filmstrip of the systems, each crop with its music rendered below it and the issues and warnings as boxes on the crops.
  - **Models don't get renderings,** at first: they compare the crops with the lens as text.
- **The checks by code have no stage of their own:** validation happens inside `extract` and `apply_review`, on the lens, after each system and for the whole score at the stage's end. Problems that code finds without failing the stage are issues raised by code when they are a question about the page (a slur that never ends: "where does it end?"), and warnings otherwise (a measure whose durations don't add up; see `docs/notation.md`, "Warnings").
- **No `assemble` stage** (decided; an earlier draft had one, to build the full MEI after `extract`). Building MEI is code, and nothing before `engrave` needs the full score's MEI:
  - **the checks of the whole score** (loose ends, the repeat structure, measures across systems, measure numbers) run on the lens at the end of `extract` and of `apply_review`, not on MEI, so their warnings come while reviews can still act on them;
  - **each system gets a small MEI of its own, rendered** (see "The Transcription"), as a view;
  - **the full score's MEI is built by `engrave`,** at the end.
- **`engrave` and `fix_mei`:** in `docs/stages/engrave.md`. In short: `engrave` is always the last stage: it builds the full score's MEI from the latest extraction, layout, metadata and pieces (or takes `fix_mei`'s MEI as it is), engraves it with Verovio, and offers the MEI, the engraved PDF and a report of the run for download; its main artifact is the MEI view, the file beside its engraving, linked both ways. `fix_mei` is the only place where the user edits the MEI directly, as text, checked against MEI's schema before it is applied; it comes right before `engrave` and nothing else can come after it, since a direct edit makes the issues unreliable. What holds beyond them:
  - **The engraving has Verovio's own breaks,** never the original's: the PDF always engraves exactly the MEI it comes with. Matching the original system by system is the review's business.
  - **The MEI is what is stored;** the PDF is made again from it when it is needed.

#### The notation
In `docs/notation.md`: the lens, the symbolic format, MEI, what is music and what is typesetting, stretches and measures, the issues and the warnings. In short:
- **Two formats:** MEI is the export format, what users get. The lens is the internal format, what models read and write: JSON for the structure, with strings in the symbolic format (LilyPond's notation, borrowed, not a subset of it) for the music of one voice in one stretch. Code builds the MEI from the lens; models never write MEI.
- **The model reports what is printed, and code works out the rest:** the accidentals printed, not the pitches they mean; notes under an 8va where they are printed; clefs and keys at every system's start. Code resolves the pitches, the ties, the ottavas and the measures' numbers.
- **The music, never its appearance:** the test is "would a player read it differently?" Typesetting (spacing, slur shapes, positions of marks, breaks) is never encoded.
- **Stretches:** code cuts each system at its bar lines into stretches, which are fixed structure; `extract` classifies each (no measure, a new one, or continuing one), and code builds and numbers the measures from that, per piece. Versions of the extraction are compared stretch by stretch.
- **Issues** are questions about what the printed page says at a place: boxes on the pages (at most 2 consecutive systems), answers keyed by letter, every stage's choice kept, and the answer the music reflects (`applied`). Two classes: `reading` (hard to tell what the page says) and `format` (clear, but the lens can't express it, which the format gap report collects). Ids are numbers per score, given by code, never reused.
- **Warnings** are about the current extraction, not the page (durations that don't add up, a change in the offset of the measure numbers, changes beyond an issue's boxes): never answered, computed anew for each version, shown to the next review.
- **The MEI is full MEI 5, close to MEI Basic,** going beyond it only where a list in the code says so (`BEYOND_BASIC`), and validated against both schemas in the tests, not at run time.

#### Zooming in
**Zoom crops on request, without tool calls** (decided, for a later version: the first version has none), for `extract`, `review` and probably `apply_review`:
- **The first answer has one of two shapes,** in one schema: the stage's answer itself, when the model needs nothing more (a clean system), or a list of requests: zoom boxes on the crops it was sent (and, for `review`, other systems' crops), at most N, each with a short reason ("dot near the A♭: staccato or smudge?").
- **The second request** repeats the first, adds the model's requests as its answer and the zoom crops, each labelled (§7.2), and asks for the stage's answer; this one can't ask for more. Its prefix is the first request, so prompt caching makes the repeated part cheap.
- **So at most two rounds per call,** plus the follow-ups for failed checks, if those come too (`extract`). This is a tool loop with one round, built ourselves: the same on every provider (no tool-use APIs, no loop in the adapters), every call record a plain request and answer, and the cap enforced by the schema rather than by the model's judgement (the manual run's over-exploration, §13).
- **Code cuts the zoom crops** from the deskewed page at the page image's resolution. A zoom gives the model real detail where its view of a large crop was shrunk (Claude sees at most 2576 px on the long edge); on a low-resolution scan it is only a closer look at the same pixels, which may still help it focus.
- **The zoom boxes and their reasons are recorded** with the call (§5.2), and the issues that come from them can point at the same boxes: evidence for the reviewer and the user.
- **Open, until `review` is built: accumulating zoom crops across stages** (§15, "Zoom crops on request").

## 7. LLM steps

What each LLM stage is given and returns is in §6, with the stages (`layout`, `analyze`, `extract`, `review`, `apply_review`), the format models write music in ("The lens"), and what is checked (`extract`'s checks, issues and warnings). This section covers what all of them share.

### 7.1 Structured output
Every call returns JSON validated by a Zod schema, using the provider's schema-constrained output. Doubts are issues (§6), not prose.

### 7.2 Prompts and model configs
- Prompt templates are versioned in `packages/prompts` and are part of their step's version.
- Every call is recorded (§5.2), and identical requests are served from the record instead of being paid for again.
- **Provider, model and thinking budget or effort are the user's choice.** The app is meant to be flexible here and doesn't prescribe a model. The user guide will recommend Claude Opus 5.5 for everything: the only evidence so far is the project owner's manual runs with Gemini 3.1 Pro, a Gemini Flash and Opus 5.5, and even Gemini 3.1 Pro got far too much wrong. The prompts are tuned on Opus, so the app offers the choice but can't promise the same quality with another model.

#### Calling the providers
Built: `apps/worker/src/llm/`. One small request and response shape for every provider (`LlmProvider`, §3): a system prompt, messages of text and images, a maximum of output tokens, an effort, and optionally a JSON schema the answer must follow (the provider's schema-constrained output, §7.1; the answer is then parsed). The response says which model answered, the text (and parsed JSON), why it stopped (finished, cut off, refused) and the tokens. Errors are typed and say whether retrying can help.
- **The chosen model answers, or the call fails.** No fallback to another model, not even Anthropic's server-side fallback on refusals: a refusal comes back as a refusal.
- **Several images in one request are labelled** with a text block right before each ("System 3:", "System 3, stretch 2:"): content is an ordered list of text and images for both Anthropic and Gemini, and the adapters keep the order. Neither API passes a file name to the model. Anthropic's vision docs recommend this way of labelling.
- **Anthropic** (Claude API), with the official SDK. Requests are streamed, so long answers don't hit timeouts. Thinking is left at the model's default (adaptive on current models), and effort maps directly. As a sanity check, an answer that names another model than the one asked is an error (`unexpected_model`).
- **Google** (Gemini API, keys from AI Studio), with the official SDK. Effort maps to Gemini's thinking levels (low, medium, high), which exist from Gemini 3 on; older Gemini models want a token budget and would refuse a level. Thinking tokens count as output, cached ones apart from the rest. Gemini names the exact version that answered, which can differ from the name asked for (an alias, a dated version), so there is no model check.
- **Claude on Google Cloud's Vertex AI** (for processing in the EU, §10), with Anthropic's official Vertex client: the same Messages API, so the same adapter code as for Anthropic's API, sanity check included. Configured with a service account's key file (a secret), a region (`eu` for the EU multi-region, a single region such as `europe-west1`, `us` or `global`) and optionally a project (default: the key file's).
  - **Tokens without Google's auth library,** which expects Node (files, child processes, the metadata server) and doesn't run in a Worker. Our own small token source signs Google's service-account claim with WebCrypto, exchanges it for an access token, and reuses the token until a minute before it expires. A refused service account is an `auth` error.
  - **Billing** goes through Google Cloud, after the fact. Google Cloud now has enforced spending caps per project; the project owner's project ("score3ly") has a monthly cap of €30, with the Vertex AI API enabled. What is left to set up is a task (§15).
- **Claude on Amazon Bedrock** (for processing in the EU: Opus 5.5 isn't offered on Vertex AI in Europe, and Anthropic has no servers there), with Anthropic's official Bedrock client for Bedrock's Messages API endpoint ("Mantle"): again the same adapter code, sanity check included. Configured with a region (e.g. `eu-central-1`) and either a Bedrock API key or an AWS access key pair (a key ID and a secret), both secrets; with a key pair, requests are signed with AWS Signature V4. The client runs in a Worker as it is, given the credentials explicitly (it would otherwise look for them in the environment and AWS's files). The model is Bedrock's own ID for it, e.g. an `eu.` inference profile.
  - **Setting up an AWS account for it** (for the user guide): a new account must first be verified (up to 24 hours), then the AWS Marketplace agreement for the model signed, then Anthropic's use-case form submitted; before that, requests are refused with "not available for this account". The project owner's account is in this process (2026-10-09), with 100 USD of starter credits valid for six months.
  - **The sanity check compares the two model strings as they are;** whether Bedrock answers with the string that was asked is checked on the first real call (§15).
  - **Spending:** AWS has no hard spending cap as far as known: budgets alert, and a budget action can at most attach a deny policy. The app's spending cap (§10) and the IAM user's permissions are the limits.
- Gemini on Vertex AI isn't built (§15).
- Tested without network, with a fake `fetch`, and run inside the local Workers runtime. `npm run llm:try -w apps/worker -- <anthropic|anthropic-vertex|anthropic-bedrock|google> <model> <image> "<question>" [--json]` sends one image and a question with real credentials, from environment variables.
- **Wired into the Worker** (built, `apps/worker/src/llmRoutes.ts`), as Block 1 of the LLM stages:
  - **`POST /api/projects/<id>/stages/<stage id>/llm`** takes one request of a running stage (system prompt, messages of text and images, base64, an optional JSON schema and maximum of output tokens). The model config is the stage's (set when it starts, from the stage's choice or the default setting, §7.2). **The item-level cache comes first** (decided): an earlier successful call with the same request key, not deleted, is served at no cost, even when the spending cap is reached. Only then: the price, the spending cap, the secrets, the call. The request key is the hash of the request, with each image replaced by its recipe key (§5.2, "Only recipes"), and of the model's provider, model and effort.
  - **The browser asks first without the images** (built, `ask` in `apps/web/src/llm.ts`): each image named only by its recipe key. A cached call is served then; otherwise the answer is `{ imagesNeeded: true }`, and only then does the browser make the images (from the device's cache, or from their recipes), check the request's size against the provider's limits, and send it again with them. So a re-run on another device makes no images for calls already paid for. A stage builds its requests with each image as its recipe and the function that makes it (`requestImage`); every image sent has a recipe, `layout`'s drawings for its check rounds included (cached now, like the others).
  - **Requests must be built the same way in a run and in a retry:** an answer that later requests are built from (a page's analysis, a system's extraction) is used as it reads back from storage, canonical JSON, also in the run that got it; otherwise the order of its keys differed and the whole-score `analyze` request missed the cache after a retry (found while building this).
  - **Every call is recorded** in `llm_calls`, with its tokens (cache reads and writes apart, migration 0008) and cost. The request is stored in R2 as canonical JSON **with images replaced by their recipe keys and hashes** (decided, built): images are never stored (§2); a cached request is found and served without them, and the images of a request can be rebuilt from the stored outputs when someone needs to look at them (inspection and debugging aren't ordinary use). The response (text, parsed JSON, stop reason, the provider's raw answer) is stored as JSON.
  - **Statuses:** `ok`; `cut_off`, `refused`, `unparseable` and `error` are recorded but never served from the cache. `unparseable` is first the JSON itself: an answer that isn't valid JSON, although the provider was asked for schema-constrained output. Its tokens aren't known (the adapter throws), so its cost isn't recorded: a gap in the costs, accepted for now.
  - **Answers the stage can't use** although their JSON is fine (LilyPond in `extract`'s answer that doesn't parse, a `layout` box outside the page): the stage marks the call unusable (`POST …/llm-calls/<call id>/unusable` with the reason), which records it as `unparseable`, so it isn't served from the cache again; its cost stays recorded.
  - **Free-tier configs are always allowed:** no spending cap needed, no known price needed, and they don't count towards the cap.
  - **Errors the stage acts on** carry a code: `spending_cap`, `no_price`, `no_model_config`, `missing_secret`. The stage fails with the message, and a retry later asks only what is missing.
  - **Model configs** (`/api/model-configs`) and **settings** (`/api/settings`: the default model config, the spending cap and the run mode for new projects) have endpoints; the settings page shows the run mode, the spending cap and the model configs (read-only) so far. Each provider's form is checked: which secrets (by the Worker secret's name) and which plain values it needs.
  - **A fake provider** (`provider: "fake"`) answers without network: the simplest JSON its schema allows, tokens counted from the request's size, made-up prices; some model names make it fail on purpose. Two steps get more, so the pipeline runs end to end: `layout` two systems on every page, each with three bar lines, and `extract` the stretches asked for, a voice per staff with a whole-measure rest in 4/4, a made-up doubt on every system and a format issue on the first (§6, `extract`). For tests, and for trying the pipeline without paying.
  - **In the browser** (`apps/web/src/llm.ts`): the stage's model config, the part of the stage key that depends on it (provider, model, effort), images as request content, and asking the model.

#### Model configs
- **A model config** is a stored, named combination of provider, model, thinking effort and the provider's authentication. The user can keep several. They live in D1 and are edited in the settings.
- **The model is the provider's own string** (to be replaced by picking from the supported models, see "Supported models, prices and the config form" below), entered as the provider spells it (`claude-opus-5-5` on Anthropic's API, an `anthropic.`-prefixed ID or an `eu.` inference profile on Bedrock, ...). The app doesn't translate between providers' names, and the sanity check compares the answer's model with that string as it is (§7.2, "Calling the providers").
- **An optional name** for each model config, shown on the stage cards (§5.6). Without one, the card shows the model string, shortened in the middle when it doesn't fit, like project and file names (§5.7).
- **Each provider declares its own form:** which fields are secrets and which are plain values. The plain Anthropic and Google APIs take one key; Google Vertex AI wants a service-account file plus a project and a region, AWS Bedrock an access key pair plus a region. The form is generated from a schema, like a step's config (§3).
- **A secret field is a dropdown of the Worker's secrets, by name** (§10). The config stores the name, never the value. Several keys per provider are possible, e.g. a free-tier key and a paid one.
- **A missing key:** if a secret was removed or renamed, the configs pointing to it are broken. The app says so on the config and before a run starts, not in the middle of one.

#### Which config a stage uses
Three levels; the most specific wins:
1. **The config picked for a stage in a project** ("Change config" in the stage's "⋮", §5.6). Full flexibility, not normal use.
2. **Advanced settings: a config per kind of work.** First draft of the kinds: finding layout boxes (`layout`), analyzing the pages (`analyze`: metadata and observations), extracting the music notation (`extract`, `apply_review`), review (`review`).
3. **The default config:** one settings item. With it, and nothing else set, the pipeline is "fire and wait".

- **Model configs are append-only** (§5.8): editing one adds a new row and marks the old one deleted (copy on change), and deleting one only marks it. So a stage and each of its calls refer to the row they actually used, and editing or deleting a config, or renaming a secret, doesn't rewrite the history of old projects. The secrets' names are part of the row; a secret's value isn't recorded in any way.
- **Changing the config of a stage that already ran** is a change in the middle (§5.5): confirmation, then everything after it runs again.
- **The key is not part of a stage's inputs.** Using another key for the same model doesn't count as a change and doesn't make paid stages run again.

#### Supported models, prices and the config form (under discussion)
**Not decided yet, and not built.** This is where the discussion stands; what is still open is listed at the end of this section, and in §15 ("Decide the model configs"). Where it disagrees with "Model configs" above or with §10 (a model string typed by hand, the price table in the code), this section is the newer thinking.

- **Why:** the code has to know which kind of model it talks to, not only the provider. Today the provider ids carry the model family (`anthropic-vertex` and `anthropic-bedrock` are Claude; `google` is Gemini on Google AI Studio), and the Worker's adapter, the effort levels (Gemini has three, quietly mapped from our five), the image limits (`apps/web/src/llm.ts`) and the prices all follow from that. Gemini on Vertex AI would need code. And a model without a price in the code's table can't be used at all unless marked free tier, which hides its spending from the cap: a new model (an Opus 5.6) can't even be tried without a new version of the app.
- **Providers are platforms,** from a fixed list in the code: Anthropic, Vertex AI, AWS Bedrock, Google AI Studio, Fake. **Model families** are a second fixed list: Claude, Gemini, Fake. The user never picks a family when creating a config; it comes with the model. The pair (provider, family) tells the code which secrets and plain values to ask for, which effort levels to offer, and how to make a request. Only pairs the code can call exist (no Gemini on Vertex AI until there is code for it).
- **The supported models are a table in the database:** per row the provider, the model string as the provider spells it (on Bedrock's Messages API endpoint, which the code uses, `anthropic.claude-opus-5-5`, without a region prefix: the prefixes `eu.`, `us.`, `global.` belong to Bedrock's older integration), the family, the region where the provider has regions (none for Anthropic and Google AI Studio), and four prices in US dollars per million tokens: input, output, cache read, cache write. **One row per provider, model and region,** because prices differ: on Bedrock and Vertex AI, regional (and multi-region) endpoints of Claude 4.5 and later cost 10% more than the global endpoint, and AWS says a price depends on the region a request is made from. Size isn't a concern (a few hundred rows). The four prices are all needed: cache prices aren't a fixed ratio of the input price (a cache hit is 2.5% of it on Fable 5.1, 5% on Opus and Sonnet 5.5, 10% on others).
- **Shipped prices:** the app ships its list in the code, with a version; when the Worker sees a newer version than the database has, it writes the prices of every model on the list (a new version of the app updates all prices it knows). Rows the user added are left alone. Filling a list of this size by hand invites mistakes that make the cap undercount, so the idea is to generate it with a script from the providers' published price lists (AWS publishes its as public JSON files; Google's catalog needs an API key), run before a release.
- **A price is always looked up at call time** (decided): a config doesn't pin a price, so editing a price later corrects the estimate for every config that uses it. Each call already records the prices it was billed at (§10), so history stays as it was.
- **The "prices as of" line leaves the About page** (decided) once prices can be edited by hand.
- **The settings page:**
  - **"Model configs" has a "+" on the heading's line** (like the forms' "+", §6), and each card a "⋮" with Edit, Make default (disabled on the default) and Delete (refused for the default until another config is the default).
  - **Each card shows a compact price label,** input and output per million tokens, e.g. "$4 / $20 per MTok". Money is shown here, in a stage's details and in the costs view, never in the pipeline panel (§5.6).
  - **Creating a config: everything is picked, nothing typed** but the optional name: provider, then model and region, the effort (the levels the family has: for Claude "Model's default" and low to max, for Gemini "Model's default", low, medium, high; a level a single model rejects is found by the Test button, below), and each secret from a drop-down of the Worker's secret names (a new endpoint listing the names of its text bindings, never their values). Then the optional name, the free-tier checkbox with its confirmation (§10), and "Make it the default".
  - **Model and region filter each other:** the region picker lists only the regions that have a row for the chosen model, and the model picker only the models served in the chosen region, so a user who wants their data in Europe picks "eu" first and sees what is available there. "Global" is one more region. A combination without a price can't be picked. Vertex AI works the same way.
  - **Adding a supported model:** pick the provider and the family, type the model string, pick one or more regions (where the provider has them), and enter the four prices, with "US dollars" prominent and the provider's pricing page as a hint. One row per region.
  - **A "Test" button** on a config sends a minimal request through the Worker, to show that the model, region and key work before a long run. A hint says what it does and that it costs money (a fraction of a cent, counted towards the cap).
- **Pre-installed:** a new database has the Fake model and a config for it named "Fake model" (on the cards, a plain "Fake" read unclearly), which is the default (decided; built, migration 0014: existing databases get it too, as their default only where none is set; free tier: it is for users to try the app, so it costs nothing and never meets the cap; trying costs and the cap needs a fake config that isn't free tier), and a spending cap of $1 (built, §10).
- **What comes after the first round, and what is still to settle or research,** is in the task "Decide the model configs" (§15).

### 7.3 Known LLM risk: plausible wrong notes
LLMs fill in "musically likely" content. That is desirable for a smudge and dangerous everywhere else, because the errors look correct. Defenses:
- issues for every doubt (§6)
- checks by code (`extract`, `apply_review`)
- review against the crops (`review`)
- checking the engraved output against the original on the test set (§13)

## 8. Image processing and reproducibility across devices

### 8.1 Getting page images
Built: `packages/imaging/src/pdfPages.ts` (`openPdf`, `pageImage`), tested on the test set (§13). `npm run pages -w packages/imaging -- <file.pdf> <folder>` writes every page, as extracted and straightened, as PNGs.
- **Scanned PDFs:** extract the embedded page image directly instead of rendering the page: the scan's own pixels, at its own resolution.
  - **A page counts as a scan** when it has exactly one image and that image covers at least 85% of the page. Other content, such as an invisible OCR text layer, is ignored. Anything else (vector music, a scan cut into several images, an image at an angle that isn't a right angle) is rendered.
  - **This is decided per page, and exactly, not guessed.** How a PDF was made can't be known for sure (score2ly could only guess whether a PDF was vector), but that doesn't matter: what a page draws is listed exactly in its content stream, and the rule is a decision about that. A PDF that mixes scans and vector pages is handled page by page. Where the rule doesn't take the pixels directly (a scan cut into strips, or with a vector stamp or page number added), the page is rendered, which is always correct, only at our resolution instead of the scan's. Tests that decide by whether a page has text are wrong whenever a scan has an OCR layer or vector music is drawn as paths.
  - **On the test set** (2026-10, all 83 pages of 14 PDFs): 79 pages are scans; the 4 pages of the only vector PDF (Debussy, Mutopia) are rendered, and have no image at all (about 1,100 to 1,400 path and 500 to 1,100 text operations each). Scans range from 785×1228 px at 200 dpi to 5400×7200 px at 600 dpi, and Bendel's resolution changes within the PDF (293 dpi on page 1, about 640 on the rest). Kinderscenen reports 72 dpi for 2000×2578 px scans: its PDF pages are as large as the images (about 28 inches wide), so the dpi means nothing there; the pixels are taken as they are. The test set has no PDF that mixes scans and vector pages, and no scan cut into strips, so that fallback hasn't been tried on real files.
  - **Decoding:** CCITT, JBIG2 and JPEG 2000 by pdf.js (JS and its WASM decoders, which need pdf.js's `wasm` folder), JPEG by pdf.js's own JS decoder: `isImageDecoderSupported: false` stops pdf.js from using the browser's. `isOffscreenCanvasSupported: false` makes pdf.js hand over images as pixel arrays rather than bitmaps.
  - **What the test set showed,** all handled:
    - 1-bit scans stored as a **stencil mask** (ink where a bit is 0, in the fill color);
    - scans with **transparency** (black ink plus a soft mask that says where the ink is): laid on white;
    - scans stored **rotated or mirrored**: turned the way the page shows them;
    - images **larger than the page**: only the part on the page is kept;
    - scans stored with **non-square pixels** (e.g. 300 dpi across and 150 down), which the PDF stretches back into shape. The page as the PDF shows it is the truth, so they are resampled to square pixels at the higher of the two resolutions, nearest neighbour (exact copies for a factor of 2, and 1-bit scans stay sharp).
  - The reported resolution is the scan's (from its size on the page).
- **Colour is kept** when the scan has it. On yellowed, stained paper, colour separates ink from stains and paper better than grayscale, and a global binarization threshold can fail entirely (SmartScore's mandatory threshold on Kinderscenen p3 found no usable setting). LLMs bill images by pixel dimensions, not channels, so colour costs nothing extra in LLM calls; only the device cache grows (§2). Grayscale or binarization may replace it after an ablation (§15).
- **Vector PDFs:** render with pdf.js at a fixed DPI (300 by default), with pixel size computed explicitly as `round(pagePt × dpi / 72)`. Geometry is identical everywhere. Only anti-aliased edges differ slightly between canvas backends, and binarization removes most of that. The canvas is passed in: an `OffscreenCanvas` in the browser, `@napi-rs/canvas` in Node (tests).
- **In the browser:** the same code runs in a Web Worker (`apps/web/src/pageImageWorker.ts`, used by `rasterize`). A worker has no DOM, so pdf.js is given what it would take from it: an `OffscreenCanvas` factory for its canvases, a filter factory that does nothing (pages with transfer functions are drawn without them, as in Node), and its data folders (fonts, character maps, wasm decoders) as absolute URLs fetched by pdf.js's own worker (`useWorkerFetch`). Glyphs are drawn as paths, not with the browser's fonts (`disableFontFace`), as in Node.
  - **Compared with Node** (Chromium, 2026-10): a scan (Bendel p4) gives the same pixels, bit for bit. Vector pages (Debussy, 300 dpi) differ in about 0.5% of their pixels, on anti-aliased edges (at most about 70 gray levels on a pixel, 0.01 on average): "close" by §8.3, not identical. The PNG files our encoder writes from the same pixels are identical in Chromium and Node. Firefox, Safari and phones aren't tried yet (§15).
- **Crops** (`packages/imaging/src/crop.ts`): a box (§6: `left`, `right`, `top`, `bottom` as fractions from 0 to 1) covers every pixel it touches, even partly, so nothing at the edge of a system or measure is cut off. Named regions come as JSON, `{"system_3": {"page": 2, "bbox": {...}}, ...}`, pages counted from 1; names become file names, so they are kept to letters, digits, `_`, `-` and `.`. As in the pipeline (pages extracted, deskewed, sent to an LLM for the boxes, then cropped), crops are cut from the deskewed page images: `npm run crops -w packages/imaging -- "<pages>/page-{n}.straight.png" <regions.json> <folder>` reads the page images (`{n}` is the page number; `npm run pages` writes them so) and writes `<name>.png` for each region.

### 8.2 Deterministic operations
- All image operations are implemented in our own TS/WASM code, never with canvas transforms or `drawImage` scaling.
- `Math.sin`, `Math.cos`, `Math.exp` etc. are not guaranteed to give identical results across JS engines. Round them to a fixed precision (e.g. 12 decimals) or ship our own implementations.
- Operation chains are ordered. Coordinates refer to the output of the previous step.
- **Rotation** (`packages/imaging/src/rotate.ts`): about the image's center, positive angles clockwise as seen on screen, bilinear interpolation. **The output has the input's size:** corners that turn out are cut off, and areas that turn in are filled with the paper's color (the median color of the page, so yellowed paper stays yellowed). Deskewing angles are small, so little is lost, and coordinates stay simple. A test pins the exact pixels (a hash), so any change to rotation shows up as one, and is a new step version.
- Human and LLM coordinates are stored in **normalized units**, so they survive regeneration at a different resolution.

### 8.3 Fingerprints: verifying "close", not just "identical"
**Which images** (decided): every image from which a stored result was computed, by code, a model or a person: the page images (`skew_analysis` measures its lines on them, `fix_skew` shows them), the straightened and scaled pages sent by `layout` and `analyze`, the straightened pages of `fix_layout`, and later the crops of `extract`, `review` and `apply_review` and the pages of `human_review`. Not the images that are only shown, or only lead to other images (the full-resolution straightened page before it is scaled for a request): a mismatch there shows in the images made from them. Stored when the result is first computed from the image, with its recipe key, one per recipe key (`image_fingerprints`, §5.8).

**Why:** the stored results refer to those pixels: a model's boxes and answers, a person's lines and boxes. Keys hold only recipes (§5.2), so a result is reused whichever device makes the image again; that is right as long as the images are close, as they are expected to be. A fingerprint says when one isn't, so that the user knows the coordinates or answers may not fit the image on this device. **A warning, never a stop:** which device is right can't be told, and significant mismatches aren't expected.

**Where:** no image is made only to be checked. Images are made from their recipes whenever a device needs one its cache doesn't have: an artifact or an editor shows it, or a stage sends it in a new request. **Every image that has a fingerprint is checked then** (decided), in the one place where images are made from their recipes (`apps/web/src/pageImages.ts`), whatever needed it. Checking only what may differ between devices (vector pages, functions such as `Math.sin`) would save a hash and a thumbnail, cheap next to making the image, at the price of a judgement that could be wrong. Checked in three tiers:

1. **Exact:** pixel dimensions plus SHA-256 of the **raw decoded pixels**. This is not a hash of the PNG file, since PNG encoders differ.
2. **Close:** a downsampled grayscale thumbnail (64×64 to 128×128). Compare the regenerated image downsampled the same way:
   - mean absolute difference below about 1 gray level, and
   - no single tile above a few gray levels.
3. **Mismatch:** a warning (decided): nothing is flagged in storage, since it is this device's image that differs.
   - **Over every image of the page concerned** (the page, straightened, its crops), wherever it is shown (artifact views, editors): "This image differs from the one the stored results were made from (probably on another device, or before a recent update); boxes or answers may not fit it." In the desktop app, the only device its data is on, the parenthesis is "(probably before a recent update)" (decided). Below a system's crop instead of over it, where a banner would hide the music.
   - **On the card of a stage running on this device** that makes such an image: "Some images differ from the ones the stored results were made from (probably on another device, or before a recent update); boxes or answers may not fit them.", with the same parenthesis as above in the desktop app.
   - **"Close" is silent.**

**Built** (`packages/imaging/src/fingerprint.ts`; `apps/web/src/pageImages.ts`, `ImagesDiffer.tsx`; `apps/worker/src/fingerprints.ts`, migration 0016 adds the version, the thumbnail's size and the time):
- **The fingerprint:** the size, the SHA-256 of the raw RGBA pixels as decoded (an image stored as gray as it reads back), and a grayscale thumbnail of at most 64×64 (area averaging, each pixel the average of a tile); "close" is a mean difference below 1 gray level and no thumbnail pixel more than 4 apart. A version (`FINGERPRINT_VERSION`): only fingerprints of the same version are compared.
- **Made with every image,** in the page image worker, and kept next to it in the device's cache (an image cached without one gets it computed from its PNG when needed).
- **Stored** (`POST /api/fingerprints`, one per recipe key, the first stays) by what computes a stored result from images: every image of an LLM request that was paid for (`ask`: `layout`'s, `analyze`'s and `extract`'s), `skew_analysis`'s page images, and the images `fix_skew` and `fix_layout` save a change on.
- **Checked** (`GET /api/fingerprints/<recipe key>`) whenever an image is made because the cache doesn't have it; a mismatch marks the page (its page image's recipe key) for the rest of the page load. A check that can't be made (offline) is skipped.
- Tried in Chromium at both widths, with a stored fingerprint altered by hand: the banners on the pages, the layout and the Transcription's crops, and the running stage's card.

### 8.4 Finding the skew
In `docs/stages/pages.md` ("Finding the skew"): how `findSkew` measures a page's angle and its lines, how staves are detected, and when a page is deskewed (no lines, no deskewing; the angle that fits the lines best; not for tiny angles).

### 8.5 Device constraints
- **Memory:** a 300 dpi page held in canvas memory is about 35 MB, and mobile Safari strictly limits total canvas memory. Process one page at a time in a Web Worker, using typed arrays / `OffscreenCanvas`.
- **Latency:** generate lazily, current page first.
- **Eviction:** call `navigator.storage.persist()`, but assume the OPFS cache can disappear at any time. Missing derivatives are simply regenerated. Built: asked once per page load, at the cache's first write (`imageCache.ts`), unless the storage is already persistent; Chromium grants or refuses it by itself, Firefox asks the user.
- **Size:** the image cache is an LRU cache with a configurable size limit (§8.6), the least recently used images deleted first. Deletion is real deletion. **Built** (2026-10-26; `cacheLru.ts`, `imageCache.ts`):
  - **The limit** is a setting of this device (Settings, "This device", "Image cache": 250 MB, 500 MB, 1 GB, 2 GB, 5 GB; default 1 GB; kept in the browser), shown with what the cache takes now; never more than 80% of what the browser lets the site store (`navigator.storage.estimate`). Lowering it prunes at once.
  - **Once a write takes the cache over the limit,** the least recently used files are deleted until it is under 90% of it, so it isn't pruned at every write; the file just written stays. Every file in the cache counts: page images, straightened pages, crops, fingerprints, renderings.
  - **The last use of each file** (read or write) is kept in an index, `cache/lru.json`, saved a moment after changes; OPFS itself keeps only write times. Once per page load the index is merged with a scan of the cache's folder, which gives the sizes and catches what other tabs wrote; a lost index falls back on the write times.
  - **The memory fallback** (no OPFS) keeps at most 200 MB, the least recently used going first.
  - Tried in Chromium: the same views take 3.1 MB without a limit and 1.6 MB under a 2 MB one, with the images still shown.
- **Bundle size:** avoid OpenCV.js (about 10 MB). With LLMs doing the reading, preprocessing is light enough to write by hand.

### 8.6 The image cache
Page images, straightened pages and crops are views computed from the PDF and the stages' results (§6), and cached in OPFS, each step separately, so a crop doesn't mean rendering the PDF again.
- **The key is the hash of the image's recipe, chained:**
  - page image: hash of (the PDF's SHA-256, the page number, `rasterize`'s version and config);
  - straightened page: hash of (the page image's key, the angle the decision gives for the page's lines, the decision's and the rotation code's versions);
  - crop: hash of (the straightened page's key, the box, the crop code's version).

  Each key contains the key of the image it was made from, so a change anywhere before it (another resolution, another angle, a new version of the code) changes every key after it. Nothing is ever invalidated: an old entry is simply never asked for again, and ages out of the LRU cache (§8.5).
- **Numbers are written canonically** before hashing (angles and box coordinates rounded to fixed decimals, canonical JSON), so the same recipe always gives the same key.
- **The code versions** are those of our image functions, plus pdf.js's for the page images (§11).
- **Stored as PNG** (`cache/pdf-<sha256>/<key>.png`: a folder per PDF, so that deleting a project can delete its images), encoded by our own code: a raw RGBA page is about 35 MB, a PNG of line art much smaller and lossless. Reading costs a decode.
  - **Built:** the encoder and decoder (`packages/imaging/src/png.ts`: 8-bit RGBA, the "Up" row filter, compressed with the platform's `CompressionStream`, so the same in browsers and Node) and the cache (`apps/web/src/imageCache.ts`), keyed by the hash of the recipe as canonical JSON. Where OPFS isn't available (some private windows), images are kept in memory while the page is open. The artifact view shows the cached PNG directly (an `<img>`), with no decode. The size limit and LRU eviction are built (§8.5).
- **The key isn't the fingerprint** (§8.3): the key says what an image should be, the fingerprint, stored in D1 for every image from which a stored result was computed, what it was. An image regenerated on another device is checked against it.

## 9. Rendering

**Verovio (WASM) renders the MEI in the browser** (decided; npm package `verovio`, LGPL-3.0, §3, "License"), to SVG: each system's rendering in the Transcription (and so the side-by-side view of `human_review`), and `engrave`'s PDF a user can download with the MEI. Every stage runs on any device, with no local helper and no paid compute. LilyPond is a native program that runs neither in the browser nor in a Worker, with no practical WASM build, so it would need a desktop helper (against "runnable from anywhere") or an always-on container (against "free tier only").
- **Verovio's engraving differs from the original's,** but for comparing pitches, rhythms, voices and marks against the original, that doesn't matter (see `human_review` for how the two panels are linked anyway).
- **Verovio adds a few MB to the download:** it is loaded lazily, only where something is rendered.
- **No LilyPond export** (decided). score3ly's output is MEI. Whoever needs MusicXML or LilyPond can convert it with existing tools: MEI to MusicXML (e.g. music21, MuseScore 4's MEI import, the MEI community's XSLT), then MusicXML to LilyPond with `musicxml2ly`. Each step loses something (§1, "Why a text encoding").

## 10. External services

| Service | Use | Notes |
|---|---|---|
| Cloudflare Workers (static assets + API) | Hosting | Free tier. No heavy compute. |
| Cloudflare D1 | Database | EU jurisdiction set at creation. Cannot be changed later. |
| Cloudflare R2 | Original PDFs, stage outputs, large LLM payloads | EU jurisdiction bucket. Cannot be changed later. |
| Cloudflare Access | Login | Protects everything, including the API. |
| Google Drive | Picking source PDFs. Optional export target. | `drive.file` scope, Picker for selection, app-created export folder. Publish the OAuth app to "production" status (even unverified), because refresh tokens expire after 7 days in "testing" status. |
| Vision LLMs | Layout, analysis, extraction, review (§6) | Called **only through the Worker**: API keys stay in Worker secrets. |

### Secrets
- **The LLM API keys are Worker secrets,** set by whoever runs the instance, outside the app (`wrangler secret put`, or the Cloudflare dashboard, which also works from a phone), under names of their own choosing. They are independent of code deployments: `npm run deploy` doesn't touch them, and changing one takes effect within seconds, without deploying the code again (Cloudflare makes a new version of the Worker with the new value by itself). Locally, `wrangler dev` reads them from `apps/worker/.dev.vars`, which is not committed.
- **The app can't change them and contains no code that handles keys.** The Worker only reads them to call a provider; they never reach the browser.
- **The app only knows their names,** which a model config picks from (§7.2). The Worker can list the names of everything it was given but can't tell a secret from an ordinary setting, since both are text values. Today all of them are secrets; if ordinary settings are ever added, a naming rule has to separate them.
- **Not done on purpose:** letting the Worker change its own secrets through Cloudflare's API. It would need a Cloudflare API token stored in the Worker, and the permission to edit a Worker's secrets also allows replacing its code.
- **Model configs are not secrets:** provider, model, thinking effort and the names of the secrets to use are stored in D1 and edited in the app (§7.2).
- The user guide explains how to set the keys.
- Entering the keys in the app is an optional task (§15).

### Data residency
- PDFs and stage outputs (R2) and everything else (D1) are in EU-jurisdiction Cloudflare storage. Images stay on the device unless sent to an LLM.
- Cloudflare is a US company. An EU jurisdiction guarantees **where** data is stored, not which legal regime ultimately applies. This is acceptable for this project.
- **LLM calls are the residency gap.** For EU processing:
  - Gemini and Claude are both available in EU regions through Google Vertex AI. Claude is also available through AWS Bedrock.
  - The plain provider APIs give no such guarantee. Anthropic's API can pin where inference runs (`inference_geo`), but only to the US or "global", not the EU.
  - Built: Claude through Vertex AI and through Bedrock (§7.2). Opus 5.5 is offered in the EU only on Bedrock (checked 2026-10-09: not on Vertex AI in Europe; Anthropic's API has no EU option).
  - On Google AI Studio's free tier, inputs may be used to improve Google's products.

  Document the choice per provider in the config.

### Cost
- Storage and hosting: free tiers.
- LLM calls: cents per call. Roughly per PDF: about 12 page analyses, about 50 system transcriptions, plus reviews and fixes. The recommended model is Opus 5.5 for every stage (§7.2).
- **LLM requests are sequential and synchronous for now:** one at a time, no parallel calls, no overnight batch requests. Further optimizations are decided once we see how long an extraction takes.

#### How costs are computed and kept
- **The app computes the cost itself:** the providers' APIs report token counts per call, not money. Cost = tokens × a price table per model, kept in the code (to move into the database, under discussion: §7.2, "Supported models, prices and the config form").
- **Currency: US dollars** for everything, since that is how the providers publish their prices. The amounts are estimates, not the invoice: the bill may be in another currency, with tax or discounts. The app doesn't convert.
- **The cost is stored with each call, when it is made,** so a later price change doesn't rewrite history.
- **So are the prices it was computed with** (decided, built): each call records the price table's entry for its model and the date the table was collected (`price_json`, migration 0009). The table's date (`PRICES_AS_OF` in `apps/worker/src/llm/prices.ts`) is shown on the About page, marked once it is older than three months, so stale prices are noticed and a new version updates them. The costs view (planned) may show the prices behind a cost where it doesn't clutter.
- **Costs and statistics come from the rows of the calls and the stages** (§5.8), with no ledger of their own: each call has its cost, each stage its start and end time and its page count (§5.8). Those rows survive everything that removes outputs:
  - stages replaced by re-running from an earlier stage (§5.5), which are no longer visible in the pipeline;
  - stopped stages (§5.6);
  - deleted projects (§4): their project, stage and call rows are kept, marked as deleted.
- **Statistics:** the runtime and cost of each stage and of whole pipelines, and averages per page, using each stage's own page count (§5.8); perhaps also the issues raised per page, by models and by the user.
- **The spending cap** sums the costs of the calls started in the last 24 hours, deleted projects included.

#### The costs view
- **Totals** per stage, per project and per month. No cost per single call, and no estimate before a run.
- **Format:** two decimals, "$0.12", "$3.40". A paid amount below one cent is "<$0.01"; "$0.00" is reserved for free-tier calls.
- **Replaced stages** are included in their project's total.
- **Deleted projects** are listed, clearly marked as deleted, with their creation and deletion dates next to the name, because a deleted project's name can be used again.
- **Free-tier configs:** the user can mark an LLM config as free tier, behind a confirmation dialog, since the app can't check it: a response says nothing about whether the call was billed. Calls with such a config are shown as "$0.00".

#### Spending cap
- **Purpose: protection against bugs,** not against a user who transcribes too much. A bug in the app must not be able to burn a lot of money on a handful of scores.
- **A setting: at most $X within any 24 hours** (a rolling window, not the calendar day, so a runaway just before midnight doesn't get two budgets). Once reached, the app refuses every further request that costs money.
- **Always set** (decided): a new database has a cap of $1, and it can be changed but never removed, so there is no way to run without one. (Migration 0012 removes a cap stored as unset, so the $1 applies.)
- **On the settings page** (built): an amount in US dollars ("$ 1.00"), saved when the field is left or Enter is pressed; anything but an amount above $0 isn't saved and says so. It can't be cleared: an empty field isn't saved, and Escape brings back the cap.
- **Why a day and not a month:** with a monthly budget the user picks a large number ("about $30 a month"), and a bug can spend all of it in a day before anything stops. A daily budget makes them pick a small one ("$1 a day"), so a bug is stopped after a small sum.
- **Why not per project:** scores differ a lot in length, and re-running stages adds cost legitimately.
- **Enforced by the Worker,** which makes the LLM calls. A second tab or a stale page can't get around it.
- **The cap can be overshot** by the cost of the calls in flight when it is reached, because a call's cost is only known when it returns. Sequentially that is one call, a few cents. **If requests ever run in parallel, revisit this:** the overshoot could be far too much.
- **Free-tier configs stay usable** after the cap is reached, and don't count towards it. A config wrongly marked as free spends money the cap doesn't see; a spend limit set at the provider is the backstop.

## 11. Versioning

- **Step versions are explicit and immutable.** An algorithm change that would invalidate human input (e.g. stored system boxes) is a new step version, such as `layout@2`. The old one stays in the codebase, and projects record which version produced each artifact.
- **Part of a step's version:**
  - library versions (pdf.js, decoders, Verovio)
  - prompt template versions

  The model is not part of it: it is the user's choice and belongs to the stage's config (§7.2).
- Load old step versions lazily with dynamic `import()`.
- **A newer step version on a re-run:** what a re-run does when a stage's step has a newer version is still open (§15).
- **D1 schema migrations** use `wrangler d1 migrations`.
- **The app's version** is the `version` in the root `package.json` (0.1.0 for now), in three parts, major.minor.fix:
  - **Fix** goes up for bug fixes.
  - **Minor** goes up for compatible additions: UI features, new optional stages to pick from, a new step version such as `layout@2` that becomes the default for new runs. Additions are collected for a while first, so the minor doesn't go up twice a day.
  - **Major** goes up for incompatible changes: ones after which old pipelines can no longer be re-run. This is also the way out if the number of step versions grows unmanageable. Even then we make an effort to keep old projects viewable in the UI, clearly marked as run with a pipeline that is no longer supported.
- The build also records the git commit it was built from, and whether there were uncommitted changes. The About page shows all of it, e.g. "0.1.0 @ 61c081d" (plus "[+ uncommitted changes]" and "[dev server]" where they apply), so a deployed app can always be traced to its code.

## 12. Testing and reproducibility

**Principle:** deterministic parts are tested directly. Non-deterministic parts (LLM calls, human input) are **recorded and replayed**.

- **Unit tests:** image operations, the lens parser and checks, measure building, the MEI builder (validated against MEI 5 and MEI Basic, `docs/notation.md`, "MEI"). Among the checks: a two-note tremolo with a wrong count fails the duration check (§15).
- **Golden-image tests:** deterministic image pipelines produce known raw-pixel hashes, or fingerprints within tolerance (§8.3).
- **Fixture projects:** real scores with recorded LLM call records (request + response) and recorded human operations (angles, boxes, answers to issues), stored in `fixtures/`.
- **Replay tests:** run a fixture end to end with the replay `LlmProvider`.
  - Deterministic steps must reproduce identical output hashes. LLM and manual steps return their recordings.
  - This tests the plumbing, assembly and resume logic with no API cost.
- **Stale recordings:** a changed prompt or model changes the request hash, so replay misses. The test reports exactly which recordings are stale, and they are re-recorded against the live API.
- **CI** (decided and built, 2026-10-26, `.github/workflows/ci.yml`): GitHub Actions runs `npm ci`, the typecheck of every workspace (`npm run typecheck --workspaces`) and `npm test` on every push to **main only** (and by hand); the working branches aren't checked there, only what lands on main. Node 22, as in development; Electron's binary isn't downloaded (the tests don't run it). Tried as a fresh clone here before the first run on GitHub.
- **Quality evaluation** is separate from tests (§13): live runs, with repeated runs to measure variance. A temperature of 0 doesn't guarantee identical answers.

### Test environments (planned)
For trying the app by hand on prepared data, locally only (no remote test database or bucket).

- **A test environment is a folder** in the repo, `testenvs/<name>/`, with:
  - the local D1 and R2 state, which `wrangler dev` reads from any folder (`--persist-to`);
  - a secrets file, loaded with `--env-file` instead of `.dev.vars`. It holds fake or test-only keys, and real keys are never committed.
- **Environments are built by a script, not by hand:** it applies the migrations to an empty folder (`wrangler d1 migrations apply --local --persist-to`), then adds PDFs and projects through the API. Wrangler's local storage format is internal and can change between versions; with the script, an environment can be rebuilt after a migration or a Wrangler update.
- **One command starts an environment,** e.g. `npm run dev:env -- <name>`:
  1. refuses to start if the test ports are taken;
  2. copies the environment to a scratch folder, so the prepared one stays as it was;
  3. starts `wrangler dev` on the copy and Vite, on the **test ports** (e.g. 8887 and 5273), apart from the normal ones (8787 and 5173). There is one pair for all environments: only one runs at a time. Vite's proxy target, now fixed to `localhost:8787` in `apps/web/vite.config.ts`, comes from an environment variable. Vite listens on `127.0.0.1`, since WSL2 may not forward a server that only listens on IPv6;
  4. waits until the app answers, then opens it in a browser with a **throwaway profile**;
  5. when that browser is closed, stops the servers and deletes the copy and the profile.

  Deleting on exit will fail now and then (a crash, a killed terminal, a file still locked on Windows). So the copy and the profile get folder names with a short random part (e.g. `score3ly-test-3f9a1c`): a leftover from an earlier run never gets in the way of the next one.
- **Throwaway profiles, not private windows:** a fresh profile starts with empty storage (OPFS, `localStorage`, history), so environments never mix, and it behaves like a normal browser. Private windows keep storage in memory with a much smaller limit, which the image cache (§2) can exceed, and they join the running browser instead of starting a separate one.
- **Firefox and Chrome** are supported, from Linux and from WSL2 (the browser then runs on Windows and reaches the servers in WSL through `localhost`):
  - **Firefox:** `firefox -no-remote -profile <folder> <url>`. `-no-remote` starts a separate Firefox even while a normal one is open. A `user.js` in the profile turns off the welcome pages, the default-browser question and telemetry prompts.
  - **Chrome:** `chrome --user-data-dir=<folder> --no-first-run --no-default-browser-check <url>`. A separate user data folder is a separate browser.
  - **From WSL2,** the browser is the Windows program (e.g. `/mnt/c/Program Files/Mozilla Firefox/firefox.exe`), and the profile folder is on the Windows side, in `%TEMP%`: browsers keep their storage in SQLite files, which don't work well on the network file system through which Windows reaches WSL. The script finds `%TEMP%` with `cmd.exe /c echo %TEMP%` and converts paths with `wslpath`.
  - **Which browser and where it is installed** is a local setting, in an uncommitted file, with the usual install paths as defaults.

## 13. Evaluation

**Human evaluation, supported by tooling.** There is no ground-truth encoding for interesting scores (only for PDFs engraved from a source that is published with them, such as Mutopia's LilyPond, a narrow and easy subdomain). Every format can also express the same music in many ways, so comparing source text is meaningless. And the errors music OCR still makes are big and obvious: improvements are visible from a glance at the rendered output. Precise automatic metrics would be the right tool for a production system tuned over years, not for this project.

### Test set
- `testset/` in the repo. Small, since evaluation is by hand. Only the input PDFs (public domain, e.g. from IMSLP), the highlighter strokes on them, the `.ly` and `.musicxml` candidates and the Soundslice screenshots are committed. The inputs never change, so their strokes stay valid on any machine. Engravings, strokes on engravings and any other files produced there stay local. Its README documents the tooling and why each piece was picked.
- Input PDFs are chosen to cover the phenomena in §1 rather than random pieces: multiple voices per staff, staff count changes, lyrics, editorial notes and ossia/alternatives, reduction staff, two-piano double systems, old ornamented scans, clean vector PDFs, a few non-piano cases.
- Naming: `<piece>.orig.pdf` is the input. Each extraction method adds `<piece>.<method>.<format>`, in the format the method writes: `.musicxml` from OMR tools (e.g. `fuer_elise.audiveris.musicxml`), rendered directly, so a tool isn't judged on a lossy `musicxml2ly` conversion; `.ly` from LilyPond (e.g. the manual run's `bendel_la_cascade_p4.claude-chat.ly`); `.mei` from score3ly (e.g. `fuer_elise.s3l-opus.mei`). Baselines are the best results from existing tools.

### Tooling
- **Engrave command:** engraves every `<piece>.<method>.ly` (local LilyPond install), `<piece>.<method>.musicxml` (local MuseScore 4 install) and `<piece>.<method>.mei` (score3ly's output: Verovio in Node with the app's options, Verovio's own breaks on A4, its SVG pages drawn into the PDF with pdfkit and svg-to-pdfkit, nothing to install) that has no `<piece>.<method>.pdf` yet. Never overwrites existing PDFs. MEI candidates are committed like the others, named `s3l-<model or config>`.
- **Viewer:** a local web page with three PDFs side by side, each scrolling continuously (page breaks don't line up across engravings). The left pane always shows the original. The middle and right panes have dropdowns listing the available engravings of the same piece.
- **Highlighter:** freehand strokes painted over any of the PDFs (original or engraving), in a color from a short list, with multiply blending so the notes underneath stay visible. They point the eye at errors: no types, no counting. A switch between reading and highlighting mode prevents accidental strokes. One "undo last stroke" covers all panes and is the only way to erase. Its history covers the current session and is cleared when switching pieces.
- **Stroke storage:** next to the PDF in `<piece>.<method>.marks.jsonl` (`<piece>.orig.marks.jsonl` for the original), saved after every change, as JSON Lines: one stroke per line. Per stroke: page, color name, width and points (relative to the page size), and the SHA-256 of the PDF it was drawn on. Colors are stored by name and looked up in the viewer's palette, so adjusting a palette value recolors existing strokes; names not in the palette are painted grey. Storing the hash per stroke means strokes drawn on an older version of a PDF stay identifiable even after new ones are added. The viewer warns about such strokes, since they may be misplaced. The PDF itself is never modified.

### Baselines
**The question:** how well can existing tools read a PDF, understand the music and write it in a formal text format? Any format counts, so MusicXML is rendered directly with MuseScore 4 (`npm run eval:engrave`), not converted to LilyPond first. Audiveris is installed only from https://github.com/Audiveris/audiveris/releases: `audiveris.com` and `audiveris.net` are scam sites.
- **Tested** (2026-10), covering free and open source to expensive proprietary: Soundslice (free tier), Newzik (7-day trial), PlayScore 2 (1-week trial), SmartScore 64 Pro (demo), Audiveris 5.11. Not tested: PhotoScore & NotateMe, ScanScore, Klangio Scan2Notes, Opuscan/Flat, ACE Studio, oemer, and research models (LEGATO and others, which mostly output notes and rhythms only, in ABC or kern). Ruled out: combining several tools' extractions with an LLM, which would cost more than any paid service.
- **Results:** every tool is far from usable; even the best results need too much correction by hand.
  - **Soundslice:** Mozart unrecognizable. Its free tier doesn't allow exporting the extracted music, so its results in the test set are screenshots of its rendering (`<piece>.soundslice.pdf`). A very polished UI, which asks multiple-choice questions about everything it was unsure of.
  - **Newzik:** terrible throughout, and very verbose (141k characters of MusicXML for one Mozart page). Failed on the full Kinderscenen.
  - **PlayScore 2:** the best of the three on the whole test set, still not usable. Measures whose durations don't add up (Chopin, Kinderscenen p3, Villa-Lobos). Crashed on the full Kinderscenen.
  - **Audiveris** (batch mode): mostly very bad; Clair de Lune (a vector PDF engraved by LilyPond) surprisingly decent. Failed on Chopin (internal crash), Liszt (a cover page without staff lines aborts the export) and Kinderscenen (pages over its 20-megapixel limit).
  - **SmartScore** (judged in the app, the demo exports almost nothing): Für Elise (Leipzig) the best of any tool, few mistakes; Clair de Lune good, Mozart decent; the rest bad to a disaster. The full Kinderscenen took over 45 minutes and failed; its binarization threshold suits no part of the stained paper (one reason to keep colour, §8.1).
  - **Bendel, La Cascade p4** (an obscure piece): a disaster with every tool.
- **Opus 5.5 in a chat** ("The manual run" below) did far better, which decided building the app (2026-10-06): every existing tool tested, paid or free, was far from usable, and this design builds on the manual run's lessons.

**Memorization:** LLMs recognize the famous pieces of the test set (Gemini Flash named the Mozart concerto and movement from a page with the edition, plate and page numbers cropped away), so a transcription may be partly recalled rather than read, and the test set would overstate how well the approach works. Two checks: obscure scores unlikely to be in the training data (Bendel, La Cascade, which neither Gemini 3.1 Pro nor Opus 5.5 could identify), and different editions of the same piece (the two Für Elise), to see whether the model follows the page or its memory where they differ (§15).

### The manual run
Bendel, La Cascade p4, transcribed by Claude Opus 5.5 in a claude.ai chat with code execution, following the intended pipeline by hand (2026-10). The result, uncorrected, is `testset/bendel_la_cascade_p4.claude-chat.ly`.
- **What was done:**
  1. Structure from the full page, as structured text: systems, measures and staves per system, clefs, keys and time signatures with their changes, voices, and observations such as repeated melodies.
  2. A LilyPond skeleton with one variable per measure and hand (a first version reused one variable for measures it thought identical, and was corrected).
  3. System boxes by eye, with a check loop: code draws the boxes on the page, the model looks and corrects; two rounds sufficed.
  4. System crops, uploaded one at a time; the model cut them into measure crops on its own and zoomed further into tricky note groups.
  5. Transcription system by system, compiled with LilyPond to check, and a correction of system 4 after system 5 (a slur continued into the next system).
- **What it showed, and where it went in the design:**
  - **Opus read the structure from the full page correctly,** measure counts included (6, 6, 6, 7, 8), where Gemini 3.1 Pro and 3.6 Flash had answered 3 per system, guessing from note groups instead of bar lines. One page, one try each, but it supports `layout` on whole pages with bar line positions as evidence rather than counts.
  - **Boxes by eye with a draw-and-check loop work,** at least on a clean page (`layout`'s tool, at most 3 rounds). Unknown on stained, ornamented scans (the Kinderscenen test, §15).
  - **Measure crops help, and so does zooming into small note groups:** stretch crops with every system crop, and zoom crops on request (§6, "Zooming in").
  - **Left alone, the model over-explores:** too many images, turns and tool calls, and too much time (7 minutes for system 1). Images are cheap (a full page is roughly 1.5–3k input tokens); the cost is in turns resending a growing context and in long reasoning. Hence steps we control, one call per system, and caps on every loop.
  - **Systems depend on each other:** slurs, ties, hairpins, 8va lines, pedal and voices cross system breaks, and a later system can change the reading of an earlier one. Hence the neighbouring crops in `extract`, the continuation flags, and `review` with the whole score.
  - **Repetitions seen from above were partly wrong** (m13 isn't m9): observations are hints, and every stretch is read on its own.
- **The author's check of the result** found 11 errors, 6 of them at least partly in the model's list of doubts. Three kinds, needing different remedies:
  - *saw it, decided wrongly* (the extent of an 8va, a crescendo dismissed as a printing mark, staccatos left out, the wrong one of two rhythms): mostly among the doubts; `review` and the issues resolve them;
  - *misread or invented* (an invented note, a wrong note, a missed staccato, a measure copied from a supposed repeat): reading discipline in the prompt, and `review`;
  - *spanners and simplification* (slurs ending too early at bar lines and system breaks, three slurs written as one): crop margins, `review`'s attention to spanners, and the rules on musical content (`docs/notation.md`, "Musical content and typesetting").

  Claude's account of what it had checked was wrong until asked again (it recommended comparing the rendering with the crop but never did it): the call records are trusted, not a model's account (§5.2).
- **Claude's own retrospective** (what would have helped from the start), and what became of it:
  - **A fixed output spec,** given in full from the start: it changed its conventions midway (pedal moved into the left hand, phrasing slurs from system 2 on, sounding pitch under 8va). That is the lens and the prompt (`docs/notation.md`, "The lens").
  - **A known effort budget:** caps belong to the pipeline, not to the model's judgement (`extract`'s loops).
  - **Context from before the page** (time signature, anything still open, composer and edition): the state carried by code, the observations and the metadata.
  - **Doubts as data, not prose:** issues.
  - **Labels for the images:** in the chat, uploads reached the model as generic file names, so it couldn't tell which crop was which. In the API, a text block before each image labels it (§7.2).
  - **Boxes by eye with a draw-and-check loop, at most 3 rounds:** `layout`.
  - **A render-and-compare self-check, and visual comparison per bar:** a review step we control, not the model's own loop (`review`, "Renderings").
  - **An independent review** by a model that hasn't seen the first transcription: `review`, possibly with another model (§7.2).
  - **Checks** for durations and unclosed marks: `extract` and `apply_review`.
  - **Dropped:**
    - **a rough chord per bar as a prior,** with a check for notes clashing with it: Claude did fine without it, and a wrong chord would bias the reading;
    - **staff lines and bar lines found by pixel counting:** that kind of scripting failed in v1 and in score2ly, and a wrong detection would make the extraction worse; bar lines come from `layout`;
    - **transcribing bar by bar:** many more calls, and the view of the whole system is lost (the slur fix came from it).
  - **Experiments for some day** (§15): pitch guides. Printed accidentals and 8va instead of pitches became the symbolic format (§6), as an experiment.

### Use
- Compare methods, prompts and models side by side by eye.
- Count how many of the real errors the issues raised by `extract` catch (6 of 11 in the manual run).
- Cost per piece comes from the LLM call records (§10).

## 14. Things to pay special attention to

| Risk | Mitigation |
|---|---|
| **Infrastructure work crowding out quality work** (plumbing is fun) | Validate the approach by hand before building (§13). Measure quality on the test set early and often. |
| Losing LLM output or human input because it was treated like cache | §5.3: LLM and manual outputs are always persisted. Eviction only touches computed outputs. |
| Plausible but wrong notes from LLMs | §7.3: issues for every doubt, checks by code, review against the crops, measured slip-through rate. |
| Regenerated images drifting from what the human or LLM worked on | §8: deterministic decoding and operations, normalized coordinates, fingerprint checks. |
| Downscaled system images losing detail (models shrink large images, and piano systems are wide) | Stretch crops sent along with the system crop, and zoom crops on request (§6, `extract`, "Zooming in"). |
| Bugs in building the MEI or rendering it, misleading the user in `human_review` | Tests of the MEI builder, validated against the MEI schemas (`docs/notation.md`, "MEI"); `review` reads the lens, not the rendering. |
| ML costs creeping up | Per-call cost logging, reuse of recorded requests, the spending cap (§10). |
| Two devices editing the same project | Optimistic locking (§4). |
| Irreversible infrastructure choices | D1 and R2 jurisdictions are set at creation. Scripted in the repo. |

## 15. Tasks

Everything still to do is a task in `docs/tasks.md`, which explains how the list works. A reference to §15 elsewhere in this document points to a task there, by its name where it gives one.

## 16. The first release
The main parts of the first release, and the measure of progress: ticked items stay. Finer tasks are in §15.

**Assessment**
- [x] Evaluation tooling: engrave command, viewer, highlighter (§13)
- [x] Baselines from existing tools (§13)
- [x] Manual run of the pipeline with Opus in a chat (§13)
- [x] Decide to build the app

**The app's frame**
- [x] Projects: create from a local PDF, pick, rename (§4, §5.6)
- [x] The project view: the pipeline panel and the artifact view, wide and narrow (§5.6)
- [x] The pipeline in D1: stages, outputs, run, stop, retry, Auto and Manual, config changes with confirmation (§5.8)
- [x] Manual stages: add, finish, edit, drop (§5.4, §5.8)
- [x] LLM calls through the Worker: the providers' adapters, call records, the cache, costs, the spending cap (§7.2, §10)
- [x] Settings page: run mode, spending cap, model configs read-only
- [ ] Model configs: decide (§15), then supported models and prices in the database, and the config form (§7.2)
- [x] Delete a project (§4)
- [ ] Costs view and statistics (§10)

**The stages**
- [x] `rasterize` (§6)
- [x] `skew_analysis` and `fix_skew`
- [x] `layout` and `fix_layout`
- [x] `analyze`, `fix_metadata` and `fix_observations`
- [x] Define the lens and the symbolic format (§6)
- [x] The lens's parser and checks
- [x] Crops with margins for `extract`
- [ ] The linking code (§6, `analyze`)
- [x] `extract`
- [x] The MEI builder, validated against MEI 5 and MEI Basic (`docs/notation.md`, "MEI")
- [x] The Transcription: each system rendered by Verovio (§9), the boxes of issues and warnings, the raw toggle
- [x] The checks of the whole score at the end of `extract` (`apply_review` runs them too, once it exists)
- [ ] `review` and `apply_review`
- [ ] `human_review`
- [x] `engrave`: the full score's MEI, its view, the PDF, the download

**With real models and scores**
- [ ] Check the prompt and the response schema of `layout`
- [ ] Check the prompt and the response schema of `analyze`
- [ ] Check the prompt and the response schema of `extract`
- [ ] Check the prompt and the response schema of `review`
- [ ] Check the prompt and the response schema of `apply_review`
- [ ] Run the pipeline with a real LLM
- [ ] The first fixture, and replay tests (§12)
- [ ] Results on the test set, compared with the baselines in the viewer (§13)

**Deployment**
- [ ] The remote D1 database and R2 bucket in the EU, and a first deployment
- [ ] Cloudflare Access in front of it
- [ ] Tried in Firefox, Safari and on a phone
- [ ] The user guide (Help)
- [x] A license (AGPL-3.0, and the third-party notices)
