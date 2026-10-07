# Design Document — Score-to-LilyPond Pipeline (v2)

> Status: draft, pre-implementation. The early assessment (§16 steps 1–4) is done and the app will be built. Before building, the findings in `NOTES-2026-10-formats.md` are folded into this document (§16 step 5). This document records the architecture, the reasons behind it, and the known risks with proposed mitigations. Items marked **Proposed** are leading candidates, not final decisions. **Open questions** are collected in §15.

## 1. What this app is

A web app that converts PDFs of music scores into **LilyPond source code**.

- **Input:** a PDF, usually a scan of an old score, sometimes a digitally typeset (vector) PDF.
- **Output:** LilyPond source, optionally with an engraved rendering for side-by-side comparison with the original.
- **Focus:** the **pipeline**, not just the end result.
  - Every step is configurable.
  - Every intermediate input and output can be inspected.
  - Any part of the pipeline can be re-run from the first stage that went wrong, with a different configuration.
  - Any intermediate artifact can be edited by hand, and the pipeline resumes from the edited version.
- **Recognition is done by vision LLMs** (e.g. Gemini, Claude), steered by programmatic steps and human assistance. Programmatic steps handle the deterministic work: image handling, structure, checks, assembly. Humans assist where machines are unreliable, for example cropping heavily ornamented old scores.

### Lessons from v1
v1 was Python-only, local-only and command-line-only.

**What failed:** heavy programmatic preprocessing (cropping, deskewing, stain removal) followed by Audiveris (MusicXML) and `musicxml2ly`.
- Ornamented old scores were impossible to handle with scripts.
- Audiveris failed badly on them.

**What carries over:**
- The stage-tracking system: detecting finished stages, resuming interrupted runs, re-running stages, with hash checks and JSON documentation. It is the basis for §5.
- The LilyPond output conventions in §7.3.

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
- **Possible later: image input (PNG, JPEG)** in addition to PDFs. It is almost no extra work: an image is a page image, so it skips PDF extraction and joins the same pipeline at stage 1 (§6), with JPEGs going through the same bundled decoder (§8.1).

### Goals
- **Quality first:** the measure of success is how good the LilyPond is and how little human correction it needs. Infrastructure only exists to serve that.
- **Cheap:** runs on free tiers. Paid LLM calls are the only expected running cost.
- **Transparent:** open source, simple deployment, documented strategy (this file).
- **Runnable from anywhere:** start on the desktop, continue on the phone. Every pipeline stage should work on both.
- **Reproducible and testable:** every artifact can be traced back to its inputs, code version, prompt version, model and configuration. Non-deterministic parts (LLM calls, human input) are recorded so they can be replayed (§12).

### Non-goals (for now)
- Multiple users, sharing, collaboration. Each person deploys their own instance to their own Cloudflare account, with their own secrets, so the app has no user accounts and none are planned.
- MusicXML output.
- Offline-first operation.

## 2. Architecture overview

```mermaid
flowchart LR
  subgraph Device["Browser (desktop or mobile)"]
    UI[React UI]
    WW["Web Workers:<br/>PDF decoding, image processing,<br/>fingerprints, LilyPond-subset checks,<br/>preview rendering (proposed)"]
    OPFS[("OPFS:<br/>derived images (cache)")]
    UI <--> WW
    WW <--> OPFS
  end

  subgraph CF["Cloudflare (EU jurisdiction)"]
    W["Worker (Hono):<br/>API, auth boundary, LLM proxy"]
    D1[("D1 (SQLite):<br/>projects, configs, text artifacts,<br/>provenance, LLM call records")]
    R2[("R2:<br/>original PDFs by SHA-256,<br/>non-regenerable binaries")]
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
| Projects, step configs, provenance, fingerprints | D1 | Small, structured, relational. SQLite is easy to inspect and migrate. |
| Text artifacts (analysis JSON, LilyPond fragments, review findings, human operations) | D1 | Small, must never be lost, often not reproducible. |
| LLM call records (full request + response) | D1 (large payloads in R2) | Needed for provenance, cost tracking and replay tests (§12). |
| Derived images (page images, preprocessed pages, system crops) | OPFS on the current device | Large (roughly 150–300 MB per PDF in colour, a third of that in grayscale) but regenerable from the PDF plus the recipe. Device-local means real deletion, no cloud quota, and no data residency issue. |
| Final exports (LilyPond, optional engraved PDF) | Download, or an app-created folder in Google Drive | The user's own file space. Browsable anywhere. |

### Why this split
- **No server-side compute.** Workers have tight CPU limits and no native libraries. All heavy processing happens in the browser, so the Worker stays a thin API and LLM proxy, and stays on the free tier. Waiting on an LLM response doesn't consume Worker CPU time.
- **Images are cache, not data.** This removes the biggest storage cost entirely. Switching devices costs some regeneration time, not storage.
- **Everything persistent is small** (text in D1) or **content-addressed and immutable** (PDFs in R2).

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
| PDF handling | pdf.js, version pinned | Renders vector PDFs and decodes CCITT/JBIG2 images in JS, deterministically. |
| JPEG decoding | Bundled JS/WASM decoder (e.g. libjpeg-turbo WASM, jpeg-js), not the browser's | Browser JPEG decoders may differ by about ±1 gray level. A bundled decoder gives identical pixels everywhere. |
| Vision LLMs | Gemini for layout (bounding boxes). Gemini and/or Claude for transcription and review. Configurable per step. | Gemini is trained to return bounding boxes (normalized 0–1000). Both are strong readers. Swappable behind the `LlmProvider` port and compared on the test set. |
| Structured LLM output | Provider-native schema-constrained output, validated with Zod | Machine-checkable outputs. No free-form parsing. |
| Schema validation | Zod (or similar) | Validates step configs, LLM outputs and DB payloads. The same schema generates the UI controls (toggles, sliders). |
| Preview rendering | **Proposed:** Verovio (WASM) in the browser, fed by a TS converter from our constrained LilyPond subset | Keeps review and preview rendering runnable everywhere. See §9. |
| Google Drive | Google Identity Services + Google Picker + `drive.file` scope, entirely in the browser | `drive.file` is non-sensitive: no app verification, and access only to files the user picks or the app creates. |
| Local development | `wrangler dev` (local D1/R2 emulation) + Vite dev server, run as two processes. Vite proxies `/api` to Wrangler. No Cloudflare Vite plugin. | One code path from day 1. Keeps the app and the Worker as separate packages with a clear boundary. |
| Deployment | One Worker with static assets: `apps/worker`'s Wrangler config serves `apps/web`'s build output. `wrangler deploy` uploads both. | One origin: no CORS, one Access policy, app and API always deployed at the same version. |
| Tests | Vitest | Pure-TS core runs in Node for unit, golden-image and replay tests. |

### Repository layout (suggested)

```
packages/
  core/      Pipeline engine, artifact model, step definitions, config schemas.
             Pure TypeScript, no DOM and no Cloudflare APIs.
  imaging/   Decoders, deterministic image operations, fingerprints. Pure TS/WASM.
  notation/  Constrained-LilyPond parser, structural checks, skeleton builder,
             assembler, converter for preview rendering.
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
| `BlobStore` (original PDFs) | R2 via the Worker. In-memory for tests. |
| `ProjectStore` (projects, artifacts, provenance) | D1 via the Worker. SQLite or in-memory for tests. |
| `DerivativeCache` (regenerable images) | OPFS. In-memory for tests. |
| `LlmProvider` | One adapter per provider (via the Worker). **Replay** adapter for tests. |
| `Renderer` | **Proposed:** Verovio in the browser. Optional: LilyPond (local install, container). See §9. |
| `ExportTarget` | Browser download, Google Drive folder |

## 4. Identity and projects

- A PDF is identified by the **SHA-256 of its bytes**, computed on the device with `crypto.subtle.digest` **before** uploading.
- When a PDF is selected, the app asks D1 whether the hash exists:
  - **Unknown:** upload to R2 at `pdfs/<sha256>.pdf` and create a project.
  - **Known:** offer to resume an existing project on this PDF, or start a new one. There can be several projects per PDF.
- The file name and source (Drive ID, local path) are stored as informational metadata only, never as identity.
- Each project has a **name**, so the user can tell projects on the same PDF apart (e.g. "Sonata, Claude run" vs "Sonata, Gemini run"). The name is a label, not the identity (that is the project ID), but it is unique so it can be relied on:
  - It defaults to the PDF's file name without ".pdf". If a project already has that name, the Worker appends " (1)", " (2)", ... and takes the first free one, like file managers do. A file that is already called `Sonata (1).pdf` becomes `Sonata (1) (1)`, also like file managers.
  - Uniqueness is case-insensitive ("Sonata" and "sonata" clash) and enforced by the database (`UNIQUE COLLATE NOCASE`), so two projects created at once can't get the same name. Names are trimmed, never empty, and at most 200 characters.
  - The user can rename a project at any time. Renaming to a name that is taken is refused with a message, not numbered: numbering only applies to the default.
  - Deleting a project frees its name.
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

Each step declares:
- `id` and `version`, e.g. `transcribe_system@3` (see §11).
- A **config schema** (Zod), which is also the source of its UI controls.
- **Input** and **output artifact types**.
- **Granularity:** per document, per page, or per system. Steps can fan out, e.g. one page becomes many systems.
- Its **kind:** `deterministic` (code), `llm`, or `human`.
- Its **runtime:** browser (Web Worker) or Worker proxy (LLM calls).

### 5.2 Artifacts and provenance

Every step output is an artifact with:
- `step id@version`
- a canonical config hash (JSON with sorted keys)
- the IDs of its input artifacts
- its `origin` (`computed` | `llm` | `manual` | `imported`)
- a fingerprint (for images, see §8.3)
- a timestamp

LLM artifacts additionally reference their **call record**: prompt template version, filled-in context, image hashes, exact model ID, parameters, full response, token usage and cost.

A **cache key** = hash(step id, version, canonical config, input artifact IDs).
- Re-running a step with identical inputs and config hits the cache.
- Artifacts of later stages may already exist when an earlier stage is run again with the same inputs and config. They are found through the cache key and reused.

Every artifact has a row in D1, which belongs to the stage that produced it and says whether the artifact's content is stored (and where: D1 or R2) or only its recipe (§5.3).

### 5.3 Persisted vs. regenerable (important)

- **Deterministic** artifacts (page images, preprocessing, crops, assembly) store only their **recipe plus fingerprint**. Images live in OPFS and can be regenerated. Small text outputs may be stored anyway for convenience.
- **LLM** and **human** artifacts **must be persisted**. They cannot be regenerated: re-running an LLM call gives a different answer and costs money.
- Rule: *anything you would hate to lose must never exist only as a cached image.*

### 5.4 Manual stages

The user intervenes by adding a manual stage to the pipeline. The manual stages foreseen so far:
- fix deskewing angles
- fix content crops
- fix system crops
- fix measure crops
- fix extracted metadata (composer, title, edition etc.)
- fix musical content: at any point after the first transcription, before and/or after any review stage
- answer questions about uncertainties that a model flagged

Rules:
- **One manual stage covers the whole PDF,** however many items are fixed in it. Fixing twelve measure crops is one "fix measure crops" stage, not twelve. Otherwise the pipeline shown in the UI would get too long.
- The artifacts of a manual stage have `origin = manual` and the corrected artifact as their parent.
- Edits to images are stored as **replayable operations** in D1, not as edited pixels: crop windows, deskew angles, masks as vector strokes. Replaying them on the regenerated base image reproduces the edited result.
- Text artifacts (analysis JSON, transcribed music) are stored edited, with a diff to their parent.

### 5.5 Resuming and re-running
- **The history of a project is linear.** There are no branches inside a project.
- Changing something in the middle (e.g. the config of stage N, or a manual stage added there) means running everything after that point again. The results of the later stages are replaced.
- Before that happens, a dialog asks for confirmation and explains what will be lost: the LLM calls already paid for in the later stages, and the manual work put into them.
- To keep the old results and try something else, the project is forked (planned, §16), not branched.
- Execution is lazy and per item: only the pages and systems being looked at, or needed downstream, are computed.

## 6. Pipeline stages (initial plan)

| # | Stage | Kind | Granularity | Output |
|---|---|---|---|---|
| 0 | Ingest | deterministic | document | PDF in R2, project in D1 |
| 1 | Page images | deterministic | page | Page image (OPFS) + fingerprint |
| 2 | Light preprocessing (deskew, contrast, optional binarization; colour is kept by default, §8.1) | deterministic + human (angles) | page | Preprocessed image + recorded parameters |
| 3 | Global analysis | llm | page + document | Structured JSON (see below) |
| 4 | Layout correction | human (+ deterministic snapping) | page | Confirmed system boxes, normalized coordinates |
| 5 | System crops | deterministic | system | Crop images. Wide systems optionally split into overlapping halves (§8.5). |
| 6 | Score skeleton | deterministic (+ human confirmation) | document | LilyPond structure: staves, voices, variable names, staff changes |
| 7 | Transcription | llm | system | Structured JSON: music per voice, measure count, uncertainty list |
| 8 | Structural checks | deterministic | system | Check results (§7.4) |
| 9 | Review | llm | system | Findings (§7.5) |
| 10 | Fix | llm or human | system | Revised transcription. At most 1–2 review→fix rounds. |
| 11 | Assembly | deterministic | document | Complete LilyPond source |
| 12 | Export | deterministic (+ optional engraving, §9) | document | `.ly` file, optional engraved PDF |

### Global analysis (stage 3)
One pass over each page, plus a document-level merge. The output is used as context for all later LLM steps:
- **System bounding boxes**, normalized to 0–1000 (Gemini's native format). They are snapped to detected staff lines (horizontal projection) and then confirmed or corrected by the human in stage 4.
- **Metadata:** title, composer, editor, opus, movement titles.
- **Structure:** staves per system, instruments, voices per staff, staff count changes.
- **Musical context:** key and time signatures and their changes, clefs, where themes and melodies begin and end, repeats, and which passages repeat earlier material.
- **Phenomena per system:** multiple voices, lyrics, ossia/alternatives, editorial notes, reduction staff, double systems. These drive the skeleton.

Example of why this matters: a smudged note on one page can be resolved because the global analysis knows the passage repeats a theme from a page that was read without problems.

## 7. LLM steps

### 7.1 Context for each transcription call
- the system crop (or its overlapping halves)
- the relevant global analysis (key, time, clefs, voices, themes, repeated material)
- the score skeleton: which voices to fill and their names
- the LilyPond output of the **previous system**, plus its final state (key, time, clefs, voice positions)
- optionally, the transcription of referenced material (e.g. the theme being repeated)

### 7.2 Structured output
Each call returns JSON validated by a Zod schema: music per voice, measure count, and a list of **uncertain spots** (location, reason, e.g. "smudged, inferred from theme in m. 12"). This uses provider-native schema-constrained output.

### 7.3 LilyPond conventions (carried over from v1)
- **Absolute pitches**, not `\relative`, so an octave error doesn't propagate and systems are independent.
- **Code builds the skeleton.** The score structure (staves, voices, naming, variables) is generated by code. LLMs only fill in music per voice and system, so assembly is concatenation, not merging.
- **Bar checks** (`|`) and `\barNumberCheck` are required in every fragment.
- A fixed, documented **subset of LilyPond** that LLMs may use (notes, rests, chords, ties, slurs, tuplets, grace notes, articulations and ornaments, dynamics, lyrics, voice changes). A constrained output space makes it checkable.

### 7.4 Structural checks (deterministic, browser-side)
A TS parser for the constrained subset checks, without needing LilyPond:
- the fragment parses
- the duration of each measure matches the time signature (accounting for pickups and tuplets)
- bar checks are consistent and measure counts match the global analysis
- expected voices are present, and their names match the skeleton
- pitches are within plausible ranges per clef/staff

Failures go to the fix stage with a precise location. This replaces what LilyPond's bar-check warnings would provide, while staying runnable everywhere.

### 7.5 Reviewer role (proposed: flag, don't fix)
- The reviewer gets the original crop, the transcription, and (proposed, §9) a rendering of the transcription to compare against the original.
- It returns **findings**, not edits. Each finding has a location (system, measure, voice, beat), a type (pitch, rhythm, accidental, missing voice, missing ornament, …), a confidence, and optionally a **suggested patch** for that single measure.
- **Fixes are a separate stage:** re-transcribe the affected system with the findings as context, or a human accepts or rejects the suggested patches. Patches may be auto-accepted only if structural checks still pass.
- **Why flag instead of fix:**
  - A fixing reviewer can silently turn correct notes into plausible wrong ones.
  - Mixing review and editing blurs provenance.
  - Flags can be checked against the original by eye, which tells us whether review is worth its cost.
- At most 1–2 review→fix rounds. If reviewers disagree or findings persist, the system goes to the human.
- A different model than the transcriber is preferred for review.

### 7.6 Prompts and models are code
- Prompt templates are versioned in `packages/prompts` and are part of their step's version.
- Model IDs are pinned exactly, never "latest" aliases.
- Every call is recorded (§5.2), and identical requests are served from the record instead of being paid for again.

### 7.7 Known LLM risk: plausible wrong notes
LLMs fill in "musically likely" content. That is desirable for a smudge and dangerous everywhere else, because the errors look correct. Defenses:
- explicit uncertainty lists
- structural checks
- image-based review
- checking the engraved output against the original on the test set (§13)

## 8. Image processing and reproducibility across devices

### 8.1 Getting page images
- **Scanned PDFs:** extract the embedded page image directly instead of rendering the page.
  - CCITT/JBIG2: decoded by pdf.js in JavaScript, so identical everywhere.
  - JPEG: decoded by the bundled decoder, so identical everywhere.
- **Colour is kept** when the scan has it. On yellowed, stained paper, colour separates ink from stains and paper better than grayscale, and a global binarization threshold can fail entirely (SmartScore's mandatory threshold on Kinderscenen p3 found no usable setting). LLMs bill images by pixel dimensions, not channels, so colour costs nothing extra in LLM calls; only the device cache grows (§2). Grayscale or binarization may replace it after an ablation (§15).
- **Vector PDFs:** render with pdf.js at a fixed DPI, with pixel size computed explicitly as `round(pagePt × dpi / 72)`. Geometry is identical everywhere. Only anti-aliased edges differ slightly between canvas backends, and binarization removes most of that.

### 8.2 Deterministic operations
- All image operations are implemented in our own TS/WASM code, never with canvas transforms or `drawImage` scaling.
- `Math.sin`, `Math.cos`, `Math.exp` etc. are not guaranteed to give identical results across JS engines. Round them to a fixed precision (e.g. 12 decimals) or ship our own implementations.
- Operation chains are ordered. Coordinates refer to the output of the previous step. Define exactly how deskewing sizes its output canvas.
- Human and LLM coordinates are stored in **normalized units**, so they survive regeneration at a different resolution.

### 8.3 Fingerprints: verifying "close", not just "identical"
Stored for every image a human or LLM has worked on, and for every confirmed system box. Checked after each regeneration in three tiers:

1. **Exact:** pixel dimensions plus SHA-256 of the **raw decoded pixels**. This is not a hash of the PNG file, since PNG encoders differ.
2. **Close:** a downsampled grayscale thumbnail (64×64 to 128×128). Compare the regenerated image downsampled the same way:
   - mean absolute difference below about 1 gray level, and
   - no single tile above a few gray levels.
3. **Mismatch:** flag the project and ask the human to re-check the affected boxes and angles.

### 8.4 Device constraints
- **Memory:** a 300 dpi page held in canvas memory is about 35 MB, and mobile Safari strictly limits total canvas memory. Process one page at a time in a Web Worker, using typed arrays / `OffscreenCanvas`.
- **Latency:** generate lazily, current page first.
- **Eviction:** call `navigator.storage.persist()`, but assume the OPFS cache can disappear at any time. Missing derivatives are simply regenerated.
- **Rotation:** an LRU cache with a configurable size limit. Deletion is real deletion.
- **Bundle size:** avoid OpenCV.js (about 10 MB). With LLMs doing the reading, preprocessing is light enough to write by hand.

### 8.5 Image resolution sent to LLMs
Models downscale large images (Claude to roughly 1568 px on the long edge; Gemini has configurable media resolution). Piano systems are wide, so on dense systems noteheads can become a few pixels tall. Mitigations:
- split wide systems into overlapping halves, with a defined overlap in measures and a merge rule
- choose the resolution setting per provider
- test both on the test set

## 9. Rendering (proposed)

**Goal:** every pipeline stage runs on any device, desktop or mobile, with no local helper and no paid compute.

**Problem:** LilyPond is a native program. It runs neither in the browser nor in a Worker, and there is no practical WASM build. A desktop helper would break "runnable from anywhere". An always-on container (Cloudflare Containers) would break "free tier only", since it needs the $5/month paid plan.

**Proposal:** separate *checking* and *previewing* from *engraving*.

| Need | Solution | Runs |
|---|---|---|
| Rhythm and structure checks | Constrained-subset parser (§7.4) | Browser |
| Visual preview for the human and the reviewer | TS converter: constrained LilyPond subset → MEI (or MusicXML), rendered with **Verovio** (WASM) to SVG | Browser |
| Final engraving (the "real" LilyPond PDF) | Outside the pipeline: compile the exported `.ly` locally. Optionally a paid container later, behind the same `Renderer` port. | Optional |

**Reasons:**
- Because LLM output is restricted to a documented subset (§7.3), converting it is a bounded task, unlike converting arbitrary LilyPond.
- Verovio's engraving differs from LilyPond's, but for comparing pitches, rhythms, voices and ornaments against the original, that doesn't matter.

**Risks:**
- Converter bugs could cause false review findings. Mitigation: converter golden tests, plus the occasional real LilyPond compile of exported files as a cross-check.
- The subset must be rich enough for piano (multiple voices, cross-staff notation, grace notes, ornaments, tuplets, lyrics). The converter grows with the subset.
- Verovio adds a few MB to the download. Load it lazily, only in review and preview views.

## 10. External services

| Service | Use | Notes |
|---|---|---|
| Cloudflare Workers (static assets + API) | Hosting | Free tier. No heavy compute. |
| Cloudflare D1 | Database | EU jurisdiction set at creation. Cannot be changed later. |
| Cloudflare R2 | Original PDFs, large LLM payloads | EU jurisdiction bucket. Cannot be changed later. |
| Cloudflare Access | Login | Protects everything, including the API. |
| Google Drive | Picking source PDFs. Optional export target. | `drive.file` scope, Picker for selection, app-created export folder. Publish the OAuth app to "production" status (even unverified), because refresh tokens expire after 7 days in "testing" status. |
| Vision LLMs | Global analysis, transcription, review | Called **only through the Worker**: API keys stay in Worker secrets. |

### Data residency
- PDFs (R2) and text (D1) are in EU-jurisdiction Cloudflare storage. Images stay on the device unless sent to an LLM.
- Cloudflare is a US company. An EU jurisdiction guarantees **where** data is stored, not which legal regime ultimately applies. This is acceptable for this project.
- **LLM calls are the residency gap.** For EU processing:
  - Gemini and Claude are both available in EU regions through Google Vertex AI. Claude is also available through AWS Bedrock.
  - The plain provider APIs give no such guarantee.
  - On Google AI Studio's free tier, inputs may be used to improve Google's products.

  Document the choice per provider in the config.

### Cost
- Storage and hosting: free tiers.
- LLM calls: cents per call. Roughly per PDF: about 12 page analyses, about 50 system transcriptions, plus reviews and fixes. Cheaper models (e.g. Flash-class) for easy steps, stronger models where accuracy matters.
- Every call is logged with its cost. The UI shows per-project and monthly totals.
- **Cost estimate before running** (planned): the app estimates what extracting a score will cost before the user starts, and reports the real cost afterwards, so anyone using it knows what a score costs to extract.

## 11. Versioning

- **Step versions are explicit and immutable.** An algorithm change that would invalidate human input (e.g. stored system boxes) is a new step version, such as `crop_to_systems_v2`. The old one stays in the codebase, and projects record which version produced each artifact.
- **Part of a step's version:**
  - library versions (pdf.js, decoders, Verovio)
  - prompt template versions
  - pinned model IDs
- Load old step versions lazily with dynamic `import()`.
- If the number of versions grows unmanageable: release **app v2.0**, declare v1.x project data incompatible, and start fresh. This is acceptable while there is a single user.
- **D1 schema migrations** use `wrangler d1 migrations`.

## 12. Testing and reproducibility

**Principle:** deterministic parts are tested directly. Non-deterministic parts (LLM calls, human input) are **recorded and replayed**.

- **Unit tests:** image operations, parser, structural checks, skeleton builder, assembler, converter.
- **Golden-image tests:** deterministic image pipelines produce known raw-pixel hashes, or fingerprints within tolerance (§8.3).
- **Fixture projects:** real scores with recorded LLM call records (request + response) and recorded human operations (boxes, angles, accepted patches), stored in `fixtures/`.
- **Replay tests:** run a fixture end to end with the replay `LlmProvider`.
  - Deterministic steps must reproduce identical artifact hashes. LLM and human steps return their recordings.
  - This tests the plumbing, assembly and resume logic with no API cost.
- **Stale recordings:** a changed prompt or model changes the request hash, so replay misses. The test reports exactly which recordings are stale, and they are re-recorded against the live API.
- **Quality evaluation** is separate from tests (§13): live runs, with repeated runs to measure variance. A temperature of 0 doesn't guarantee identical answers.

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

### Use
- Compare methods, prompts and models side by side by eye.
- Cost per piece comes from the LLM call records (§10).

## 14. Things to pay special attention to

| Risk | Mitigation |
|---|---|
| **Infrastructure work crowding out quality work** (plumbing is fun) | Validate the approach by hand before building (§16). Measure quality on the test set early and often. |
| Losing LLM output or human input because it was treated like cache | §5.3: LLM and human artifacts are always persisted. Eviction only touches deterministic artifacts. |
| Plausible but wrong notes from LLMs | §7.7: uncertainty lists, structural checks, image-based review, measured slip-through rate. |
| Regenerated images drifting from what the human or LLM worked on | §8: deterministic decoding and operations, normalized coordinates, fingerprint checks. |
| Downscaled system images losing detail | §8.5: overlapping halves, resolution settings, tested per provider. |
| Converter/preview bugs producing false review findings | §9: converter golden tests, occasional real LilyPond cross-check. |
| ML costs creeping up | Per-call cost logging, reuse of recorded requests, cheaper models for easy steps. |
| Two devices editing the same project | Optimistic locking (§4). |
| Irreversible infrastructure choices | D1 and R2 jurisdictions are set at creation. Scripted in the repo. |

## 15. Open questions

- **Rendering:** confirm the Verovio-based proposal (§9), or drop rendering from the pipeline entirely and review from crop + LilyPond text only (as in v1). Decide after testing whether rendered previews measurably improve review quality.
- **Reviewer details:** flag-only versus auto-accepted patches. Same model or a different one. Number of rounds. Decide by comparing results with and without review on the test set.
- **Model choice per step:** which models for analysis, transcription and review, and at what price/quality point.
- **Splitting wide systems:** always, never, or based on density. The overlap size and the merge rule.
- **Constrained LilyPond subset:** exact definition, especially for cross-staff notation, ornaments, ossia and lyrics.
- **Colour vs. grayscale vs. binarized** page images for the LLM steps: decide by ablation on the test set (§8.1).
- **LLM provider access:** direct APIs versus Vertex AI / Bedrock for EU processing.
- **D1 schema for stages and artifacts** (§5): not designed yet.
- **What re-running from a stage discards** (§5.5): the later stages' artifacts are replaced, but the LLM call records are also what the cost totals (§10) and the reuse of identical requests (§7.6) are built on. Decide whether the records of replaced stages are kept.

## 16. Roadmap

Whether to build the app at all is decided by evidence first (steps 1–4).

1. **Evaluation tooling:** the engrave command and the viewer (§13). *Done.*
2. **Baselines from existing tools:** *Done.* Extract test-set pieces with existing services, paid ones included. The aim is the best transcription obtainable without building anything new. MusicXML outputs are judged by rendering them directly (plus automated checks such as measure durations), not after a lossy `musicxml2ly` conversion. Candidate tools and prices: `NOTES-2026-10-formats.md`. Audiveris is installed only from https://github.com/Audiveris/audiveris/releases: `audiveris.com` and `audiveris.net` are scam sites.
3. **Manual run of the intended pipeline:** extract a few test-set pieces by following §6–7 by hand (cropping, prompting the LLMs, assembling), without building the app. *Done* for Bendel p4 with Claude Opus 5.5 in a chat (`NOTES-2026-10-formats.md` §8).
4. **Decision:** compare 3 against 2 in the viewer and decide whether to build the app. Possible reasons: better results, equal results more cheaply or faster, an open tool that does the job well and gives the user full control and transparency, or simply wanting to.
   *Decided (2026-10-06): build it.* Every existing tool tested, paid or free, was far from usable. Opus 5.5 in a chat was far better, and with this design plus the improvements documented in the notes it should work very well.
5. **Fold the notes into this document:** review the design and `NOTES-2026-10-formats.md` once more, update the decisions (target and storage format, lens, prompts, caps, cross-system handling, musical content vs typesetting, review, content crops and measure crops as stages in §6), fold everything into this document, then delete the notes file.
6. **Build the app,** after or in parallel with step 5, from the outside inwards as usual. First milestone, a vertical slice:
   1. Pick a PDF (local file only) → hash → upload to R2 → project in D1. *Built, local only, not yet tried by hand in the browser.* The "+ New project" button picks a PDF, the browser hashes it, and one request (`POST /api/projects`) stores it in R2 and adds a row to the `projects` table in D1 (`id`, `name`, `pdf_sha256`, `pdf_filename`, `created_at`, `last_modified_at`, `last_opened_at`), with the default name from §4. The API can also rename a project (`PATCH /api/projects/<id>`, 409 if the name is taken) and record that it was opened (`POST /api/projects/<id>/opened`), and lists all projects, most recently opened first (`GET /api/projects`).

      The header has a **project picker**. Narrow screens show the wordmark and "+ New project" on one row and the picker on its own row below. From 1024 px, everything is on one row, with the picker in the middle. The **open project is part of the URL** (`#/projects/<id>`), so it survives a reload, each tab has its own, and the back button and bookmarks work. Any other URL means no project is open, which is how a fresh tab or device starts. "Last opened" is shared by all devices and only sorts the list: a project created or opened elsewhere never changes what this tab shows. The picker shows the open project's name, or "Open a project". Opening the picker turns the name into a filter field over all projects (name, how long ago it was opened, PDF file name). Picking a project opens it and marks it as opened; creating a project opens it too. Loading a URL or going back doesn't mark the project as opened. The list is fetched when the app loads. The UI can't rename a project yet.

      Picking a PDF first looks up its hash (`GET /api/pdfs/<sha256>?filename=...`, which returns the PDF's projects, most recently opened first, and the name a new project would get). An unknown PDF is uploaded and gets a project right away. A known PDF opens a dialog that lists its projects to open one, with "+ New project" as the last item, showing the name the new project would get. A new project on a known PDF is created without uploading the file again (`POST /api/projects` with the `filename` instead of the `pdf`). Still missing from §4:
      - The Worker does not hash the PDF. R2 checks the bytes against the client's hash and refuses a mismatch, which currently surfaces as a plain HTTP 500.
      - The remote R2 bucket and D1 database don't exist yet (`wrangler.jsonc` has a placeholder database ID), so the app can't be deployed.
      - No shared package yet: the `Project` type exists in both `apps/web` and `apps/worker`, and `sha256Hex` in both `apps/web` and `apps/eval`.
   2. Extract page images deterministically → OPFS → show in the UI.
   3. Global analysis of one page with Gemini → system boxes + metadata. Human correction of the boxes.
   4. Crop systems → transcribe one system with context → structural checks.
   5. Record the LLM calls, turn the result into the first fixture, and compare against the baselines in the viewer.

   Then: assembly across systems, review (with or without preview rendering), the pipeline of stages in D1 and in the UI (§5.1), manual stages (§5.4), re-running from a stage with confirmation (§5.5), regeneration on a second device, Drive integration.

   Also planned, details open:
   - **Cost estimate before a run, real cost after it** (§10), shown to the user per score.
   - **Report remaining uncertainties** after the review step, so the user knows where to look.
   - Possibly a **side-by-side viewer for human review** in the app (like the evaluation viewer, §13).
   - Possibly a **human → machine feedback step** for last corrections (the human points out errors, the model fixes them).
   - **Renaming a project** in the UI (the API can already do it, §4).
   - **Deleting a project** completely, leaving no trace of it anywhere (D1, R2, device cache), behind several confirmations. A PDF or artifact that another project still uses has to stay.
   - **Forking a project** from a given stage: a new, separate project that starts with the original's pipeline up to that stage. Each project keeps its own linear history. Behind the scenes, the fork reuses the original's artifacts without duplicating them.
