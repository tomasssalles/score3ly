# Design Document — Score-to-MEI Pipeline (v2)

> Status: draft. The early assessment (§16 steps 1–4) is done and the app is being built from the outside inwards (§16 step 6): projects, the project picker and the project view exist and run locally; the pipeline panel is designed with mock stages (§5.6), and there are no real pipeline stages yet. This document records the architecture, the reasons behind it, and the known risks with proposed mitigations. Items marked **Proposed** are leading candidates, not final decisions. Concrete **tasks**, including the decisions still to be made, are collected in §15.

## 1. What this app is

A web app that converts PDFs of music scores into a formal, text-based encoding of the music: **MEI** (§6, "MEI").

- **Input:** a PDF, usually a scan of an old score, sometimes a digitally typeset (vector) PDF.
- **Output:** an MEI file (the **export format**), with an engraved rendering for side-by-side comparison with the original. Inside the pipeline, the models read and write a compact subset of LilyPond instead (the **internal format**, §6, "The lens").
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
- **LilyPond:** melodic lines stay contiguous and readable, for people and models alike; simultaneity needs duration sums, which code checks. **Chosen,** as a subset we define.

**What users get** had other requirements:
- everything musical, as opposed to typesetting: pitches, durations, rests, ties, slurs, articulations, tremolo, dynamics, and what a player needs: voices, cross-staff notes, stem directions;
- room for editorial notes and alternatives, clearly separated from the music;
- unambiguous to parse, and, once what isn't musical is removed, one way to encode given music, or equivalences that are trivial to recognize. No format guarantees that by itself: it takes a normalizer, and ours is the conversion from the lens (§6);
- conversion to other formats. Lossless conversion to ABC or kern is impossible (they express less), and LilyPond can only be imported from a subset we define.

**MEI fits best** (§6, "MEI"): XML from the musicology community, with the musical content apart from the layout, pitches as name and octave, durations as note values (no ticks), written and sounding values kept apart (`accid` and `accid.ges`), dynamics, slurs and the like attached to notes, irregular measures marked as such (`@metcon`), editorial markup (`app`/`rdg`, `choice`, `supplied`, `unclear`, `annot`), links to image regions (`facsimile`), and MEI Basic, an official subset with "one way of encoding for every feature". Verovio renders it in the browser and keeps the MEI's ids in its SVG. MusicXML was the fallback (the best ecosystem of tools, but heavy normalization and weak editorial markup); the other formats would be views derived from MEI. Export to them is a later question: no converter between MEI and LilyPond exists in either direction, and Verovio doesn't write MusicXML.

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
- **Focus:** classical piano scores. This is hard enough already, because it involves:
  - multiple voices per staff
  - the staff count changing mid-piece (e.g. 3 staves in a passage, 2 elsewhere)
  - lyrics below systems
  - editorial notes, ossia and alternative versions
  - a reduction staff for an orchestral part
  - two-piano double systems
- **Also possible:** other instrumentations are not excluded, but they are not optimized for initially.
- **Possible later: image input (PNG, JPEG)** in addition to PDFs. It is almost no extra work: an image is a page image, so it skips PDF extraction and joins the same pipeline at `rasterize` (§6), with JPEGs going through the same bundled decoder (§8.1).

### Goals
- **Quality first:** the measure of success is how good the transcription is and how little human correction it needs. Infrastructure only exists to serve that.
- **Cheap:** runs on free tiers. Paid LLM calls are the only expected running cost.
- **Transparent:** open source, simple deployment, documented strategy (this file).
- **Runnable from anywhere:** start on the desktop, continue on the phone. Every pipeline stage should work on both.
- **Reproducible and testable:** every stage output (§5.2) can be traced back to its inputs, code version, prompt version, model and configuration. Non-deterministic parts (LLM calls, human input) are recorded so they can be replayed (§12).

### Non-goals (for now)
- Multiple users, sharing, collaboration. Each person deploys their own instance to their own Cloudflare account, or runs the desktop version (§3, planned), with their own secrets, so the app has no user accounts and none are planned.
- MusicXML output.
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
- **Every object in R2 is stored under the SHA-256 of its bytes,** not only the PDFs. Objects never change: changed content is a new object under a new key. So a repeated upload is harmless, the browser can cache every object for good, a fork (§16) copies no objects, and the hash that a stage's validity check needs anyway (§5.2) is also the key. The price is that an object can't simply be deleted with the row that refers to it, since other rows may refer to it too (§4).

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
| Vision LLMs | The user's choice, per stage (§7.2). Recommended: Claude Opus 5.5 for everything. | In the manual run (§16 step 3) Opus did best at everything, layout included. Providers are swappable behind the `LlmProvider` port. |
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
  core/      Pipeline engine, stage outputs and artifacts, step definitions, config schemas.
             Pure TypeScript, no DOM and no Cloudflare APIs.
  imaging/   Page images from PDFs, deterministic image operations, fingerprints. Pure TS/WASM.
             (Exists: page images, skew detection, rotation. The other packages don't exist yet.)
  notation/  Lens parser and checks, measure building from stretches,
             MEI builder (the frame from the structure and metadata, the music from the lens).
  prompts/   Versioned prompt templates and their output schemas.
apps/
  web/       React UI, Web Worker host, OPFS + Drive + local-file adapters.
  worker/    Hono API, D1 + R2 adapters, LLM provider adapters.
  eval/      Local evaluation tooling: engrave command, side-by-side viewer (§13).
fixtures/    Recorded test projects (§12).
testset/     Evaluation test set (§13): inputs, their strokes and .ly/.musicxml candidates committed, rest ignored.
DESIGN.md
```

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

### Desktop version (planned)

The app is built for the browser and Cloudflare, and that stays the focus. An optional **desktop version** wraps the same code, for people who prefer that trade-off:

| | Web app on Cloudflare | Desktop app |
|---|---|---|
| Setup | A Cloudflare account, a deployment, secrets in the dashboard | Install and run |
| Devices | Every device, phones included, with the important data synced | One computer |
| Data | D1 and R2 in the EU, images cached per device (sometimes missing and rebuilt) | Everything local and persistent; the disk is the only backup |
| Secrets | Worker secrets | A local file |
| Residency | EU storage at a US company (§10) | Local, apart from the LLM calls |

The project owner uses the web app. The desktop version mainly makes the app easier to share with people who would not set up Cloudflare (the API keys they have to bring remain a hurdle either way).

**The rule that keeps it cheap:** the web app only ever talks to the Worker's HTTP API, and the Worker only touches Cloudflare through its D1 and R2 bindings and its secrets. Anything Cloudflare-only beyond those (e.g. Workflows or Durable Objects, §16) goes behind a port with a desktop equivalent, or is a deliberate exception. Then the desktop version is a different host for the same server code, not a second app.

**How:**
- **Electron.** Its main process (Node) runs the Worker's Hono app as a local server on `127.0.0.1`, and the window shows that address. The React app doesn't change. Electron rather than Tauri because it ships Chromium: the system web views (WebKit on macOS) differ in canvas, OPFS and pdf.js behaviour, and Tauri would still need Node alongside for the server. The price is a download of about 150 MB.
- **Small adapters on Node, not Miniflare.** D1 is SQLite: the part of the D1 API we use (`prepare`, `bind`, `all`, `batch`) is a thin layer over Node's built-in SQLite, running the same migration files, at startup. R2 is a few calls (`get`, `put`, `head`, `delete`) over a folder of plain files. Miniflare would need no adapters but is a development tool, ships the `workerd` binary per platform and stores R2 objects in its own format.
- **No login:** the server only listens on localhost, so Cloudflare Access isn't needed.
- **The same server also runs without Electron,** as a plain local server, e.g. on a home server reachable from a phone through a VPN.

**What differs in the app.** The server says which host it is (e.g. `GET /api/info`), so the web bundle stays the same for both; the UI asks the server, and nowhere else decides by host:
- **Secrets:** in the desktop version they are in a file in the app's data folder, in the same `NAME=value` format as `.dev.vars` (§10). The app creates it on first start, with a commented example and permissions for the user only. A button in the settings opens it in the system's default text editor: the page asks the server, which opens it (`shell.openPath`), since a web page can't. Changes take effect without a restart: the server reads the file again when it changes, and the secret names in the model configs (§7.2) update. In the web version, the same place in the settings explains that secrets are set in the Cloudflare dashboard, with a link to the user guide.
- **Navigation:** an Electron window has no browser bar, but the app relies on the back button (closing an artifact or a stage's details, leaving a menu page, §5.6). So: back and forward buttons in the header, left of the wordmark, disabled when there is nowhere to go (Electron knows: `navigationHistory.canGoBack()`), and the usual shortcuts, which Electron doesn't set by itself: Alt+←/→ (Windows, Linux), Cmd+[/] (macOS), the mouse's side buttons and swipes on macOS. The condition is "no browser bar", not "desktop": a phone app opened from the home screen without the browser's bar would need the same (§15).
- **The data folder:** nothing in the app opens it. The user guide says where things are stored on each platform, with a strong warning that changing those files can invalidate pipelines that already ran (§5.2).
- **Easier on desktop:** no Worker limits on CPU time, no lost answers when a phone sleeps, no free-tier quotas. Running the whole pipeline on the server (§16) is simple there.

**The real costs** are outside the code:
- **Code signing:** unsigned apps get warnings (macOS Gatekeeper, Windows SmartScreen) that stop non-technical users. Notarizing for macOS needs an Apple Developer account ($99/year); a Windows certificate costs money too.
- **Builds for three platforms** (GitHub Actions) and updates (e.g. electron-updater from GitHub Releases).
- **Migrations on users' machines,** run at startup.

**When:** after the first vertical slice works (§16 step 6). Until then, only the rule above has to hold, and the current code follows it.

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
- **Deleting a project** (planned): apart from the costs and statistics, it must be **as if the project had never existed** (decided). In particular, a new project with the same PDF, name and config runs every stage from scratch and finds nothing of the deleted one in the cache.
  - **Deleted:** the project's stage outputs (their rows and their content), the full requests and responses of its LLM calls, its PDF and the PDF's image fingerprints, in D1, R2 and the device cache, unless another project that isn't deleted still uses them. That is checked with a query at deletion time, not with stored reference counts, which can drift.
  - **Orphans in R2 are collected then too:** objects that no row in D1 refers to any more, from any project. They are left behind when a manual stage in progress is saved again (the new content is a new object, §2) or when an upload isn't followed by its row in D1. Nothing else deletes them: a save doesn't delete the object it replaces. This lists the whole bucket and compares it with D1, which is acceptable because deleting a project is rare.
  - **Kept, but marked with a deletion time (`deleted_at`):** the project's row, its stages and their LLM calls, for the costs and statistics (§10). Every cache lookup ignores marked rows (§5.8), so they are never reused. A stage that a fork which isn't deleted still uses is not marked (§5.8).
  - A deleted project never appears in the UI again, except in the costs view. Picking its PDF again doesn't trigger the "already based on this file" dialog, unless other projects use that PDF.
  - Uniqueness of names only counts projects that aren't deleted: a partial unique index (`... WHERE deleted_at IS NULL`). *Built* (migration 0003, which rebuilt the table: the earlier constraint sat on the column and couldn't be dropped).
  - Behind several confirmations.
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
- A project's **pipeline** is the ordered list of its stages. It is stored in D1 and shown in the UI (probably in a side panel), so it has to stay short.

There are two sorts of stages:
- **Planned stages** have a predefined order (§6) and can run automatically, one after the other.
- **Manual stages** are added by the user to intervene by hand (§5.4). They are recorded in the pipeline like any other stage.

The same step can occur more than once in a pipeline. Example: the review step run twice for extra accuracy, or once with one model and once more with another.

#### Run modes
A small drop-down in the pipeline panel sets, per project, how the pipeline runs:
- **Auto:** one click starts the pipeline (or resumes it), and it keeps going from stage to stage, following the recipe, until it is done or fails. If a model flags that it would like human input, the flag is recorded, but the pipeline goes on with the model's best guess. The spending cap (§10) also stops it.
- **Manual:** each stage is started by a click. This leaves time to look at the outputs and decide whether to step in with a manual stage or to run a stage again with other parameters.
- Far in the future, perhaps a middle ground: run automatically, but stop when a model asks for human input.

The mode for new projects is a settings item. After installation it is "Auto".

The browser drives the pipeline, so in either mode a run only advances while the app is open (§15, §16).

Each step declares:
- `id` and `version`, e.g. `extract@3` (see §11).
- A **config schema** (Zod), which is also the source of its UI controls.
- **Input** and **output types**.
- **Granularity:** per document, per page, or per system. Steps can fan out, e.g. one page becomes many systems.
- Its **kind:** `ingest`, `computed` (code), `llm` or `manual`, and nothing else (decided). `ingest` is the kind of the first stage only: it doesn't run (the PDF is given when the project is created), so the UI treats it apart (no run, progress or retry; it is done from the start), and its output is stored like LLM and manual outputs (§5.3).
- Its **runtime:** browser (Web Worker) or Worker proxy (LLM calls).

While it runs, a stage **reports its own progress** as a fraction from 0 to 1, which the UI shows (§5.6):
- Only the code that performs the stage knows how far it is. It is handed a function to call whenever it has got further (e.g. after each system), and doesn't know about the bar or the circle that show the value. A stage running in a Web Worker can't call into the page, so there the function passes the value on as a message.
- **A single LLM call has nothing to report while it waits,** so its share of the bar fills with the time elapsed out of the call's timeout, and jumps to full when the answer arrives. If the timeout is reached, the call has failed. For a stage that is one call, the share is the whole bar; for a stage with a call per system, each call fills its own slice.

### 5.2 Outputs, artifacts and provenance

**Terminology** (decided):
- **Stage outputs** are internal: many and fine-grained, e.g. one per page, per system or per LLM request. They carry provenance and cache keys, have a row each in D1, and are what is stored or regenerated. They are saved as soon as each is done, so an interrupted or failed stage resumes where it stopped.
- **Stage artifacts** are what the user sees: few per stage, mostly for the whole score (the pages, the layout, the score so far, the MEI file, the issues), shown as tiles and in the artifact view (§5.6). A stage doesn't show 107 tiles for 107 systems. An artifact is built from the stage's outputs, as a view; some are stored as well for convenience (the MEI file for download), but an artifact never holds anything that isn't in, or computable from, the outputs. So provenance and caching live in one place, the outputs.
- **The export format** is what the user gets: MEI (§6, "MEI"). **The internal format** is what the pipeline works with: the lens (§6, "The lens"). There is no single storage format: the outputs may hold either or both, as the stages need; that is settled when they are built.

Every stage output has:
- `step id@version`
- a canonical config hash (JSON with sorted keys)
- the IDs of the outputs it was made from
- its `origin`: the kind of the stage that produced it (`ingest` | `computed` | `llm` | `manual`)
- a fingerprint (for images, see §8.3)
- a timestamp

LLM outputs additionally reference their **call record**: prompt template version, filled-in context, image hashes, exact model ID, parameters, full response, token usage and cost.

**The cache has two levels** (decided):
- **Stage level:** the key is hash(step id, version, canonical config, the model's provider, model and effort for LLM stages, the content keys of the stage's inputs). An input's content key is the hash of its stored content, or the recipe key of a computed image (§8.6): content rather than row IDs, so a stage that produces identical content again (e.g. `layout` run again with the same boxes) doesn't invalidate what follows. If it matches, the stage is skipped and its outputs reused. Outputs of later stages may already exist when an earlier stage is run again with the same inputs and config: they are found through the key and reused.
- **Item level, when the stage's key doesn't match:** the stage runs, but each item checks its own key first: for an LLM request, the exact request including the model config (provider, model, effort; §7.2: an identical request is served from its record); for an image, its recipe (§8.6). Cheap code just runs again. Requests contain only what they really use (§5.5), so fixing one page's boxes changes only the requests that depend on that page; a request that contains the whole score (`review`) changes with any change upstream, as it should.
- **What isn't part of any key:** a model config's plain parameters (the region, the project) and its secrets (§7.2). They choose where and with which credentials a request runs, not what the model is given. A parameter that some day does change the answer must be added to the keys.
- **Only usable answers are cached:** an error (no answer, a timeout) or an answer that fails to parse is recorded (call record, costs, §10) but never served from the cache, so a retry asks again.

Every output has a row in D1, which belongs to the stage that produced it and says whether its content is stored (in R2, under its hash, §2) or only its recipe (§5.3).

**Checking that stages are still valid:** a pipeline checks its stages against the hashes of their inputs and outputs. Stored content can change outside the app (e.g. files in the desktop version's data folder edited by hand), and a stage whose recorded inputs or outputs no longer match what is stored is not valid any more. How and when this is checked, and what the app does then, is still to be designed (§15).

### 5.3 Persisted vs. regenerable (important)

- **Computed** outputs (page images, straightened pages, crops) store only their **recipe plus fingerprint**. Images live in OPFS and can be regenerated. Small text outputs may be stored anyway for convenience.
- **Ingest**, **LLM** and **manual** outputs **must be persisted**: everything that isn't computed. They cannot be regenerated: re-running an LLM call gives a different answer and costs money.
- Rule: *anything you would hate to lose must never exist only as a cached image.*
- **Regeneration is lazy, per device** (decided): a device computes a computed output only when something needs it, never the whole chain up front. Example: seven stages run on a laptop, and on the bus the user adds an eighth, manual stage on a phone. The phone has none of the laptop's images, but the eighth stage's inputs are there (stored outputs fetched from R2, or images regenerated from their recipes because the stage needs them), so the user simply continues. If the user then opens an earlier stage's images to inspect them, they are regenerated from their recipes then, and cached on the phone (§8.6).

### 5.4 Manual stages

The user intervenes by adding a manual stage to the pipeline. The manual stages foreseen so far:
- fix the skew angles (`fix_skew`)
- fix the system boxes and bar lines (`fix_layout`)
- fix the metadata (`fix_metadata`) and the observations (`fix_observations`)
- answer the issues and correct the music (`human_review`, after any `apply_review`)

(The stages are listed in §6.)

Rules:
- **One manual stage covers the whole PDF,** however many items are fixed in it. Fixing the boxes on twelve pages is one `fix_layout` stage, not twelve. Otherwise the pipeline shown in the UI would get too long.
- The outputs of a manual stage have `origin = manual` and the corrected output as their parent.
- Edits to images are stored as **replayable operations**, not as edited pixels: skew angles, boxes, bar line positions. Replaying them on the regenerated base image reproduces the edited result.
- Text outputs (analysis JSON, extracted music) are stored edited, with a diff to their parent.
- **Undo exists only inside a tool for manual work** (the tools aren't built yet), while it is open. Leaving the tool saves, and after that nothing can be undone: the stage can only be edited further or dropped (§5.5).
- **A finished stage never changes.** Editing a finished manual stage creates a new manual stage, which starts from the finished state of the old one and takes its place in the pipeline. The old one becomes a replaced stage (§5.5) and stays in storage as it was. The reason is forking (§16): another project's pipeline can use the same stored stage, and it must not change there.

### 5.5 Resuming and re-running
- **The history of a project is linear.** There are no branches inside a project, and no undo.
- Changing something in the middle (e.g. the config of stage N, or a manual stage added there) means running everything after that point again. The later stages are replaced: they leave the pipeline and are no longer shown.
- To keep the old results and try something else, the project is forked (planned, §16), not branched.
- **Any stage that isn't part of the recipe can be dropped:** manual stages, and extra stages the user added, such as a further review. Dropping is a change in the middle like any other: after a confirmation, the pipeline continues from the stage before the dropped one, with the same rules (run mode, reuse where the inputs match). Planned stages can't be dropped.
- **Execution is per item** (a page, a system), with each item's outputs saved as soon as it is done (§5.2).

#### What a re-run follows
A re-run follows **the pipeline as it was, not the standard recipe** of planned stages, for as long as the outcomes stay the same. This is the intended behaviour, not yet a technical definition; the details are worked out when we get there.
- **A stage whose inputs and config are exactly the same is reused,** manual stages included. Example: the composer's name is corrected after a full run that also had a wrong note fixed by hand. Nothing that the note fix depended on changed, so the fix is still there after the re-run.
- **A manual stage whose input changed at all is dropped as a whole** (decided), even if only one page or system of its input changed, and none of its fixes is applied, and the pipeline continues with the planned stages. The typical manual fix is a better deskewing angle or better system crops on a difficult old score. The point of it is that the stages after it then produce very different, better output, which ideally no longer needs the manual fixes that the poor first attempt needed.
- **Stages must depend only on what they really use.** If an `extract` call got the whole metadata as context, composer included, correcting the composer would change the input of every `extract` call, and all of them would be paid for again.
- **Proposed** (§15)**:** after a re-run, the app reports which manual fixes were carried over and which were dropped. Which ones are dropped depends on the outcome of the run, so it can't be said beforehand, and a dropped fix would otherwise go unnoticed.

#### Replaced stages
- **Replaced stages are kept in storage,** with their outputs and full LLM call records (requests and responses). They are reused whenever possible: a stage that runs again with the same inputs and config, or an identical LLM request (§7.2), is served from what is stored and costs nothing.
- **They stay connected to their project in D1,** although the pipeline no longer shows them, so that deleting the project (§4) finds and deletes them too. Until then, a project's storage only grows.

#### Confirmation before a re-run
A dialog asks for confirmation before anything is replaced. The wording still needs polishing, but it must say clearly:
- The pipeline is **overwritten irreversibly**: there is no undo and no branching, so this is a hard rewrite.
- Changing one stage can change, and is likely to change, the rest of the pipeline.
- Wherever the input stays exactly the same, earlier results are reused: LLM calls already paid for are not paid for again, and manual fixes are kept. Everywhere else, calls are paid for again and manual work is dropped.

### 5.6 How the app shows a project
- **The pipeline is the main attraction; the artifact view is secondary.** The usual use is: new project, let it run, take the final MEI and leave. So the pipeline gets the comfortable place on every screen, and inspecting artifacts is what gets less comfortable on small screens.
- **Two layout modes, nothing in between:** wide (from 1024 px, the same breakpoint as the header) and narrow. Resizing a window switches between them on the fly.
  - **Wide:** the **pipeline panel** on the left (project, run controls, the stages), the **artifact view** on the right, much larger. The panel collapses into a narrow strip that shows only an expand button (a chevron, like the one that collapses the panel) and the progress circles below it, "Pipeline" above "Stage", each labelled below and without numbers. "Stage" is only there while a stage runs. The chevron sits at exactly the same height as the one that collapses the expanded panel. The collapsed state is remembered per browser.
  - **Narrow:** the pipeline panel is the only view. Picking an artifact (or a stage's details) opens it over the whole app, with a close button ("x") floating over its top right corner, white on translucent grey. The artifact is in the URL (`#/projects/<id>/artifacts/<artifact id>`), so the back button closes it too, and a reload keeps it open. A stage's details have a URL too (`#/projects/<id>/stages/<stage id>`). After closing, what was open stays selected in the panel, so the user sees what they last looked at (until the page is reloaded or another project is opened).
- **The artifact view has no header of its own,** in either mode: it is the most valuable space on the screen. Which artifact is shown can be seen in the pipeline panel, where it is selected.
- **Progress:** one indicator for the whole pipeline and one for the running stage, **never with numbers**. In the expanded panel, the pipeline's is a thin bar in the panel's head; the stage's is a bar in the running stage's card. The collapsed strip shows both as circles. The pipeline's total is a best guess (a second review round or a manual correction adds stages), and a change only moves the circle a little. A stage is a big chunk of work: doing something to every system is still one stage.
- **Each stage declares its main artifact** (stages can have several). What the artifact view shows in wide mode, unless the user picked something:
  - a new project: the original PDF;
  - when the pipeline finishes: the final MEI;
  - when a project is opened: the latest stage's main artifact.

  Whether the view follows the pipeline while it runs is still to be decided (§15).
- **Built so far:** the pipeline panel as described below, with **mock stages** (`apps/web/src/mockPipeline.ts`): made-up stages and outputs and a simulation of running them, kept in memory only, so a reload starts over. A dashed "Mock" box at the end of the panel can make the running stage fail and reset the mock. The mock is there to design the UI before the stages are real (§15; their schema is in §5.8); its types (`pipeline.ts`) are a first guess at the real data. Only the original PDF is real, shown with pdf.js (its legacy build: the modern one needs browser features many phones don't have yet). The Worker serves the PDF at `GET /api/pdfs/<sha256>/file`. Later: editing in the artifact view.

#### The pipeline panel
- **A small head stays in view,** and only what is below it scrolls: the project's name (one line, shortened in the middle) with its "⋮" and the collapse chevron, then the **run mode** (a small drop-down showing "Auto" or "Manual", §5.1, which takes less room than a switch), the pipeline's progress bar and, in Auto mode only, **Run** (green) or **Stop** (red) while a stage runs. Below the head, scrolling away: when the project was created and changed.
- **The stages are stacked,** first at the top, as cards (rectangles). The original PDF is the artifact of the first stage, **Ingest**, so every card is a stage and every tile in it an artifact. There are no arrows between the cards: a stage's inputs are often not just the previous stage's outputs, and arrows would suggest they were.
- **A card shows:**
  - an icon for its kind (ingest, computed, LLM, manual), its name and a "⋮";
  - one line of facts: the model; once done, also the run time, the cost and a short result ("54 systems", "3 boxes moved, 1 added");
  - while running, its progress bar; when failed, the error;
  - its button, if it has one (below);
  - at the bottom, its **artifacts as tiles,** three per row, each with an **icon for its kind of artifact, never a thumbnail:** at a tile's size no content is recognizable, so a thumbnail adds nothing. (Not built yet: the tiles still show thumbnails for images and for the original PDF, §15.) Artifacts are **grouped logically:** all 54 system crops are one artifact, one tile with "×54", not 54 tiles (§5.2). The first artifact is the stage's main one. Tiles are what gets selected (highlighted in coral), not the card.
- **Stage states:**
  - **done**;
  - **running**: a green border and its progress bar;
  - **failed**: a red border and the error. It can run again;
  - **ready**: its turn has come. It looks like a done card, but without outputs;
  - **planned**: not its turn yet. Only the dimmed title (and the "⋮"), no outputs. It becomes ready, no longer dim, when its turn comes;
  - **WIP**: a manual stage being worked on (below).
  - A "needs you" state for a model asking for human input is left out for now; it will be easy to add (§5.1).
- **Buttons:** in Manual mode, the ready stage has **Run** and, while it runs, **Stop** in the same place. In Auto mode the cards have no Run or Stop: those are in the head. When the stage whose turn it is has failed, Run reads **Retry**, with a circular arrow, in both modes. Stop throws away what the running stage did so far: the stage is marked as stopped and leaves the pipeline. Its LLM calls stay, for the costs and the cache.
- **Manual stages** are added from a stage's "⋮" ("Add: Fix system boxes", whichever fixes fit after that stage). They start as **WIP** (a badge next to the name): the user opens the stage's output as often as they like and works on it, and clicks **Finish** on the card when done. Then the next stage gets its turn. In Auto mode the pipeline carries on by itself; in Manual mode the next stage is ready. A finished manual stage can be edited again ("Edit" in its "⋮"): that continues from where the user left it, not from scratch, but like any change in the middle (§5.5) it replaces the later stages and needs confirming. In storage, the stage being edited is a new one that replaces the finished one (§5.4); the mock still reopens the same stage. There is no "Discard": a manual stage, WIP or finished, is removed with "Drop stage" (§5.5). Undoing single edits belongs to the tools for manual work (§5.4).
- **The stage's "⋮"** holds everything else, so the card stays clean: "Show details", "Change config", "Add: Fix …", "Edit" (manual stages), "Drop stage" (stages that aren't part of the recipe, WIP ones included, §5.5; in red). Only what applies is listed, and while a stage runs only "Show details". There is no "Run again": running a stage again without changing its config only makes sense after it failed, and that is Retry. Whatever replaces stages that already ran asks first (§5.5).
- **Show details** opens the stage in the artifact view: step and version, kind, status, run time, cost, result, its config, and for LLM stages the calls it made with their tokens and costs.
- **Groups are shown as a filmstrip:** the items one below the other with a small gap, scrolling continuously, with a counter in a corner ("12 / 54"). That way the end of one system and the start of the next are on screen together, which helps when checking musical content. `extract` shows each system's crop with its music below it.
- **Auto-scroll:** the list scrolls to the current stage (the first that isn't done) when the project is opened, when an Auto run starts, and whenever another stage gets its turn, in both modes: as an Auto run moves on, and in Manual mode when a stage finishes and the next one becomes ready. The stage is brought to about the middle of the view, or as far up as the list goes when few stages follow it.

- **The menu** (☰, at the far right of the header, after "+ New project") leads to the app's own pages: Statistics (including costs, §10), Settings, Help and About, in three groups separated by lines (what you look at, what you change, help). Each page has its own URL (`#/stats`, `#/settings`, `#/help`, `#/about`) and replaces the project view while it is open, so the back button returns to the project. All but About are placeholders for now (§15). Help will not be a page of its own: it will lead to a user guide, a Markdown file in the repository on GitHub. Anything urgent (the spending cap reached, a missing key) must not hide in the menu: it is shown where the user is.
- **Project actions:** a "⋮" button next to the project's name in the pipeline panel opens a menu of things to do with the project: "Rename", then a line, then "Delete project" in red (`--danger`, kept apart from the coral accent). Deleting isn't built yet (§15): picking it only closes the menu.
  - **Rename** opens a dialog with the name selected. "Rename" stays disabled while the name is empty (after trimming) or unchanged; a name over 200 characters gets a message right away. A name another project has (ignoring case) is refused by the Worker (409) with "A project with that name already exists. Names must be unique (case-insensitive).", and the dialog stays open. The field has no visible label (the dialog's title says it all), only one for screen readers. Both menus share one component (`DropdownMenu`).
- **The About page:** the wordmark (centered), what the app does ("A music transcription tool, driven by vision LLMs, that converts printed scores into MEI, an open, XML-based standard for encoding music notation."), its version (§11), the author (Tomás Silveira Salles), a link to the repository on GitHub, and the license. There is no license yet (§15), so all rights are reserved, and the page says so: the code can be read on GitHub but not copied, changed or shared.
- **Leaving a project loses nothing,** whether for a page from the menu, another project or a closed tab, because manual work is saved as it happens (§5.4). Once editing exists, changes not saved yet are saved or confirmed before the project view goes away.

### 5.7 Look and feel
- **Modern and clean, for desktop, tablet and phone.** Dark theme only for now. A light theme comes later; both must stay high-contrast.
- **Wordmark:** `<score3ly>` in JetBrains Mono, white, with the angle brackets in the accent color. It nods at the source code the app turns music into. It is always on the left of the header, at every width.
- **Accent color: coral** (`#ff7b72`, 8.4:1 on black). It is used for the wordmark's brackets, the "+ New project" button (black text), focus rings, the open picker and the selected pipeline item. Chosen from a set of candidates in a mockup.
- **Fonts:** JetBrains Mono for the wordmark and anything that is code (LilyPond, file names, IDs, times); Inter for interface text. Both are bundled with the app (Fontsource), so no request goes to Google Fonts.
- **Progress is green** (`--green`, `#3fb950`), not coral: bars and circles use `--progress`, which points to `--green`, so changing the progress color is one line.
- **Colors are CSS variables** in `apps/web/src/styles.css` (`--bg` black for the header and side panel, `--surface` near-black for the page, `--accent`, ...), ready for a light theme.
- **Compact mark:** `< >` in the accent color with a white quarter note inside, on a black rounded square (`apps/web/public/icon.svg`). A quarter note rather than an eighth: the flag made the note lopsided between the brackets and is too much detail for a favicon. Besides angle brackets as a tag, `<c e g>` is a chord in LilyPond.
  - It is the favicon, and the icon on a phone's home screen: PNG files in three sizes, listed in a web app manifest. `npm run icons` makes the PNGs from the SVG. They are committed, so after changing the icon the command has to be run again (with `-- --force`, since it doesn't replace existing files otherwise).
  - The icon is a separate image and can't use the app's CSS variables, so its accent color is a copy, named `.accent` in the SVG. A test checks that it matches `--accent`.
  - The manifest doesn't set a display mode, so the app opens from the home screen as a normal browser page.
- **Project and file names are never cut off at the end.** They wrap over up to three lines wherever there is room (the picker's list, the dialogs, the pipeline panel); a name with spaces breaks between words; a name without any (typically a file name) fills each line and breaks wherever it ends, since breaking early at a hyphen wastes most of a line. Only the picker's field in the header is a single line. A name that needs more lines than it may have is shortened **in the middle** ("villa-lobos_bach…prelude.orig (1)"), because names on the same PDF differ at the end, and hovering then shows all of it. This works the same with a mouse and on touch: the full name of the open project is one tap away, in the picker's list. The browser can only cut text at the end, so one component (`FittedText`) measures and shortens.
- **Dates, times and numbers have one fixed English format everywhere.** They don't follow the browser's language or region: the interface text is English, and a browser's idea of the locale often differs from the user's.
  - **Dates:** day and the month's short name, "7 Oct", plus the year when it isn't the current one, "7 Oct 2025". Never all-numeric, which is ambiguous between day-first and month-first. The day is the device's local one.
  - **How long ago:** compact, "20min ago", "5h ago", "2d ago".
  - **Money:** US dollars with two decimals, "$0.12" (§10).

### 5.8 The database
The D1 schema for the pipeline (decided; built in `apps/worker/migrations/0003_pipeline.sql`, which has the columns and their comments). Artifacts have no table: a step's code defines them as views over its outputs (§5.2), and an artifact that is stored for convenience (the MEI file) is an output for the whole score.

| Table | One row per | Holds |
|---|---|---|
| `projects` | project | Besides §4: the run mode (§5.1), a version for optimistic locking (§4), the number the next issue gets (§6, "Issue ids"), the PDF's page count (statistics, §10), `deleted_at`. |
| `pipeline_entries` | stage in a pipeline | Project, position (1, 2, 3, ... without gaps) and the stage. Nothing else: the pipeline is a list of pointers. |
| `stages` | stage, planned ones included | The project it was created in, the step and its version, the status (`planned`, `running`, `failed`, `done`, `wip`, `stopped`), the step's config, the model config (LLM stages), the stage key, error, a short result, the stage it replaces (an edited manual stage, §5.4), times, a heartbeat, `deleted_at`. |
| `stage_inputs` | input of a stage | The outputs a stage read. |
| `outputs` | item a stage produced | The stage, the item, the type (`pdf`, `layout`, `lens`, `mei`, ...), the content's hash (stored, in R2) or the recipe and its key (computed), the corrected output (manual), the call that produced it (LLM). One per stage, item and type. |
| `output_inputs` | input of an output | The outputs an output was made from (§5.2). |
| `llm_calls` | LLM call | The stage, the model config, the request key, the model the response names (`response_model`), the full request and response (in R2), the status (`running`, `ok`, `error`, `unparseable`, `refused`, `cut_off`), the error, tokens (output tokens include thinking: Gemini reports thinking apart, and its adapter adds it), the cost, times, `deleted_at`. |
| `model_configs` | version of a model config | Optional name, provider, model, effort, plain parameters (region, project), secrets as `{field: secret name}` (Bedrock with a key pair needs two), the free-tier mark, the row it supersedes, `deleted_at`. Append-only (§7.2). |
| `image_fingerprints` | image sent to a model or worked on by a person | Its recipe key, its PDF, and the fingerprint (§8.3): dimensions, the hash of the raw pixels, the thumbnail. |
| `settings` | user setting | A key and a JSON value. |

- **Planned stages have a row** (status `planned`), so all there is to know about a stage lives in `stages`, and a pipeline entry is only a pointer. A planned stage is unfinished, so it may change: its config is NULL while it takes the settings' choice (§7.2), or what the user picked for it. When it starts, its config is the resolved one (what it actually used), and its version and stage key are set. "Ready" isn't stored: it is the first planned stage after the done ones.
- **The kind isn't stored:** it follows from the step, declared in code (§5.1). A step's kind never changes, which a unit test guarantees (§15).
- **Stages are shared, not owned by a pipeline.** A fork (§16) copies the pipeline entries up to its stage, and the issue counter, and no stages or outputs. `created_in` says which project a stage was created in.
- **Item names:** `''` for the whole score, `p3` for page 3, `p3/s2` for the second system on page 3. A system's number in the whole score (system 17) is derived, not stored.
- **A manual stage has an output for every item** of what it corrects, not only for the items changed: an unchanged one points to the same content (the same hash, so nothing is copied in R2). The next stage's inputs are then simply the outputs of the stages before it, with no falling back to an earlier stage per item.
- **Running a stage:** resolve its config and inputs and compute the stage key. If a stage that is done and not deleted has that key, the entry points to it and nothing runs. Otherwise the stage runs, each item first looks in the cache (`llm_calls` for an LLM request, a successful call with the same request key that isn't deleted; the device's image cache for an image), and each output's row is written as soon as it is done.
- **Retry** runs the failed stage again in the same row: the items already saved stay, the missing ones run.
- **Stop** marks the stage `stopped` and takes it out of the pipeline. Its outputs are deleted; its calls stay, for the costs and the cache.
- **A change in the middle** (§5.5) points the later entries to new planned stages, each with the config of the stage it replaces (a re-run follows the pipeline as it was). The replaced stages stay as they are, for the stage key to find; a dropped manual stage's entry is removed.
- **An interrupted run** (a tab closed mid-stage) leaves a stage `running`. A running stage writes a heartbeat regularly; one whose heartbeat is older than about a minute counts as interrupted, and is resumed like a failed one.
- **Progress isn't stored:** only the device that runs a stage knows it (§5.1). Another device sees the stage running, without a bar.
- **Deleting a project** (§4) marks rows instead of deleting them, for the costs and statistics, and every cache lookup ignores marked rows (partial indexes `... WHERE deleted_at IS NULL`). Marking in the rows, rather than filtering every lookup by the projects that aren't deleted, keeps the rule in one place. When project P is deleted:
  - a stage is marked if no other project that isn't deleted has it in its pipeline, and it was created in P or in a project already deleted. A stage a fork still uses stays, and is marked when that fork is deleted; a stage created in a project that isn't deleted is never marked;
  - the calls of a marked stage are marked with it;
  - the outputs of marked stages, the content of stages and calls that nothing else uses, and the fingerprints of a PDF nothing else uses are deleted (§4).
- **Two kinds of settings:** the user's, in the `settings` table (the default model config, the run mode for new projects, the spending cap, ...), and the device's, in the browser (`localStorage`), for what may differ between a phone and a laptop: screen size, touch or mouse, bandwidth. The collapsed pipeline panel (§5.6) is the first device setting.

## 6. Pipeline stages

### The stages

Stages marked **[manual]** are optional and added by the user (§5.4). The last column lists each stage's artifacts, what the user sees (§5.2); its outputs are finer, e.g. one per page or per system. Everything else is the recipe. Each stage has a short identifier, used throughout this document.

| # | Id | Stage | Kind | Artifacts |
|---|---|---|---|---|
| 1 | `ingest` | Ingest | ingest | The PDF (R2) |
| 2 | `rasterize` | Rasterize | computed | All page images, as one artifact. Not stored: reproduced from the config (§5.3) |
| 3 | `skew_analysis` | Skew analysis | computed | JSON: per page, the skew angle, the staves found, and whether the page is to be rotated (§8.4). No rotated images |
| 4 | `fix_skew` | Fix skew angles **[manual]**, after `skew_analysis` | manual | JSON as in `skew_analysis` |
| 5 | `layout` | Layout | LLM | JSON: the structure: per page, the system boxes and the positions of the bar lines in each system |
| 6 | `fix_layout` | Fix system boxes and bar lines **[manual]**, after `layout` | manual | JSON: the structure, as in `layout` |
| 7 | `analyze` | General analysis | LLM | JSON: metadata. JSON: observations per page and for the whole score (including the special bar lines) |
| 8 | `fix_metadata` | Fix metadata **[manual]**, after `analyze` | manual | JSON: metadata |
| 9 | `fix_observations` | Fix observations **[manual]**, after `analyze` | manual | JSON: observations |
| 10 | `extract` | Extraction | LLM, per system | The score so far, system by system (each system's answer in the internal format: the music, the stretches' classification). The issues raised (see below) |
| 11 | `assemble` | Full MEI | computed | The MEI file. Its rendering as a PDF. All issues combined into one JSON. The warnings (see "Warnings") |
| 12 | `review` | Review | LLM, per system | JSON: the issues, updated |
| 13 | `apply_review` | Apply review results | LLM | The MEI file, the new rendering, the issues with what was applied, and the warnings |
| 14 | `human_review` | Human review **[manual]**, after any `apply_review` | manual | JSON: the issues, updated. An `apply_review` is added after it automatically |

- **No manual fixes of the music before the first review.** The first point where the user corrects the music is `human_review`.
- **The recipe has exactly one review** (`review`, followed by `apply_review`). **Further reviews** can be added by hand after it, as many as the user wants, with the same or another config. Adding a review, by hand or after a human review, always adds its `apply_review` after it.
- **Manual stages after an LLM stage** are added from its "⋮": `fix_layout` after `layout`; `fix_metadata` and `fix_observations` after `analyze`, in any order.
- **Two stages read the pages** (decided): `layout` finds where things are, `analyze` says what they are. `analyze` runs after `fix_layout`, so it sees the final layout: code draws the systems and bar lines on each page, numbered, and the observations refer to those labels. Each has its own model config (§7.2: finding layout boxes, extracting metadata), and a better prompt for one doesn't re-run the other. The price is that every page is sent twice, small next to one `extract` call per system.
- **No skeleton stage** (decided; an earlier draft had one, an MEI file with a placeholder per measure). What it was for (a fixed structure, assembly as filling in, a check that the extraction returns exactly the measures asked for) needs no stored MEI: code builds the MEI frame from the structure whenever it is needed (see "MEI" below).
- **A stage exists where there is a config or a decision** (decided). A pure function of other stages' results is a view, not a stage. So there is no skeleton stage (above), and no stages for the straightened pages or the crops: the angles and boxes are decisions of other stages, and rotating and cropping are fixed operations (§8.2). Those images are computed when something needs them (a view, an LLM request) and cached on the device (§8.6); stages wouldn't add anything but cards in the pipeline and a second copy of every page on the device. They are shown as views of other stages' outputs: `skew_analysis` and `fix_skew` show the pages straightened, as they will be sent; `extract` shows each system's crop with its music below it (the filmstrip, §5.6). `rasterize` stays a stage: its config (the resolution for vector pages, perhaps colour or grayscale, §15) changes every image after it, and its pages are the natural first view.
- **The structure is final before `extract`.** The structure is what decides which pixels the models see: the skew angles (`fix_skew`), where the systems are on each page and where the bar lines are on each system (`fix_layout`). `extract` is shown system crops and stretch crops, and if it is shown the wrong part of the page, no model can make up for it. So every fix of the structure comes before `extract`, and no later stage changes it; a mistake in it found later is fixed by going back to `fix_layout`, which replaces everything after it (§5.5). The pieces or movements (`fix_metadata`) are fixed before `extract` too: the MEI's sections and the numbering restart with them.
  - **Everything else is content,** read by `extract` and open to correction by the stages after it: how the stretches between bar lines form measures, the kinds of measure and of bar line, and so which measures exist and how they are numbered; and the `scoreDef` (clefs, keys, time signatures, staff labels and groups). Those are hard for a model to get right from a whole page (the stretches need the note durations read), and easy to correct later, now that no MEI is built in advance. A user of an automated app shouldn't be asked to transcribe them by hand before anything is extracted.

#### Details per stage
- **`fix_skew`.** The user flips through the pages with arrows (no continuous scroll). Per page: a toggle that turns deskewing on or off, and lines drawn by clicking where their two ends should be, along the staff lines. Code computes the angle that makes those lines as horizontal as possible. A very small angle still means no rotation, but an angle set by hand may be larger than the 5 degrees allowed otherwise (§8.4). Still needed: deleting a line, moving its ends, and how all of this works on touch devices.
- **`layout`.** Per page:
  - whether the page is severely skewed;
  - a bounding box per system (none on a page without music), as fractions of the image's width and height: an object with `left`, `right`, `top` and `bottom`, each from 0 to 1. **This is our format for every box** (systems, issues, zooms, crops), not a provider's (Gemini's native one is a 0–1000 list): fractions don't depend on how a model shrinks the image internally, and Claude returns them reliably. Boxes may overlap, so that nothing is missing from a crop. The model can call a tool that shows the page with its boxes drawn in colour, and adjust them, at most 3 rounds; if it still isn't satisfied, it flags the page for human review and returns its best guess;
  - per system, the positions of its bar lines (see "Bar lines, stretches and measures" below), with the same tool and rounds as for the boxes.
  - **No classification of pages** (cover, empty, music, other; decided): nothing is done differently by kind of page. Metadata is read from every page (publishing details may be on a text page inside the book, the pieces and movements are on the music pages), and a page without music is simply a page without systems.
- **`analyze`.**
  - **Per page,** with the final layout drawn on it (systems and bar lines, numbered):
    - metadata, where the input can include what earlier pages gave, so that the model only updates it (as a full JSON or a JSON patch);
    - high-level musical information: number of staves, the probable instrument of each staff, voices per staff, time signatures, key signatures, clefs, 8va and the like (for all of these also where and how they change), large-scale dynamics such as crescendos, melodies that seem to repeat in other places, repeats, "da capo" and the like, parts, movements or pieces, and the general style (e.g. baroque);
    - **the special bar lines** only (double, final, start repeat, end repeat, dashed; an ordinary single bar line is not listed), as part of the observations: the repeats are part of the score's global structure.
    - **Locations are local,** e.g. "page 7, system 3, bar line 4", using the labels drawn on the page: a miscounted system on another page or a miscounted bar line in another system can't make them wrong.
  - **Per project:** all pages in a small format, with what the per-page part found, to get observations across pages that help the extraction later, such as melodies that repeat on other pages: a smudged note on one page may be read because the passage repeats a theme from a page that was read without problems.
  - **No content boxes** (decided, until there is evidence they would help). The idea: `analyze`, or a stage before it, finds the box of the content on each page, and most of the analysis runs on content crops. The scenario for it: old paper with an ornate frame around every page, the model's systems and bar lines are nonsense on all of them, and the user has to fix 22 pages of boxes, after which `extract` reads the music fine; with content boxes, the user would fix one box per page and the model would do the rest. Against it: another box per page, another set of images, another stage and more LLM calls, and so far Opus has found systems well. Testing the finished pipeline on Kinderscenen (§15) shows whether the scenario happens.
- **`fix_metadata`.** A form from the start, not a JSON editor: the metadata is small and fixed, its Zod schema exists anyway (§3), and typing JSON on a phone is miserable.
  - **Sections with headers:** titles, people, the work, pieces or movements, the edition. Titles, people and pieces are lists, with rows to add and remove and a dropdown for the type or role.
  - **The page each field was found on** is shown next to it ("p. 3"), as a link that opens the page, for checking.
  - **What the user enters is the truth.** Its page stays as the model gave it, and may no longer fit (the model may have read the wrong page); that is fine, since the pages aren't used by any later stage.
- **`fix_layout`.** The system boxes and the positions of the bar lines, nothing else (the rest is content, above). A page's systems can be removed altogether, or drawn on a page where `layout` found none.
  - **Boxes:** each has its own colour, cycling through 7 that colour-blind people can tell apart (e.g. Okabe–Ito without its black), and a small label in its colour at a corner. One box is selected: opaque, thicker, with handles; the others are dimmed but visible, since the overlap with the neighbouring systems is what the user is checking. Outlines only, no fill, which would hide the music. Tapping a box selects it; tapping again where boxes overlap selects the next one under that point; tapping a label always works.
  - **Bar lines** belong to a system and span its box from top to bottom. They are dragged sideways only; a new one is placed by a single tap inside the selected system, at that x.
  - **A toolbar, not a context menu:** "+ System", "+ Bar line", "Delete" (enabled while something is selected), outside the zoomed page. On touch, a long-press would compete with moving a box and with the start of a pinch or a pan, and right-click doesn't exist; the buttons also give the gestures their meaning: normally a drag on empty page pans, after "+ System" the next drag draws a box, after "+ Bar line" the next tap places a line. On desktop, shortcuts as well: Delete or Backspace removes, Escape cancels, arrow keys nudge.
  - **Our own component, not a package:** an SVG layer over the page image (rectangles with handles, lines, labels, in our fractions, with pointer events for mouse, pen and touch), inside a small zoom-and-pan library such as `react-zoom-pan-pinch`, since pinch-zooming a large page on a phone without confusing it with dragging is the hard part. Ready-made annotation tools (Annotorious, the closest) handle rectangles and polygons but not bar lines bound to a system, nor our look; canvas toolkits (Konva, Fabric.js) would still leave the interaction to us. The same component serves `human_review` (boxes for issues) and the lines along the staves in `fix_skew`.
- **`fix_observations`.** At first by editing the JSON. Later the observations could be shown as a Markdown document that the user edits as formatted text. That Markdown could be a further artifact of `analyze`, or of a tiny stage after it, and `fix_observations` would then edit the Markdown. Worth building early although it is a nice-to-have: it changes the list of stages and the kinds of artifact.
- **`extract`.** One call per system, with:
  - the system crop and its stretch crops, the stretch crops with generous margins (e.g. half a measure on each side), so that a slur crossing a bar line shows where it ends (in the manual run, with 25 px margins, every missed slur crossed a bar line or a system break);
  - the crops of the previous and the next system;
  - the observations from `analyze` (or `fix_observations`);
  - the stretches it must classify and fill, and the special bar lines and the staves `analyze` saw, as a starting point;
  - whether the previous system's extraction ended with a measure that continues into this system;
  - the marks left open by the previous system (slurs, ties, hairpins, 8va, pedal, per staff and voice), worked out by code from its extraction (see "Loose ends across systems" below);
  - the state the system begins with (clefs, keys, time signature), carried by code from the previous system's extraction;
  - later, zoom crops on request (see "Zooming in" below).

  The model classifies each stretch (see "Bar lines, stretches and measures"), extracts the music printed in each stretch, says whether the system's last measure continues into the next system, corrects the bar lines' kinds and the `scoreDef` where needed (the starting clefs, keys and time signatures, the staff labels and groups), and reports its doubts as issues. **It can't add or drop a stretch:** code rejects an answer that doesn't cover exactly the stretches asked for. **The extraction is stored per stretch** (its classification and its music), not per measure: stretches are fixed structure, so two versions of an extraction always match stretch by stretch, however the measures were regrouped (`apply_review`); code joins a measure's stretches into one MEI measure. **Each system's answer is checked as soon as it arrives,** not at the end: if the model can't handle the score, that shows early, and an hour of calls isn't paid for answers that turn out not to parse. It tells the user to step in earlier in the pipeline, or to use a stronger model.
  - **Models write music as a subset of LilyPond, wrapped in JSON** (decided), never MEI: code builds the MEI. So MEI's schemas are checked in our tests, as a check on our converter, not at run time (see "MEI").
  - **Checks after each system's answer,** on the system alone (code wraps it with the running state where needed):
    - **parsing:** the answer is valid JSON in our schema, and its LilyPond parses;
    - **durations:** each voice in each measure, its stretches joined, adds up to the time signature (incomplete and unmeasured measures excepted);
    - **the stretches** are exactly the ones asked for.
  - **First version: a single turn per system** (decided), no follow-up rounds. A duration mismatch becomes a warning (see "Warnings"), which `review` sees, and the stage goes on. An answer that doesn't parse (the JSON itself is guaranteed by the provider's schema-constrained output, the LilyPond inside it isn't) **stops the run there** (decided): the stage fails, and the rest of the score isn't extracted. The answers so far stay in the cache, the broken one doesn't (§5.2). The card shows the stage as failed, with Retry, and an error that says exactly what happened, e.g. "Couldn't parse the answer for system 17. The answers for systems 1–16 are kept." A retry is an ordinary run of the stage, with the cache used exactly as in any run: with the same config, systems 1–16 come from the cache and the requests start again at system 17; with another model config, nothing matches and every system is asked again.
  - **Later, perhaps: a failed check goes back to the model** in the same call, with the place and the problem, as one more round of the conversation, with a configurable cap: most slips might be fixed for the price of a short follow-up. Whether it pays off over `review` seeing the warnings is measured then.
  - **Loose ends across systems are matched by code** (decided), from the lens alone; the model lists nothing extra:
    - code parses each system's answer and finds the marks still open at its end: slurs, ties, hairpins, 8va, pedal, per staff and voice;
    - the next system's request says what is open ("slur 2 in staff 1, voice 1 continues from the previous system"), as it says whether the last measure continues; the model closes it on the note where it ends. The lens allows a closing mark without an opening one at the start of a system, where the request says it is open, and an opening mark left open at the end of a system;
    - code matches both sides: what was left open must be closed in the next system, or still be open for marks that can run longer (8va, pedal). `assemble` checks the whole score;
    - **ties:** on the page, a tie and a slur are the same kind of curve, and what makes one a tie is that it joins two neighbouring notes of the same pitch. In the lens the model has already decided which it is (`~` or a slur), so code checks that decision against the pitches it wrote: a tie whose next note has a different pitch means a misread pitch or a slur written as a tie, and becomes an issue raised by code ("is this curve a tie or a slur, and are both notes the same pitch?"). It is a check of the extraction's consistency, not of the truth, like the duration check; across a system break it is the only one, since the two notes are in two calls. **A tie to nothing,** "let ring" (*l.v.*, common in piano music, e.g. an arpeggio held with the pedal), has its own notation in the lens (e.g. LilyPond's `\laissezVibrer`), so it isn't taken for an open tie;
    - a mismatch becomes an issue raised by code, with boxes at the end of one system and the start of the next ("where does this slur end?"), within the 2-system rule;
    - what code can't catch is a slur ended too early on both sides (m31→32 in the manual run): the pairing looks consistent. That is left to `review`'s attention to spanners.
    - The number of voices isn't matched: it changes from measure to measure, and is content.
  - **No list of long marks in advance** (decided; Claude's suggestion in the manual run): `extract` sees the whole system, closer than `analyze` does, plus the neighbouring systems and the marks left open, so planning ahead is a line in its prompt, not an extra pass. Instructions that aren't marks with two ends ("sempre staccato", "simile", "con pedale", "cresc. poco a poco" over a long passage) are in `analyze`'s observations already.
  - **The prompt,** besides what is musical (see "Musical content and typesetting"), carries the lessons of the manual run (§13):
    - **Doubts as alternatives with evidence for each** ("dot near the A♭: staccato or smudge?"), raised as issues, not decided silently. In the manual run, 6 of the 11 errors were at least partly in the model's list of doubts, so a review that gets them sees them for free.
    - **What comes from the previous system is a hint, not ground truth:** whether its last measure continues, the marks it left open, and the state carried by code are the current best guess, given to help. Where the page clearly says otherwise, the model trusts its own eyes. A mistake in one system then doesn't spread to the next, and it doesn't go unnoticed either: code compares both sides and raises an issue on a mismatch (above, and "Bar lines, stretches and measures").
    - **Plan ahead within the system:** follow every long mark (slur, hairpin, 8va, pedal) to its end before writing it down.
    - **Read first, compare afterwards:** a stretch is transcribed from the image before any supposed repeat is looked at; the differences from the repeat are then things to look at again, never a reason to copy (m13 was copied from m9 because of a hint, and was wrong).
    - **No unprinted tuplets:** if the durations don't add up, read again; if they still don't, raise an issue (an invented note in m9 produced an odd rhythm, which was "fixed" with a tuplet that isn't printed).
    - **A checklist per note:** accidental, dots, accents, fingering, where slurs start and end.
    - **Telling marks from smudges** is the hard part, not keeping or dropping marks by default: "keep every printed mark" was rejected, since several of the model's omissions were right (a stray dot in m2, a dot beside a note in m15).
- **The checks by code have no stage of their own:** validation happens inside `extract` and `assemble`. Problems that code finds without failing the stage are issues raised by code when they are a question about the page (a slur that never ends: "where does it end?"), and warnings otherwise (a measure whose durations don't add up; see "Warnings").
- **`assemble`.** Code builds the MEI frame from the structure and the metadata, inserts the snippets, validates the whole document, renders it, and combines the issues of all systems.
  - **The rendering** (Verovio) can follow the original's layout or not: its `breaks` option `encoded` uses the page and system breaks in the MEI (below), so the rendering has the same systems as the original and the two can be compared system by system, as in `human_review`; `auto` computes its own breaks for the page size and ignores the encoded ones.
- **`review`.** One call per system, with the same input as `extract`, plus the extraction and the issues of the whole score. The model reviews the extraction, changes the chosen answers of unresolved issues, and adds an issue for every correction it wants; such an issue has at least two answers, the present state and the one the reviewer thinks is right, and possibly other reasonable ones. Zoom crops and the crops of other systems on request (see "Zooming in") come in a later version. **The review doesn't change the MEI and doesn't propose patches:** issues are its only output. **Its prompt names the common mistakes** to pay attention to, foremost slurs and other spanners crossing bar lines and system breaks (every missed slur in the manual run, §13; no separate tracing pass).
  - **The whole score goes into every call** (decided), so the model can check consistency across the score. It is sent in the compact format the models write the music in (the "lens", `extract`), not as MEI.
  - **Each call sees what the calls before it in the stage changed,** and the cost stays close to linear in the score's length, by prompt caching. A call's prompt is, in this order:
    1. the whole score;
    2. the issues as they were when the stage started, and the warnings of the version being reviewed (see "Warnings"); each call is also told which warnings touch its own system, and its crops show the part of each warning's box that falls on them;
    3. the changes made by the stage's earlier calls, one entry per change, in the order of the calls (e.g. "review of system 7: chose answer 2 for issue 12", or a new issue). Entries are only ever appended, never rewritten, like `choices` in an issue;
    4. the system's own part: its crops, its extraction, the neighbouring systems' crops.

    Parts 1 to 3 of a call are the start of the next call's prompt, so with a cache breakpoint at the end of part 3 each call pays the full price only for the entries added by the call before it, and the rest is read from the cache. Without the append-only log, every change to the issues would break the cache, and the cost would grow with the score's length times the number of issues, which is itself roughly proportional to the length. The calls run one after another (§10), so the cache stays warm between them.
- **Renderings** (decided): `assemble` renders the MEI for people, for the side-by-side view in `human_review`. Models don't get renderings, at first: `review` compares the crops with the extraction as text (the LilyPond subset), as in the manual run (§16 step 3), and `apply_review` changes text. Whether a rendering of the system next to its crop helps `review` is measured later on the test set (§15); if it does, it becomes the default and can be turned off in `review`'s config. A rendering can mislead in its own way: differences of engraving (spacing, stem directions, Verovio's own choices) look like errors to a model comparing pictures.
- **`apply_review`** (decided):
  - **Which issues:** those that need applying (below). Systems with none aren't called.
  - **One call per system where at least one such issue begins** (its first system), applying all issues that begin there. The call's window is that system and, for an issue that reaches it, the next one (an issue spans at most 2 consecutive systems, see "Issues"). Calls run in score order; each sees the earlier calls' changes through the append-only log, so a system changed by one call is up to date when the next call's window includes it. Chained issues (systems 1–2, 2–3, 3–4, …) are applied one call each, and no window is ever larger than 2 systems.
  - **Input, laid out like `review`'s calls so the cache works the same way:**
    1. the whole score in the LilyPond subset, as it was when the stage started (the same bytes as `review`'s prefix, so right after a `review` even the first call may read it from the cache);
    2. the append-only log of what the stage's earlier calls changed;
    3. the call's own part: the crops of its window (systems and stretches, clean and with the issues' boxes drawn), its current extraction (per stretch, with the continuation flags), the issues to apply (question, location, boxes, chosen answer, the stretches under the boxes), the other issues on those systems, which are not to be changed, and the extraction of the systems just before and after the window.
  - **Answer: only the stretches it changes,** each in full, in exactly `extract`'s per-stretch format (classification and music), plus continuation flags and `scoreDef` changes where they change. Nothing unchanged is copied, so nothing can be miscopied or hallucinated there, and it isn't a custom patch language: a stretch is replaced as a whole. **Merging and splitting measures** are a changed classification ("these two stretches are one measure": the second goes from "new" to "continues"), so they are first-class without anything extra, and nothing but regrouping the fixed stretches is possible.
  - **Per issue, a boolean:** applied or not. If applied, `applied` becomes the chosen answer; if not, it stays, and the model's reason (e.g. the chosen answer contradicts what is printed) is shown to the user.
  - **Changes beyond the boxes:** the model may also change stretches of the systems just before and after its window, not only those under the boxes of the issues it applies, e.g. when an issue says a slur doesn't end at the box but continues into the next system, whose start then changes too. Every stretch changed outside the boxes comes with a reason. A change without one goes back to the model once; a change with one is accepted and becomes a warning, so a person sees what changed beyond the boxes and why.
  - **Checks:** those of `extract` (parsing; durations of the affected measures; continuations consistent across systems), handled as in `extract` (a single turn in the first version); then the comparison before and after (below). Code then rebuilds and renumbers the measures, choosing the 0-or-1 start anew.
  - **Model config:** the same kind of work as `extract` (§7.2: extracting the music notation).
- **`human_review`.** The user picks another answer for an issue, or writes one that isn't in the list ("none of these, but ..."). The user also adds issues of their own to correct something no model raised.
  - **The warnings of the version being reviewed** are shown too (see "Warnings"). The user never sees MEI or LilyPond.
  - **The screen:**
    - **Two panels at most,** side by side or stacked as in the evaluation viewer (§13): the original on the left or at the top, the rendering of the current extraction on the right or below. Zooming is a must. The side-by-side view is mainly for finding problems nobody raised; resolving an issue mostly needs only the original, since issues are about what is hard to read on it.
    - **No list of issues:** the boxes of all issues sit on the original, dimmed, and can be clicked. The selected one is no longer dimmed, and a panel with the issue (its question, location, answers, choices) covers the rendering panel; the original stays visible. Closing it dims the box again. Where the rendering is needed, the panel is opened and closed as often as needed.
    - **Warnings use the same UI:** their boxes are on the original too, in their own style (e.g. dashed, a warning colour); their panel shows the explanation, with nothing to answer. The rendering matters more for warnings than for issues.
    - **Arrow buttons** go from one box to the next (issues and warnings, in score order), scrolling the original to it, with the panel staying open.
    - **The original can be hidden,** to look at the rendering alone, and **the boxes can be hidden,** to see the original cleanly.
    - **A "⋮" menu** takes over once the toolbar gets busy: show or hide the boxes, show or hide the original, create a new issue. Creating one: the next drag on the original draws a box (the box tool of `fix_layout`), and the panel opens with the new issue, whose answer the user writes; boxes can be adjusted or added while it is open, within the 2-system rule.
    - **Scrolling and zooming are linked** between the two panels by default, with a small button to unlink them. Verovio's engraving won't match the original's heights and spacing (staff size, distances between staves and systems, room for titles, lyrics and dynamics), even with options such as `spacingSystem` and `spacingStaff`; widths can come close, rendering each page at the original page's width. But with the encoded breaks, systems correspond one to one, and both sides have their systems located (the original from the layout, the rendering from the system elements of Verovio's SVG). So the link maps positions system by system, piecewise linear (40% into system 12 on one side is 40% into system 12 on the other, gaps interpolated alike), and the zoom is linked so that the same system has the same width on both sides. Re-linking aligns the rendering to the original.
  - **Every correction is applied by `apply_review`,** an LLM call (decided). Applying answers by code doesn't work in general: a measure can have several issues, and an answer would have to come with a replacement for every combination of answers; and many corrections reach beyond one measure ("this slur continues the one in the previous system" touches two systems, perhaps two pages).
  - **Code checks what `apply_review` did:** it compares the extraction before and after, **stretch by stretch** (not the MEI by measure: measures can be merged or split, stretches can't), the rendering highlights the measures whose stretches changed, and a changed stretch outside the boxes of the issues being applied needs a reason and is flagged (see `apply_review`). The stretches of an issue are the ones under its boxes (see "Issues" below).
  - **So `applied` is what the model says, checked only roughly by code.** A model's account of what it did isn't reliable (§13, "The manual run").
    - **Code catches,** as warnings: a missing change (an issue said to be applied, whose stretches didn't change; its `applied` stays as the model said, since the extraction may already have matched the answer), a change beyond the boxes (above), and a change where none was due (the chosen answer is the present state).
    - **Code can't tell** whether the change is the chosen answer: the right stretch changed the wrong way passes. Where several issues share stretches, a change can't be credited to one of them.
    - **The answer itself** can only be verified by a model or the user looking at the result, e.g. in a later review.
  - **No editing of the source and no replacing it by an upload** (decided, for now). Either would make the issues unreliable: after a direct edit, nobody knows which answer of each issue the MEI reflects. A "final touches" stage is an optional item for late in the roadmap (§16).
  - **Adding a correction:** the user drags one or more boxes on the original score (easy on touch devices too) and writes the correction as free text ("this should be a C flat"). It becomes an issue like any other (below).

#### Metadata
What identifies the score, in the narrow sense: the layout (systems, measures, boxes) and the musical observations are separate artifacts of `analyze`. Every field is optional, holds **only what is printed** (as printed), and notes the page where it was found. Models know famous works and would add an opus number or a composer's dates from memory; that can't be checked against the page, and the user can add it in `fix_metadata`.
- **Titles:** a list of `{ text, type }`, the type one of main, subtitle, alternative, translated. Title pages often give the title in several languages ("Kinderscenen / Scènes d'enfants").
- **People:** a list of `{ name, role, printed role }`, the role from a fixed list (composer, arranger, editor, lyricist, librettist, translator, other), the printed role as worded on the page ("Revidiert und mit Fingersatz versehen von …"), which rarely maps exactly. Any role can have several people.
- **Opus or catalogue number** (e.g. "Op. 15", "BWV 846"), **dedication**.
- **Instrumentation** as printed, e.g. "für Klavier zu vier Händen".
- **Pieces or movements:** for each, its title or number as printed and the page where it starts (Kinderszenen has 13).
- **Edition:** publisher, place, year, plate number, copyright and other notices.

**In MEI's header** (`meiHead`), which follows library cataloguing and separates the abstract work from the printed edition, code fills:
- **The work** (`workList/work`): the titles as repeated `<title>` elements with `@type` (`main`, `subordinate` for a subtitle, `alternative`, `translated`); the people as `<composer>`, `<arranger>`, `<lyricist>`, `<librettist>`, `<editor>`, any other role as `<persName role="…">` in a `<respStmt>` (MEI 5 also has generic `<creator>` and `<contributor>` with a role); the catalogue number (`identifier`), the dedicatee, the instrumentation (`perfMedium`, structured), and the pieces (`componentList`, matching the `mdiv` sections of the music).
- **The printed edition** (MEI 5: `manifestationList/manifestation`; earlier versions: `fileDesc/sourceDesc`): publisher, place, date, the plate number (`physDesc/plateNum`), and possibly a transcription of the title page as printed (`titlePage`), which keeps the printed wording of everything above.
- **How the file was made** (`encodingDesc/appInfo`): score3ly, its version (§11), perhaps the models used: provenance in the file itself.

To check against the MEI 5 guidelines: the details of the edition's description, which changed in MEI 5.

#### MEI
**The export format is full MEI 5, close to MEI Basic** (decided): as simple as possible, focused on the musical content. The music uses only what MEI Basic allows; a few features of full MEI are used where needed, each a deliberate decision, listed in one place in the code (below) and explained in our documentation.
- **Divisions:** an `mdiv` per piece or movement, labelled and linked to its entry in the header's `componentList`; an anthology of several works has an `mdiv` per work, with an `mdiv` per movement inside. (MEI's `<parts>` is something else: separate part books, one per player, which we don't produce.)
- **Each division's `<score>` begins with a `scoreDef`:** the staves (`staffGrp`, `staffDef`) with their labels and instrument names as printed, and each staff's starting clef, key and time signature. It declares **every staff that appears anywhere in the division,** e.g. a third staff in one passage, an ossia staff; a measure leaves out the staves it doesn't have. Groups nest: the Mozart concerto in the test set, with two pianos (I and II) of two staves each, is one score with two braced `staffGrp`s labelled "Piano I" and "Piano II" inside the outer one, staves 1 to 4; not parts.
- **Measures:** measure → `staff` (numbered as in the `staffDef`s) → `layer` (a voice) → notes. Code writes each measure's frame, from the classification of the stretches: its number (`@n`), `@metcon="false"` for an incomplete one, the bar lines' kinds (`@left`, `@right`), its zones (`@facs`, below) and one `staff` per staff present on its system. `extract` fills the layers: how many voices a staff has changes from measure to measure, and is content.
- **The original's layout** is kept with page and system breaks (`<pb/>`, `<sb/>`) between measures. Renderers can ignore them (see `assemble`). A measure split across systems is the awkward case.
- **`facsimile`** (decided, a feature of full MEI): zones on the page images, and each measure linked to its zone (`@facs`), or to several when it is split across systems. The structure lives in the file itself, and an issue's boxes map to measures through it.
  - **A `<surface>` per page,** with a coordinate space we choose: zones (`@ulx`, `@uly`, `@lrx`, `@lry`) are in the surface's own space, not in any image's pixels. MEI wants whole numbers, so our fractions are scaled (e.g. to 0–10000).
  - **The coordinates are on the deskewed page,** the image the models and the user saw and where all our boxes are (§8.2); on the original page a box would be a rotated rectangle.
  - **No images are stored or required:** `<graphic>`, which names an image of a surface with its pixel size, is optional and left out, since page images are a regenerable cache (§5.3). MEI has no notion of PDF pages: "surface 3 is page 3 of the project's PDF" is our own convention, documented with the file.
  - **The other direction, from the rendering to the MEI,** comes for free: Verovio's SVG keeps the MEI's `xml:id`s, so a rendered measure or note maps back to the stored one. `human_review` uses it to link the panels and to highlight the measures that changed.

**What MEI Basic allows** (checked in its customization, `customizations/mei-basic.xml` in the music-encoding repository, 2026-10):
- **Nested `mdiv`:** yes, explicitly (an `mdiv` holds a score or further `mdiv`s).
- **The music:** everything above (`scoreDef`, `staffGrp`, measures with `@n` and `@metcon`, `pb`, `sb`).
- **The header:** only `fileDesc` (`titleStmt` with titles and a `respStmt` of `persName`s with roles; `pubStmt` with publisher, place, date, license) and optionally `encodingDesc/appInfo`. No `workList`, `componentList`, `manifestation`, `sourceDesc`, `titlePage`, `perfMedium`, `plateNum`, nor dedicated `<composer>`-like elements.
- **`facsimile`:** `measure` keeps `@facs`, but the facsimile module (`facsimile`, `surface`, `zone`) isn't included.

**So we go beyond MEI Basic in two places:** the header's work, pieces and edition (titles and people would fit) and the `facsimile` element. One file of full MEI 5, rather than a strict MEI Basic file with `fileDesc/@corresp` pointing to a second file with the rest, which MEI Basic would allow.

**Validation is in the tests, not at run time:** models never write MEI (`extract`), so every element comes from our code, and conformance is a property of the code, not of a run. At run time only content varies inside a fixed structure, and a validator (libxml2 as WASM, a few MB) would add nothing but weight. The tests cover every construct of the LilyPond subset and every case of the frame (nested `mdiv`, staff groups, split measures, the header fields), and check every MEI file they produce twice:
1. it validates against full MEI 5;
2. with exactly the elements we decided to use outside MEI Basic removed (the list in the code, the single source of truth), it validates against MEI Basic. Using anything else outside it fails the test until it is added to the list on purpose.

Text from users and models (titles, names) must be escaped correctly when the XML is written; the tests cover that too.

#### The lens
**The format models read and write** (decided at this level; the exact LilyPond subset and the JSON schema are settled when `extract` is built, §15).
- **Two formats, each for its purpose:** MEI is the export format, what users get (`assemble`'s file, downloads). The lens is the internal format: inside the pipeline, the extraction is kept in it, per stretch (`extract`): the stretch is our unit of work, and more precise than MEI's measures, which can be split across systems and are regrouped by `apply_review`, while stretches never change. `extract` and `apply_review` write the lens, `review` and `apply_review` read the whole score in it, and code builds the MEI from it.
- **JSON carries the structure** (the provider's schema-constrained output, §7.1): per stretch, its classification, the measure's kind, a printed measure number, and its staves with their voices; per system, whether its last measure continues, changes to the `scoreDef`, and the issues raised.
- **One string per voice in each stretch,** in a subset of LilyPond: absolute pitches, explicit durations, slurs, ties, dynamics, hairpins and articulations written on the notes, markers for stem direction and cross-staff notes.
- **A sketch** (field names not final):

  ```json
  { "stretches": [
      { "stretch": 3, "class": "new", "kind": "normal", "printedNumber": null,
        "staves": [
          { "staff": 1, "voices": [
              { "voice": 1, "music": "e''4( <c'' e''>4 a'2-.) \\p" },
              { "voice": 2, "music": "a'2 g2\\staffDown" } ] } ] } ],
    "lastMeasureContinues": false,
    "issues": [ { "boxes": [ … ], "question": "…", "answers": [ "…" ] } ] }
  ```
- **Several simultaneous slurs** (e.g. one from each note of a chord) must be expressible, e.g. with LilyPond's labelled slurs (`\=1(` … `\=1)`), or the model is pushed to simplify (§13, the triple slurs); MEI attaches slurs to individual notes anyway. **Labelled slurs are numbered from top to bottom** where several are open at once, so when the previous system leaves slurs 2 and 3 open, the model knows which ends where. Slurs don't cross in practice, so the order is stable.
- **The conversion to MEI normalizes** whatever freedom the lens still leaves (§1, "Why a text encoding").
- **The lens is swappable** (e.g. a kern-like one) without touching MEI. Which lens transcribes best is an empirical question.

#### Zooming in
**Zoom crops on request, without tool calls** (decided, for a later version: the first version has none), for `extract`, `review` and probably `apply_review`:
- **The first answer has one of two shapes,** in one schema: the stage's answer itself, when the model needs nothing more (a clean system), or a list of requests: zoom boxes on the crops it was sent (and, for `review`, other systems' crops), at most N, each with a short reason ("dot near the A♭: staccato or smudge?").
- **The second request** repeats the first, adds the model's requests as its answer and the zoom crops, each labelled (§7.2), and asks for the stage's answer; this one can't ask for more. Its prefix is the first request, so prompt caching makes the repeated part cheap.
- **So at most two rounds per call,** plus the follow-ups for failed checks, if those come too (`extract`). This is a tool loop with one round, built ourselves: the same on every provider (no tool-use APIs, no loop in the adapters), every call record a plain request and answer, and the cap enforced by the schema rather than by the model's judgement (the manual run's over-exploration, §13).
- **Code cuts the zoom crops** from the deskewed page at the page image's resolution. A zoom gives the model real detail where its view of a large crop was shrunk (Claude sees at most 2576 px on the long edge); on a low-resolution scan it is only a closer look at the same pixels, which may still help it focus.
- **The zoom boxes and their reasons are recorded** with the call (§5.2), and the issues that come from them can point at the same boxes: evidence for the reviewer and the user.
- **Open, until `review` is built: accumulating zoom crops across stages.** The places `extract` zoomed into are the parts of the page that are hard to read, so the first `review` call for a system could get them from the start, with their reasons, and still ask for more; every later `review` and `apply_review` would get all zooms asked for so far, the set growing stage by stage. The caps could then differ, e.g. 3 per system for `extract` and 1 per system after it.

#### Musical content and typesetting
**What is extracted is the music, never its appearance** (decided). In the manual run (§13), Claude attached the m7 crescendo to the pedal line instead of the notes, so that it would print lower and not clutter the music: a false musical fact encoded on purpose to make the engraving look better. That must never happen.
- **The test:** *would a player read it differently?* If yes, it is musical and is encoded exactly as printed.
- **Musical** (extracted and reviewed): pitches, rhythms, rests, voices, which hand plays what, ties, slurs (including one slur per chord note), articulations, dynamics and hairpins with the notes they start and end on, 8va extents, clefs, repeats, **beam grouping** (4 × 3 eighths is not 12 single eighths: grouping shows rhythm and phrasing, including beams against the meter or across bar lines and staves), and **stem direction** where it separates voices or hands (in one staff shared by both hands it often shows which hand plays what).
- **Typesetting** (ignored): spacing, the shapes of slurs and beams, beam slope and thickness, stem length, the exact vertical position of marks, line and page breaks, fonts, the default stem direction of a single voice.

**Defences:**
- **The `extract` prompt:** encode what the music means, never how it should look; attach every dynamic, hairpin, articulation and slur to the notes it applies to; never let layout influence what is encoded; never simplify to suit the format, and report what can't be expressed as an issue instead of dropping it. In the manual run, Claude saw three slurs in the left hand (m23→24, m25→26), one from each note of a chord to the next chord, and silently wrote one, because that is simpler in LilyPond; it reported most of its other simplifications, but not this one. The pedal-line and the triple-slur examples go in the prompt.
- **Hacks are impossible in the lens:** it has no layout controls (no `\override`, `\tweak`, spacer-only voices or separate `Dynamics` contexts); beam grouping (manual beams) and stem direction where it separates voices or hands are in the lens, as musical content, not as layout controls; and dynamics and hairpins can only be written on notes or rests in a voice. The parser rejects anything outside the subset (`extract`'s checks). In MEI, `<dynam>` and `<hairpin>` refer to a staff and to notes or beats; where they appear on the page is decided by the renderer, from the musical data. How the lens says which staff a dynamic belongs to, or both (a dynamic between the piano staves usually applies to both hands, MEI `staff="1 2"`), is a detail of the lens, settled with it.
- **`review` and `apply_review`:** check only the musical content against the original and ignore typesetting; an issue is about the music ("the hairpin looks too high" is not one). They read the extraction as text, not only a rendering, since a rendering can look right while the source is wrong (the pedal-line hack would render plausibly).

#### Bar lines, stretches and measures
Bar lines alone don't give the measures. A courtesy key or time signature at the end of a system comes after the system's last bar line and belongs to no measure (a courtesy clef comes before it, inside the last measure). A measure can be split across systems, even pages, or by a repeat bar line or a double bar in its middle (typically after a pickup). A passage without bar lines (a cadenza) is one long stretch. So:
- **Bar lines:** `layout` gives their x-positions per system (structure, fixed in `fix_layout`); `analyze` lists the special ones by kind (double, final, start repeat, end repeat, dashed; content, in the observations), and every other bar line is a single one. `extract` may correct the kinds, never the positions.
- **Stretches:** code cuts each system at its bar lines: from the start of the staff to the first bar line, between consecutive bar lines, and from the last bar line to the end. The stretches partition the system.
- **`extract` classifies each stretch,** in order, while reading its music: **none** (part of no measure, e.g. courtesy signatures), **new** (starts a measure) or **continues** (part of the same measure as the previous stretch that is part of a measure, even on the previous system or page). This is local: the model never numbers measures across the score.
- **Across systems, from both sides:** `extract` says whether the system's last measure continues into the next system, and that goes into the next system's request; the next system classifies its first stretch as "continues" or not. A mismatch (one says the measure ends, the other that it continues) becomes an issue (below). A measure split across systems is extracted in two calls, one stretch each; code joins them into one MEI measure, and the duration check runs on the joined measure (once both systems are extracted).
- **The kind of each measure,** on its first stretch: **normal**, **incomplete** (a pickup, or the short measure that completes one before a repeat or at the end of a section) or **unmeasured** (a cadenza, a passage without bar lines).
- **Printed measure numbers,** where one is visible (usually at the start of a system), on the stretch where it is printed.
- **Code builds the measures** from the classification and numbers them, **per piece or movement** (from the metadata): numbering starts again with each piece. It does so again whenever the classification changes: after `extract` and after every `apply_review`.
  - **0 or 1:** when a piece begins with an incomplete measure, code numbers it 0 or 1, whichever matches the printed numbers better, chosen anew at every build. Nothing is asked of the user: without printed numbers it doesn't matter, and with them, once the bar lines and the classification are right, the offset between printed and counted numbers is the same throughout the piece and settles it. What doesn't match becomes a warning (below), which the next review sees.
- **Code checks plausibility.** What it finds is either an issue, when it can be asked as a question about the page, or a warning (see "Issues" and "Warnings"):
  - **Issues raised by code:**
    - a mismatch across systems (above), in either direction: "Is the first stretch of system 8 a continuation of the measure that ends system 7?", answers "yes" and "no", `applied` the one the current classification says;
    - the first stretch of a piece classified "continues", or a "none" anywhere but at the end of a system: "What part of a measure is this stretch?", answers "start", "continuation", "not part of a measure", `applied` known;
    - a printed number on a stretch not classified "new": the same question, the first answer stressing the observation ("start, because there is a printed measure number next to it"), which a reviewer takes into account.
  - **Warnings:**
    - printed numbers that don't match code's count. Only where the **offset** between printed and counted numbers changes, not every measure after it: one missing measure must not flag the rest of the score. The box runs from the previous printed number to the one where the change is noticed, since the misclassified stretch is somewhere in that range (usually not more than 2 systems, with a number per system). Some changes are legitimate (editions often give a first and a second ending the same number);
    - durations that don't add up in a measure (a wrong classification is one possible cause).

#### Issues
An **issue** is one question about what the printed score says at one place (or a few, below): a model's doubt, a reviewer's correction or a user's correction. (Earlier called "uncertainty".)

- **It describes a place in the printed score,** not in the MEI or in the rendering, with **bounding boxes,** whoever raised it (a model, the user, code). Each box is a page and a box on it in our usual fractions (§6). An issue can have several, e.g. a slur that continues into the next system, perhaps on the next page: one box at the end of one system, one at the start of the next.
  - **At most 2 systems, consecutive** (decided): the systems an issue's boxes touch must be one system or two consecutive ones, checked when the issue is created, whether by a model (a failed check, back to the model) or by the user (the tool doesn't allow otherwise). It keeps `apply_review`'s calls small; where more systems are genuinely involved, the user writes several issues.
  - **Code works out the stretches** under the boxes, and so the measures, from the system boxes, the bar lines and the measures as code built them (see "Bar lines, stretches and measures"), instead of trusting a model's measure numbers: the detection of measures is one of the things that can be wrong. They are the stretches `apply_review` changes for the issue without needing a reason.
  - **Models give boxes on the crop they were sent** (a system, stretch or zoom crop). Code turns them into boxes on the page: the crops were cut from known boxes, so this is exact.
  - **An optional prose location** says what in the box is meant when the box alone doesn't, e.g. "the middle note of the chord". It must be **simple and local to the box,** and not depend on the model's reading of the score: "the left-hand note on the third beat" turns wrong if the note wasn't for the left hand, or wasn't on the third beat, after all. The prompts say so.
  - **Issues are text only:** no stored image with annotations. A model sees the boxes as coordinates and, **proposed,** as pictures drawn by code when the request is built: one copy of the crop with all boxes in different colours, and one without any, since lines over the music would get in the way of reviewing everything else, and boxes may overlap.
- **What an issue holds** (the field names are a sketch):
  - `id`: assigned by code, the same through all stages (see "Issue ids" below);
  - `source`: who raised it: the extraction, a review, the user or code;
  - `boxes`: page and box, one or more (above);
  - `location` (optional, above) and `question`: prose, e.g. "the middle note of the chord" and "not sure which duration it has";
  - `answers`: a list of free texts, possibly empty;
  - `choices`: who chose which answer, one entry per stage that chose (the extraction, each review, the user). The answer that counts is the latest one, but nothing is overwritten, so disagreement between reviewers stays visible and the human review can show those issues first. Possibly empty;
  - `applied`: the answer the current MEI reflects, or **null** when that isn't known. It is null for an issue the user added: the user only says what is right, not what the MEI has now;
  - `resolved`: set when a human chose or wrote the answer.
- **One schema for every source** (decided): `location`, `question` and `applied` are optional, `answers` and `choices` may be empty. Which may be missing depends on `source`, and code checks it, e.g.:
  - **from a model:** a question and at least one answer;
  - **from the user:** one answer, chosen by the user, `resolved` set, `applied` null; the question may be missing;
  - **from code** (see "Bar lines, stretches and measures", and a slur or tie that never ends: "where does it end?"): a question, and the answers where code knows them (e.g. yes and no), with `applied` known when the extraction says which one it reflects. Code doesn't raise an issue when one about the same stretches and the same question exists already; otherwise every rebuild would raise it again.

  The prompts explain what is missing for each source. Answers and choices added later go through the same append-only log as every other change (`review`).
- **A re-run treats issues like everything else** (§5.5): nothing special. A stage is reused when its inputs are exactly the same, and dropped otherwise. A change before `extract` will usually change the extraction, so the issues start over, and a human review after it is likely dropped with the issues it resolved. That is accepted.
- **Issue ids** (decided):
  - **Code assigns them,** when an issue is first stored: a short number per score (`#1`, `#2`, …), never reused, not even after a re-run drops the issue. After a re-run from before `extract`, the numbering continues, so old and new issues can't be confused in the call records.
  - **Models never write ids.** A new issue comes without one, and code numbers it as soon as the answer is stored, so the next call (the next system, the next review) already sees it with its id. A model refers to existing issues by their ids, e.g. when choosing an answer; a reference to an id that doesn't exist is a failed check and goes back to the model.
  - **Ids carry over:** every stage that touches the issues produces a new version of the same list, with the same ids.
- **A resolved issue stays in the list for good.** No LLM stage can change its chosen answer: later reviews take it as the truth and don't raise the question again. The user can change it, in a later `human_review` (changing their own earlier decision).
- **An issue needs applying** (`apply_review`) when its chosen answer differs from `applied`, which includes every issue whose `applied` is null.
- **The issues of a score are one JSON artifact.** Each stage that touches them produces a new version (§5.4: stored stages never change).

#### Warnings
A **warning** is about the current extraction, or about how it was produced, not about the page (that is an issue). Code finds it; it has boxes and an explanation, and it is never answered or applied: it calls attention, the user's or a reviewer's. The user who sees one can act on it with an issue of their own, e.g. a box around a smudge with the answer "this is a smudge, not a note" after a duration warning showed where the extraction invented a note.
- **The warnings so far:** durations that don't add up in a measure; a change in the offset between printed and counted measure numbers (both in "Bar lines, stretches and measures"); and from comparing two versions (`apply_review`): a change beyond the boxes (with the model's reason), a change where none was due, a missing change.
- **They belong to a version of the music:** whichever stage produces one (`assemble` or `apply_review`) also produces its warnings, as a small artifact of its own, with a warning badge and their number on the stage's card. They open in the artifact view like any output: the original with the warnings' boxes, and their text next to them. A quick look tells the user whether they warrant a human review.
- **They are shown to the next `review`,** in the part of its prompt that all calls share, and that's all. They aren't stored with the issues and don't last: the next version gets its own warnings, computed anew. A problem that persists is warned about again; a problem that was fixed isn't.
- **Their boxes have no cap:** they are never applied, so the 2-system rule of issues doesn't apply.

## 7. LLM steps

What each LLM stage is given and returns is in §6, with the stages (`layout`, `analyze`, `extract`, `review`, `apply_review`), the format models write music in ("The lens"), and what is checked (`extract`'s checks, issues and warnings). This section covers what all of them share.

### 7.1 Structured output
Every call returns JSON validated by a Zod schema, using the provider's schema-constrained output. Doubts are issues (§6), not prose.

### 7.2 Prompts and model configs
- Prompt templates are versioned in `packages/prompts` and are part of their step's version.
- Every call is recorded (§5.2), and identical requests are served from the record instead of being paid for again.
- **Provider, model and thinking budget or effort are the user's choice.** The app is meant to be flexible here and doesn't prescribe a model. The user guide will recommend Claude Opus 5.5 for everything, except perhaps a second review with a different model for variety. The prompts are tuned on Opus, so the app offers the choice but can't promise the same quality with another model.

#### Calling the providers
Built: `apps/worker/src/llm/`. One small request and response shape for every provider (`LlmProvider`, §3): a system prompt, messages of text and images, a maximum of output tokens, an effort, and optionally a JSON schema the answer must follow (the provider's schema-constrained output, §7.1; the answer is then parsed). The response says which model answered, the text (and parsed JSON), why it stopped (finished, cut off, refused) and the tokens. Errors are typed and say whether retrying can help.
- **The chosen model answers, or the call fails.** No fallback to another model, not even Anthropic's server-side fallback on refusals: a refusal comes back as a refusal.
- **Several images in one request are labelled** with a text block right before each ("System 3:", "System 3, stretch 2:"): content is an ordered list of text and images for both Anthropic and Gemini, and the adapters keep the order. Neither API passes a file name to the model. Anthropic's vision docs recommend this way of labelling.
- **Anthropic** (Claude API), with the official SDK. Requests are streamed, so long answers don't hit timeouts. Thinking is left at the model's default (adaptive on current models), and effort maps directly. As a sanity check, an answer that names another model than the one asked is an error (`unexpected_model`).
- **Google** (Gemini API, keys from AI Studio), with the official SDK. Effort maps to Gemini's thinking levels (low, medium, high), which exist from Gemini 3 on; older Gemini models want a token budget and would refuse a level. Thinking tokens count as output, cached ones apart from the rest. Gemini names the exact version that answered, which can differ from the name asked for (an alias, a dated version), so there is no model check.
- **Claude on Google Cloud's Vertex AI** (for processing in the EU, §10), with Anthropic's official Vertex client: the same Messages API, so the same adapter code as for Anthropic's API, sanity check included. Configured with a service account's key file (a secret), a region (`eu` for the EU multi-region, a single region such as `europe-west1`, `us` or `global`) and optionally a project (default: the key file's).
  - **Tokens without Google's auth library,** which expects Node (files, child processes, the metadata server) and doesn't run in a Worker. Our own small token source signs Google's service-account claim with WebCrypto, exchanges it for an access token, and reuses the token until a minute before it expires. A refused service account is an `auth` error.
  - **Billing** goes through Google Cloud, after the fact. Google Cloud now has enforced spending caps per project; the project owner's project ("score3ly") has a monthly cap of €30, with the Vertex AI API enabled. Still to do: a service account, enabling Claude for the project, a key file, the first real call, and checking whether Opus 5.5 is offered on Vertex AI, and in the EU.
- **Claude on Amazon Bedrock** (for processing in the EU: Opus 5.5 isn't offered on Vertex AI in Europe, and Anthropic has no servers there), with Anthropic's official Bedrock client for Bedrock's Messages API endpoint ("Mantle"): again the same adapter code, sanity check included. Configured with a region (e.g. `eu-central-1`) and either a Bedrock API key or an AWS access key pair (a key ID and a secret), both secrets; with a key pair, requests are signed with AWS Signature V4. The client runs in a Worker as it is, given the credentials explicitly (it would otherwise look for them in the environment and AWS's files). The model is Bedrock's own ID for it, e.g. an `eu.` inference profile.
  - **Setting up an AWS account for it** (for the user guide): a new account must first be verified (up to 24 hours), then the AWS Marketplace agreement for the model signed, then Anthropic's use-case form submitted; before that, requests are refused with "not available for this account". The project owner's account is in this process (2026-10-09), with 100 USD of starter credits valid for six months.
  - **To check on the first real call:** whether the answer names the model with the same string that was asked (an inference profile may come back as the bare model ID). The sanity check compares the two as they are.
  - **Spending:** AWS has no hard spending cap as far as known: budgets alert, and a budget action can at most attach a deny policy. The app's spending cap (§10) and the IAM user's permissions are the limits.
- Gemini on Vertex AI isn't built.
- Tested without network, with a fake `fetch`, and run inside the local Workers runtime. `npm run llm:try -w apps/worker -- <anthropic|anthropic-vertex|anthropic-bedrock|google> <model> <image> "<question>" [--json]` sends one image and a question with real credentials, from environment variables.
- Not wired into the app yet: no API endpoint, no call records, no costs.

#### Model configs
- **A model config** is a stored, named combination of provider, model, thinking effort and the provider's authentication. The user can keep several. They live in D1 and are edited in the settings.
- **The model is the provider's own string,** entered as the provider spells it (`claude-opus-5-5` on Anthropic's API, an `anthropic.`-prefixed ID or an `eu.` inference profile on Bedrock, ...). The app doesn't translate between providers' names, and the sanity check compares the answer's model with that string as it is (§7.2, "Calling the providers").
- **An optional name** for each model config, shown on the stage cards (§5.6). Without one, the card shows the model string, shortened in the middle when it doesn't fit, like project and file names (§5.7).
- **Each provider declares its own form:** which fields are secrets and which are plain values. The plain Anthropic and Google APIs take one key; Google Vertex AI wants a service-account file plus a project and a region, AWS Bedrock an access key pair plus a region. The form is generated from a schema, like a step's config (§3).
- **A secret field is a dropdown of the Worker's secrets, by name** (§10). The config stores the name, never the value. Several keys per provider are possible, e.g. a free-tier key and a paid one.
- **A missing key:** if a secret was removed or renamed, the configs pointing to it are broken. The app says so on the config and before a run starts, not in the middle of one.

#### Which config a stage uses
Three levels; the most specific wins:
1. **The config picked for a stage in a project** (e.g. behind a gear icon on the stage's card). Full flexibility, not normal use.
2. **Advanced settings: a config per kind of work.** First draft of the kinds: finding layout boxes, extracting metadata, extracting the music notation, review.
3. **The default config:** one settings item. With it, and nothing else set, the pipeline is "fire and wait".

- **Model configs are append-only** (§5.8): editing one adds a new row and marks the old one deleted (copy on change), and deleting one only marks it. So a stage and each of its calls refer to the row they actually used, and editing or deleting a config, or renaming a secret, doesn't rewrite the history of old projects. The secrets' names are part of the row; a secret's value isn't recorded in any way.
- **Changing the config of a stage that already ran** is a change in the middle (§5.5): confirmation, then everything after it runs again.
- **The key is not part of a stage's inputs.** Using another key for the same model doesn't count as a change and doesn't make paid stages run again.

### 7.3 Known LLM risk: plausible wrong notes
LLMs fill in "musically likely" content. That is desirable for a smudge and dangerous everywhere else, because the errors look correct. Defenses:
- issues for every doubt (§6)
- checks by code (`extract`, `assemble`)
- review against the crops (`review`)
- checking the engraved output against the original on the test set (§13)

## 8. Image processing and reproducibility across devices

### 8.1 Getting page images
Built: `packages/imaging/src/pdfPages.ts` (`openPdf`, `pageImage`), tested on the test set (§13). `npm run pages -w packages/imaging -- <file.pdf> <folder>` writes every page, as extracted and straightened, as PNGs.
- **Scanned PDFs:** extract the embedded page image directly instead of rendering the page: the scan's own pixels, at its own resolution.
  - **A page counts as a scan** when it has exactly one image and that image covers at least 85% of the page. Other content, such as an invisible OCR text layer, is ignored. Anything else (vector music, a scan cut into several images, an image at an angle that isn't a right angle) is rendered.
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
- **Not tried in a browser yet:** the code only ran in Node so far (§15).
- **Crops** (`packages/imaging/src/crop.ts`): a box (§6: `left`, `right`, `top`, `bottom` as fractions from 0 to 1) covers every pixel it touches, even partly, so nothing at the edge of a system or measure is cut off. Named regions come as JSON, `{"system_3": {"page": 2, "bbox": {...}}, ...}`, pages counted from 1; names become file names, so they are kept to letters, digits, `_`, `-` and `.`. As in the pipeline (pages extracted, deskewed, sent to an LLM for the boxes, then cropped), crops are cut from the deskewed page images: `npm run crops -w packages/imaging -- "<pages>/page-{n}.straight.png" <regions.json> <folder>` reads the page images (`{n}` is the page number; `npm run pages` writes them so) and writes `<name>.png` for each region.

### 8.2 Deterministic operations
- All image operations are implemented in our own TS/WASM code, never with canvas transforms or `drawImage` scaling.
- `Math.sin`, `Math.cos`, `Math.exp` etc. are not guaranteed to give identical results across JS engines. Round them to a fixed precision (e.g. 12 decimals) or ship our own implementations.
- Operation chains are ordered. Coordinates refer to the output of the previous step.
- **Rotation** (`packages/imaging/src/rotate.ts`): about the image's center, positive angles clockwise as seen on screen, bilinear interpolation. **The output has the input's size:** corners that turn out are cut off, and areas that turn in are filled with the paper's color (the median color of the page, so yellowed paper stays yellowed). Deskewing angles are small, so little is lost, and coordinates stay simple. A test pins the exact pixels (a hash), so any change to rotation shows up as one, and is a new step version.
- Human and LLM coordinates are stored in **normalized units**, so they survive regeneration at a different resolution.

### 8.3 Fingerprints: verifying "close", not just "identical"
Stored for every image a human or LLM has worked on, and for every confirmed system box. Checked after each regeneration in three tiers:

1. **Exact:** pixel dimensions plus SHA-256 of the **raw decoded pixels**. This is not a hash of the PNG file, since PNG encoders differ.
2. **Close:** a downsampled grayscale thumbnail (64×64 to 128×128). Compare the regenerated image downsampled the same way:
   - mean absolute difference below about 1 gray level, and
   - no single tile above a few gray levels.
3. **Mismatch:** flag the project and ask the human to re-check the affected boxes and angles.

### 8.4 Finding the skew
Built: `findSkew` in `packages/imaging/src/skew.ts`. It returns the angle (degrees, positive when horizontal lines descend to the right; `deskew(image, angle)` straightens the page), a confidence from 0 to 1, whether the angle is at the limit of the search, and the staves found (below). `shouldDeskew` applies the rule below.
- **Lines, not ink:** a filter keeps thin, dark, horizontal-ish structures. A pixel counts as much as it is darker than both the pixels a few rows above and below it, relative to them. Large dark areas (scanner borders, a shadow at the spine, beams, noteheads) and vertical strokes give nothing, and faded ink still counts because the measure is relative. Strong responses are capped, so a few very dark lines don't outweigh many faint ones. A margin of 4% on each side is ignored, where scanner borders and page edges are.
- **Projection by strips:** the page is cut into 48 vertical strips, each with a row profile of the line responses. For a candidate angle, the strips' profiles are shifted by how far a line at that angle moves, and added up. At the right angle all of a staff line falls on the same rows, so the sum of squares of the summed profile is largest. A coarse search (0.1°, ±5° by default), a fine one (0.01°) around the best, then a parabola through the best three.
- **Outliers** such as long hairpins or slurs are lines at other angles, but much less ink than the staves, so they add a little to every candidate and don't move the peak. Tested with made-up pages: hairpins, faded ink on dark noisy paper, black borders and a crooked page edge, all within 0.05°. On real pages from the test set, a page turned by a known angle is measured again within 0.05°.
- **Large scans** are first shrunk by an integer factor to about 1800 pixels across, keeping the darkest pixel of each block, so thin lines survive.
- **Confidence** is how much the best angle stands out from the median one: `1 − median score / best score` over the coarse angles. Music pages in the test set scored 0.35 to 0.83; title pages without staves scored 0.01 to 0.35 (and one ornate one 0.35 with a plausible angle). It is not good enough to decide on its own whether to deskew.
- **At most 5°.** Larger angles aren't searched: real scans are rarely skewed by more than 1° (the test set's largest is 0.82°), and a wrong angle on a cover page can't turn it so far that a model can no longer read it. A result at the edge of the range means the true angle is outside it.
- **Limits:** one angle per page. Curved pages (near a book's spine) have no single right angle; the result is the best compromise. Speed: about 0.1 to 1 second per page in Node, depending on its size.

#### When a page is deskewed
**Best effort, low risk.** Deskewing happens before any LLM call, in code, and a mistake must cost little: at worst, a music page isn't straightened and is a little harder to read. So:
- **Only pages with staves** are deskewed. Code detects staves for this and for nothing else: it doesn't decide what a page is, nor which pages go to which LLM task. Every page goes to the LLMs (`layout` and `analyze`, §6), which find the systems on it, if any.
- **Not at the edge of the range:** an angle at the 5° limit isn't trusted, and the page stays as it is.
- **Not for tiny angles:** rotation blurs a little (interpolation), so a page whose lines drift by less than about a pixel across its width (about 0.02° for 2500 px) stays as it is.
- The user can always set the angle by hand (§5.4).

#### Detecting staves
Built, in `findSkew`, from the same line responses and strips, at the angle found:
- **Lines:** rows (along the angle) that cross at least 30% of the strips. A row crosses a strip when its mean line response there reaches 30% of the page's strong lines (the 98th percentile over all strips and rows), kept between 0.02 and 0.08: a staff line counts even where notes interrupt it, and faint staves on faded pages count too.
- **Staves:** five lines with even spacing (within 15%), a spacing between 3 work pixels and 1.5% of the page's height, whose five lines cross the same strips: at least 40% of the strips are crossed by all five. A staff's lines start and end together; the evenly spaced strokes of ornaments and engraved pictures don't, which is what keeps cover pages from having staves.
- **One spacing per page:** staves whose spacing is more than 25% away from the page's median one are dropped.
- **Result:** the staves' tops and bottoms as fractions of the page's height (where they cross the page's vertical center line). Only their number is used.
- **On the test set** (the first three pages of each PDF): all five cover pages have no staves; every music page has at least five (pages have 6 to 14). Not every staff is found (a page's count is often a little low), which doesn't matter: one is enough.

### 8.5 Device constraints
- **Memory:** a 300 dpi page held in canvas memory is about 35 MB, and mobile Safari strictly limits total canvas memory. Process one page at a time in a Web Worker, using typed arrays / `OffscreenCanvas`.
- **Latency:** generate lazily, current page first.
- **Eviction:** call `navigator.storage.persist()`, but assume the OPFS cache can disappear at any time. Missing derivatives are simply regenerated.
- **Rotation:** an LRU cache with a configurable size limit (§8.6). Deletion is real deletion.
- **Bundle size:** avoid OpenCV.js (about 10 MB). With LLMs doing the reading, preprocessing is light enough to write by hand.

### 8.6 The image cache
Page images, straightened pages and crops are views computed from the PDF and the stages' results (§6), and cached in OPFS, each step separately, so a crop doesn't mean rendering the PDF again.
- **The key is the hash of the image's recipe, chained:**
  - page image: hash of (the PDF's SHA-256, the page number, `rasterize`'s version and config);
  - straightened page: hash of (the page image's key, the angle, the rotation code's version);
  - crop: hash of (the straightened page's key, the box, the crop code's version).

  Each key contains the key of the image it was made from, so a change anywhere before it (another resolution, another angle, a new version of the code) changes every key after it. Nothing is ever invalidated: an old entry is simply never asked for again, and ages out of the LRU cache (§8.5).
- **Numbers are written canonically** before hashing (angles and box coordinates rounded to fixed decimals, canonical JSON), so the same recipe always gives the same key.
- **The code versions** are those of our image functions, plus pdf.js's for the page images (§11).
- **Stored as PNG** (`cache/<key>.png`), encoded by our own code: a raw RGBA page is about 35 MB, a PNG of line art much smaller and lossless. Reading costs a decode.
- **The key isn't the fingerprint** (§8.3): the key says what an image should be, the fingerprint, stored in D1 for every image sent to a model, what it was. An image regenerated on another device is checked against it.

## 9. Rendering

**Verovio (WASM) renders the MEI in the browser** (decided), to SVG: `assemble`'s rendering, the side-by-side view of `human_review`, and the engraved PDF a user can download with the MEI. Every stage runs on any device, with no local helper and no paid compute. LilyPond is a native program that runs neither in the browser nor in a Worker, with no practical WASM build, so it would need a desktop helper (against "runnable from anywhere") or an always-on container (against "free tier only").
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
- Entering the keys in the app is an optional roadmap item (§16).

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
- LLM calls: cents per call. Roughly per PDF: about 12 page analyses, about 50 system transcriptions, plus reviews and fixes. Cheaper models (e.g. Flash-class) for easy steps, stronger models where accuracy matters.
- **LLM requests are sequential and synchronous for now:** one at a time, no parallel calls, no overnight batch requests. Further optimizations are decided once we see how long an extraction takes.

#### How costs are computed and kept
- **The app computes the cost itself:** the providers' APIs report token counts per call, not money. Cost = tokens × a price table per model, kept in the code.
- **Currency: US dollars** for everything, since that is how the providers publish their prices. The amounts are estimates, not the invoice: the bill may be in another currency, with tax or discounts. The app doesn't convert.
- **The cost is stored with each call, when it is made,** so a later price change doesn't rewrite history.
- **Costs and statistics come from the rows of the calls and the stages** (§5.8), with no ledger of their own: each call has its cost, each stage its start and end time, each project its page count. Those rows survive everything that removes outputs:
  - stages replaced by re-running from an earlier stage (§5.5), which are no longer visible in the pipeline;
  - stopped stages (§5.6);
  - deleted projects (§4): their project, stage and call rows are kept, marked as deleted.
- **Statistics:** the runtime and cost of each stage and of whole pipelines, and averages per PDF page.
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
- **Mandatory:** there is no way to run without a cap. Adding the first model config that isn't marked free tier requires setting it.
- **Why a day and not a month:** with a monthly budget the user picks a large number ("about $30 a month"), and a bug can spend all of it in a day before anything stops. A daily budget makes them pick a small one ("$1 a day"), so a bug is stopped after a small sum.
- **Why not per project:** scores differ a lot in length, and re-running stages adds cost legitimately.
- **Enforced by the Worker,** which makes the LLM calls. A second tab or a stale page can't get around it.
- **The cap can be overshot** by the cost of the calls in flight when it is reached, because a call's cost is only known when it returns. Sequentially that is one call, a few cents. **If requests ever run in parallel, revisit this:** the overshoot could be far too much.
- **Free-tier configs stay usable** after the cap is reached, and don't count towards it. A config wrongly marked as free spends money the cap doesn't see; a spend limit set at the provider is the backstop.

## 11. Versioning

- **Step versions are explicit and immutable.** An algorithm change that would invalidate human input (e.g. stored system boxes) is a new step version, such as `crop_to_systems_v2`. The old one stays in the codebase, and projects record which version produced each artifact.
- **Part of a step's version:**
  - library versions (pdf.js, decoders, Verovio)
  - prompt template versions

  The model is not part of it: it is the user's choice and belongs to the stage's config (§7.2).
- Load old step versions lazily with dynamic `import()`.
- **A newer step version on a re-run** (first idea, not thought through): a re-run follows the pipeline as it was while the inputs match (§5.5), but a stage's step may by then have a newer version that is considered better. When the re-run is started, the app asks the user which to do:
  - use the new version in any case; or
  - keep the old version's results where the input still matches, and use the new version only where it doesn't.

  Keeping an old result means reusing what is stored (§5.5), so no old code has to run for it.
- **D1 schema migrations** use `wrangler d1 migrations`.
- **The app's version** is the `version` in the root `package.json` (0.1.0 for now), in three parts, major.minor.fix:
  - **Fix** goes up for bug fixes.
  - **Minor** goes up for compatible additions: UI features, new optional stages to pick from, a new step version such as `crop_systems_v2` that becomes the default for new runs. Additions are collected for a while first, so the minor doesn't go up twice a day.
  - **Major** goes up for incompatible changes: ones after which old pipelines can no longer be re-run. This is also the way out if the number of step versions grows unmanageable. Even then we make an effort to keep old projects viewable in the UI, clearly marked as run with a pipeline that is no longer supported.
- The build also records the git commit it was built from, and whether there were uncommitted changes. The About page shows all of it, e.g. "0.1.0 @ 61c081d" (plus "[+ uncommitted changes]" and "[dev server]" where they apply), so a deployed app can always be traced to its code.

## 12. Testing and reproducibility

**Principle:** deterministic parts are tested directly. Non-deterministic parts (LLM calls, human input) are **recorded and replayed**.

- **Unit tests:** image operations, the lens parser and checks, measure building, the MEI builder (validated against MEI 5 and MEI Basic, §6, "MEI"). Among the checks: a two-note tremolo with a wrong count fails the duration check (§15).
- **Golden-image tests:** deterministic image pipelines produce known raw-pixel hashes, or fingerprints within tolerance (§8.3).
- **Fixture projects:** real scores with recorded LLM call records (request + response) and recorded human operations (angles, boxes, answers to issues), stored in `fixtures/`.
- **Replay tests:** run a fixture end to end with the replay `LlmProvider`.
  - Deterministic steps must reproduce identical output hashes. LLM and manual steps return their recordings.
  - This tests the plumbing, assembly and resume logic with no API cost.
- **Stale recordings:** a changed prompt or model changes the request hash, so replay misses. The test reports exactly which recordings are stale, and they are re-recorded against the live API.
- **Quality evaluation** is separate from tests (§13): live runs, with repeated runs to measure variance. A temperature of 0 doesn't guarantee identical answers.

### Test environments (planned)
For trying the app by hand on prepared data, locally only (no remote test database or bucket).

- **A test environment is a folder** in the repo, `testenvs/<name>/`, with:
  - the local D1 and R2 state, which `wrangler dev` reads from any folder (`--persist-to`);
  - a secrets file, loaded with `--env-file` instead of `.dev.vars`. It holds fake or test-only keys, and real keys are never committed. To check when building it: whether an existing `.dev.vars` makes Wrangler ignore the `--env-file`.
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

**Human evaluation, supported by tooling.** There is no ground-truth LilyPond for interesting scores (only for PDFs engraved from LilyPond, a narrow and easy subdomain). LilyPond can also express the same music in many ways, so comparing source text is meaningless. And the errors music OCR still makes are big and obvious: improvements are visible from a glance at the rendered output. Precise automatic metrics would be the right tool for a production system tuned over years, not for this project.

### Test set
- `testset/` in the repo. Small, since evaluation is by hand. Only the input PDFs (public domain, e.g. from IMSLP), the highlighter strokes on them and the `.ly` and `.musicxml` candidates are committed. The inputs never change, so their strokes stay valid on any machine. Engravings, strokes on engravings and any other files produced there stay local. Its README documents the tooling and why each piece was picked.
- Input PDFs are chosen to cover the phenomena in §1 rather than random pieces: multiple voices per staff, staff count changes, lyrics, editorial notes and ossia/alternatives, reduction staff, two-piano double systems, old ornamented scans, clean vector PDFs, a few non-piano cases.
- Naming: `<piece>.orig.pdf` is the input. Each extraction method adds `<piece>.<method>.ly`, e.g. `fuer_elise.audiveris.ly`, `fuer_elise.s3l-gemini.ly`. Baselines are the best results from existing tools (§16 step 2), e.g. `<piece>.audiveris.ly`. MusicXML from OMR tools is kept as `<piece>.<method>.musicxml` and rendered directly, so a tool isn't judged on a lossy `musicxml2ly` conversion.

### Tooling
- **Engrave command:** engraves every `<piece>.<method>.ly` (local LilyPond install) and `<piece>.<method>.musicxml` (local MuseScore 4 install) that has no `<piece>.<method>.pdf` yet. Never overwrites existing PDFs.
- **Viewer:** a local web page with three PDFs side by side, each scrolling continuously (page breaks don't line up across engravings). The left pane always shows the original. The middle and right panes have dropdowns listing the available engravings of the same piece.
- **Highlighter:** freehand strokes painted over any of the PDFs (original or engraving), in a color from a short list, with multiply blending so the notes underneath stay visible. They point the eye at errors: no types, no counting. A switch between reading and highlighting mode prevents accidental strokes. One "undo last stroke" covers all panes and is the only way to erase. Its history covers the current session and is cleared when switching pieces.
- **Stroke storage:** next to the PDF in `<piece>.<method>.marks.jsonl` (`<piece>.orig.marks.jsonl` for the original), saved after every change, as JSON Lines: one stroke per line. Per stroke: page, color name, width and points (relative to the page size), and the SHA-256 of the PDF it was drawn on. Colors are stored by name and looked up in the viewer's palette, so adjusting a palette value recolors existing strokes; names not in the palette are painted grey. Storing the hash per stroke means strokes drawn on an older version of a PDF stay identifiable even after new ones are added. The viewer warns about such strokes, since they may be misplaced. The PDF itself is never modified.

### Baselines (§16 step 2)
**The question:** how well can existing tools read a PDF, understand the music and write it in a formal text format? Any format counts, so MusicXML is rendered directly with MuseScore 4 (`npm run eval:engrave`), not converted to LilyPond first.
- **Tested** (2026-10), covering free and open source to expensive proprietary: Soundslice (free tier), Newzik (7-day trial), PlayScore 2 (1-week trial), SmartScore 64 Pro (demo), Audiveris 5.11. Not tested: PhotoScore & NotateMe, ScanScore, Klangio Scan2Notes, Opuscan/Flat, ACE Studio, oemer, and research models (LEGATO and others, which mostly output notes and rhythms only, in ABC or kern). Ruled out: combining several tools' extractions with an LLM, which would cost more than any paid service.
- **Results:** every tool is far from usable; even the best results need too much correction by hand.
  - **Soundslice:** Mozart unrecognizable. A very polished UI, which asks multiple-choice questions about everything it was unsure of.
  - **Newzik:** terrible throughout, and very verbose (141k characters of MusicXML for one Mozart page). Failed on the full Kinderscenen.
  - **PlayScore 2:** the best of the three on the whole test set, still not usable. Measures whose durations don't add up (Chopin, Kinderscenen p3, Villa-Lobos). Crashed on the full Kinderscenen.
  - **Audiveris** (batch mode): mostly very bad; Clair de Lune (a vector PDF engraved by LilyPond) surprisingly decent. Failed on Chopin (internal crash), Liszt (a cover page without staff lines aborts the export) and Kinderscenen (pages over its 20-megapixel limit).
  - **SmartScore** (judged in the app, the demo exports almost nothing): Für Elise (Leipzig) the best of any tool, few mistakes; Clair de Lune good, Mozart decent; the rest bad to a disaster. The full Kinderscenen took over 45 minutes and failed; its binarization threshold suits no part of the stained paper (one reason to keep colour, §8.1).
  - **Bendel, La Cascade p4** (an obscure piece): a disaster with every tool.
- **Opus 5.5 in a chat** (§16 step 3) did far better, which decided building the app (§16 step 4).

**Memorization:** LLMs recognize the famous pieces of the test set (Gemini Flash named the Mozart concerto and movement from a page with the edition, plate and page numbers cropped away), so a transcription may be partly recalled rather than read, and the test set would overstate how well the approach works. Two checks: obscure scores unlikely to be in the training data (Bendel, La Cascade, which neither Gemini 3.1 Pro nor Opus 5.5 could identify), and different editions of the same piece (the two Für Elise), to see whether the model follows the page or its memory where they differ (§15).

### The manual run (§16 step 3)
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
  - *spanners and simplification* (slurs ending too early at bar lines and system breaks, three slurs written as one): crop margins, `review`'s attention to spanners, and the rules on musical content (§6, "Musical content and typesetting").

  Claude's account of what it had checked was wrong until asked again (it recommended comparing the rendering with the crop but never did it): the call records are trusted, not a model's account (§5.2).
- **Claude's own retrospective** (what would have helped from the start), and what became of it:
  - **A fixed output spec,** given in full from the start: it changed its conventions midway (pedal moved into the left hand, phrasing slurs from system 2 on, sounding pitch under 8va). That is the lens and the prompt (§6, "The lens").
  - **A known effort budget:** caps belong to the pipeline, not to the model's judgement (`extract`'s loops).
  - **Context from before the page** (time signature, anything still open, composer and edition): the state carried by code, the observations and the metadata.
  - **Doubts as data, not prose:** issues.
  - **Labels for the images:** in the chat, uploads reached the model as generic file names, so it couldn't tell which crop was which. In the API, a text block before each image labels it (§7.2).
  - **Boxes by eye with a draw-and-check loop, at most 3 rounds:** `layout`.
  - **A render-and-compare self-check, and visual comparison per bar:** a review step we control, not the model's own loop (`review`, "Renderings").
  - **An independent review** by a model that hasn't seen the first transcription: `review`, possibly with another model (§7.2).
  - **Checks** for durations and unclosed marks: `extract` and `assemble`.
  - **Dropped:**
    - **a rough chord per bar as a prior,** with a check for notes clashing with it: Claude did fine without it, and a wrong chord would bias the reading;
    - **staff lines and bar lines found by pixel counting:** that kind of scripting failed in v1 and in score2ly, and a wrong detection would make the extraction worse; bar lines come from `layout`;
    - **transcribing bar by bar:** many more calls, and the view of the whole system is lost (the slur fix came from it).
  - **Experiments for some day** (§15): pitch guides, and printed accidentals and 8va instead of pitches.

### Use
- Compare methods, prompts and models side by side by eye.
- Count how many of the real errors the issues raised by `extract` catch (6 of 11 in the manual run).
- Cost per piece comes from the LLM call records (§10).

## 14. Things to pay special attention to

| Risk | Mitigation |
|---|---|
| **Infrastructure work crowding out quality work** (plumbing is fun) | Validate the approach by hand before building (§16). Measure quality on the test set early and often. |
| Losing LLM output or human input because it was treated like cache | §5.3: LLM and manual outputs are always persisted. Eviction only touches computed outputs. |
| Plausible but wrong notes from LLMs | §7.3: issues for every doubt, checks by code, review against the crops, measured slip-through rate. |
| Regenerated images drifting from what the human or LLM worked on | §8: deterministic decoding and operations, normalized coordinates, fingerprint checks. |
| Downscaled system images losing detail (models shrink large images, and piano systems are wide) | Stretch crops sent along with the system crop, and zoom crops on request (§6, `extract`, "Zooming in"). |
| Bugs in building the MEI or rendering it, misleading the user in `human_review` | Tests of the MEI builder, validated against the MEI schemas (§6, "MEI"); `review` reads the lens, not the rendering. |
| ML costs creeping up | Per-call cost logging, reuse of recorded requests, cheaper models for easy steps. |
| Two devices editing the same project | Optimistic locking (§4). |
| Irreversible infrastructure choices | D1 and R2 jurisdictions are set at creation. Scripted in the repo. |

## 15. Tasks

Concrete pieces of work, like tickets. The roadmap (§16) is the high-level, long-term plan; every task here is a step somewhere on it.
- **The list isn't complete and doesn't try to be.** Tasks are written down as they become clear, not foreseen for the whole roadmap.
- **A decision still to be made is a task** ("Decide ...").
- **Tasks overlap with the rest of this document,** which says what is intended. A task says what is left to do about it. A bug can be a task without the design mentioning it.
- **A finished task is deleted,** not ticked off. A decision goes into the section it belongs to.

### Decisions
- **Compare `review` with and without renderings as model input** (§6, "Renderings"), on the test set, some day: run it both ways and compare what it finds, counting false findings as well as extra correct ones. If renderings help, they become the default, and a config option of `review` can turn them off.
- **Define the lens exactly** (§6, "The lens"), when `extract` is built: the LilyPond subset, especially cross-staff notation, ornaments, ossia and lyrics, and the JSON schema.
- **Decide between colour, grayscale and binarized** page images for the LLM steps, by ablation on the test set (§8.1).
- **Decide how the LLM providers are accessed:** direct APIs versus Vertex AI / Bedrock for EU processing (§10). Adapters exist for the Anthropic and Gemini APIs, and for Claude on Vertex AI and Bedrock (§7.2).
- **Design the validity check of stages** (§5.2): checking recorded input and output hashes against what is stored; when (on opening a project, before a run, ...), and what the app shows and does when a stage is no longer valid.
- **Decide on the report after a re-run** (§5.5, proposed): which manual fixes were carried over and which were dropped.
- **Polish the wording of the confirmation before a re-run** (§5.5).
- **Decide whether the artifact view follows the pipeline while it runs** (§5.6).
- **Decide whether the app opens like an installed app on a phone** (§5.7): the web app manifest sets no display mode, so from the home screen it opens as a normal browser page. As an installed app it would get the whole screen, but lose the browser's back button (which closes an artifact or a menu page, §5.6) and the address bar. It would then need the same back and forward buttons as the desktop version (§3).
- **Choose a license** (§5.6, the About page). Until then all rights are reserved.

- **Test the finished pipeline on Kinderscenen** (test set), once it runs end to end. Among other things: whether `analyze` finds the systems and bar lines despite the old paper and decorations, or whether the user would have to fix most pages by hand, the scenario for content boxes (§6, `analyze`).
- **Test the extraction on two-note tremolos** (two notes alternating fast, joined by beams, e.g. the left hand in the first movement of Beethoven's Pathétique), with a score added to the test set for it: the lens writes them as `\repeat tremolo 16 { c32 g32 }`, so the model has to work out the count, and a wrong count is caught by the duration check (a unit test, §12); the task is how often models get it right. If models often miscount, a lens form closer to the page (the printed notes plus the number of strokes, as MEI's `<fTrem>` has them) is the alternative.
- **Test the finished pipeline on the two editions of Für Elise** (test set), for memorization (§13, "Baselines"): where the editions differ, does the extraction follow the page or the famous version?

### Placeholders to replace
- **Pick an icon for each kind of artifact** (§5.6), once the list of stages is final and the kinds of artifact are known, and remove the thumbnails from the output tiles (`PdfThumb.tsx` and the mock's image thumbnails).
- **Replace the mock stages** (§5.6, `apps/web/src/mockPipeline.ts` and `mockContent.tsx`) with real ones, once the D1 schema exists; remove the "Mock" box. A form for "Change config" (the mock goes straight to the confirmation) comes with them. The details in §5.6 are provisional until the schema and the possible stages are defined, and are settled then: what exactly a card shows, the icons, the fields of the details view, and which manual stages can be added where.
- **Statistics page:** the costs view and the statistics (§10). Now a placeholder text.
- **Settings page:** the model configs, the default config and the configs per kind of work (§7.2), the run mode for new projects (§5.1), the spending cap and the free-tier mark for model configs (§10). Now a placeholder text.
- **Help:** write the user guide as a Markdown file in the repository, and make "Help" in the menu lead to it on GitHub (§5.6). It has to cover deployment and setting the LLM keys (§10), and it recommends a model (§7.2). For the desktop version (§3): where things are stored on each platform, with a strong warning that changing those files can invalidate pipelines that already ran. Only makes sense once there is something to explain. Now a placeholder page.
- **"Delete project"** in the project actions does nothing. Build deletion as in §4 and §5.8: marking the project, its stages and calls, deleting what nothing else uses, the confirmations. The columns and the partial unique index on names exist (migration 0003); listing projects and numbering default names don't filter deleted projects yet.
- **Light theme** (§5.7).
- **A unit test that no step's kind ever changes** (§5.8): a committed list of every step id with its kind; the test fails when a step's kind differs from the list or a step is missing from it. New steps are added to the list; entries are never edited. With the first real steps.

### Infrastructure and cleanup
- **MEI in the evaluation tooling** (§13): score3ly's output is MEI, but the engrave command only handles `.ly` (LilyPond) and `.musicxml` (MuseScore). Add `<piece>.<method>.mei`, engraved to PDF with Verovio in Node, so score3ly's results show in the viewer next to the baselines; commit `.mei` candidates like the others, and update §13's naming and wording, which still assume LilyPond output.
- **Create the remote R2 bucket and D1 database** (EU jurisdiction, with a script in the repo, §14) and put the real database ID into `apps/worker/wrangler.jsonc`, which has a placeholder. Until then the app can't be deployed.
- **Set up Cloudflare Access** in front of the deployed app (§3).
- **Answer a PDF that doesn't match its hash with a 400.** The Worker doesn't hash the PDF: R2 checks the bytes against the client's hash and refuses a mismatch, which now surfaces as a plain HTTP 500.
- **Create the shared package** (`packages/core`, §3) and remove the duplicates: the `Project` type (`apps/web` and `apps/worker`), `sha256Hex` (`apps/web` and `apps/eval`), the pdf.js asset plugin and the PDF rendering (`apps/web` and `apps/eval`; the eval copy is dev-only and uses the modern pdf.js build).
- **Build the test environments** (§12): the start script, the build script and a first environment.
- **Run the imaging code in the browser** (§8.1): in a Web Worker, with pdf.js's assets (the `wasm` folder is needed for JBIG2 and JPEG 2000 scans) and an `OffscreenCanvas` for vector pages. Check that the pixels match Node's (the hashes in the tests).
- **Images for the LLMs:** prepare page and system images for the requests (§14).
  - **Encode** them as PNG, in our own code (Node's zlib and the browser's `CompressionStream` both deflate), so the bytes are the same everywhere and the request hash (§12) is stable. PNG rather than JPEG: lossless, and small for line art.
  - **Size:** Claude's high-resolution models (Opus 4.7 and later) see at most 2576 px on the long edge and 4784 visual tokens (28×28-pixel patches, about 3.75 megapixels); a larger image is shrunk by the API, out of our control. So we decide: shrink a page ourselves (deterministically) to fit, and send wide systems as they fit, or with measure crops alongside (§14). Other limits: 10 MB per image (base64) on Anthropic's API, 5 MB on Bedrock and Vertex, 32 MB per request.
  - **Coordinates:** boxes a model returns refer to the image it was sent; with our fractions of the image (§6) they map back to the page however the image was shrunk.
  - **Gemini** has its own limits and resolution settings; to check when we use it.
- **Wire the LLM adapters into the Worker** (§7.2): an endpoint the pipeline calls, call records (§5.2), costs and the spending cap (§10).
- **Keep the device awake while a pipeline runs** (the browser's Screen Wake Lock): the browser drives the pipeline, so a phone that goes to sleep pauses the run. The lock only holds while the app is in front; switching to another tab or app releases it. A run that was paused anyway must resume where it stopped.
- **Never lose an LLM answer that was paid for:** a request may be in flight when a phone suspends the page or the tab is closed. The Worker must finish the call and store the answer (§5.2) even though the browser has gone, so that resuming finds it and doesn't pay for the same request again.

### Experiments (some day)
Possible improvements to accuracy or speed, deliberately left out of the first prototype.
- **Pitch guides,** if extraction turns out painfully slow: faint labelled lines for the staff lines and ledger-line positions (E4, G4, …, C6) drawn on each crop, so the model reads a label instead of judging a pixel height, its biggest time sink in the manual run (§13). It needs the staff lines detected, which is error-prone, and a wrong detection would make the extraction worse.
- **Printed symbols instead of pitches, for accidentals and 8va** (a proposal, not decided; a big change to the lens, the code and the prompts). The model reports what is printed, and code works out what it means:
  - **Accidentals:** five markers, `\flat`, `\sharp`, `\natural`, `\doubleflat`, `\doublesharp` (names LilyPond uses for these glyphs in text markup, so a model is likely to recognize them), each directly before the note it is printed for, which also gives its position on the staff; nothing else may come between (no rest, bar line, bracket, slur or other mark), and in a chord it goes inside the brackets (`<\flat g' b' d''>`). The model reports exactly the accidentals printed, all of them and nothing implicit. Note names are positions on the staff: a G that sounds G♭ because of the key signature or an earlier accidental is written `g`. LilyPond's own suffixes (`ges`, `fis`) are rejected by the parser, so a pitch name can't mean two things.
  - **Code resolves the pitch** from the key signature and the accidentals earlier in the measure: same staff position and octave, the same staff, all voices on that staff (so code has to add up durations to know which notes come after an accidental), until the bar line, carried over it by a tie. Only this common modern rule; `analyze` doesn't report other conventions, which wouldn't be reliable and would add to an already complex task.
  - **8va by the same principle:** notes are written where they are printed, under the 8va line, which stays a mark, and code transposes them. The manual run switched to sounding pitch under 8va midway (§13), so this also settles that.
  - **Clefs stay as they are:** the note names depend on the clef, as in LilyPond. Going further from what the models were trained on would make the lens too hard to write, and above all to read: a reviewer that has to work out the actual music behind the text can't easily reason about harmony.
  - **Why:** the model looks only at the note in front of it. In the manual run it wrote G♮ for a G♭ whose flat was in the key signature far to the left (§13), and a missed flat on the first G of a measure spoils every later G in it: six fixes. With symbols, a missed flat is one mistake, and fixing it fixes the other notes too; the same for a misread 8va line. A misread duration early in a measure can change which notes an accidental reaches, although the model sees the note to the right of it; that is accepted, since fixing the duration fixes the pitch too, and a note clearly right of an accidental is a hint that the duration doesn't fit. MEI keeps the written accidental (`accid`) apart from the sounding one (`accid.ges`), and both are filled exactly; Verovio prints `accid` as given, so the rendering shows the page's accidentals, courtesy ones included, instead of choosing its own. A printing error (an accidental the engraver forgot) stays visible, and a reviewer can raise it.
  - **The model still uses its understanding of the music:** reporting symbols is its task, and interpreting what it sees is how it does it well. Musical sense fills gaps and decides what isn't fully clear on the page (a smudged accidental, a faint note); it is why LLMs give better results than OMR. The prompt says so; only where the page is clear does what is printed win over what would be likely.
  - **Cautionary accidentals** (reminders that don't change the pitch, often in parentheses) are reported like any printed accidental, as courtesy accidentals; the parentheses are typesetting, which a renderer can add back following the user's preference. `review`'s prompt says so, so that a reminder accidental written without its parentheses isn't taken for a mistake.
  - **The lens is then no longer a subset of LilyPond,** only a format that borrows LilyPond's notation: `g` no longer means G natural, and the markers and the 8va rule are ours.
  - **The risk:** it deviates from the LilyPond the models were trained on, 8va even more than accidentals. Measured on the test set against plain LilyPond. A lighter variant: the model writes sounding pitches *and* marks the printed accidentals, and code only checks the two against each other (a pitch that differs from what the key and the measure imply, without a printed accidental, contradicts the page).

### Optional
- **Dates up to about a week old as "how long ago"** ("Created 2d ago"), older ones as a date (§5.7).

## 16. Roadmap

Whether to build the app at all is decided by evidence first (steps 1–4).

1. **Evaluation tooling:** the engrave command and the viewer (§13). *Done.*
2. **Baselines from existing tools:** *Done.* Extract test-set pieces with existing services, paid ones included. The aim is the best transcription obtainable without building anything new. MusicXML outputs are judged by rendering them directly (plus automated checks such as measure durations), not after a lossy `musicxml2ly` conversion. Tools and results: §13, "Baselines". Audiveris is installed only from https://github.com/Audiveris/audiveris/releases: `audiveris.com` and `audiveris.net` are scam sites.
3. **Manual run of the intended pipeline:** extract a few test-set pieces by following §6–7 by hand (cropping, prompting the LLMs, assembling), without building the app. *Done* for Bendel p4 with Claude Opus 5.5 in a chat (§13, "The manual run"; its lessons are in §6).
4. **Decision:** compare 3 against 2 in the viewer and decide whether to build the app. Possible reasons: better results, equal results more cheaply or faster, an open tool that does the job well and gives the user full control and transparency, or simply wanting to.
   *Decided (2026-10-06): build it.* Every existing tool tested, paid or free, was far from usable. Opus 5.5 in a chat was far better, and with this design plus the improvements documented in the notes it should work very well.
5. **Fold the notes into this document:** *Done (2026-10-11).* The notes of 2026-10-02 to 2026-10-06 (baselines, formats, MEI, the manual run) are in §1, §6 and §13, and the notes file is deleted.
6. **Build the app,** after or in parallel with step 5, from the outside inwards as usual. First milestone, a vertical slice:
   1. Pick a PDF (local file only) → hash → upload to R2 → project in D1. *Built, local only.* The "+ New project" button picks a PDF, the browser hashes it, and one request (`POST /api/projects`) stores it in R2 and adds a row to the `projects` table in D1 (`id`, `name`, `pdf_sha256`, `pdf_filename`, `created_at`, `last_modified_at`, `last_opened_at`), with the default name from §4. The API can also rename a project (`PATCH /api/projects/<id>`, 409 if the name is taken) and record that it was opened (`POST /api/projects/<id>/opened`), and lists all projects, most recently opened first (`GET /api/projects`).

      The header has a **project picker**. Narrow screens show the wordmark and "+ New project" on one row and the picker on its own row below. From 1024 px, everything is on one row, with the picker in the middle. The **open project is part of the URL** (`#/projects/<id>`), so it survives a reload, each tab has its own, and the back button and bookmarks work. Any other URL means no project is open, which is how a fresh tab or device starts. "Last opened" is shared by all devices and only sorts the list: a project created or opened elsewhere never changes what this tab shows. The picker shows the open project's name, or "Open a project". Opening the picker turns the name into a filter field over all projects (name, how long ago it was opened, PDF file name). Picking a project opens it and marks it as opened; creating a project opens it too. Loading a URL or going back doesn't mark the project as opened. The list is fetched when the app loads.

      Picking a PDF first looks up its hash (`GET /api/pdfs/<sha256>?filename=...`, which returns the PDF's projects, most recently opened first, and the name a new project would get). An unknown PDF is uploaded and gets a project right away. A known PDF opens a dialog that lists its projects to open one, with "+ New project" as the last item, showing the name the new project would get. A new project on a known PDF is created without uploading the file again (`POST /api/projects` with the `filename` instead of the `pdf`).

      Below the header is the project view (§5.6): the pipeline panel, with mock stages for now, and the artifact view. What is left to do here is in §15.

      Note: the Worker's entry module (`apps/worker/src/index.ts`) may only export handlers: the Workers runtime refuses to start otherwise, and the tests (which import the module directly) don't notice. Helpers live in their own modules (e.g. `names.ts`).

      The D1 schema for the stages exists (§5.8, migration 0003). Next: the stages.

      **The manual stages come later.** At first, when a model gets something wrong and the author wants it fixed, the fix goes in as a manual stage without a UI: a small internal API endpoint takes the corrected output (e.g. the fixed boxes as JSON) and adds it as a manual stage after the stage it corrects, and the stages after it run again as designed. Stored outputs are never edited in place (§5.4: a finished stage never changes). The data is the same as the real manual stages will produce later.
   2. Extract page images deterministically → OPFS → show in the UI. *The extraction, skew detection and rotation exist* (§8.1, §8.2, §8.4), not yet in the app.
   3. `layout` of one page → system boxes and bar lines; `fix_layout`.
   4. Crops → `extract` of one system with context → checks.
   5. Record the LLM calls, turn the result into the first fixture, and compare against the baselines in the viewer.

   Then: `assemble`, `review` and `apply_review`, `human_review`, the pipeline of stages in D1 and in the UI (§5.1), manual stages (§5.4), re-running from a stage with confirmation (§5.5), regeneration on a second device, Drive integration.

   Also planned, details still to be worked out:
   - **Costs view, statistics, and the spending cap** (§10).
   - **Deleting a project** (§4).
   - **Running the pipeline on the server** (optional but desirable; big, and tricky to get right). Today the browser drives the pipeline and does all the PDF and image work, so a run only advances while the app is open and, on a phone, on screen.
     - **Preferred: all-in.** The whole pipeline runs on the server, PDF and image work included. The browser only shows results and takes the user's input, and a run doesn't depend on any device.
     - **Whether that is possible is the thing to think about first.** A Cloudflare Worker has little memory and, on the free plan, almost no CPU time, and it has no canvas to render vector PDFs with. Image work may need the paid plan ($5/month), or a container, or may not fit Cloudflare at all.
     - **In its favour:** the image operations are our own TS/WASM code (§8.2), not the browser's, so they can run elsewhere. With one place doing the image work, the effort to get identical pixels on every device (§8) would mostly fall away.
     - **Against it:** derived images would live in R2 and not on the device, 150–300 MB per PDF (§2), which eats the free 10 GB quickly; and "no server-side compute" (§2) is one of the reasons the app is free to host.
     - **Fallback: a split.** The browser keeps the PDF and image work (the short part at the start) and uploads the crops to R2; the server runs the remaining stages on its own (the LLM calls, the light checks and the assembly between them) with Cloudflare's building blocks for long-running, resumable work (Workflows, Durable Objects). Waiting for an LLM doesn't count against a Worker's CPU limit, so this may fit the free plan. To be checked against the current terms.
     - Either way, first find out how long a real extraction takes. Until then: keeping the device awake and reliable resuming (§15).
   - **Entering the LLM keys in the app** (optional). The keys are stored in D1, encrypted with one master key, which is the only secret left to set on the host. The Worker decrypts a key only to call the provider and never sends it back to the browser: the settings page shows "set", and perhaps the last four characters. Whoever gets past the login can replace a key, but not read one.
     - **Why:** it decouples the app further from Cloudflare. A SQLite database, object storage, a server and one secret can be had from other providers, and with the right ports and adapters (§3) the app becomes portable. Setting up the keys is then the same on every host, and so is the user guide. It is also more convenient: a key can be changed from the app, on any device.
     - **The price:** code that handles secrets, which has to be right.
   - **Keeping manual fixes per item** (optional, not thought through): when a manual stage's input changes for only some items, keep the fixes on the items whose input didn't change, and drop only the others, instead of dropping the whole stage (§5.5). Well-meant, but it makes the behaviour harder for the user to understand: which fixes survive a re-run would depend on details of the input.
   - **A "final touches" stage** (optional, late): the user edits the MEI directly in the app, in a code editor, validated and rendered again on saving. No stage can be added after it, so the issues, which a direct edit leaves unreliable, are no longer needed; its result goes to the export. Replacing the MEI by uploading a file edited in another program (MuseScore reads and writes MEI) is left out: such a round trip can lose the IDs that tie measures to the original.
   - **Desktop version** (optional, §3): Electron around the same app and server, with Node adapters for D1 and R2 and secrets in a local file.
   - **Forking a project** from a given stage: a new, separate project that starts with the original's pipeline up to that stage. Each project keeps its own linear history. Behind the scenes, the fork reuses the original's stage outputs without duplicating them.
