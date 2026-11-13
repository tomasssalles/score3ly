# Tasks

Everything that is still to do about score3ly is a task, and every task is in this file: features, decisions to make, bugs, tests to run by hand, research, far-future ideas.

**How the list works:**
- **Just tasks.** No sections, no subtasks, no numbers, no checkboxes. The order means nothing; tags say what matters when.
- **A done task is deleted.** Whatever it decided goes into the docs file that covers its topic (`docs/overview.md` or one in `docs/`). Progress at the highest level is tracked in `docs/overview.md`'s checklist of the first release (§16), whose items stay when done.
- **A large task broken down** is replaced by the smaller ones, or loses the parts they take over. Some overlap between tasks is fine.
- **A task collects its notes:** what was found out, discussed and decided about how to do it, so that it becomes easy to do. A decision that holds beyond the task also goes into the docs file that covers its topic.
- **Tasks overlap with the rest of the docs,** which say what is intended; a task says what is left to do about it. § numbers in this file are `docs/overview.md`'s sections.
- **The contents** (above the tasks) list every task by its name, linked: a task added, renamed or deleted is added, renamed or deleted there too.
- **The form:** each task is a `###` heading with its short name, under the one `## The tasks` below. The first line is its tags (left out when it has none), then, after a blank line so that they render apart, its text. The text may use lists, quotes, code blocks and the like, but no headings: a list in a task is notes, not subtasks.

**Tags** (written as `` `#optional` `` on a task's first line, so that `grep "#optional"` finds them; a task may have none or several):
- `#optional`: not decided yet whether it should ever be done.
- `#next`: what is being worked on now, or comes next.
- `#next-release`: part of the next release.
- `#nice-to-have`: decided to be worth doing, but small gain.
- `#bug`: something that is wrong.
- `#security`
- `#style`: looks, wording, polish.
- `#decision`: something to decide before or instead of building it, usually in a discussion.
- `#research`: something to look up first (documentation, prices, other tools).
- `#owner`: needs the project owner: their judgement, their accounts or their devices.
- `#manual-test`: trying something by hand (a browser, a phone, a platform), not writing code.
- `#experiment`: measuring something, usually on the test set with a real model, to decide on evidence.
- `#format`: something the lens or the MEI can't express yet (`docs/notation.md`, "Issues": format issues show what is missing).
- `#docs`: documentation for users or developers.
- `#date`: due on or after a day, which its name starts with (`### 2026-12-01: …`), so that `grep "#date"` and the names say what comes up when.

## Contents

The tasks below, in the file's order.

- [Accept LilyPond's pitch names in the lens, with a warning](#accept-lilyponds-pitch-names-in-the-lens-with-a-warning)
- [Move the tasks to GitHub issues](#move-the-tasks-to-github-issues)
- [Delete the tasks file](#delete-the-tasks-file)
- [A manual test suite](#a-manual-test-suite)
- [Clean up the codebase](#clean-up-the-codebase)
- [Clean up the docs before the first release tag](#clean-up-the-docs-before-the-first-release-tag)
- [Run the whole manual test suite before the first release tag](#run-the-whole-manual-test-suite-before-the-first-release-tag)
- [The costs view: the order of long lists](#the-costs-view-the-order-of-long-lists)
- [Heartbeats of manual stages being edited](#heartbeats-of-manual-stages-being-edited)
- [Rethink the Statistics page as one concept](#rethink-the-statistics-page-as-one-concept)
- [Change the human review's screen to work like the Transcription](#change-the-human-reviews-screen-to-work-like-the-transcription)
- [Decide how the Transcription's boxes should look on a phone](#decide-how-the-transcriptions-boxes-should-look-on-a-phone)
- [A home](#a-home)
- [Tags for projects](#tags-for-projects)
- [A "done" mark for projects](#a-done-mark-for-projects)
- [Check export and import on a large project](#check-export-and-import-on-a-large-project)
- [Measure the Worker's CPU time per LLM request](#measure-the-workers-cpu-time-per-llm-request)
- [Safe storage of the secrets in cadenza](#safe-storage-of-the-secrets-in-cadenza)
- [Spot-check the collected prices](#spot-check-the-collected-prices)
- [2026-12-01: Gemini 4 Argon's new prices on AI Studio](#2026-12-01-gemini-4-argons-new-prices-on-ai-studio)
- [2027-01-01: Gemini 3.8 Flash's new prices on AI Studio](#2027-01-01-gemini-38-flashs-new-prices-on-ai-studio)
- [2027-01-01: Gemini 3.6 Flash's new prices on AI Studio](#2027-01-01-gemini-36-flashs-new-prices-on-ai-studio)
- [Test the thinking levels of Gemini 3.7 Flash, 3.5 Flash, 3.1 Flash-Lite and 2.5](#test-the-thinking-levels-of-gemini-37-flash-35-flash-31-flash-lite-and-25)
- [Do our prompts reach long-context prices?](#do-our-prompts-reach-long-context-prices)
- [Stages from the record with a config that can't be used](#stages-from-the-record-with-a-config-that-cant-be-used)
- [Hint at similar configs the app still supports](#hint-at-similar-configs-the-app-still-supports)
- [Verify the prompt and schema of `layout`](#verify-the-prompt-and-schema-of-layout)
- [Verify the prompts and schemas of `analyze`](#verify-the-prompts-and-schemas-of-analyze)
- [Verify the prompt and schema of `extract`](#verify-the-prompt-and-schema-of-extract)
- [Verify the prompt and schema of `review`](#verify-the-prompt-and-schema-of-review)
- [Verify the prompt and schema of `apply_review`](#verify-the-prompt-and-schema-of-apply_review)
- [Confirm the decisions made while building `extract`, the MEI builder and `engrave`](#confirm-the-decisions-made-while-building-extract-the-mei-builder-and-engrave)
- [`review`'s crops without boxes too](#reviews-crops-without-boxes-too)
- [Compare `review` with and without renderings as model input](#compare-review-with-and-without-renderings-as-model-input)
- [The cache's lifetime for Claude: 5 minutes or 1 hour](#the-caches-lifetime-for-claude-5-minutes-or-1-hour)
- [Zoom crops on request](#zoom-crops-on-request)
- [Zoom crops accumulated across stages](#zoom-crops-accumulated-across-stages)
- [New and existing voices as separate entries in the schema](#new-and-existing-voices-as-separate-entries-in-the-schema)
- [A failed check goes back to the model](#a-failed-check-goes-back-to-the-model)
- [Nested tuplets](#nested-tuplets)
- [Beams across bar lines](#beams-across-bar-lines)
- [Tuplets across bar lines](#tuplets-across-bar-lines)
- [Brackets across stretches](#brackets-across-stretches)
- [Nested `mdiv`s](#nested-mdivs)
- [Chord symbols and figured bass](#chord-symbols-and-figured-bass)
- [Repeat signs](#repeat-signs)
- [Harp pedals](#harp-pedals)
- [Percussion staves](#percussion-staves)
- [Microtonal accidentals](#microtonal-accidentals)
- [Older accidental conventions](#older-accidental-conventions)
- [Transposing instruments](#transposing-instruments)
- [A staff that begins or ends in the middle of a system](#a-staff-that-begins-or-ends-in-the-middle-of-a-system)
- [Alternative versions of passages](#alternative-versions-of-passages)
- [Lyrics](#lyrics)
- [Tempo marks repeated over several staves](#tempo-marks-repeated-over-several-staves)
- [The MEI header after MEI 6](#the-mei-header-after-mei-6)
- [Check the edition's description against the MEI 5 guidelines](#check-the-editions-description-against-the-mei-5-guidelines)
- [Decide between colour, grayscale and binarized](#decide-between-colour-grayscale-and-binarized)
- [Design the validity check of stages](#design-the-validity-check-of-stages)
- [Decide what a re-run does with a newer step version](#decide-what-a-re-run-does-with-a-newer-step-version)
- [Decide how pieces are numbered](#decide-how-pieces-are-numbered)
- [Decide how to show the original in `fix_mei`](#decide-how-to-show-the-original-in-fix_mei)
- [Make the engraving look like a commercial edition](#make-the-engraving-look-like-a-commercial-edition)
- [Refine the MEI view by using it](#refine-the-mei-view-by-using-it)
- [The format gap report](#the-format-gap-report)
- [Test the installed app on a real Android phone and an iPhone](#test-the-installed-app-on-a-real-android-phone-and-an-iphone)
- [Test the desktop app on the project owner's computer](#test-the-desktop-app-on-the-project-owners-computer)
- [Try the desktop app's package on macOS and Windows](#try-the-desktop-apps-package-on-macos-and-windows)
- [Unsigned desktop builds by GitHub Actions](#unsigned-desktop-builds-by-github-actions)
- [Rewrite the README](#rewrite-the-readme)
- [Help](#help)
- [Try `analyze` on an excerpt that starts or ends mid-page](#try-analyze-on-an-excerpt-that-starts-or-ends-mid-page)
- [Test the finished pipeline on Kinderscenen](#test-the-finished-pipeline-on-kinderscenen)
- [Test the extraction on two-note tremolos](#test-the-extraction-on-two-note-tremolos)
- [Test the finished pipeline on the two editions of Für Elise](#test-the-finished-pipeline-on-the-two-editions-of-für-elise)
- [Measure the prompt lengths](#measure-the-prompt-lengths)
- [Compare the symbolic format with plain LilyPond](#compare-the-symbolic-format-with-plain-lilypond)
- [Pitch guides](#pitch-guides)
- [Sort the statistics' project lists by name](#sort-the-statistics-project-lists-by-name)
- [Search the statistics' project lists](#search-the-statistics-project-lists)
- [Keep a run going while another page of the app is open](#keep-a-run-going-while-another-page-of-the-app-is-open)
- [Check Access's token in the Worker](#check-accesss-token-in-the-worker)
- [Build the test environments](#build-the-test-environments)
- [An Android app](#an-android-app)
- [Closing cadenza during a run](#closing-cadenza-during-a-run)
- [A run in a background tab](#a-run-in-a-background-tab)
- [Google Drive](#google-drive)
- [Model configs per kind of work](#model-configs-per-kind-of-work)
- [OpenRouter's prices in the config form](#openrouters-prices-in-the-config-form)
- [Try a run on a real phone that goes to another app](#try-a-run-on-a-real-phone-that-goes-to-another-app)
- [The Worker finishes an LLM call on its own](#the-worker-finishes-an-llm-call-on-its-own)
- [Remove the override of `minimatch`](#remove-the-override-of-minimatch)
- [A run mode between Auto and Manual](#a-run-mode-between-auto-and-manual)
- [A "needs you" state for stages](#a-needs-you-state-for-stages)
- [Split the whole-score analysis of long scores](#split-the-whole-score-analysis-of-long-scores)
- [Choose places by tapping the score](#choose-places-by-tapping-the-score)
- [Links between observations made by the model](#links-between-observations-made-by-the-model)
- [More about the transcription in the MEI](#more-about-the-transcription-in-the-mei)
- [Undo and redo could bring the change into view](#undo-and-redo-could-bring-the-change-into-view)
- [Go straight to the flagged pages in `fix_layout`](#go-straight-to-the-flagged-pages-in-fix_layout)
- [Stages that would run as no-ops stay finished](#stages-that-would-run-as-no-ops-stay-finished)
- [Keep `fix_mei`'s edits through a re-run](#keep-fix_meis-edits-through-a-re-run)
- [Going back to an earlier applied version in `fix_mei`](#going-back-to-an-earlier-applied-version-in-fix_mei)
- [Running the pipeline on the server](#running-the-pipeline-on-the-server)
- [Entering the LLM keys in the app](#entering-the-llm-keys-in-the-app)
- [Keeping manual fixes per item](#keeping-manual-fixes-per-item)
- [Forking a project](#forking-a-project)
- [Timeouts for LLM calls](#timeouts-for-llm-calls)
- [The Worker reports the current call's progress](#the-worker-reports-the-current-calls-progress)
- [Show that a long call is making progress](#show-that-a-long-call-is-making-progress)
- [VAT in the costs](#vat-in-the-costs)
- [The model configs' list on the settings page](#the-model-configs-list-on-the-settings-page)
- [The default name follows the form when cloning](#the-default-name-follows-the-form-when-cloning)
- [Stop cancels the LLM call](#stop-cancels-the-llm-call)

## The tasks

### Accept LilyPond's pitch names in the lens, with a warning
`#optional`

Models trained on LilyPond write `fis`, `bes`, `ees` despite the prompt (Opus 5.5 did in a real `extract`, 2026-11-09), and the parser rejects them, which makes the whole answer unusable. Instead, code would accept them and write the most likely printed form: in LilyPond `fis` is the pitch that sounds, so it becomes `f` where an F is already sharp at that point (the key signature, or an accidental earlier in the measure in that voice) and `\sharp f` otherwise, the reading with the fewest printed accidentals (wrong only for a courtesy accidental, or a misreading). Each conversion gets a warning (about the lens: "Stretch 3, voice 1: the model wrote `fis`, a sounding pitch; code wrote it as `\sharp f`."), which `review` follows up on the page like any warning (`docs/stages/music.md`, `review`, "Warnings are followed up"), raising an issue with a real location where code's guess is wrong. Not an issue raised by code: code can't say which printed note it is about, and issues are about the page. The work: the checks reject such names today (`parseVoice`), and the conversion needs each voice's accidental state through the measure, carried across stretches and systems for a measure that continues, which only the MEI builder works out today; `extract`'s and `apply_review`'s answers alike. The follow-up round for failed checks (`docs/stages/music.md`, `extract`, "Later, perhaps") would fix such slips too, by asking the model again.

### Move the tasks to GitHub issues
`#next-release`

After the first release, work turns from quick, large changes to one issue at a time with mostly localized changes, and outside users (and perhaps contributors) report problems: GitHub issues are the place for that (discussed 2026-11-03). So the tasks in this file go, gradually: some are done, the rest are moved to issues, reworded and organized on the way (the tags become labels), and fewer and fewer new tasks are added here, until only "Delete the tasks file" is left. Decisions still go into the docs, as now.

### Delete the tasks file
`#next-release`

Once this file holds only this task (see "Move the tasks to GitHub issues"), delete it and work with GitHub issues from then on: update `CLAUDE.md` and the docs that point here (`docs/overview.md`'s "The docs" and §15, and the references to tasks by name across the docs). Temporary task files in feature or release branches stay possible later.

### A manual test suite
`#manual-test` `#owner`

A documented, step-by-step list of behavioural tests for trying the app by hand before showing it to anyone: covering the decisions in the docs and the edge cases the code handles (re-runs and carried manual stages, retries after a failed call, the cache, the spending cap, the views and their toggles, both layouts and themes, the desktop version, …). Each test: what to set up, what to do, what should happen. The project owner runs them; they also tell what is worth an automated test.

A first version is in `docs/manual-tests.md` (2026-11-01): nine stories, each a script of many actions in a row (the project owner's brief: no clean slate per case, stories of what a user might do, sized for a person), a smoke run of about 45 minutes and a full run of about 5 hours, with the fake models and `curl` for the configs the app can't make yet. Left to do:
- **The project owner reviews it** and runs it once; the expected results come from the docs and may be wrong where the docs are.
- **Multi-device tests wait for a real deployment** (§16, "Deployment"): listed at the end of the file, to be written as stories then, with real phones, Firefox and Safari.
- **Stories to add** once built: the format gap report. (The model configs: story 10, 2026-11-05; `apply_review` and further reviews: in stories 1 and 3, 2026-11-02; `human_review`: in stories 2 and 3, 2026-11-04.)
- **The setup becomes a test environment** once those exist ("Build the test environments"), so the stories start with one command.

### Clean up the codebase

Go through the entire codebase and clean it up: dead code, duplicated helpers, names and comments that no longer say what the code does, modules that grew too large, tests that test the same thing twice. Behaviour stays as it is.

### Clean up the docs before the first release tag
`#next-release` `#docs`

Right before the first release tag (§11, "Branches and releases"): go through the entire `docs/` folder and clean it up: what is outdated, repeated or contradicts the code or another file, notes of decisions that no longer need their history, and the overview's summaries against the files they sum up.

### Run the whole manual test suite before the first release tag
`#next-release` `#manual-test` `#owner`

Once, right before the first release tag: every story of `docs/manual-tests.md`, the full run, not only the smoke run. What fails becomes a bug task; what the stories got wrong is fixed in them.

### The costs view: the order of long lists
`#decision`

`docs/statistics.md`, "The costs view". **The order of the lists that grow** (projects, PDFs, configs) in the filters: today the most expensive first, over all time; to decide (sorting and searching the statistics' project lists are tasks of their own).

### Heartbeats of manual stages being edited
`#optional` `#decision`

Proposed 2026-10-30. While a manual stage's editor is open, the browser sends a heartbeat once a minute (as a running stage does, docs/database.md), saying whether anything was changed since the last one, and perhaps whether the editor was touched at all (scrolling, clicking, typing). Uses:
- **Statistics:** reading and comparing without changing anything is work too, and saves alone miss it (the Effort tab's active time in manual stages counts the minutes with a save). Even if this is built, counting that time as active manual work in the statistics is undecided.
- **Two devices:** another device could show that a manual stage is open in edit mode elsewhere, and either sync the edits automatically or just warn, to avoid conflicting edits (today only optimistic locking guards against them, §4).

### Rethink the Statistics page as one concept
`#optional` `#decision`

The tabs measure different targets in different ways, because the data offers no single clean one (the reasons, from the project owner: `docs/statistics.md`, "Why the tabs differ"). Some day, perhaps: one concept for the whole page, with consistent definitions of a project, a page, work and time across the tabs. Not now (decided 2026-10-30): the statistics aren't a scientific experiment, and what is built is probably good enough for a while. Two optional tasks would help it: "Tags for projects" and "A "done" mark for projects".

### Change the human review's screen to work like the Transcription
`#decision` `#next-release`

The project owner, after using the deployed app (2026-11-10): `human_review`'s screen (`docs/stages/music.md`, `human_review`, "The screen"; `HumanReviewEditor`: the original and the rendering in two panes, the boxes dimmed on the original, one issue's panel at a time over the rendering, arrows from box to box) is very hard to use for a person, while the Transcription (`ExtractionView.tsx`: a filmstrip of the systems, each crop above its rendering, the issues' cards below it) is already excellent for comparing the original with the transcription. The human review should become something very similar to the Transcription. The linked scrolling of the two panes doesn't work well either (the project owner, same day). And unlinked, the zoom buttons zoom only the original, and pinching on the touchpad zooms the original correctly but, on the rendering, zooms the whole page (the browser's zoom). Bugs of the screen as it is, to fix only if it stays. The project owner's thoughts on how come later.
- **Fit width back on a phone** (the project owner, 2026-11-12): the toolbar's tools don't fit on one row at 390 px, so "Fit width" is hidden there (`.human-review-toolbar .zoom-fit` in `styles.css`); the new screen should make room for it again.

### Decide how the Transcription's boxes should look on a phone
`#decision` `#style`

**The problem** (found by the project owner on the deployed app, Android, 2026-11-10): in the Transcription (`docs/stages/music.md`, "The Transcription"; `ExtractionView.tsx`), the boxes of issues and warnings cover far too much of the score on a phone, the numbers especially: each box has its label filled in its colour inside the top left corner, as the layout's system labels, and at a phone's scale those labels sit on noteheads, accidentals and marks, the very things the box asks about. The toggle hides all the boxes, which helps for a quick look but loses the link between the music and the issues.

**Proposed** (2026-11-10, to decide), like `human_review`'s original, where all boxes are dimmed (45%) and the selected one isn't, but further:
- **Unselected boxes:** a thin, faint frame, without a number; a thin frame hides little, the filled labels hide the most. The box and its card below the system stay linked by colour, as now (the card's edge has its box's colour).
- **The selected box:** at full strength, with its number. Selected by tapping it (which also brings its card into view, as now) or its card; tapping it again or another changes or clears the selection; nothing selected when the view opens.
- **Warnings** the same: dashed frames, "!" only when selected.
- **The toggle stays,** for a clean look.
- **One rule at every width,** so the wide view gets calmer too.

### A home
`#optional`

The header's wordmark `<score3ly>` (`docs/style.md`, "The wordmark"), on the left like a website's logo, suggests that clicking it goes home, but it isn't clickable, and the app has no home. Today a tab without a project in its URL shows no project (`docs/project-view.md`, "The header"), and leaving a project while it runs interrupts the run (the task "Keep a run going while another page of the app is open"). The project owner's idea (2026-11-10):
- **Opening the app with no project open** shows cards of the most recent projects in the main view, to open one with a click (beside the picker and "+ New project", which stay).
- **Once a project is open,** the app shows it, as it does now.
- **The wordmark is a link to the main view.** With a project open, that is the project view itself: clicking it closes whatever is open over it (an artifact, a stage's details, a page from the menu) and shows the project, without bringing the cards back, leaving the project, or interrupting anything. With no project open, it shows the cards.

### Tags for projects
`#optional` `#decision`

Proposed by the project owner (2026-10-29). Arbitrary tags on projects, added by the user ("baroque", "stained paper", "choir"). For organizing and finding projects in the app (the project picker, a filter by tags), and for the statistics: every tab's project filters could select by tags (e.g. projects tagged "baroque" and "stained paper"), so the averages and estimates come from projects similar to the next one, as the "i" texts already suggest. A user could also mark the projects they consider finished with a tag of their own ("done", "happy"). To decide: where tags are added and shown (the project's actions, the header); whether tags are suggested from the ones used before.

### A "done" mark for projects
`#optional` `#decision`

Proposed by the project owner (2026-10-29). A toggle on each project, set by the user when satisfied with the result: a much clearer signal than the finished pipeline the statistics use today (Run times, the average cost per page's "unfinished pipeline"), which says nothing about whether the result still needs work. To decide: whether the statistics then use the mark instead of the finished pipeline, or both (e.g. the mark where it is set).

### Check export and import on a large project
`#next-release` `#manual-test`

An import sends all the rows of a project's pipeline to the Worker in one request (`POST /api/projects/import`), which parses them and writes them in one D1 batch; an export hands them out in one answer (`docs/database.md`, "Exporting and importing a project"). Tried only on the one-page Bach prelude (2026-11-11). On a long score (a Beethoven sonata: a few hundred systems, each with its outputs and calls) that may hit the Workers free plan's limits: the 10 ms of CPU time (parsing a large JSON body and building the statements), the size of a D1 batch and of its statements, and the number of calls to R2 in one request (`POST /api/content/missing` heads at most 200 objects per request for that reason). **Without paying for a real run:** the fake model draws six systems on every page since 2026-11-12 (as a real page of piano music; two before), so the longest PDFs in `testset/` (Liszt's Consolations, Schumann's Kinderszenen, 22 pages each) give 132 systems, close to a long sonata's 150 to 200 (its answers stay whole-measure rests, shorter than real music). Run such a score with it on the deployed app, export it, import it there and into a fresh local instance, and read the requests' CPU time in the dashboard. If it is over or close, split the import into several requests (stages first, then calls and outputs in chunks), as the export's content is already fetched object by object.

### Measure the Worker's CPU time per LLM request
`#research` `#next-release`

The Workers free plan allows 10 ms of CPU time per request; waiting for the provider doesn't count, but everything the Worker does with the request does: parsing the JSON with the images in base64, the cache key, writing the call record to R2, building the provider's request (and on Bedrock with an access key pair, signing it, which hashes the whole body), reading the answer. `review` sends the whole score with every call. `wrangler dev` doesn't enforce the limit, so it can only be measured on a deployed Worker (its CPU time per request in the dashboard's metrics or Workers Logs): a large `extract` and a `review` call on a long score, cached and not. If it is over, or close, fix what the measurement shows to be expensive (discussed 2026-11-06).
- **Measured with the fake model** (the project owner, 2026-11-12, a 30-page score on the deployed app; the dashboard's percentiles, every request of the Worker together): no errors of any kind, although p90 was about 25 ms in `layout` and 40 ms in `analyze`, and p999 about 50 and 60 ms. Cloudflare tolerates a Worker that runs over "infrequently" and stops it only when it does so "consistently", without saying where that line is, so the leeway can't be relied on. The fake model doesn't exercise building a provider's body or reading a streamed answer.
- **Gemini streams since 2026-11-12** (`docs/llm.md`, "Calling the providers"): the run on Debussy's first Arabesque with Gemini 3.1 Pro Preview on Vertex AI (2026-11-12) was measured with answers in one piece, so its `/llm` requests' CPU time doesn't carry over to a streamed answer (see candidate fix 2).
- **Per request:** Workers Logs are on: every request with its CPU time, and since 2026-11-12 a log line of the Worker's own under it, with the step, the call's label and the answer (`docs/database.md`, "The Worker's logs"), since Cloudflare redacts the ids in URLs. **To check on the first deployment with it:** that Cloudflare leaves our lines readable (the shortened ids above all). Next: a run with a real model, looking at the `/llm` requests apart from the others (outputs, heartbeats).
- **What the Worker does with an image today** (`apps/worker/src/llmRoutes.ts`): it parses the request with the image in base64, decodes it (`atob`) and hashes its bytes (`sha256Hex`) for the call record only, then hands the base64 to the adapter, which writes it into the provider's JSON body. Parsing the request once and writing the provider's body once can't be avoided; both are native string handling, roughly linear in megabytes.
- **Candidate fix 1: the browser sends each image's hash** with the image, so the Worker neither decodes nor hashes it. The browser has the bytes and hashes them for nothing (in a Web Worker). The only downside: the Worker records a hash it hasn't checked, so a bug in the browser could record a hash that doesn't match the bytes sent. The hash is only kept for checking the image later, never part of a key (keys use recipe keys), and the browser is trusted with far more anyway (it makes the images and runs every stage).
- **Candidate fix 2: answers in one piece instead of streamed.** The adapters stream (`messages.stream(…).finalMessage()`; `docs/llm.md`: "so long answers don't hit timeouts"), so a long answer arrives as thousands of small events, each parsed apart in JavaScript, which may cost as much as the request. One response is one parse. Downsides: Anthropic's SDK may refuse a request without streaming when its expected duration is long (a large maximum of output tokens; to check); a connection silent for minutes risks being cut by something in between, which happened (2026-11-12): Cloudflare cuts a Worker's request that gets no response within 125 seconds (524), so this fix is out for long calls. Nothing is lost for progress: partial answers aren't shown.
- **Strong candidate if the others aren't enough: the browser builds the provider's exact body** (the project owner, 2026-11-06), and the Worker adds the credentials and sends the bytes on without parsing them, so its CPU time per request hardly depends on the request's size. The costs:
  - **The adapters are split:** building the request (each provider's format, cache marks, thinking, the schema's dialect) moves to the browser; reading the answer (tokens, cost, stop reason) stays in the Worker, which records the cost. The Worker's API is no longer the same for every provider.
  - **No SDK for sending:** Anthropic's SDK takes the neutral parameters, not a finished body, so the Worker sends with a plain `fetch`, and on Bedrock with an access key pair signs the request itself (e.g. `aws4fetch`).
  - **The key and the request can disagree:** today the Worker computes the request key and the call record from the very request it translates and sends, so they agree by construction. Without parsing the body, the browser sends the key and the request for the record beside it, and nothing checks them against each other: a bug that sent one body under another request's key would store the wrong answer under that key, served from the cache from then on. It is a matter of bugs, not security: each instance belongs to one person behind Cloudflare Access, and the Worker already trusts the browser's recipe keys for the images.
- **Not a fix: images as binary parts instead of base64.** Every provider wants base64 in its JSON body, so the Worker would have to encode them, which costs more than passing the browser's base64 through.
- **Ruled out** (the project owner, 2026-11-06): the paid Workers plan ($5/month, 30 s of CPU time by default), since it breaks "runs on free tiers" for every instance; sending each image once through the providers' Files APIs and naming it in later calls (a feature per provider, uploads that expire, Bedrock and Vertex AI different); preferring Bedrock API keys to key pairs to save the signing's hash of the body (small, and nothing for other providers); calling the providers from the browser (the keys would reach it).
- **Not a problem:** the RSA signature of Vertex AI's token exchange (native, well under a millisecond; `docs/llm.md`, "Authentication stays in the Worker's own code").

### Safe storage of the secrets in cadenza
`#decision` `#security`

`docs/desktop.md`: the desktop app keeps the secrets in plain text in `secrets.env` in its data folder, mode 600, as `~/.aws/credentials` and gcloud's credentials are kept. That protects them from other users, not from other programs running as the same user, nor from backups or syncing of the data folder. Think about storing them safely, by whichever means: the operating system's keychain (Electron's `safeStorage`), an encrypted file, or something else. Most ways mean the user can no longer edit the file in a text editor, so the app would need a form for the keys (see "Entering the LLM keys in the app").

### Spot-check the collected prices
`#owner` `#next-release`

The prices the gathering collected for all four providers (`apps/worker/model-list/<provider>.json`, from the excerpts in `gather/sources/<provider>/`; `docs/llm.md`, "The list of models and prices: code, generated"), checked by the project owner against the providers' own pages before the first release: a sample of models, regions and routings per provider, and anything that looks odd (a price far from its siblings, a model missing where it should be).
- **Vertex AI, against Google's billing catalog too:** a few prices looked up by hand with the commands in `gather/README.md` ("Cross-checking with Google's billing catalog, by hand"). Already compared (2026-11-06): Gemini 4 Argon, global and regional, matches the catalog.
- **Left out on Vertex AI for slips on Google's pages** (2026-11-06; the gathering prints them): Gemini 3 Flash Preview everywhere (no output price). If the page is fixed, gather again; if it isn't, decide whether to take its prices from the catalog by hand.

### 2026-12-01: Gemini 4 Argon's new prices on AI Studio
`#date` `#owner`

Google's pricing page announces new prices for Gemini 4 Argon on AI Studio from 2026-12-01: $4 input, $20 output, $0.20 cache read, per million tokens (now $2, $10, $0.10). The list has the prices valid on the day of the gathering (2026-11-06; `apps/worker/model-list/gather/README.md`, "Google AI Studio"), so from 2026-12-01 its calls are counted at the old ones. On that day or after, gather AI Studio again (`node model-list/gather/ai-studio.ts --download`, then `npm run model-list -w apps/worker`), and make a release with the new list.

### 2027-01-01: Gemini 3.8 Flash's new prices on AI Studio
`#date` `#owner`

Google's pricing page announces new prices for Gemini 3.8 Flash on AI Studio from 2027-01-01: $1.50 input, $7.50 output, $0.15 cache read, per million tokens (now $0.75, $3.75, $0.075). The list has the prices valid on the day of the gathering (2026-11-06; `apps/worker/model-list/gather/README.md`, "Google AI Studio"), so from 2027-01-01 its calls are counted at the old ones. On that day or after, gather AI Studio again (`node model-list/gather/ai-studio.ts --download`, then `npm run model-list -w apps/worker`), and make a release with the new list.

### 2027-01-01: Gemini 3.6 Flash's new prices on AI Studio
`#date` `#owner`

Google's pricing page announces new prices for Gemini 3.6 Flash on AI Studio from 2027-01-01: $1.50 input, $7.50 output, $0.15 cache read, per million tokens (now $0.75, $3.75, $0.075). The list has the prices valid on the day of the gathering (2026-11-06; `apps/worker/model-list/gather/README.md`, "Google AI Studio"), so from 2027-01-01 its calls are counted at the old ones. On that day or after, gather AI Studio again (`node model-list/gather/ai-studio.ts --download`, then `npm run model-list -w apps/worker`), and make a release with the new list.

### Test the thinking levels of Gemini 3.7 Flash, 3.5 Flash, 3.1 Flash-Lite and 2.5
`#owner` `#manual-test` `#next-release`

`apps/worker/model-list/gather/gemini-models.json` gives these models the three levels low, medium and high, without a real call to back them:
- **Gemini 3.1 Flash-Lite:** assumed. It isn't in the table of Google's page "Gemini thinking" ("Controlling thinking"), and its model page only shows `thinking_level="high"`.
- **Gemini 2.5 Pro, 2.5 Flash and 2.5 Flash-Lite:** from that table, but these models used to want a token budget instead of a level, and the app has never sent them one.
- **Gemini 3.7 Flash and 3.5 Flash:** assumed (2026-11-06). Only Vertex AI offers them, so they aren't on AI Studio's pages; tested on Vertex AI.

For each, make a model config on AI Studio (Vertex AI for the last two) with each effort and press Test (`docs/llm.md`, the paragraph on Test); remove a level that is refused from `gemini-models.json`, or the model if it refuses them all.

### Do our prompts reach long-context prices?
`#research`

`docs/llm.md`, "Supported models, prices and the config form": the prices are the short-context ones (decided 2026-11-04). Check, once real runs exist, whether a prompt of ours ever reaches a provider's threshold for long-context prices (Gemini's Pro models: more than 200K tokens of prompt; Claude's long-context variants on Bedrock; Haiku 5.5: more than 100K), for every provider and family the release supports. The likeliest is `review` on a long score, which sends the whole score with every call. The data is there: every call's prompt is the sum of its `input_tokens`, `cached_tokens` (cache reads) and `cache_write_tokens` in `llm_calls`, so a query over the calls of real runs answers it; each provider's exact rule (which tokens count towards the threshold) is checked on the way. If a prompt does reach one, a new task: get the long-context prices and use them where they apply.

### Stages from the record with a config that can't be used
`#optional` `#decision`

`docs/llm.md`, "No longer supported" (2026-11-05): a stage whose model config was deleted or is no longer supported can't start, even when every one of its calls would be served from the record without a call. Whether such a stage should be used after all (nothing is paid, nothing is sent), and how the UI would then show the config (in red today, which would be confusing for a stage that runs without problems). Rare: it needs a new list of models, or a deleted config, between two runs of the same stage.

### Hint at similar configs the app still supports
`#nice-to-have`

`docs/llm.md`, "No longer supported": when a config is no longer supported, a hint at similar configs the app does support, starting from the part the reason names (the first in the form's order that isn't supported) and keeping everything before it: the same model on the same provider in other regions or routings ("The app still supports Claude Opus 4 on Bedrock in eu-central-1, …"), else on other providers ("… on OpenRouter and Anthropic"), else other models of the family on the same provider; the efforts the model still takes; the credentials the adapter takes now. Shown in the stage's failure and on the settings card, and useful in the clone form. Not hard with the list's lookups (`placesOf`, `modelsOf`, `effortsOf`); the wording and how much to list are the work.

### Verify the prompt and schema of `layout`
`#owner` `#next-release`

`packages/prompts/src/layout.ts`: the texts, the rounds, what counts as a bar line and what a box must hold, before the first real runs.

### Verify the prompts and schemas of `analyze`
`#owner` `#next-release`

`packages/prompts/src/analyze.ts`: the page and whole-score texts, the metadata fields and the observations' shape, the confidence levels, the places (systems and bar lines by their labels), and the checks, before the first real run.

### Verify the prompt and schema of `extract`
`#owner` `#next-release`

`packages/prompts/src/extract.ts`: the text, what each call is given (the system's crop and stretch crops, the neighbours, the observations, what is carried over from the previous system), the lens as the answer's schema, the issues it asks for, and the checks, before the first real run (`docs/stages/music.md`, `extract`).

### Verify the prompt and schema of `review`
`#owner` `#next-release`

`packages/prompts/src/review.ts`: the text, the whole score in every call and the append-only log of earlier calls' changes, what an issue it writes must hold (boxes, answers, class), and the schema, before the first real run (`docs/stages/music.md`, `review`).

### Verify the prompt and schema of `apply_review`
`#owner` `#next-release`

`packages/prompts/src/applyReview.ts`: the text, which issues a call gets and when a system gets a call, the typed patch stretch by stretch, the reasons asked for changes outside the issues' boxes, and the schema, before the first real run (`docs/stages/music.md`, `apply_review`).

### Confirm the decisions made while building `extract`, the MEI builder and `engrave`
`#owner`

Each of them has a list "Decisions made while building it (to confirm)" in `docs/stages/music.md` (`extract`, built) and `docs/notation.md` ("MEI", built) and `docs/stages/engrave.md` (`engrave`, built).

### `review`'s crops without boxes too
`#optional` `#experiment`

`review` sends its crops with the issues' boxes drawn on them (decided, 2026-10-31). `docs/notation.md` ("Issues") proposed a clean copy of each crop as well, since lines over the music may get in the way of reviewing everything else. Add it only if experiments on the test set show that it helps.

### Compare `review` with and without renderings as model input
`#experiment`

`docs/stages/music.md`, "Renderings for the models", on the test set, some day: run it both ways and compare what it finds, counting false findings as well as extra correct ones. If renderings help, they become the default, and a config option of `review` can turn them off.

### The cache's lifetime for Claude: 5 minutes or 1 hour
`#experiment` `#decision`

`docs/llm.md`, "Prompt caching": Claude's cache breakpoints use the default lifetime, 5 minutes from the last use, so a call that takes longer than that lets the next call's prefix expire (`review`'s calls each read what the call before wrote). The 1-hour lifetime costs twice the input price to write instead of 1.25 times.
- After using the app with real models for a while: from the call records, how often Claude calls take longer than 5 minutes, separately for each step.
- If it happens often: calculate whether the 1-hour lifetime would save money, and how much.
- Then decide whether to build it at all, and if so whether to use it always, never, or as a global setting, a stage's config, or part of the model config.

### Zoom crops on request
`docs/stages/music.md`, "Zooming in" (decided, for a later version), for `extract`, `review` and probably `apply_review`.

### Zoom crops accumulated across stages
`#optional`

Once zoom crops on request exist: the places `extract` zoomed into are the parts of the page that are hard to read, so the first `review` call for a system could get them from the start, with their reasons, and still ask for more; every later `review` and `apply_review` would get all zooms asked for so far, the set growing stage by stage. The caps could then differ, e.g. 3 per system for `extract` and 1 per system after it.

### New and existing voices as separate entries in the schema
`#optional` `#decision`

The project owner (2026-11-13), if models often leave a new voice's description `""` (Gemini 3.1 Pro did in `extract`, 2026-11-13; seen before at least once): the schema itself makes the difference, with one kind of entry for a voice new in the piece, whose description can't be left out, and no id to refer to another voice, and another for a voice that continues, with only its id and no description. The description matters: later calls use the earlier descriptions to tell a new voice from one that continues. The names are a draft. It enlarges the grammar (an `anyOf` per voice entry, `docs/llm.md`, "Claude's limit on schemas"), so it needs the probe again. First see whether the schema's descriptions (`docs/llm.md`, "Descriptions in the schemas") are enough.

### A failed check goes back to the model
`#optional`

`docs/stages/music.md`, `extract` ("Later, perhaps"): in the same call, with the place and the problem, as one more round of the conversation, with a configurable cap. Whether it pays off over `review` seeing the warnings is measured then.

### Nested tuplets
`#format`

A tuplet inside a tuplet, e.g. a triplet inside a quintuplet. Rare outside complex modern music; until then the parser rejects them, and the model raises an issue.

### Beams across bar lines
`#format`

`beamSpan`: MEI's `<beam>` is a container inside a voice in one measure, so a beam reaching into the next measure needs `<beamSpan>`, written at the measure level and pointing to its first and last notes (`@startid`, `@endid`, the list of notes). Beam grouping is musical, beams across bar lines included (`docs/notation.md`, "Musical content and typesetting"), but MEI Basic excludes `beamSpan`, so it would be a deliberate step beyond it (`docs/notation.md`, "MEI"). Cross-staff beams need no span: the notes stay in their voice and point to the other staff (`@staff`). Until then such a beam is split at the bar line.

### Tuplets across bar lines
`#format`

`tupletSpan`: the same as for beams, `<tuplet>` being a container in one measure; `<tupletSpan>` is also excluded from MEI Basic.

### Brackets across stretches
`#format`

Beams, tuplets, grace groups and two-note tremolos must close in the stretch where they open (`docs/notation.md`, "The symbolic format"), so a beam over a bar line, or across a mid-measure bar line or a system break inside a measure, is split, with a format issue. With beams and tuplets across bar lines (their tasks), the format gap report shows how often it matters.

### Nested `mdiv`s
`#format`

`docs/notation.md`, "MEI": a collection of works, each with movements of its own, as an `mdiv` per work with an `mdiv` per movement inside. The metadata's pieces would need a level for works. The main case is a small collection of short pieces, some with short movements; a large anthology is still best transcribed in several projects, by `rasterize`'s page selection.

### Chord symbols and figured bass
`#format`

Letters above the staff naming the harmony (`C`, `Am7`, `G/B`), typical of lead sheets (a melody plus chord symbols: jazz, pop songbooks), and numbers and accidentals under a bass line (`6`, `6/4`, `7`, `♯`) for the continuo player of Baroque music to fill in the chords. MEI has `<harm>` for both (figured bass structured inside it as `<fb>` with `<f>`), and it is in MEI Basic. LilyPond writes them in contexts of their own (`\chordmode`, `\figuremode`), the same kind of construct as lyrics.

### Repeat signs
`#format`

Shorthand telling the player to play again what came just before, without writing it out: the measure repeat (a slash between two dots in an otherwise empty measure, MEI `mRpt`), the two- or four-measure repeat across a bar line (`mRpt2`, `multiRpt`), the beat repeat (`beatRpt`) and the half-measure repeat (`halfmRpt`), long runs often counted above the signs. Common in drum, guitar and bass parts, jazz and pop charts, and orchestral parts; rare in classical piano editions.

### Harp pedals
`#format`

The concert harp's seven pedals, one per note name (D, C, B on the left; E, F, G, A on the right), each setting every string of that name to flat, natural or sharp. Scores show the settings as letters ("D♮ C♯ B♭ …") or as a small diagram (a horizontal line with a short mark above or below it per pedal), and changes wherever the harpist must move a pedal. MEI has `<harpPedal>`, in MEI Basic.

### Percussion staves
`#format`

In scope (§1): unpitched notes, as in orchestral scores from Beethoven's Ninth on (bass drum, cymbals, triangle), on a percussion clef or a one-line staff, which LilyPond writes in a notation of its own (`\drummode`). Until then, format issues.

### Microtonal accidentals
`#format`

Quarter-tone and other microtonal signs. They follow the same rules of duration as sharps and flats (to the end of the measure); the symbolic format has only the five markers, so until then they come back as format issues.

### Older accidental conventions
`#format`

The modern rules (`docs/notation.md`, "The symbolic format") are the only ones at first. Several parts:
- **a model judges which conventions the original probably follows,** from the pages and the metadata (date, edition, style);
- **the code that turns the printed symbols into sounding notes becomes configurable** by convention. It decides the `.ges` attributes of the MEI, and affects e.g. a conversion into LilyPond;
- **optionally, or in addition, a modernized MEI:** generated with the configurable code, it doesn't match the original symbol by symbol but musically, under the modern rules: it has written accidentals the original hasn't, or leaves out some it has, so that it sounds the same as the original read with its old conventions.

### Transposing instruments
`#format`

Instruments written at another pitch than they sound (B♭ clarinet a whole tone lower, horn in F a fifth lower, trumpet in B♭, alto saxophone in E♭), so that in a full score written as the players read it the staves have different key signatures at once (horns traditionally none). Key signatures are per staff already; what is missing is the transposition itself, so that the written pitch can differ from the sounding one: MEI's `@trans.semi` and `@trans.diat` on the staff definition.

### A staff that begins or ends in the middle of a system
`#format`

As in some modern scores that show a staff only where it plays ("cutaway" scores). Until then, format issues.

### Alternative versions of passages
`#format`

Transcribing every alternative the page gives for a passage, e.g. an ossia (an easier version, one for a smaller keyboard, an editor's reading, usually on a small extra staff above a few measures, sometimes in small notes in the main staff; common in virtuoso piano music such as Liszt's), with the text that explains it where there is one, attached to it. **Transcribing and encoding every alternative is musical content; how one is shown is typesetting** (an extra staff, small notes, a footnote) and outside our scope. So:
- **the lens's JSON schema, `extract` and `review`** get a way to write alternatives for a passage, with their texts;
- **both stages get crops of the original showing the alternatives,** and `review` gets a rendering of each version on its own, never mixed;
- **the MEI encodes them all, clearly,** e.g. with `app`, `lem` and `rdg` (MEI also has `<ossia>`, with `oStaff` and `oLayer`; neither is in MEI Basic, so this is a deliberate step beyond it, `docs/notation.md`, "MEI"). The user can then do with them whatever they want: render one, render all with their texts as footnotes, render a second one as an ossia on an extra staff or in small notes. Code handles them with full control, instead of us producing an opinionated output the user has to live with.
- **Until then the lens has no alternatives at all:** the prompts of `extract` and `review` tell the models to transcribe the main text only and to ignore alternatives.

### Lyrics
`#format`

Lines of their own above or below a staff, not in one, with text tokens, durations and invisible rests; the same quoted-text question as in the symbolic format.

### Tempo marks repeated over several staves
`#decision` `#style`

Typesetting: an orchestral score prints the same tempo mark above several groups of staves, and the lens reports each (`docs/notation.md`, "The symbolic format", "Tempo marks"), so the MEI has one `<tempo>` per staff it is printed on, and Verovio draws them all. Whether an engraving shows them all, or only the top one, is a typesetting decision still to make (e.g. an option of `engrave`).

### The MEI header after MEI 6
`docs/stages/analyze.md`, "The metadata": MEI 6 (in feature freeze since 2026) replaces `<composer>`, `<arranger>` and the like with `<creator role="…">` and MARC's roles; the header code follows once it is released.

### Check the edition's description against the MEI 5 guidelines
`#research`

`docs/stages/analyze.md`, "The metadata": the details of the edition's description (`manifestationList/manifestation`), which changed in MEI 5.

### Decide between colour, grayscale and binarized
`#experiment` `#decision`

Page images for the LLM steps, by ablation on the test set (§8.1). The outcome decides whether it becomes an option of `rasterize` or a fixed default (§6, `rasterize`).

### Design the validity check of stages
`#decision`

§5.2: checking recorded input and output hashes against what is stored; when (on opening a project, before a run, ...), and what the app shows and does when a stage is no longer valid.

### Decide what a re-run does with a newer step version
`#decision`

§11. A first idea, not thought through: a re-run follows the pipeline as it was while the inputs match (§5.5), but a stage's step may by then have a newer version that is considered better. When the re-run is started, the app asks the user which to do:
- use the new version in any case; or
- keep the old version's results where the input still matches, and use the new version only where it doesn't.

Keeping an old result means reusing what is stored (§5.5), so no old code has to run for it.

### Decide how pieces are numbered
`#decision`

`docs/stages/engrave.md`, "The MEI view", and the metadata: pieces have numbers on the page, names, or both, and printed numbers aren't always a simple count (a book starting at étude 13, nested pieces with nested numbers, an alternative version of nocturne 5 labelled "5a"). Where nothing is printed, we may or may not want to show a number of our own, e.g. in the MEI view's picker. Until then the picker shows names only ("Untitled" without one).

### Decide how to show the original in `fix_mei`
`#decision`

§6: the edits are made against the score engraved from the MEI, but the original is what they should match. E.g. the score pane switching between the score and the original, which shows the measure of the selected line (its `@facs` zone) on its page.

### Make the engraving look like a commercial edition
`#style` `#owner`

`engrave`'s PDF (`docs/stages/engrave.md`) should look like a good printed edition, not Verovio's defaults.
- **First, the side margins:** far too small. `pageOptions` in `apps/web/src/engrave.ts` sets no margins, so Verovio's defaults apply (5 mm on every side); printed editions have about 15 to 20 mm.
- **The finer details** (spacing, title and headers, system and staff distances, the size of the staves) wait for a long real transcription to judge them on.

### Refine the MEI view by using it
`#owner`

`docs/stages/engrave.md`, "The MEI view": the split, the toolbar, going between the file and the score, tried on real scores rather than judged on paper.

### The format gap report
`docs/project-view.md`, "The menu and its pages": the button in the settings' "Developer" section that downloads it, and the script that groups and counts its issues for analysis.

### Test the installed app on a real Android phone and an iPhone
`#manual-test` `#owner`

Once the app is deployed (§10): back navigation with the app's buttons and the system's back gesture, the wake lock, the image cache, touch in the editors, the status bar's colour.

### Test the desktop app on the project owner's computer
`#manual-test` `#owner`

§3: `npm install`, `npm run desktop`; create a project, run the pipeline with the fake model, then a real one with a key in the secrets file (Settings, "Open the secrets file"), back and forward, quit and start again.

### Try the desktop app's package on macOS and Windows
`#manual-test` `#owner`

`docs/desktop.md`, "Packaging"; the project owner, or someone with those systems: `npm install`, `npm run package:desktop`, install it as `apps/desktop/README.md` says, start it from its icon; check the name in the dock or taskbar and the app switcher, that macOS opens the self-built app without a warning (it is signed ad hoc), and where the data goes.

### Unsigned desktop builds by GitHub Actions
`#optional`

`docs/desktop.md`, "Packaging": builds to download, with the systems' warnings to click past, so that users needn't build the app themselves.

### Rewrite the README
`#docs`

The root `README.md`; the owner wants it written properly, today it is the development notes with the logo on top: what score3ly is and does, with screenshots, how to use it, how to develop it; and badges at the top (version, license, tests passing, and the like). Wording for dropping and adding stages: see "Help".

### Help
`#docs` `#next-release`

Write the user guide as a Markdown file in the repository, and make "Help" in the menu lead to it on GitHub (§5.6). It has to cover deployment (written: `apps/worker/README.md`, to link to) and setting the LLM keys (§10; a service account's key file is set from the file, `npx wrangler secret put NAME -c wrangler.deploy.jsonc < key.json`), and it recommends a model (§7.2). For the desktop version (§3): where things are stored on each platform, with a strong warning that changing those files can invalidate pipelines that already ran. Only makes sense once there is something to explain. Now a placeholder page.
- **Wording to use, here and in the README** (the project owner's, 2026-11-03): *you can drop a stage you added.* That is every manual stage and every extra review; a new project already comes with a standard review, which you didn't add, so you can't drop it. *Reviews, by a model or by you, are added from an Apply review stage.*
- **Runs in the background** (decided 2026-11-03): on a computer, a run goes on while the app's tab or window is in the background (another tab, another window, minimized), in the browser and in the desktop app; only closing it stops the run (and asks first). On a phone, a run only goes on while the app is open and in front: switching apps or locking the screen stops it, and nothing can warn first (the screen is kept on while it runs). **Run picks up where it stopped,** in about a second: what was done is kept, so after an interruption, Run again.

### Try `analyze` on an excerpt that starts or ends mid-page
`#experiment`

§6: systems of another piece at the top or bottom of the selected pages, kept or deleted in `fix_layout`.

### Test the finished pipeline on Kinderscenen
`#experiment`

Test set, once it runs end to end. Among other things: whether `layout` finds the systems and bar lines despite the old paper and decorations, or whether the user would have to fix most pages by hand, the scenario for content boxes (§6, `analyze`).

### Test the extraction on two-note tremolos
`#experiment`

Two notes alternating fast, joined by beams, e.g. the left hand in the first movement of Beethoven's Pathétique, with a score added to the test set for it: the lens writes them as `\repeat tremolo 16 { c32 g32 }`, so the model has to work out the count, and a wrong count is caught by the duration check (a unit test, §12); the task is how often models get it right. If models often miscount, a lens form closer to the page (the printed notes plus the number of strokes, as MEI's `<fTrem>` has them) is the alternative.

### Test the finished pipeline on the two editions of Für Elise
`#experiment`

Test set, for memorization (`docs/evaluation.md`, "Baselines"): where the editions differ, does the extraction follow the page or the famous version?

### Measure the prompt lengths
`#experiment`

When the pipeline is finished: run it on most of the test set with a real model, and get statistics of the prompts' lengths per stage. They decide whether prices that change above a prompt length (Haiku 5.5 above 100,000 tokens, Gemini Pro above 200,000) must be modelled (`docs/llm.md`, "Supported models, prices and the config form").

### Compare the symbolic format with plain LilyPond
`#experiment`

`docs/notation.md`, "The symbolic format": the project owner transcribes the page of the manual run (§13) with the symbolic format and compares it with Claude's plain LilyPond from that run, which was good but had a few small mistakes; later, the test set. If the symbolic format does worse, and debugging shows the model struggling with the format, we pivot towards plain LilyPond.

### Pitch guides
`#experiment` `#optional`

If extraction turns out painfully slow: faint labelled lines for the staff lines and ledger-line positions (E4, G4, …, C6) drawn on each crop, so the model reads a label instead of judging a pixel height, its biggest time sink in the manual run (§13). It needs the staff lines detected, which is error-prone, and a wrong detection would make the extraction worse.
- **Revisited** (the project owner, 2026-11-12): even Opus 5.5 still miscounts staff lines now and then ("is this a D or an F?"). Against it: built in code, easily wrong on bad scans of old scores, and wrong guides would make the extraction much worse than none; guides drawn over the ink would have to stand out from it, and in grayscale (colour isn't decided, "Decide between colour, grayscale and binarized") a line on top of a line among other lines hardly can.
- **Proposed shape, to avoid both** (not decided): **a ruler beside the music, never over it.** A narrow white strip added to the left of each stretch crop (stretch crops are short, so the music is never far from it), with a tick at each line and space of each staff, continuing a few ledger positions above and below, labelled by position (lines 1–5 and the spaces, or the pitch names for the clef in effect), not drawn on the ink, so grayscale is enough. The model sees the staff lines run into the ruler, so a ruler that doesn't match them is visible as such.
- **Detection is partly there:** `skew_analysis` finds the staves' lines (`findSkew`, `docs/stages/pages.md`); a ruler needs each staff's five lines measured locally at the stretch's left edge (scanned lines curve), and is drawn only where five evenly spaced lines are found clearly, else that staff gets none.
- **Experiment before building:** take systems where Opus misread a pitch, add rulers to their crops (a script, or by hand), and compare its answers with and without, in a chat as in the manual run (§13).

### Sort the statistics' project lists by name
`#optional`

In every list of projects on the Statistics page (Costs: the average per page's list, and the detailed overview's Project section, `docs/statistics.md`, "The costs view"; Usage: the project picker of the active hours): sort by name as well as by date. Everywhere or nowhere (decided).

### Search the statistics' project lists
`#optional`

In every list of projects on the Statistics page (as above): a search field that keeps the projects whose name contains the text, ignoring case, as the project picker in the header does. Everywhere or nowhere (decided).

### Keep a run going while another page of the app is open
`#optional`

Not for the first release (decided 2026-11-03): the navigation it protects (Settings, Statistics, About, another project) is rare during a run, and a run is fragile anyway (a phone stops it when the app goes to the background). Until then, leaving a project while it runs asks first (`docs/project-view.md`, "Leaving a running project").

Today a run belongs to the project view: opening a menu page (Statistics, Settings, About) or another project unmounts it, and its cleanup aborts the run (`ProjectView.tsx`, the first `useEffect`), without a warning, unlike closing the tab. The outputs saved stay; an LLM answer on its way is lost, although it is paid for; the stage shows as running until its heartbeat is 3 minutes old, then as interrupted, and a retry asks only for what is missing (docs/database.md). The same in the web app and in cadenza. Switching to another window doesn't stop a run (a hidden window's timers are slowed, but the heartbeat stays within the 3 minutes).

To do: move the runner (the abort controller, the heartbeat, the Auto loop and the wake lock) out of the project view to the app's top level, so a run goes on whatever the app shows, and the project view only shows it. Then: where the user sees a run going on while elsewhere (e.g. in the header or the project picker), and what a second project's Run does while one runs (one run at a time, as the calls are sequential, §10).

### Check Access's token in the Worker
`#optional` `#security`

Cloudflare Access checks every request before the Worker runs, for a Worker protected as a whole (worker-level or account-level Access, which covers all its addresses). Cloudflare's older guide for workers.dev still advises validating the JWT that Access adds (`Cf-Access-Jwt-Assertion`) in the Worker as well, against the team domain's keys and the application's audience: a second lock, should a setting ever leave an address open. `ctx.access` would make it a one-liner, but it isn't passed to Workers with static assets, which ours is, so it would be the header and `jose` (or WebCrypto), with the team domain and audience as settings (in `NOT_SECRETS`, §10). Not for local development or cadenza, which have no Access. Decide whether it is worth it.

### Build the test environments
§12: the start script, the build script and a first environment.

The plan (decided), moved from `docs/overview.md` §12:

For trying the app by hand on prepared data, locally only (no remote test database or bucket).

- **A test environment is a folder** in the repo, `testenvs/<name>/`, with:
  - the local D1 and R2 state, which `wrangler dev` reads from any folder (`--persist-to`);
  - a secrets file, loaded with `--env-file` instead of `.dev.vars`. It holds fake or test-only keys, and real keys are never committed.
- **Environments are built by a script, not by hand:** it applies the migrations to an empty folder (`wrangler d1 migrations apply --local -c wrangler.local-dev.jsonc --persist-to`), then adds PDFs and projects through the API. Wrangler's local storage format is internal and can change between versions; with the script, an environment can be rebuilt after a migration or a Wrangler update.
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

To check when building it: whether an existing `.dev.vars` makes Wrangler ignore the `--env-file`.

### An Android app
`#optional`

The one way to let a phone run a pipeline in the background (discussed 2026-11-03): on a phone, a web app stops when it goes to the background, and nothing can prevent it; on iOS a packaged app is suspended as well, so this is for Android only. After the first release.
- **A wrapper, not an app written from scratch:** Capacitor (Ionic's; Electron's idea for phones) puts the web app in Android's own browser view (Chromium) and makes the Android project around it, built with Gradle and the Android SDK.
- **The native part:** a foreground service, as music players use, started when a run starts and stopped when it ends, with a notification ("score3ly: Extract, system 12 of 40"). A community Capacitor plugin, or about a hundred lines of Kotlin. Android 15 limits some kinds of these services to about 6 hours a day: plenty.
- **The risk, to settle first with a prototype on a real phone (about a day):** the service keeps the process alive, but the browser view may still pause its JavaScript timers in the background, which would stop the heartbeat (`docs/database.md`); Capacitor's settings or a line of native code should prevent it.
- **A client of the user's own deployment:** a phone can't run the Worker (no Node, unlike cadenza), so the app asks for the app's address on its first start and logs in through Cloudflare Access inside it. Nothing in the APK is the user's, so one APK serves everyone.
- **Distribution:** without a store, for free (users already deploy to Cloudflare or build cadenza themselves): an APK signed with our own key (free), on GitHub's releases, or built by users themselves like cadenza; installed by allowing installs from unknown sources. One key, so a new version installs over the old one.

### Closing cadenza during a run
`#bug` `#next-release` `#manual-test` `#owner`

`docs/desktop.md`, "Closing during a run": closing the desktop app while a stage ran probably did nothing at all (Electron cancels the close silently when the page holds back from being unloaded). Fixed 2026-11-03 without trying it: the main process asks with its own dialog (`will-prevent-unload`, `apps/desktop/src/leaving.ts`), as Electron's documentation describes; Electron can't run in the sessions' environment. To check by hand in cadenza, during a run (the fake model with many pages, so it runs long enough):
- Close the window: "Close while a stage is running?". Cancel: the window stays, the run goes on. Close: the window closes (and the app quits, but on macOS).
- Reload (Ctrl+R or Cmd+R): "Reload while a stage is running?", the same two ways.
- Quit from the menu, and Cmd+Q on macOS: the same question as closing.
- Without a run, closing and reloading ask nothing.

### A run in a background tab
`#manual-test` `#owner` `#next-release`

On a computer, a run should go on while its tab is in the background: the page keeps running, and the heartbeat (once a minute, stale after 3) stays within its limit even under Chrome's strongest timer slowing (once a minute after 5 hidden minutes). What isn't known: whether Chrome's Memory Saver, Edge's sleeping tabs or Safari put a busy tab to sleep after a while, which would stop the run. Run a long pipeline (a real model, or the fake one with many pages), then spend 30 minutes or more in another tab and another window, in Chrome, Edge, Firefox and Safari; note what each did. The user guide's text depends on it ("Help").

### Google Drive
§3, §10: picking source PDFs with the Picker, and exporting to an app-created folder.

### Model configs per kind of work
`#optional`

`docs/llm.md`, "Which config a stage uses": a level between a stage's own config and the default, in the advanced settings: a model config per kind of work, used by every stage of that kind that has no config of its own. Proposed kinds: finding layout boxes (`layout`), analyzing the pages (`analyze`: metadata and observations), extracting the music notation (`extract`, `apply_review`), reviewing (`review`).

### OpenRouter's prices in the config form
`#optional`

`docs/llm.md`, "Configs" (priced by the provider): the settings card shows the range of an OpenRouter model's four prices among the providers that run it, with the fee included (`/api/model-configs/<id>/price-range`). The create and clone forms could show the same for the model picked, listed or unlisted (once its identifier is typed), at the form's region and with the fee of the account picked: the Worker's lookup taking a model string and a region instead of a config's id (`fetchPriceRange` in `apps/worker/src/llm/openrouter.ts` already does), and the form asking again when the model, the region or the account changes (debounced while the identifier is typed). An unlisted identifier OpenRouter doesn't know could be said there too ("OpenRouter has no model …"), before the config is saved.

### Try a run on a real phone that goes to another app
`#manual-test`

§5.8: while this device runs a stage, the screen is kept on (the Screen Wake Lock, `apps/web/src/wakeLock.ts`, asked for again whenever the app comes back to the front; built, tried in Chromium with the API stubbed; on the project owner's Android phone, the deployed app kept the screen on through a 20-minute `extract`, 2026-11-10). Left: the browser drops the lock when the app isn't in front, so the page can still be suspended; check that the run carries on where it stopped when the app comes back, and what other devices show meanwhile (it turns "Interrupted" after three minutes without a heartbeat).

### The Worker finishes an LLM call on its own
`#optional`

§5.8: an answer that was paid for is lost when the tab is closed or a phone suspends the page mid-call (accepted). Some day, perhaps: the Worker finishes the call and stores the answer on its own, so resuming finds it. Only for calls nobody chose to stop (a closed tab, a suspended phone); Stop cancels instead (see "Stop cancels the LLM call").
- **The project owner wants a plain Worker** (2026-11-09): no Durable Objects or Workflows. On Cloudflare, a Worker whose client has gone has at most about 30 seconds of `waitUntil` left, and calls often take minutes (a `layout` page with Gemini: several minutes), so a plain Worker can't do it; the desktop app (Node) could. Not sure whether it is worth anything then.
- **If it is done:** a request identical to one still running (stopped, then Run again unchanged) must wait for that call instead of paying for it twice; and the spending cap can be overshot by the call finishing in the background, whose cost lands late. The Worker serves requests side by side, so a call finishing in the background doesn't hold up the next one (only the browser sends one call at a time).

### Remove the override of `minimatch`
`#security`

The root `package.json` overrides `minimatch` versions 7.0.0 to 11.0.0 with `^11.0.8` (2026-11-12), against a moderate advisory (GHSA-g3hv-75wg-m249, a denial of service by globs) that `npm audit` reported 6 times, through `@electron/universal`, `app-builder-lib`, `dmg-builder` and `electron-builder`. Only used when packaging the desktop app, never at run time. No electron-builder release had fixed it then (26.18.1 and 27.0.0-alpha.14 still want `minimatch` `^10.2.5`), and `npm audit fix --force` would have downgraded electron-builder to 24.13.3. The override touches only the copies electron-builder uses (10.2.6, and 9.0.9 under `@electron/universal`), not the 3.x and 5.x copies of other packages, whose API version 11 doesn't have; the parts of the API they use (`Minimatch`, `minimatch`, `.set`, `.negate`, `.match`) are unchanged, and a Linux `dir` package built with it was byte for byte the same as one without.

To do: once an electron-builder release depends on a fixed `minimatch` (11.0.1 or later), update to it, remove the override from the root `package.json` (and the stale entries from `package-lock.json` with `npm install`), and check that `npm audit` stays clean.

### A run mode between Auto and Manual
`#optional`

§5.1: run automatically, but stop when a model asks for human input.

### A "needs you" state for stages
`#optional`

`docs/project-view.md`, "The pipeline panel": for a model asking for human input; left out for now, easy to add.

### Split the whole-score analysis of long scores
`#optional`

§6, `analyze`: chunks of about 20 pages with some overlap, each call knowing it sees a part and where the overlap is, instead of stopping at the size limit. Still valuable for what the call looks for (repeats, endings, recurring melodies).

### Choose places by tapping the score
`#optional`

In `fix_observations`: a bar line or a stretch tapped on the page, instead of the pickers.

### Links between observations made by the model
`#optional`

Only if needed: if real scores show code linking repeats, endings or spanning marks wrongly, the whole-score call could say which items belong together, by their ids.

### More about the transcription in the MEI
`#optional`

Confidence, what was confirmed, the models used, through existing elements of the schema or as a report appended to the file (`docs/stages/analyze.md`, "The metadata", "No `@cert`").

### Undo and redo could bring the change into view
`#optional` `#nice-to-have`

As in a code editor, undoing or redoing a change on a part of the page that is zoomed out of view would pan (and zoom) to it.

### Go straight to the flagged pages in `fix_layout`
`#optional`

Later, perhaps never: an arrow to the next flagged page, or the flagged pages marked by the page counter.

### Stages that would run as no-ops stay finished
`#optional`

After a change in the middle, a later stage whose inputs and config come out the same, so that it would be served entirely from what is stored, isn't shown as needing to run again (e.g. `fix_observations` after a new `fix_metadata`).

### Keep `fix_mei`'s edits through a re-run
`#optional`

`docs/stages/engrave.md`: rough patching, not git. The unit is a measure, by its `xml:id`: after a new extraction, a measure still identical to what `fix_mei` started from gets its final text; the rest is dropped and reported. The parts outside the measures (the header, the `scoreDef`) need units of their own.

### Going back to an earlier applied version in `fix_mei`
`#optional`

Every applied version would have to be kept, and listed.

### Running the pipeline on the server
`#optional`

Optional but desirable; big, and tricky to get right. Today the browser drives the pipeline and does all the PDF and image work, so a run only advances while the app is open and, on a phone, on screen.
- **Preferred: all-in.** The whole pipeline runs on the server, PDF and image work included. The browser only shows results and takes the user's input, and a run doesn't depend on any device.
- **Whether that is possible is the thing to think about first.** A Cloudflare Worker has little memory and, on the free plan, almost no CPU time, and it has no canvas to render vector PDFs with. Image work may need the paid plan ($5/month), or a container, or may not fit Cloudflare at all.
- **In its favour:** the image operations are our own TS/WASM code (§8.2), not the browser's, so they can run elsewhere. With one place doing the image work, the effort to get identical pixels on every device (§8) would mostly fall away.
- **Against it:** derived images would live in R2 and not on the device, 150–300 MB per PDF (§2), which eats the free 10 GB quickly; and "no server-side compute" (§2) is one of the reasons the app is free to host.
- **Fallback: a split.** The browser keeps the PDF and image work (the short part at the start) and uploads the crops to R2; the server runs the remaining stages on its own (the LLM calls, the light checks and the assembly between them) with Cloudflare's building blocks for long-running, resumable work (Workflows, Durable Objects). Waiting for an LLM doesn't count against a Worker's CPU limit, so this may fit the free plan. To be checked against the current terms.
- Either way, first find out how long a real extraction takes. Until then: keeping the device awake and reliable resuming.
- On the desktop version (§3) it is simple: no Worker limits on CPU time, no free-tier quotas.

### Entering the LLM keys in the app
`#optional` `#security`

The keys are stored in D1, encrypted with one master key, which is the only secret left to set on the host. The Worker decrypts a key only to call the provider and never sends it back to the browser: the settings page shows "set", and perhaps the last four characters. Whoever gets past the login can replace a key, but not read one.
- **Why:** it decouples the app further from Cloudflare. A SQLite database, object storage, a server and one secret can be had from other providers, and with the right ports and adapters (§3) the app becomes portable. Setting up the keys is then the same on every host, and so is the user guide. It is also more convenient: a key can be changed from the app, on any device.
- **The price:** code that handles secrets, which has to be right.

### Keeping manual fixes per item
`#optional`

Not thought through: when a manual stage's input changes for only some items, keep the fixes on the items whose input didn't change, and drop only the others, instead of dropping the whole stage (§5.5). Well-meant, but it makes the behaviour harder for the user to understand: which fixes survive a re-run would depend on details of the input.

### Forking a project
From a given stage: a new, separate project that starts with the original's pipeline up to that stage. Each project keeps its own linear history. Behind the scenes, the fork reuses the original's stage outputs without duplicating them (§2, §5.4, §5.8: a fork copies the pipeline entries up to its stage, and the issue counter, and no stages or outputs).
- **The statistics with forks** (the project owner's thought, 2026-10-30): a manual stage a fork shares with its original counts in both, each with the stage's whole work time and its own page count (Effort, "Average manual work per page"): what matters is the effort a new score needs, and the shared stage's work was needed for both. The statistics' queries find a project's stages by the project they were created in (`created_in`) or its pipeline; a fork's shared stages were created in the original, so they need a look whenever forks are built.

### Timeouts for LLM calls
`#decision` `#owner`

No LLM call has a timeout today: the Worker calls the adapter without an abort signal (`llmRoutes.ts`), Google's SDK and OpenRouter's `fetch` have none, Anthropic's SDK bounds at most the wait for the stream to start, and the browser's request to the Worker has none either. So a call can hang for good, and the stage's bar can't fill with the time elapsed out of the call's timeout, as §5.1 intends (today it moves only when an item is done, `stageRunner.ts`). Long calls are normal: a `layout` of 3 pages with Gemini 4 Argon at medium effort took 21 minutes (2026-11-09). **Decided** (the project owner, 2026-11-09): use the app for a while first, then choose a reasonable timeout for each kind of call (stage, perhaps provider and effort) from the recorded calls' times. Also check, while at it, whether Stop in the browser cancels the provider's call in the Worker (no signal is passed, so probably not; the provider may still bill the answer).

### The Worker reports the current call's progress

The Worker sends the browser, while an LLM call runs: when it started, when it ended, and how many tokens of the answer have arrived so far. Today the Worker puts the streamed answer together and answers the browser's request only at the end, so the browser knows nothing until then. To work out how: e.g. the Worker's response streamed as events (progress, then the answer), which keeps it to one request; mind the CPU time ("Measure the Worker's CPU time per LLM request"). Every provider streams (Gemini since 2026-11-12).

### Show that a long call is making progress
`#decision` `#style`

A call can take minutes with nothing on the screen moving, and the user can't tell whether to wait or to stop the stage and try another model. Use what is known (the number of calls made and expected, the tokens received on the current call, the time elapsed on it, its timeout, perhaps more) to show that progress is being made, or not. A clock alone only shows that the browser is alive, not that the provider is answering, though it does help decide when to give up. Note `docs/project-view.md`'s rule: progress indicators never show numbers. Waits for "Timeouts for LLM calls" and "The Worker reports the current call's progress".

### VAT in the costs
`#next-release`

Every provider the project owner pays adds VAT on top of its listed prices (2026-11-09, Germany, 19%, no VAT ID): Anthropic at checkout (5 USD of credits for 5.95 USD); OpenRouter on the credits and its fee together (100 USD of credits: 108 USD with the Business fee, 128.52 USD with VAT); AWS on pay-as-you-go use after the starter credits; Google AI Studio apparently deducted from the prepaid balance as it is used (5 € paid, 5 € of credit shown). So the app's costs (tokens × list prices, plus OpenRouter's fee) are about 19% below what the user pays, and the spending cap counts the costs before VAT too. **Decided** (the project owner, 2026-11-09):
- **One VAT rate in the settings** (a percentage), for every provider: VAT depends on the user's place and status (a VAT ID usually means a reverse charge, no VAT on the invoice), not on the model. 0% for a new database, which is today's behaviour; the user guide points to it. A rate per model config, prefilled from the global one, is left for when a provider is found that differs.
- **Each call stores the rate applied,** beside its cost before VAT, as it stores the prices used: the cost with VAT is computed from the two, and a later change of the rate doesn't change past calls.
- **Everything shown includes VAT,** marked as such ("incl. 19% VAT"): the prices on the model config cards, the Statistics page's Costs tab, and the spending cap, which is checked against the costs with VAT.
- **Not covered: payments in euros** (Google's): the costs are right in US dollars, but what that comes to on the user's statement depends on the provider's exchange rate.

### The model configs' list on the settings page
`#decision` `#style`

Proposed by the project owner (2026-11-09). The list of model configs gets long very quickly, and the other settings are below it.
- **Sorting:** by creation date, newest at the top, by default. To decide: whether the default config stays at the top regardless.
- **To decide: a more compact view of each config,** with a way to see all its details: the card expanded in place, or a view of its own.
- **To decide: how the list stays short:** pages, a container of its own that scrolls, or the configs on a tab of their own in the settings.

### The default name follows the form when cloning
`#nice-to-have` `#decision`

Proposed by the project owner (2026-11-09). `docs/llm.md`, "The default name": "Claude Opus 5.5 (Bedrock) · high". When a config is cloned from one with the default name, the clone's name doesn't change with its fields, so the user has to rewrite it by hand, which is awkward since "·" isn't on a keyboard (e.g. adding " · high" when the clone picks an effort the original left at the model's default). Instead: recognize that the name is the default one, and keep it updated as the fields change, until the user types a name of their own. To decide: whether the create form does the same (there an empty name already gives the default one, so it matters less).

### Stop cancels the LLM call

Today Stop in the browser doesn't cancel the provider's call: the Worker calls the adapter without an abort signal (`llmRoutes.ts`), so the call runs to its end and is billed in full, its answer thrown away. Found 2026-11-09: an `extract` call on Gemini 3.1 Pro Preview through OpenRouter, stopped by the project owner, is on OpenRouter's dashboard (about $0.03 to $0.04, billed), while its row in `llm_calls` stays `running`, with no cost, so the Costs tab and the spending cap leave it out. Long calls (minutes) make this matter more: a user who stops a slow call to try another model pays for both.
- **What to do:** pass the abort signal of the browser's request through the Worker to the adapter (every adapter's `send` takes one already), so that a stopped stage cancels its call. Record the cancelled call as such (`aborted`), with whatever usage is known by then, rather than leaving it `running`.
- **To check per provider:** what a call cancelled mid-stream is billed. Believed (not checked): with streaming, the generation stops and only the tokens produced so far are billed; OpenRouter passes the cancellation on for some providers only. Whether the usage so far can be read at all after cancelling (usually it comes at the end of the stream).
- **To check:** whether the Workers runtime (and `wrangler dev`, and the desktop app's Node server) signals the Worker when the browser's request goes away, and how (`request.signal`).
- **Also:** whether anything ever closes a row left `running` (a call interrupted by a closed tab, or today by Stop).
