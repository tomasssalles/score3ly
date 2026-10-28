# Tasks

Everything that is still to do about score3ly is a task, and every task is in this file: features, decisions to make, bugs, tests to run by hand, research, far-future ideas.

**How the list works:**
- **Just tasks.** No sections, no subtasks, no numbers, no checkboxes. The order means nothing; tags say what matters when.
- **A done task is deleted.** Whatever it decided goes into the docs file that covers its topic (`docs/overview.md` or one in `docs/`). Progress at the highest level is tracked in `docs/overview.md`'s checklist of the first release (§16), whose items stay when done.
- **A large task broken down** is replaced by the smaller ones, or loses the parts they take over. Some overlap between tasks is fine.
- **A task collects its notes:** what was found out, discussed and decided about how to do it, so that it becomes easy to do. A decision that holds beyond the task also goes into the docs file that covers its topic.
- **Tasks overlap with the rest of the docs,** which say what is intended; a task says what is left to do about it. § numbers in this file are `docs/overview.md`'s sections.
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

## The tasks

### Generate the prompt's token list from the parser

`docs/notation.md`, "The symbolic format": the description of the symbolic format in `extract`'s prompt (`MUSIC` in `packages/prompts/src/extract.ts`) is written by hand, and the parser (`packages/notation`) accepts a closed list of tokens. The plan was to generate the prompt's list from the parser's code, so that the two can never drift apart: every token the parser accepts is described, and nothing it rejects is offered. A change of the generated text changes the prompt's version.

### `review`
`#next`

`docs/stages/music.md` (`review`, "The Transcription"), §6 (the issues) and the first-release list (§16). Includes linking from the current extraction for `review`'s requests (§6, `analyze`, "Code links when the links are needed"): the observations' linking for `extract` is built (`apps/web/src/linking.ts`), and the same code is to pre-link the items of the extraction as it is at the start of the stage; `apply_review`'s requests use it too.

### `apply_review`
`#next`

`docs/stages/music.md` (`apply_review`; its title in the app is "Apply review"). Further reviews and their `apply_review` are carried and dropped like manual stages; an `apply_review` goes with its review; the recipe's review can't be dropped (§5.5).

### `human_review`
`#next`

`docs/stages/music.md` (`human_review`): a manual stage, never in the recipe, added by the user; an `apply_review` is added after it automatically and is dropped with it (§5.5).

### Other statistics: decide, then build
`#next` `#decision` `#next-release`

The Statistics page has its costs (done, `docs/llm.md`, "The costs view"). The chart (`TimeChart`) and the check lists are made to be reused. Decided so far (2026-10-28, under discussion):
- **One page, four tabs,** each with its own URL (`#/stats/costs`, ...); one menu entry. Built: the tabs (Costs, Usage, Run times, Effort), the new ones saying "Not built yet.", Effort with its explanation.
- **Costs:** as built.
- **Usage,** one tab in two parts: activity (when the app was in use, projects created, stages run, extra stages added, LLM calls and tokens, with free or paid as a grouping) and waste (retries, failed calls and stages, discarded stages).
- **When the app was in use** (built: the Usage tab's first block, "Activity", `UsageTab.tsx`, `usage.ts`, `GET /api/activity` in `apps/worker/src/activity.ts`): from what is recorded anyway, nothing new. An hour of the viewer's day is active if anything happened in it: an LLM call was running (start to end; one that never ended counts where it started), a stage started, ended or sent its last heartbeat, an output was saved, a project was created. A stage's start and end are events, not a span (decided: a retried stage keeps its first start, a manual stage left open for days isn't days of work). The Worker sends the quarters of an hour with activity, per project; the browser makes the local hours. A time range of its own (decided: not shared between tabs), the granularity as in Costs, bars or running total; the total in the head ("57 hours", "on 23 days" under it, all projects); no split or filter, but a project picker without a label ("All projects" first, then the projects, newest first, a deleted one with "(deleted 12 Sep 2026)" in muted italics) to see when a project was worked on, and a one-row table with the total for what is picked.
- **Run times:** projects, stages, per-page averages; a manual stage's time is from its creation to its finish, breaks and all (decided: good enough), and per-page averages ignore breaks too. Not by model to pick a faster one: the best models are the slow ones.
- **Effort** (the corrections): how often the automated pipeline wasn't good enough and the user stepped in: manual fixes, how often and how much each changes (boxes, lines, answers), extra reviews added, human reviews. Its explanation at the top: "This page is about how often the automated pipeline wasn't good enough and you had to swoop in and save the day."

Still to settle, then build:
- **Each tab's blocks and head numbers,** as in Costs (a head with title, "i" and the value on the right). Proposed, not decided: Run times, the average time per page through the whole pipeline; Effort, the share of projects that needed any manual stage.
- **Each tab's charts:** their splits, groupings and filters (e.g. Effort by kind of fix, Usage by step), with the same parts (`TimeChart`, check lists, the picker, `statsParts.tsx`); each tab's time range is its own.
- **The rest of Usage:** projects created, stages run, extra stages added, LLM calls and tokens (free or paid as a grouping); and waste. Retries aren't marked as such: proposed, a failed call followed by another call for the same item in the same stage.
- **How much a manual fix changes** isn't recorded: a fix stores its outputs whole, so the changes are only found by comparing each output with its parent (in R2). Proposed: count them once, when the fix is finished, and store the count on the stage; a rule per kind of fix (boxes and bar lines, lines, fields, answers) is to be decided.

### Failed calls in the Costs tab
`#next` `#decision`

How much money was lost on failed calls (`docs/llm.md`, "The costs view"). Proposed, not decided: a note under the detailed overview's total ("unfiltered total, $0.85 on failed calls"), and a fourth dimension in the split and the filter, "Call", with the groupings outcome (succeeded, failed) and reason (cut off, refused, unusable answer, error), so that failed calls alone can be split by stage or config. It conflicts with "failures are not a group of their own (decided: confusing)", which is to be settled: that was about failures as a group of the stage split. The Worker's points would carry the outcome as one more key.

### Decide the model configs
`#decision` `#research` `#next-release`

`docs/llm.md`, "Supported models, prices and the config form" (under discussion): the supported models and their prices in the database, the config form with pickers. Then build the first round: the table and its shipped list, the form, adding a supported model, Fake pre-installed as the default, the price label on the cards, the Test button.
- **Soon after the first round:** editing a config (copy on change, as now), removing a config, editing a supported model (e.g. its prices).
- **Still to settle or research** (the AWS and Google documentation couldn't be reached from the cloud session where this was discussed):
  - **Global versus regional on Bedrock's Messages API endpoint:** a request goes to a regional URL (`bedrock-mantle.{region}.api.aws`); how it asks for global routing, and so what a config stores for "Global", isn't documented on Anthropic's page. Also how the geographic inference profiles (US, EU, JP, AU) are addressed there. AWS's documentation, or a test call.
  - **Bedrock's per-region prices:** whether they differ beyond the 10% regional premium (AWS's pricing page and its price list files), and which regions serve which Claude models (Anthropic's page lists 27 regions; Fable 5.1 is regional only in `us-east-1`).
  - **Vertex AI:** its global, multi-region (`eu`, `us`) and regional endpoints, their prices, and which models each serves.
  - **Gemini's current models and prices** on Google AI Studio, from Google's own pricing page (third-party pages disagree).
  - **The script that generates the shipped list:** which files or APIs, and how it maps their entries to our rows.
  - **Prices that change with the prompt's length** (Haiku 5.5 above 100,000 tokens, Gemini Pro above 200,000): not modelled, since our prompts are believed to be smaller. Stays open until the pipeline is finished and has run on most of the test set with a real model (the task "Measure the prompt lengths").
  - **Model strings on Vertex AI** (with or without an `@` version) for the current models.

### Settings page, the model configs
`#next-release`

§7.2, §10: adding, editing and deleting configs, choosing the default, the configs per kind of work, the free-tier mark. Today the page has one row per setting (the run mode for new projects, the spending cap), its label (with a short hint where needed) left and its control right, and below them "Model configs", read-only: a card per config with its name (else its model), badges for the default and free tier, its provider, model and effort, its plain values and its secrets by the Worker secret's name.

### Verify the prompt and schema of `layout`
`#owner` `#next-release`

`packages/prompts/src/layout.ts`: the texts, the rounds, what counts as a bar line and what a box must hold, before the first real runs.

### Verify the prompts and schemas of `analyze`
`#owner` `#next-release`

`packages/prompts/src/analyze.ts`: the page and whole-score texts, the metadata fields and the observations' shape, the confidence levels, the places (systems and bar lines by their labels), and the checks, before the first real run.

### Confirm the decisions made while building `extract`, the MEI builder and `engrave`
`#owner`

Each of them has a list "Decisions made while building it (to confirm)" in `docs/stages/music.md` (`extract`, built) and `docs/notation.md` ("MEI", built) and `docs/stages/engrave.md` (`engrave`, built).

### Compare `review` with and without renderings as model input
`#experiment`

`docs/stages/music.md`, "Renderings for the models", on the test set, some day: run it both ways and compare what it finds, counting false findings as well as extra correct ones. If renderings help, they become the default, and a config option of `review` can turn them off.

### Zoom crops on request
`docs/stages/music.md`, "Zooming in" (decided, for a later version), for `extract`, `review` and probably `apply_review`.
- **Open, until `review` is built: accumulating zoom crops across stages.** The places `extract` zoomed into are the parts of the page that are hard to read, so the first `review` call for a system could get them from the start, with their reasons, and still ask for more; every later `review` and `apply_review` would get all zooms asked for so far, the set growing stage by stage. The caps could then differ, e.g. 3 per system for `extract` and 1 per system after it.

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

The root `README.md`; the owner wants it written properly, today it is the development notes with the logo on top: what score3ly is and does, with screenshots, how to use it, how to develop it; and badges at the top (version, license, tests passing, and the like).

### Help
`#docs` `#next-release`

Write the user guide as a Markdown file in the repository, and make "Help" in the menu lead to it on GitHub (§5.6). It has to cover deployment and setting the LLM keys (§10), and it recommends a model (§7.2). For the desktop version (§3): where things are stored on each platform, with a strong warning that changing those files can invalidate pipelines that already ran. Only makes sense once there is something to explain. Now a placeholder page.

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

### Pick an icon for each kind of artifact
`#style`

§5.6, once the list of stages is final and the kinds of artifact are known (decided so far: image artifacts the usual image icon, as on `rasterize`'s card; the original PDF a sheet with "PDF" on it, `PdfIcon`).

### Build the stages
One by one, with the Worker endpoints each needs, added as they are needed rather than planned ahead (decided). A form for "Change config" comes with them. The details in §5.6 are provisional until the possible stages are defined, and are settled then: what exactly a card shows, the icons, the fields of the details view, and which manual stages can be added where.

### Sort the statistics' project lists by name
`#optional`

In every list of projects on the Statistics page (Costs: the average per page's list, and the detailed overview's Project section, `docs/llm.md`, "The costs view"; Usage: the project picker of the active hours): sort by name as well as by date. Everywhere or nowhere (decided).

### Search the statistics' project lists
`#optional`

In every list of projects on the Statistics page (as above): a search field that keeps the projects whose name contains the text, ignoring case, as the project picker in the header does. Everywhere or nowhere (decided).

### Keep a run going while another page of the app is open
`#next-release`

Today a run belongs to the project view: opening a menu page (Statistics, Settings, About) or another project unmounts it, and its cleanup aborts the run (`ProjectView.tsx`, the first `useEffect`), without a warning, unlike closing the tab. The outputs saved stay; an LLM answer on its way is lost, although it is paid for; the stage shows as running until its heartbeat is 3 minutes old, then as interrupted, and a retry asks only for what is missing (docs/database.md). The same in the web app and in cadenza. Switching to another window doesn't stop a run (a hidden window's timers are slowed, but the heartbeat stays within the 3 minutes).

To do: move the runner (the abort controller, the heartbeat, the Auto loop and the wake lock) out of the project view to the app's top level, so a run goes on whatever the app shows, and the project view only shows it. Then: where the user sees a run going on while elsewhere (e.g. in the header or the project picker), and what a second project's Run does while one runs (one run at a time, as the calls are sequential, §10).

### Create the remote R2 bucket and D1 database
`#next-release`

EU jurisdiction, with a script in the repo (§14), and put the real database ID into `apps/worker/wrangler.jsonc`, which has a placeholder. Until then the app can't be deployed.

### Set up Cloudflare Access
`#next-release` `#security`

In front of the deployed app (§3).

### Build the test environments
§12: the start script, the build script and a first environment.

The plan (decided), moved from `docs/overview.md` §12:

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

To check when building it: whether an existing `.dev.vars` makes Wrangler ignore the `--env-file`.

### Try the page images in Firefox, Safari and on phones
`#manual-test` `#next-release`

§8.1: they work in Chromium, in a Web Worker. Check that pdf.js loads in a worker there, that the pixels match Node's (scans exactly, vector pages "close"), that the PNG bytes match (they do in Chromium), and the memory needed for large scans on a phone (a 5400×7200 scan is about 155 MB as RGBA).

### Google Drive
§3, §10: picking source PDFs with the Picker, and exporting to an app-created folder.

### Try regeneration on a second device
`#manual-test`

§5.3: a project run on one device, continued on another whose image cache is empty.

### Try the editors with touch and on a real phone
`#manual-test`

`fix_layout` hasn't been tried with touch at all, `fix_skew` only through Chromium's emulation of touch at phone size.

### Optimistic locking
§4: `projects.version` exists, but no request checks it yet. Two devices running or changing the same pipeline at once aren't guarded against, except that a running stage can't be started again.

### Images for the LLMs
They are PNGs from our own encoder (`packages/imaging/src/png.ts`), and shrunk by our own code to Claude's limits (`packages/imaging/src/scale.ts`; 2576 px on the long edge, 4784 visual tokens):
- **5 MB per image on Bedrock and Vertex AI** (10 MB on Anthropic's API, 32 MB per request): check with the first real calls whether a colour scan at 2576 px stays under it as PNG, and what to do if not (grayscale, or a smaller limit for that provider). `layout` doesn't check its requests' size yet (§6).
- **Gemini's limits:** what Gemini said about them is in §6 (`analyze`), to check against Google's documentation when we use it. `imageLimit` gives Gemini Claude's limits for now; each provider's adapter should declare its own.

### LLM calls, what is left
The configs per kind of work (§7.2); checking Bedrock's and Vertex AI's prices against the list prices that stand in for them (`llm/prices.ts`).

### Set up Claude on Vertex AI
`#owner`

`docs/llm.md`, "Calling the providers": a service account, enabling Claude for the project ("score3ly", with its €30 monthly cap and the Vertex AI API enabled), a key file, the first real call, and checking whether Opus 5.5 is offered on Vertex AI at all (not in Europe: checked 2026-10-09, §10).

### Check Bedrock's model name on the first real call
`docs/llm.md`, "Calling the providers": whether the answer names the model with the same string that was asked (an inference profile may come back as the bare model ID). The sanity check compares the two as they are.

### Gemini on Vertex AI
`#optional`

§7.2: not built; only Claude runs on Vertex AI.

### Try a run on a real phone that goes to sleep or to another app
`#manual-test`

§5.8: while this device runs a stage, the screen is kept on (the Screen Wake Lock, `apps/web/src/wakeLock.ts`, asked for again whenever the app comes back to the front; built, tried in Chromium with the API stubbed). The browser drops the lock when the app isn't in front, so the page can still be suspended: check that the run carries on where it stopped when the app comes back, and what other devices show meanwhile (it turns "Interrupted" after three minutes without a heartbeat).

### The Worker finishes an LLM call on its own
`#optional`

§5.8: an answer that was paid for is lost when the tab is closed or a phone suspends the page mid-call (accepted). Some day, perhaps: the Worker finishes the call and stores the answer on its own (a Durable Object or Workflow), so resuming finds it.

### Remove the undici override
`#security`

In the root `package.json`, once Miniflare (Wrangler's) depends on undici 7.30.1 or later: it pins an exact version, and 7.29.1 had advisories that `npm audit` reported as high (GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c). The override also covers `@electron/get` (Electron's). Check with `npm view miniflare@<version> dependencies.undici`; without the override, `npm audit` must stay clean.

### A run mode between Auto and Manual
`#optional`

§5.1: run automatically, but stop when a model asks for human input.

### A "needs you" state for stages
`#optional`

`docs/project-view.md`, "The pipeline panel": for a model asking for human input; left out for now, easy to add.

### The toolbar colour follows the theme
`#optional` `#nice-to-have` `#style`

`docs/style.md`, "Brand": the manifest's `theme_color` is the icon's coral in both themes; making it follow the theme would take a `<meta name="theme-color">` changed by script.

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

### Export a project before deleting it, and import it again
`#optional` `#nice-to-have`

Not trivial: a file with everything the project stores (its pipeline, stages, outputs and their content, call records, the PDF), so that heavy users can free storage (R2's free 10 GB, §2) and bring a project back later. Importing has to fit what is stored by then (other step versions, ids that exist, content already there).

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
