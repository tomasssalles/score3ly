# The code review: summary

First draft, written after the plan and before any fix. Updated after the fixes. It sums up the review for two uses: judging how well it worked, and deciding the rules for CLAUDE.md. The details are in `review/level4.md` (the whole app) and `review/plan.md` (the fixes, in 39 batches); "batch N" below means a batch of the plan.

## 1. The review in numbers

**What was read:** all the code of `packages/`, `apps/` and `scripts/`, tests included: 364 files (102 of them tests), about 55,600 lines, 2.6 MB (about 650k tokens). Generated files, data, `testset/`, `fixtures/` and the docs were left out.

**How:** four levels, bottom-up, each by fresh subagents one after the other, each reading only the notes of the level below (and the code only where a question needed it). 41 subagent runs in all: 10 for level 1, 24 for level 2, 6 for level 3, 1 for level 4, 1 for the plan; then this summary. Tokens per run weren't recorded.

| Level | What it read | Output |
|---|---|---|
| 1. Each file alone | 10 batches of files | 264 notes; about 510 findings marked certain and 610 marked "check" (mentions in the notes, so rough) |
| 2. Files that must agree | 24 groups (e.g. both sides of a request, a format's writer and readers) | about 370 findings |
| 3. Components | 6 (foundations, images, LLM and money, music, projects and hosts, UI) | 173 merged findings: **31 that hurt now** (P1), **61 that will hurt** (P2), 81 structural or cleanup |
| 4. The whole app | the level 3 notes | the architecture, the shape of the shared code, 44 decisions for the owner, the patterns |

**Level 1's "check" findings, settled at level 2:** about 440 confirmed, 145 dropped, 26 left open. **About 3 in 4 held.** Most drops were "a guard exists elsewhere" or "harmless in this use" (e.g. a feared pdf.js hang, a PNG checksum, an Electron quit event).

## 2. The most important findings

What the user would see, with the batch that fixes it.

**Bugs that hurt now**
- Every refusal from the Worker shows as "HTTP 409" instead of its explanation; a crash in the Worker becomes a bare "HTTP 500". (batch 9)
- Editors refuse their own saves as "changed on another device": the skew editor saving two pages at once, Fix MEI's two save timers. (batch 10)
- Finishing Fix MEI loses the last ~2 seconds of typing, and the editor stays editable on a done stage. (batch 10)
- A form row being typed vanishes on reload; editors' caches are set before the save succeeds. (batch 10)
- A malformed model answer crashes the check, is cached as good, and every Retry fails the same way. (batch 18)
- Claude calls are retried silently by Anthropic's SDK: up to 3 billed requests for one recorded call. (batch 2)
- Calls still running after 15 minutes are shown as interrupted and of unknown cost (calls may run 60 minutes); some calls of unknown cost aren't counted at all. (batch 2)
- A tempo mark or segno in a resting voice makes a correct `extract` answer unusable (multi-measure rests defined three ways). (batch 27)
- An issue box near the edge of a system counts for the neighbouring system too: valid clarifications refused in human review, and `apply_review` can miss a system. (batch 29)
- Bar lines at or past a system's box edges are accepted: empty or inverted stretches, inverted zones in the MEI. (batch 34)
- Carrying a human review on a score of 100+ systems fails on the deployed database only (too many SQL parameters for D1). (batch 11)
- Importing a project may fail on the deployed instance (D1's batch limits); to be verified by the owner first. (batch 11)
- Fix MEI's Apply and Finish can hang forever when the checking worker fails. (batch 3, for good in 23)
- A stage's notes ("N systems on M pages") are wrong after a resumed run. (batch 3)
- Esc while a dialog is busy can leave the app on a deleted project; a new project first flashes "This project doesn't exist"; a held back/forward lands on the wrong page. (batches 4, 5)
- Durations read "1 min 60 s"; Run times counts an edited manual stage twice; numbered project names can pass the 200-character limit. (batches 6, 35, 7)

**Bugs that will hurt soon**
- The replay test fails as soon as there's a second fixture ("port taken"). (batch 1)
- Which stage owns an LLM call served from the cache is guessed four different ways: the replay of a real project fails at its first layout call, and deleting a project can delete calls a live project relies on. Needed before the first real fixture. (batch 32)
- Image code has no version in its keys: a fix to it would serve old cached images and raise false "images differ" warnings. (batch 33)

**Fixed**

(to fill in after the fixes)

## 3. The most common kinds of problem

Counted at level 3, as distinct findings (copies in brackets).

| Kind | Findings |
|---|---|
| A helper, skeleton or UI part written again instead of imported (e.g. `plural` ×33, dialog shells ×8) | 72 (≈300 copies) |
| A type, list of values, constant or label restated on both sides of a boundary (web and Worker, prompts and notation) | 43 (≈120 copies) |
| Comments, names or docs that are wrong | ~30 |
| One rule computed in several places, the copies diverging | 27 |
| Concurrency, ordering and cleanup not designed (parallel saves, workers never stopped, no cancellation) | 23 |
| Dead code and plumbing of an earlier design | 23 |
| Error paths that assume success (errors lost, swallowed, misreported) | 17 |
| Tests on one side of a contract only; logic buried in components, untested | 14 |
| Generic code living in the first module that needed it | 13 |
| A rule whose premise a later feature changed | 11 |
| Keys or versions kept by hand, missing an input or redundant | 9 |
| Input trusted (import files, script arguments) | 7 |
| Platform limits only production enforces; the desktop host tested by hand | 6 |

**The most problematic** (they caused the bugs above, or misled):
- **One rule in several places:** the multi-rest rule (three copies) and "which system is this box on" (five) caused P1 bugs; "first stage not done" exists seven times.
- **Concurrency and saves:** the version lock was right, but five editors each saved in their own way, so the app refuses and loses its own edits.
- **Error paths:** the Worker's explanations never reach the screen; a check that throws turns a bad answer into a permanent failure.
- **Restated types:** two have already drifted (`unsupported`, `vatPercent`), and a test pins web and Worker together with a regex over the source.
- **Misleading:** the docs say Zod validates the answers, but there is no Zod; about 30 comments describe code that moved; four "lint-like" tests pass without finding what they check.

## 4. Likely causes

1. **Each feature built in its own session by copying the nearest neighbour.** The second user of some code copied it rather than moving it to a shared place. The strongest single cause (helpers, rules, generic code in stage modules).
2. **No designated home for shared things.** `@score3ly/core` was seen as "keys and the Project type", so later shapes were mirrored ("Mirrors …" comments). The web app had no folder for UI parts or formatting; the Worker's "export only handlers" rule kept helpers private to `index.ts`.
3. **Built and tried on the happy path, in one tab.** Local SQLite has no D1 limits; one tab, one device, one stage running to its end; failure paths not exercised.
4. **Tests written with each module, not at the seams.** Each side well tested; the agreement between them guarded only by the replay.
5. **Conventions instead of mechanisms.** Versions, what a column means, prompt text agreeing with the checks, and comments were all kept up by memory.

## 5. If we started from scratch, what big things would we do differently?

**The big decisions held.** What we'd change is the **contracts between the pieces**, which grew one feature at a time and were never designed as a whole. Most of the 173 findings trace back to them, and all can still be reached from here.

**What held up (keep):**
- The browser does the work, the Worker stays thin: free tier kept, the desktop port cheap, no findings against the split.
- Content-addressed, immutable storage: one small bug class only.
- Recipes, not pixels, in the keys; deterministic imaging. The bugs were missing version numbers, not the idea.
- The two-level cache, and the replay matching answers by their place: fixtures survive key changes, and the request snapshots guard every refactor in the plan.
- The lens in, MEI out, built by code: MEI bugs are small; notation is the best-tested package.
- Linear history with manual stages as stages: no findings against the model itself.
- One Hono app on three hosts; Cloudflare Access instead of auth code.

**What we'd change, and whether to move towards it now:**
1. **A typed API from the first route:** the request and response types, value lists and error codes in core; errors as `{error, code}` with text written for the user. Would have avoided ~25 mirrored shapes, four error classes, and the Worker's explanations never shown. *Now: yes, cheap (batches 7–9).*
2. **The Worker decides the pipeline's state, with a run identity.** The browser still does the work, but the Worker starts a stage only if it may (one conditional update), and works out "interrupted", "current" and "droppable" itself. Would have avoided two tabs paying for one stage, late writes from a dead run, two clocks disagreeing. (A Durable Object per project was considered: the desktop has no equivalent.) *Now: yes, in two steps (batches 15, 16).*
3. **One write path for a project's edits:** a per-project queue, versions that only go forward, and Finish waiting for pending saves. Would have avoided three of the P1 bugs above. *Now: yes, high value, small (batch 10).*
4. **A record of which stage consumed each LLM call,** not only which paid for it, from the day the cache served across stages. Would have avoided four ownership rules and the replay failing on a real project. *Now: yes, before the first real fixture (batch 32).*
5. **Versions and keys derived, never kept by hand; one source for each schema:** each package exports the version of what it computes, recipes are built by constructors, a test ties each prompt's text and schema to its version. (Zod from day one would have been fine; adopting it now would change every request key, so our own builder stays.) *Now: yes, in the paid release (batches 33, 34).*
6. **notation owns the whole score,** not just one system: splitting pieces, checking systems, walking stretches, the issue rules. Would have avoided the multi-rest and "which system" bugs. *Now: yes, behaviour kept, tests at the seams first (batches 27, 29).*
7. **Tests on every host at production's limits, every script typechecked.** *Now: yes, cheap (batches 1, 11).*

Not big, but would do from the start: a UI kit, a formatting module and a home for shared web code before the second screen; route files split by concern.

## 6. Proposed CLAUDE.md rules

| Rule | The pattern it answers |
|---|---|
| **Look before writing.** Before writing a helper, type, constant or UI part, grep for one. When a second user appears, move the code to a shared place and import it; never copy. | Code written again (72), generic code in the first module (13) |
| **Shared things have a home.** What two packages, or the web and the Worker, both use lives in `@score3ly/core` (request and response shapes in `core/api/`), and the Worker's routes are typed with it. In the web app: `ui/` for components, `format.ts` for text. Never write "mirrors X". | Restated types (43) |
| **One rule, one function.** A rule (which system, first stage not done, same answer, stale) is computed in one place; a variant is a parameter, not a copy. | Diverging rules (27) |
| **Keys and versions.** Code that makes pixels, prompts or stored results has a version constant, exported and used in the keys. Recipes are built by their constructor, never as literals. A prompt change bumps its version (a test checks). | Hand-kept versions (9), recipe literals (17 copies) |
| **Errors.** The Worker refuses with `refuse(status, text, code)`, the text written for the user; the web shows it. Never decide by a status code. A check returns problems; it never throws on malformed input. | Error paths (17) |
| **Writes.** Every write to a project goes through `api.ts`'s queue; editors and forms use the shared saver; Finish waits for pending saves. | Concurrency (23) |
| **Test the seam.** When two modules must agree (writer and reader, both sides of a request, a key computed and looked up), one test runs both. A test that reads source or CSS asserts that it found its target. | One-sided tests (14), lint-like tests (4) |
| **Production's limits locally.** Worker tests run on both hosts, with D1's limits on; every script is typechecked and parses its arguments with `parseArgs`. | Platform limits (6), unchecked scripts (5), trusted input (7) |
| **Ask before changing what the user sees, or anything big.** A change that is big (even a clear improvement keeping behaviour), or that changes what the user sees or gets (texts, labels, URLs, looks, defaults, what an action does) without fixing something clearly broken, however small, is put to the project owner first, never made by preference. Size alone is never the test. | Batch 2 of the fixes dropped "incl. VAT" at 0 % by preference, against a recorded decision (reverted) |
| **Leave it clean.** When changing code, grep its names in comments and docs; delete what nothing uses. | Wrong comments (~30), dead code (23) |

## 7. How effective was the review

**What the levels caught that a single pass wouldn't have:**
- **Bugs visible only when files are read together.** The editors refusing their own saves: each editor looks fine alone; it took the editors (level 2) read with the lock in `api.ts`. The "which system" rule written five ways, multi-rests three ways, the 15-minute zombie limit against 60-minute call timeouts, the Worker's refusal texts lost in the web's error handling: all span two or more files.
- **Problems assembled from several groups.** The D1 parameter limit came together from four groups (pipeline state, running a stage, import, hosts), each holding one piece.
- **Later levels corrected earlier ones.** A change to the page image's version was first judged free (only images recomputed); level 3 found the page's recipe is part of every LLM request's key, so it re-pays every call. "Export loses the calls served from the cache" was dropped (export reassigns them), but the same thread led to the deeper problem of call ownership. "A bad secret shows HTTP 500 only for a database failure" was widened: provider constructors throw too. About 145 of level 1's doubts were dropped as harmless.
- **Order and cost.** Only the whole-app view could say which changes re-key LLM requests (paid) and gather them into one release with the prompt checks that re-key everything anyway.

**What it likely missed:**
- **Nothing was run.** No test, no app, no reproduction: every bug is found by reading, and some may be wrong or overstated (one, the import on D1, is already marked "verify first"). The plan's rule (reproduce each bug in a test first) is the real check.
- **The docs weren't reviewed,** only drift noticed in passing (Zod, version numbers, the zombie limit, a few more listed in level4.md §3).
- **Prompts were read as code,** not judged for quality; that is the open §16 tasks and the evaluation.
- **Nothing was looked at:** no screenshots, no performance measured, no security review beyond what came up.
- **Counts are rough:** level 1 marked findings in free text, so its numbers count mentions, not unique findings.
- **One group fell between components:** "running a stage" was assigned to no level 3 component and had to be shared out by hand.

- **The review proposed behaviour changes by preference without flagging them** (found at fix time, 2026-11-17): the plan tucked "no 'incl. VAT' at 0 %" into C7 among "small wrong texts", so it never reached the owner's summary of decisions, and batch 2 made the change, reverting it only on finding the owner's earlier decision in docs/llm.md. The levels judged changes by size and by whether a finding *held*, not by their kind. From batch 4 on, the fixes follow the rule "What needs the owner's ok" (plan, "How every batch is done").

**What to do differently next time:**
- Give every finding an id and a fixed format from level 1 on, so counts are exact and later levels can cite them.
- Confirm each P1 bug with a quick failing test at level 3, before the plan.
- Check that every level 2 group belongs to a level 3 component before starting.
- Review the docs alongside the code they describe.
- **Flag the kind of every proposed change, not only its size:** the plan's summary for the owner lists every change of what the user sees or gets that isn't a fix of something clearly broken, and every big change; nothing of either kind hides in a batch of small fixes.
- Record the tokens of each run, to judge the cost.
- Keep the bottom-up shape: the bugs that mattered most were found at levels 2 and 3, by reading files together.
