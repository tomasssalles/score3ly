# Manual tests

A suite of behavioural tests for trying the app by hand: short scripts, each telling the story of what a user might do or go through, with many actions in a row and what should happen after each. They complement the unit tests (strict, each from a clean slate) and the screenshots (§12): what only a person clicking through the app notices. The task "A manual test suite" (§15) tracks what is left to do about it; § numbers here are `docs/overview.md`'s sections.

**How it works:**
- **Stories, not isolated cases.** A story starts from the state the earlier ones left, unless it says otherwise, and runs straight through. A step is an action (→) and what should happen (✓). When a ✓ fails, note it (story, step, what happened) and go on if you can; a broken state rarely makes the rest of a story useless.
- **Single device for now.** Everything here runs on one computer, locally, with the fake models. **Multi-device tests wait for a real deployment** (§16, "Deployment"): they are listed at the end ("Waiting for a deployment"), so they aren't forgotten.
- **Sized for a person.** Each story says roughly how long it takes. Not every story runs before every release:
  - **The smoke run** (about an hour, before every commit that reaches `main`, §11): story 1, and the steps marked ★ in stories 3, 4, 10 and 11.
  - **The full run** (about 8 hours, split over several evenings; before showing the app to anyone, and before a version goes up by a minor or a major): every story.
  - **In between:** the stories that touch what changed (each story lists the areas it covers).
- **Expected results come from the docs.** Where the docs and the app disagree, either can be wrong (CLAUDE.md): note it, don't decide on the spot.
- **They cost nothing, or very little** (decided 2026-11-06): the fake models answer without network or charges. A few stories may cost a small sum where a real model makes a test meaningful (a real run under realistic conditions); where real calls are optional, a story says so and what they would cost, as story 10 does for the configs' Test.
- **What is worth automating** is noted at the end of each story: a test that keeps failing, or that is boring and mechanical, belongs in the unit tests or the screenshot script.

## Setup

What the stories need: a local Worker and Vite on their own database and storage, a browser with empty storage, a few PDFs from the test set, and model configs that fail or cost money on purpose. **No real model and no API key** (the fake provider, docs/llm.md): the stories test the app, not the prompts. Once the test environments exist (§15, "Build the test environments"), this setup becomes one of them and one command.

**The servers**, on a state folder of their own (relative to `apps/worker`), in two terminals:
```
(cd apps/worker && npm run config && npx wrangler d1 migrations apply score3ly --local -c wrangler.local-dev.jsonc --persist-to .wrangler/manual)
npm run dev:worker -- --persist-to .wrangler/manual --var DEV_PROVIDERS:true
```
```
npm run dev:web
```
`DEV_PROVIDERS` offers the fake provider with costs, which is for development (docs/llm.md); the stories need it. To start again from nothing: stop the Worker, delete `apps/worker/.wrangler/manual`, and repeat. (Tried: the migrations, the Worker, and the `curl` commands below.) **The browser:** a profile of its own, so OPFS (the image cache), `localStorage` and history start empty, e.g. `google-chrome --user-data-dir=/tmp/s3l-manual --no-first-run http://localhost:5173` (a new folder for a fresh start).

**The PDFs** (all in `testset/`):

| PDF | Why |
|---|---|
| `beethoven_fuer_elise_leipzig.orig.pdf` | 3 clean scanned pages: quick, the default for "a score". |
| `debussy_clair_de_lune_mutopia.orig.pdf` | 4 vector pages: the resolution matters, and the lines differ with it. |
| `bendel_la_cascade.orig.pdf` | 10 large, slightly skewed scans, a cover without staves: slow enough to stop, interrupt and watch progress (`rasterize` about 40 s, `skew_analysis` about 25 s). |
| `schumann_kinderscenen_first_edition.orig.pdf` | 22 crooked colour scans, 13 MB: the big old book. |
| `schumann_kinderscenen_first_edition_p3.orig.pdf` | 1 colour page: a quick second PDF. |

**Secrets:** the Worker reads them from `apps/worker/.dev.vars` (not committed; move a real one aside first), and the config form offers their names. Dummy ones, for story 10 and "No key":
```
printf 'DUMMY_ANTHROPIC_KEY=x\nDUMMY_AWS_KEY_ID=x\nDUMMY_AWS_SECRET=x\n' > apps/worker/.dev.vars
```

**Model configs.** A new database has "Fake model" (free, the default). The others could be made on the settings page ("+" on "Model configs"), but `curl` is quicker for these; the default is picked on the settings page ("Default model config for new LLM stages"), which the stories call "make … the default":
```
W=http://localhost:8787/api
mk() { curl -s -X POST $W/model-configs -H 'content-type: application/json' -d "$1"; echo; }
F='"family":"fake","pricing":{"kind":"free"}'
mk '{"provider":"fake-dev","modelString":"fake-model","family":"fake","pricing":{"kind":"list","reference":"fake"},"name":"Fake (priced)"}'  # made-up prices: for the costs and the cap
mk '{"provider":"fake","modelString":"fake-error",'"$F"',"name":"Fails: server"}'
mk '{"provider":"fake","modelString":"fake-refusal",'"$F"',"name":"Fails: refusal"}'
mk '{"provider":"fake","modelString":"fake-cut-off",'"$F"',"name":"Fails: cut off"}'
mk '{"provider":"fake","modelString":"fake-unparseable",'"$F"',"name":"Fails: not JSON"}'
mk '{"provider":"fake","modelString":"fake-other-model",'"$F"',"name":"Fails: other model"}'
mk '{"provider":"anthropic","modelId":"claude-opus-5-5","pricing":{"kind":"list"},"name":"No key","secrets":{"apiKey":"NOT_SET"}}'
curl -s $W/model-configs | grep -o '"id":"[^"]*","name":"[^"]*"'            # the ids
```
"No key" doesn't reach the network: the Worker refuses it first (docs/llm.md, "Errors the stage acts on"). (A config without a price can't be made any more: the Worker refuses it when it is created.)

**What the fake model answers** (so that its output isn't mistaken for bugs): `layout` six systems on every page (as on a real page of piano music; two before 2026-11-12), three bar lines each (so four stretches); `analyze` empty metadata and observations; `extract` a whole-measure rest in 4/4 in every stretch, a voice per staff, a made-up doubt on every system and a format issue on the first; `review` a correction on system 1 and another answer chosen for the first issue of system 2; `apply_review` applies the issues of a window that starts on an odd system (a C in the first voice) and reverts those of an even one with a made-up reason, but always applies a person's answers.

**Known gaps** (not bugs; their tasks are in §15): leaving a running project for another page of the app or another project aborts the run ("Keep a run going while another page of the app is open"); the fake model always applies a person's answers in Apply review, so a human review that stops the stage (`docs/stages/music.md`, "A resolved issue") can't be tried here.

## Story 1: The first score

*A new user installs the app, transcribes one score with every default, and takes the MEI.* About 30 minutes. Covers: the empty app, creating a project, Auto mode, progress, every artifact's view, the downloads, the About page.

1. → Open the app in the fresh profile. ✓ No project open, "Open a project" in the picker, the header's "+ New project" and ☰. The title is "score3ly – concerto"; the edition shows next to the wordmark in wide mode only.
2. → ☰ → Settings. ✓ Run mode for new projects "Auto", spending cap "$ 1.00", image cache 1 GB with what it takes now (about nothing), "Fake model" as the only config, marked Default and Free tier (plus the ones made with `curl`), the Secrets section saying where secrets are set. → Back. ✓ The empty app again.
3. → "+ New project", pick Für Elise. ✓ A project named "beethoven_fuer_elise_leipzig.orig", opened at once (URL `#/projects/<id>`), the original PDF in the artifact view, Ingest done, the other stages planned (dimmed), Rasterize ready. Auto mode, Run in the panel's head.
4. → Run. ✓ Stop replaces Run; Rasterize gets a green border and its bar; the pipeline's bar moves; the line under it says "Rasterize…". While no tile has been picked, the artifact view follows the pipeline (the latest stage's main artifact).
5. → Let it run to the end without touching anything. ✓ Each stage in turn: Rasterize, Skew detection, Layout, Analyze, Extract, Review, Apply review, Build MEI, Engrave; the list scrolls to the current stage; LLM cards show "Fake model" on a line of their own; done cards show a run time and a short result ("lines on 3 of 3 pages", "18 systems on 3 pages", "3 pages", "18 systems · 19 issues", "2 proposed changes", "1 change applied, 1 reverted", "72 measures" (Build MEI), the pages of the engraving (Engrave): what trial runs on 2026-11-01 to 2026-11-03 gave, with the counts of six systems a page since 2026-11-12); the Download card after Engrave stays disabled until Engrave is done; no cost anywhere in the panel. At the end (about 2 minutes): "Done", the bar full, the PDF in the artifact view, the file itself, with the title ("Untitled") on its first page; Download enabled. → Reload. ✓ The same PDF. (Fixed 2026-11-02: the engraving shown right at the end had no title and a page shrunk to the music until a reload, because Verovio kept the Transcription's options. If the file's pane is ever empty for more than a moment, note it: seen once, not reproduced.)
6. → Open each tile in turn, top to bottom. ✓ Each shows something sensible:
   - Page images: the three pages, scrolling continuously, with a counter ("2 / 3").
   - Staff lines: the pages with red lines and their angles; none on a page without staves.
   - Layout: six numbered boxes per page in different colours, numbers continuing across pages (1–18), bar lines in their box's colour.
   - Metadata and Observations: empty, without errors.
   - The Transcription: each system's crop with its rendering below; numbered solid boxes for issues, dashed "!" boxes for warnings, the hint about what they are; issue cards with "[unclear]" or "[cannot be encoded]" (the first system's format issue, with its LilyPond equivalent).
   - Review's Transcription: the Δ toggle on, showing only what the review changed (system 1's correction, system 2's first issue with "[chosen by Review 1]" on one answer and "[written by Extract]" on the other, and the "Choices" line; the correction's "[in this transcription]"); Δ off shows everything, and the scroll stays put.
   - Apply review's Transcription: at the top, in red, "1 answer couldn't be applied as given, and was reverted:" with the issue's number (a link to its card) and the fake model's reason; system 1's first stretch now a C (its rendering and `</>`), system 1's correction "An E [applied by Apply review 1] [chosen by Review 1]" and "A D" without a suffix, system 2's issue with "A smudge [written by Extract] [chosen by Apply review 1]" and the reason behind its "i".
   - Build MEI's MEI: the file, highlighted, beside the engraving (below it if the window is narrower than about 900 px).
   - Engrave's PDF: the file, drawn like the original PDF. → In the browser's developer tools, delete the site's storage (Application → Storage → Clear site data), reload, open it again. ✓ "Regenerating the PDF…" for a moment, then the same PDF.
7. → In the Transcription: toggle ♪ / `</>`, and the boxes' toggle; tap a box. ✓ The raw source replaces the renderings and back; the boxes hide and show; tapping a box brings its card into view. → Reload. ✓ The same artifact open, both toggles as left (remembered per device).
8. → In the MEI view: click a note in the engraving; click a line in the file; search for `measure` (Enter, Shift + Enter, Escape); go to measure 3, then to measure 999; "Back to the top"; hide the score. ✓ Each click selects its counterpart on the other side, highlighted (amber in the score) and scrolled to the middle; the search counts "2 / 16"-style and moves; measure 999 says it doesn't exist; the score's toggle is remembered after a reload.
9. → The Download card's button → each entry in turn. ✓ "Preparing…" while it works; files named `beethoven_fuer_elise_leipzig.orig.score3ly-bundle.zip`, `.score3ly-source.mei`, `.score3ly-render.pdf`, `.score3ly-report.json`. The zip holds the other three. The PDF is the one the app showed (Verovio's own breaks), and downloading it twice gives the same bytes (no date in it). The report has the app's version and commit, the PDF's name and SHA-256, every stage with its config, model config (no secrets), times and cost (0).
10. → "Show details" in Layout's "⋮". ✓ Step and version, kind, status, run time, cost "$0.00", result, config, tokens. → Close it (back button). ✓ The panel shows what was open before.
11. → ☰ → About. ✓ Wordmark, *concerto*, the summary, the version "0.1.0 @ <commit>" with "[dev server]", the author, the links (repository, license, third-party notices, all opening on GitHub), the prices' date. → Back. ✓ The project again.

*Worth automating:* the download names and the zip's contents; the report's fields.

## Story 2: The careful user

*Someone who checks every step: Manual mode, a vector PDF, a different page selection, every manual stage.* About 90 minutes (best split after steps 12 and 14). Covers: Manual mode, config dialogs and their checks, `fix_skew`, `fix_layout`, `fix_metadata`, `fix_observations`, `fix_mei`, `human_review` (its screen, answers, clarifications, Finish's checks), Finish.

1. → Settings → run mode for new projects "Manual". → New project from Debussy. ✓ The project's run mode shows "Manual"; Rasterize ready, with **Run** on its card; no Run in the head.
2. → Rasterize's "⋮" → Change config: Pages `9`. ✓ Refused when saved (beyond the last page, 4), the old config kept. → Pages `3,1`, resolution `1000`. ✓ The resolution refused (72 to 600). → Pages `3,1`, 150 dpi, save. ✓ No confirmation (nothing ran yet). → Run. ✓ Two pages, the card "2 pages"-style, the config shown as "1, 3" in the details. The next stage is ready, not started.
3. → Run Skew detection. → Open Staff lines. ✓ Red lines on both pages, with their angles (near 0 on a vector page).
4. → Skew detection's "⋮" → "Fix skew manually". ✓ A Fix skew card with the wrench and WIP, its editor open, "Page 1/2" between arrows. The "⋮" no longer offers "Fix skew manually".
5. In the editor:
   - → Hand mode: click a line, press Delete. ✓ Gone. → Ctrl + Z, Ctrl + Shift + Z, Ctrl + Y. ✓ Back, gone, back.
   - → Select a line, drag one of its ends. ✓ It moves; the angle label follows.
   - → Drawing mode: click, move (the line follows), click. ✓ A new line. → Click once, Escape. ✓ The started line is dropped. → Click, then click straight below. ✓ Ignored; the line waits for its second end.
   - → Zoom with Ctrl + wheel and the buttons, pan by dragging in hand mode, with a line started in drawing mode. ✓ The started line survives zooming and panning.
   - → Page 2, delete all its lines. → Page 1, undo. ✓ Each page keeps its own history.
6. → Close the editor (back), reload, open Fix skew's tile again. ✓ Every change still there (saved as it happened).
7. → Finish. ✓ Card done: "lines changed on 2 of 2 pages"-style; Layout ready. → Fix skew's "⋮". ✓ "Edit" and "Drop stage" (red).
8. → Run Layout, open Layout. ✓ Page 2 (no lines now) not straightened; numbers 1–4 across both pages.
9. → Layout's "⋮" → "Fix layout manually". ✓ The editor, the hint line under the toolbar, three tools (hand, box, bar line).
   - → Box tool: click two corners. ✓ A new box, numbered by its place top to bottom (the numbers after it shift). → A tiny box (two clicks very close). ✓ Ignored; the corner waits.
   - → Hand: select a box, drag its handles; tap where two boxes overlap twice. ✓ Resizes; the second tap selects the box beneath. → Make a box narrower than its bar lines. ✓ The bar lines outside it are deleted with that step; one undo brings both back.
   - → Bar line tool: click inside a box; click outside every box. ✓ A bar line in that system; nothing.
   - → Select a bar line, arrow keys with and without Shift. ✓ Nudged by 1 and 10 pixels. → Deselect (Escape), arrow keys. ✓ They flip pages.
   - → Delete a whole box (Backspace). ✓ Gone with its bar lines. → Finish. ✓ "layout changed on 2 of 2 pages"-style; flags (none with the fake) cleared.
10. → Run Analyze. → Its "⋮": "Fix metadata manually". ✓ An empty form with one "+".
    - → "+" → Composer, type "Debussy", p. 1, ✓. ✓ Saved and confirmed (green ✓) under Work. → "⋮" → Edit, change the kind to Arranger. ✓ It moves to Arrangement, keeping its text.
    - → "+" → Piece/Mov.: "Clair de lune", from system 3. ✓ The pickers show only free systems; system 1's piece doesn't exist yet, so system 1 isn't dimmed. → Another piece: its picker dims system 3.
    - → Type a comment and close the form without leaving the field. ✓ Saved when the form closes (check after reopening).
    - → Eye button on the composer. ✓ All pages, scrolled to p. 1, the field in a strip above them with its "⋮"; closing the strip returns to the list.
11. → Analyze's "⋮" → "Fix observations manually" (while Fix metadata is still WIP). ✓ Added right after Fix metadata, also WIP. → Add a special bar line (final) at the end of system 4, a staff on a system ("Add a staff below"), an ottava on staff 2/2; then try "Remove the bottom staff". ✓ Places come from pickers by name; the removal is refused, saying what is on the staff.
12. → Run Extract while either fix is WIP. ✓ It doesn't start (a WIP fix of the analysis stops it), with a message in the head. → Finish both fixes. ✓ Their results ("2 changed · 2 confirmed"-style); Extract ready.
13. → Run Extract, Review, Apply review and Build MEI. ✓ Only Build MEI's "⋮" has "Fix MEI manually"; Apply review's has "Add Review". → Build MEI's "⋮" → "Fix MEI manually". ✓ The MEI in an editor, the score beside it.
    - → Change a `<rest>`'s `dur` from `1` to `2`, wait 2 seconds, reload. ✓ The draft kept; the toolbar says the text differs from the applied version.
    - → Apply with an unknown element `<foo/>` added; then with a tag left open; then with a duplicated `xml:id`. ✓ Each refused, the problem at its line, nothing applied.
    - → Fix them, Apply. ✓ Accepted; the score engraved again; Apply disabled. → Undo once. ✓ The text changes again and Apply is enabled (undo goes on past an Apply).
    - → Finish (with the undone change pending). ✓ The text is applied first (or refused if it doesn't pass); "… lines changed".
14. → Run Engrave. ✓ It engraves the edited MEI (the changed rest shows in the PDF). → Engrave's "⋮" → Change config: US Letter. ✓ The confirmation (Engrave ran); after Run, taller pages.
15. → Apply review's "⋮". ✓ "Add Review" and "Add Human review". → "Add Human review". ✓ The confirmation ("Add Human review": the stages after it ran); a Human review card (the wrench, WIP, Finish) right after Apply review, and a planned Apply review after it with the default model config; the Human review's screen opens: a toolbar (page arrows, "Annotation –/n" between arrows, the hand and the box tools, zoom, the link button, "⋮"), the hint, the original (straightened, every issue's boxes dimmed and numbered, warnings dashed with "!") and the transcription rendered beside it, system by system.
16. → The next-annotation arrow, then the → key. ✓ The page of the first annotation, its box in the middle and no longer dimmed; its panel covers the rendering: its number and class, the question, the answers with radio marks and their suffixes, the last row a field "Other" (italic). → Choose b. ✓ Marked, "[confirmed by Human review 1]" on it, "✓" on the box's label. → Tap b again. ✓ Taken back. → Type "An accent" in the last row. ✓ The row chosen; saved after a pause. → Choose a, then the last row again. ✓ a, then "An accent" again (the text stayed). → Empty the field. ✓ Taken back. → Type exactly the text of answer a, then the same in other capitals. ✓ Exactly: a is chosen; other capitals: a new answer. Leave b chosen on this issue, and answer two more.
17. → Close the panel (the chevron). Pan and zoom the original. ✓ The rendering follows, the same system in the middle and as wide on both sides. → Scroll the rendering to the last system. ✓ The original follows, to the other page. → The link button (unlink); pan. ✓ Each side alone, the renderings at their own size. → Link. ✓ The rendering aligned to the original again. → The view picker: "Original only", "Transcription only", "Show both"; the eye (Hide the boxes), the eye again (Show the boxes); reload. ✓ Each works, and the choices are remembered. → "Transcription only", scroll it to the last system, "Show both". ✓ Linked: the original comes to that system's page. → Unlink, move the original to page 1, "Original only", then "Show both". ✓ The transcription is where it was left.
18. → "⋮" → "Add clarification". → Tap two opposite corners between two systems (on no system). ✓ A clarification with its panel: "#n · [clarification]", "What's in the original score?" with an "i", the field "Clarification" focused; in red "The clarification text cannot be empty." and "Boxes must be on top of systems."; on the page the box's label red, with "!". → Finish. ✓ Refused: "Finishing the stage failed: Clarification n: The clarification text cannot be empty. Boxes must be on top of systems. Everything else is kept."
19. → With the clarification selected, the box tool: a box on a system. → Remove the first box. → Write "This is a C flat". ✓ No red left. → The hand tool: drag a handle of its box. ✓ It resizes, saved when let go. → The box tool: a box two systems away. ✓ Red: "The boxes are on systems 1, 3. They can be on one system, or on two neighbouring systems."-style. → Remove it, then the last box. ✓ "A clarification needs at least one box." → Draw a box on a system again. ✓ No red. → Both "i"s. ✓ Their texts, below them; tapped again, gone.
20. → A second clarification; "Delete clarification". ✓ "Are you sure?", the text, "Delete" in red. → Cancel. ✓ Kept. → Delete. ✓ Gone, from the page too.
21. → Finish. ✓ "4 changes"-style; the Apply review after it ready. → Run it, then Build MEI and Engrave. ✓ "… changes applied" (the fake model applies a person's answers, never stops on them). → The Human review's Transcription. ✓ The answers with "[confirmed by Human review 1]", the clarification as "#n · [clarification]" under its system; Δ shows only what it answered. → The new Apply review's Transcription. ✓ "[applied by Apply review 2]" on them, and the measures it changed tinted.
22. → The Human review's "⋮" → Edit. ✓ The confirmation; WIP again with everything as left; its Apply review planned again. → Finish, run to the end. → The Human review's "⋮" → Drop stage. ✓ The confirmation; it goes with its Apply review; the stages after them wait for Run.

*Worth automating:* the config dialog's refusals; the order in which a second fix after `analyze` is placed.

## Story 3: Second thoughts

*The user changes their mind in the middle: a new config upstream, edits to finished manual stages, drops. What is reused, what is carried, what is dropped.* About 50 minutes. Covers: §5.5 (re-runs, carried and dropped stages, the confirmation, the dropped cards), the cache.

Steps marked ★ are part of the smoke run (about 15 minutes). Start with a new project from Für Elise (the scan) in **Auto** mode, let it run to the end, then add a Fix skew (change one line, Finish) and let the pipeline run again to the end.

1. ★ → Rasterize's "⋮" → Change config: 150 dpi. ✓ "Are you sure?" with the text of `docs/project-view.md`, "Confirmation before a re-run", starting with "This stage will have to run again with the new config.", and "Cancel" / "Change config". → Cancel. ✓ Nothing changed.
2. ★ → Again, confirm. ✓ Nothing runs yet: in Auto mode too, a change made by hand waits for Run (only finishing a manual stage carries on by itself). → Run. ✓ Fix skew waits dimmed (carried), then is **kept**: a scan keeps its own pixels, so Skew detection finds the same lines; Fix skew keeps its result and stays done. The rest runs again.
3. → The same on story 2's Debussy project (vector), Rasterize to 200 dpi, with its Fix skew. ✓ Fix skew **dropped**: a card struck through, "⚠️ Dropped: inputs have changed", dimmed, with only an "x"; it doesn't count in the progress. Fix layout is kept only if Layout's outputs come out the same (the fake model's boxes don't depend on the page, but the stored angle does); either is right, as long as the toast or a card says which. → Run to the end (Manual mode: one Run per stage). → Dismiss a dropped card with "x". ✓ Gone; reload: still gone.
4. ★ → Back on Für Elise: Analyze's "⋮" → "Fix metadata manually": add a composer, Finish. ✓ Adding it asks first (stages after it have run: "Add stage"). Then: Extract and Review **reused** (the same run times as before: the same stages; `pieces` didn't change), only Build MEI and Engrave run again.
5. → Fix metadata's "⋮" → Edit. ✓ The confirmation ("Edit stage"); the stage WIP again with every field as left. → Add a piece at system 3, Finish. ✓ Now Extract runs again (`pieces` changed): the MEI has two `mdiv`s.
6. → Add a Fix MEI after Build MEI, change a line, Finish, let Engrave run. Then Layout's "⋮" → "Fix layout manually" (Layout has no config form yet), move one box edge, Finish. ✓ The confirmation; Fix metadata and Fix MEI carried (dimmed while they wait). Fix metadata is **kept** (the fake model's analysis comes out the same, empty, whatever the boxes); Fix MEI is **dropped** (the layout is in the MEI's facsimile), with its card; the stages between them run again. → "Fix MEI manually" in Build MEI's "⋮" again. ✓ The dropped card disappears (a stage of the same step added there).
7. → Drop a manual stage that is done (Fix layout, "Drop stage"). ✓ The confirmation ("Drop stage"); the stages after it wait for Run. → Run. ✓ Stages that used Fix layout's boxes run again, and the earlier results come back from the cache where the inputs match (Analyze and Extract as before Fix layout: quick).
8. → Add a Fix skew, leave it WIP, change Rasterize's config, Run. ✓ The WIP Fix skew is carried, waits dimmed (can't be edited, can be dropped), and when kept stays **WIP** with the pipeline waiting on it: "Fix skew (WIP)" in the head; the toast (narrow mode, story 7) "… **Fix skew** ready".
9. ★ → Try "Drop stage" on a recipe stage. ✓ Not offered. → Open any running stage's "⋮". ✓ Only "Show details".
10. → Apply review's "⋮" → "Add Review". ✓ The confirmation ("Add Review": Engrave ran); a Review and an Apply review after it, planned, with the default model config; Apply review's "⋮" has "Add Review", the new Review's has "Drop stage". → Run to the end. ✓ The second review sees the first's results (its view: the issues as Apply review 1 left them; "chosen by Review 2"). → Add another review after the *first* Apply review. ✓ It goes right after it, before Review 2, and the stages after it wait for Run.
11. → Drop the review added last. ✓ The confirmation; it goes with its Apply review. → Analyze's "⋮" → "Fix metadata manually", add a piece at system 2, Finish. ✓ Review 2 is carried (dimmed while it waits) and **dropped** at its turn with its Apply review, one card ("Review", "⚠️ Dropped: inputs have changed"): Extract's output changed, so what it would read did. → Add a review again after the Apply review, run, then change Engrave's page size. ✓ Nothing before Engrave runs again: Review 2 isn't touched by a change after it.

12. → After the last Apply review: "Add Human review", choose an answer, Finish, run to the end. → Analyze's "⋮" → "Fix metadata manually", add a piece, Finish. ✓ The Human review is carried (dimmed while it waits) and **dropped** at its turn with its Apply review, one card ("Human review", "⚠️ Dropped: inputs have changed"): the transcription it read changed. → "Add Human review" after that Apply review again. ✓ The card disappears.

*Worth automating:* the kept/dropped outcomes of steps 2, 3 and 6 as a replay test, once fixtures exist (§12).

## Story 4: Things go wrong

*Models that fail, a user who stops, a tab that closes mid-run.* About 40 minutes (the ★ steps about 15). Covers: failures and Retry, Stop, interrupted runs, the errors the Worker acts on.

1. ★ → Make "Fails: server" the default. New project from Kinderscenen p3, Auto, Run. ✓ Rasterize and Skew detection run; Layout fails: red border, the error on the card, "Layout failed" in red in the head, Run reads **Retry** with a circular arrow, the pipeline stops. → Retry. ✓ It fails again the same way.
2. → For each of "Fails: refusal", "Fails: cut off", "Fails: not JSON", "Fails: other model", "No key": Layout's "⋮" → "Change config", pick it, tick "Apply to the remaining stages planned in this pipeline", Save (confirm), Run. ✓ Each fails with a message that says what happened (refused, cut off, not JSON, another model answered, the secret `NOT_SET` missing with where secrets are set), never a blank or only technical error. The cards after it show the picked config.
3. → "Change config" on Layout: "Fake model", with the box ticked; Run. ✓ Layout runs and the pipeline goes on to the end, every LLM stage on "Fake model". A Retry alone would have kept the failing config: a stage keeps the config it was given.
   → Delete a config that planned stages name (`curl -X DELETE $W/model-configs/<id>`). ✓ Their cards show it with " (deleted)", in red where the stage still has to start with it; Run says "Layout" can't run: its model config, "…", was deleted; "Change config" shows it as the current one, Save refused until another is picked.
4. ★ → New project from Bendel, Run, and press Stop in the head while Rasterize is halfway. ✓ The stage leaves the pipeline, a planned Rasterize is ready again, nothing is lost but its partial work. → Run. ✓ It starts from the beginning (page images found in the device cache go faster).
5. ★ → During Skew detection, close the tab. ✓ The browser asks first (its own wording). → Close anyway; open the app again at the project's URL. ✓ Skew detection shows as running, without a bar. → Wait about 3 minutes (don't reload). ✓ It turns "Interrupted" by itself, red. → Retry. ✓ The pages saved before the close aren't done again (the run is quicker than a fresh one).
6. → While Analyze runs, ☰ → Settings, then back. ✓ Known gap: the run is aborted; Analyze shows running, then interrupted after 3 minutes; Retry works.
7. → While a stage runs: project "⋮" → Delete project. ✓ Refused while a stage runs, with a message saying so.
8. → Disconnect the network (DevTools → Network → Offline) during a run. ✓ An error in the panel's head or on the card, not a frozen app. → Online, Retry. ✓ Continues.

*Worth automating:* each failing fake model's message on the card (a Playwright test with the fake models, like the screenshots).

## Story 5: Money

*A user with a priced model, a low spending cap, and the Statistics page.* About 35 minutes. Covers: the spending cap, costs in the details and the costs view, the cache serving paid calls, the other Statistics tabs.

1. → Settings → spending cap: try `0`, `-1`, `abc`, an empty field, Escape. ✓ None saved, each says why; Escape brings back "$ 1.00". → `0.05`, Enter. ✓ Saved (reload to check).
2. → Make "Fake (priced)" the default. New project from Bendel, Auto, Run. ✓ Somewhere in Layout or Analyze the stage fails with the spending cap's message (in the panel, where the user is, not in a menu). If it runs through, the fake's made-up costs were too small: a new project with the cap at `0.01`.
3. → Show details of the failed stage and of a done LLM stage. ✓ Costs in US dollars there; none on the cards.
4. → Settings → spending cap `5`. Retry. ✓ The run continues where it stopped, without paying twice for the calls already made.
5. → Set the cap back to `0.05`. New project on the same Bendel PDF (the known-PDF dialog, "+ New project"), Run. ✓ Every LLM stage is served from the record (same inputs, same config): it runs to the end although the cap is reached, at no new cost.
6. → ☰ → Statistics → Costs. ✓ The priced calls, by project; the free "Fake model" calls aren't counted; the average cost per page. → Usage. ✓ Activity, projects, and the failed calls from story 4, by kind. → Run times. ✓ Per stage, from the items that really ran. → Effort. ✓ The manual work of stories 2 and 3. → Switch tabs, then back. ✓ Back leaves the page (tabs replace the URL).
7. → Delete one of the two Bendel projects (story 6 tests the dialog). ✓ Its costs are still in the costs view, marked as deleted.

*Worth automating:* the cap's refusals on the settings page.

## Story 6: Many projects

*A user with many projects: names, the picker, renaming, the known-PDF dialog, deleting.* About 30 minutes. Covers: §4, the header, the picker, the deletion dialog, as-if-it-never-existed.

1. → New project from Für Elise again. ✓ The dialog lists the PDF's projects, most recently opened first, and "+ New project" last with the name it would get, "beethoven_fuer_elise_leipzig.orig (<n>)" with the first free number. → Create it. ✓ That name; no upload (quick).
2. → Project "⋮" → Rename. ✓ The name selected, "Rename" disabled while unchanged or empty (spaces only). → 201 characters. ✓ A message at once. → The other Für Elise project's name in other capitals. ✓ "A project with that name already exists. Names must be unique (case-insensitive).", the dialog open. → Only the case of its own name. ✓ Allowed.
3. → Rename to something long (about 150 characters). ✓ Shortened in the middle in the panel and the picker, on one line.
   → New project from a PDF with a long file name, as downloaded from IMSLP (copy any PDF to e.g. `IMSLP971706-PMLP2799-Schumann_Kinderscenen_leichte_Stu-cke_fu-r_das_Pianoforte.pdf`). ✓ A project with that name (without ".pdf"). Once more: the same name with " (1)".
4. → The picker: type part of a name, part of the PDF's file name. ✓ Both filter; most recently opened first. → Open a project from it, then use back and forward. ✓ The URL follows; back returns to the previous project; going back doesn't mark it as opened (its place in the list stays).
5. → Open two tabs on two different projects. ✓ Each keeps its own; a reload keeps it. → Two tabs on the same project: rename it in one, then in the other (still showing the old name). ✓ The second is refused with "Changed elsewhere"; Reload shows the first tab's name, and renaming there works. The same with "Change config" on a stage in one tab and then in the other.
6. → "Delete project" on a finished one. ✓ The dialog: the full name, the text of `docs/database.md`, "Deleting a project", "Delete project" disabled. → Paste the name. ✓ Doesn't count. → Type it with one letter in another case. ✓ Still disabled. → Type it exactly, delete. ✓ The screen saying "<name>" was deleted from this device and from the remote storage; URL `#/`; back doesn't return to it; a reload shows the empty app; gone from the picker.
7. → If no other project uses that PDF: pick it again. ✓ No known-PDF dialog; a new project with the same name; with the same configs it runs every stage from scratch (with "Fake (priced)" as default it costs again; in Costs, a second spend).

*Worth automating:* the rename refusals (they are in the Worker's tests; the dialog's messages aren't).

## Story 7: Phone-sized

*The same app on a narrow screen, by touch.* About 35 minutes. Covers: the narrow layout, toasts, the editors by touch, the panel collapsed in wide mode, the installed app. In Chromium's device mode (390 px wide, touch emulated); a real phone waits for a deployment.

1. → Narrow the window across 1024 px and back. ✓ Wide and narrow switch on the fly; narrow: wordmark and "+ New project" on one row, the picker below, no edition.
2. → Open an artifact. ✓ It covers the app, with the floating "x" at its top right. → Back. ✓ Closed, and its tile still selected.
3. → Run a new project (Für Elise, Auto) with an artifact open over it. ✓ Toasts near the bottom, one at a time, about 4 s each: "**Layout** done. Starting **Analyze**", …, "Pipeline done". None when the pipeline is in view. None for 3 s after the user's own Run.
4. → Fix skew and Fix layout by touch: tap-tap to draw a line or a box, pinch to zoom, two fingers to pan between the taps; delete with the button. ✓ A started line or box survives zooming and panning; handles are easy to hit.
5. → Fix metadata's eye: ✓ the pages with the field's strip, one close button at a time (the strip's returns to the list; only the list's closes the artifact).
6. → Wide again: collapse the panel. ✓ The strip with the chevron (at the same height as the one that collapsed it) and the circles: the pipeline's, and the current stage's (progress while running; red triangle when failed; pause sign while waiting; a green check when done). Reload: still collapsed.
7. → Install the app from Chromium (the address bar's install button) and open it. ✓ Its own window, the back and forward arrows left of the wordmark, disabled where there is nowhere to go; Alt + ← and → work.
8. → Settings → Theme: Light, Dark, Auto (switch the system's preference while on Auto). ✓ Every screen of this story in both themes; Auto follows at once. The pages and renderings stay white.

*Worth automating:* the toasts' texts (pure functions, `toasts.ts`, partly tested already).

## Story 8: The big old book

*A 22-page colour scan: page selection, slowness, the image cache, losing it.* About 40 minutes, mostly waiting. Covers: large scores, the image cache's limit, regeneration from recipes on one device, the fingerprint warning.

1. → New project from Kinderscenen (13 MB). ✓ The upload and hashing take a moment, with some sign of progress or at least no frozen app.
2. → Rasterize config: Pages `1, 3-5`. → Run (Auto) to the end. ✓ 4 pages; the cover has no lines; every later stage sees only those 4.
3. → Settings → image cache 250 MB. ✓ It shows what the cache takes, pruned at once if it was larger.
4. → Change Rasterize to all pages and run. ✓ Rasterize about a second per page; the panel stays responsive; scrolling the page images while they are made works. The cache stays under 250 MB (Settings), the pages still shown (made again when they come into view).
5. → Clear the site's storage (DevTools → Application → Storage → "Clear site data"), reload, open the project. ✓ Everything still there; the page images, crops and renderings are made again when they come into view (slower, then cached). This is a second device's situation, on one device.
6. → Change Analyze's input slightly (a Fix layout moving one box on one page) and let it run. ✓ Only that page's calls are new; the other pages are served from the record without their images being made (quick).
7. Optional, a developer's test: change a stored fingerprint, `npx wrangler d1 execute score3ly --local -c wrangler.local-dev.jsonc --persist-to .wrangler/manual --command "UPDATE image_fingerprints SET height = height + 1"` (in `apps/worker`), clear the site's storage again, open a page. ✓ A warning that the images differ from those the results were made from; nothing stops.

## Story 9: The desktop app (*cadenza*)

*Someone who uses the desktop app instead.* About 30 minutes. Covers: `docs/desktop.md`. Run from the repository (`npm install`, `npm run desktop`); the package is the task "Try the desktop app's package on macOS and Windows" (§15).

1. → Start it. ✓ The splash in cadenza's grey, the window titled "score3ly – cadenza", the light grey icon in the taskbar or dock, no menu bar (macOS: a minimal one). → Start it again. ✓ The first window comes to the front, no second one.
2. → About. ✓ *cadenza* and its sentence about running and storing everything on this device.
3. → Settings → Secrets → open the secrets file. ✓ It opens in the system's text editor, with a commented example. → Add `TEST_KEY=x`, save; make a config naming it (`curl` against the desktop server's port, from the window's URL in the developer tools, Ctrl + Shift + I). ✓ No restart needed: a stage with it fails at the provider (the key is fake), not with "missing secret".
4. → Story 1, steps 3 to 9, quickly. ✓ The same, with back and forward buttons in the header, Alt + ← / → and the mouse's side buttons working.
5. → Theme Light, then Dark, then Auto. ✓ The window's frame follows the app's theme; Auto follows the system.
6. → Delete a project. ✓ The text says "was deleted", without "from the remote storage"; a refused deletion doesn't mention another device.
7. → Quit, start again. ✓ The projects, settings and the frame's theme are still there.

## Story 10: The model configs

*A user who sets up their models: configs of every kind, made, renamed, cloned and deleted, and a new list of models arriving with a new version of the app.* About 45 minutes (the ★ steps about 10). Covers: `docs/llm.md`, "Supported models, prices and the config form" (the form, the pricing kinds, the settings page, "No longer supported", the conversion of configs added by hand), "Change config" on stages. Needs the dummy secrets of the setup (`.dev.vars`). Costs nothing: only the configs on the fake providers are run; the others are made, shown, cloned and tested with dummy keys, which the provider refuses before charging. **With a real key** (optional, a cent or less): set it in `.dev.vars` (e.g. `ANTHROPIC_KEY=…`, or Bedrock's), make a config naming it, and its Test in step 11 should say "Success: … responded in the requested format …", with a cost below a cent; Statistics → Costs then shows it under "Test requests".

1. ★ → Settings → "+" on the line of "Model configs". ✓ "New model config": Provider "Anthropic", Model "Claude Opus 5.5", Effort "—", the API key's secret "—"; Name prefilled, muted, "Claude Opus 5.5 (Anthropic)"; "Create config" disabled, the line above the buttons saying "The secret for the API key isn't chosen yet." → Effort "high". ✓ The name follows: "Claude Opus 5.5 (Anthropic) · high". → Pick `DUMMY_ANTHROPIC_KEY`, Create config. ✓ No confirmation; the dialog closes, the new card at the end of the list with its four prices per million tokens; Default unchanged.
2. → "+" again, the same values, Create config. ✓ Before anything else: "This config already exists, with this name: …", the form open. → Type the name "Opus". ✓ The name in normal text from now on; the provider and effort no longer change it. → Create config. ✓ "Are you sure?" offering to rename the existing config to "Opus" instead, "Rename config". → Confirm. ✓ Only one card, now named "Opus".
3. → "+", Provider "Bedrock". ✓ Model back to Claude Opus 5.5, a Region (the first of the list), a Routing among those the region offers ("Global", "Geographic (EU)", "In-region" as it allows), Credentials "API key" or "Access key ID and Secret access key", Pricing with Opus's four prices at that place. → Region `eu-central-1`, each routing in turn. ✓ The prices change with the routing (global cheaper); the name stays "Claude Opus 5.5 (Bedrock)". → Model "Claude Fable 5.1". ✓ Only the regions where Fable has a price, the region and routing reset to the first that fit where they no longer did. → Back to Opus, `eu-central-1`, "Geographic (EU)"; Credentials "Access key ID and Secret access key", pick `DUMMY_AWS_KEY_ID` and `DUMMY_AWS_SECRET`; tick "Free tier", Create config. ✓ The free tier's confirmation ("Its calls will cost $0.00 and won't count towards the spending cap. …"). → Cancel, choose the listed prices again, Create config. ✓ Made, no confirmation, its card with the geographic prices.
4. → "+", Provider "Fake (dev)", Model "Unlisted model". ✓ The identifier field ("Model identifier, exactly as Fake (dev)'s API expects it"), Family "Fake" with "The only family the app supports on Fake (dev).", Pricing "Priced as" with its picker on "—", "Unpriced", "Free tier", each with its "i". → Identifier `fake-next`, "Priced as", leave the picker on "—". ✓ "Create config" disabled, saying the model it is priced as isn't chosen yet. → Pick "Fake model". ✓ Its four (made-up) prices. → Create config. ✓ The "priced as" confirmation. → Confirm. ✓ A card "fake-next (Fake (dev))", "(priced as Fake model)" after its prices.
5. → Again with `fake-next` on Fake (dev), "Unpriced", name "Next unpriced". ✓ The stronger confirmation (the spending cap can't limit it, the costs won't include it). → Confirm. ✓ The card says "Unpriced: its calls' costs are unknown". → Again with `fake-next`, "Free tier", name "Next free". ✓ Made after the free tier's confirmation; the card says "Free tier".
6. → "+", Provider "Fake", "Unlisted model", identifier `fake`. ✓ Refused when created: "Fake model is in the app's list: pick it there", the form open.
7. → "Opus"'s "⋮". ✓ Test, then Rename and Clone, then Delete (alone, red). → The default's "⋮" ("Fake model"). ✓ No Delete. → Rename "Opus" to "fake model" (another config's name in other capitals). ✓ Refused in the dialog. → "Opus 5.5". ✓ Renamed.
8. → Clone "Opus 5.5". ✓ "Clone model config", every value the original's, its name "Opus 5.5" in normal text, the line about names being unique, "Delete the original, "Opus 5.5"" unticked. → Create config at once. ✓ The offer to rename "Opus 5.5" to itself is not made: "This config already exists, with this name: "Opus 5.5"." → Effort "max", name "Opus max", tick "Delete the original". ✓ The confirmation ""Opus 5.5" will be deleted. This action cannot be undone.". → Confirm. ✓ "Opus max" at the end, "Opus 5.5" gone.
9. → Clone "Opus max", change nothing but the name ("Opus again"), tick "Delete the original". ✓ The offer to rename "Opus max" to "Opus again" instead of deleting it. → Confirm. ✓ One card, "Opus again".
10. → Clone the default ("Fake model"), effort "low", tick "Delete the original". ✓ "Make default" ticked and greyed out. → Create config (confirm). ✓ The clone is the default (its badge, the settings' default row), "Fake model" gone. → Make the clone's name "Fake model" again (Rename). ✓ Allowed: the name is free.
11. → "Opus again"'s "⋮" → Test. ✓ "Test "Opus again"", what it sends and that it costs real money. → Send request. ✓ "Waiting for the response…", then in red "Failed (after … s): 401" and Anthropic's JSON saying "invalid x-api-key" (the dummy key reaches Anthropic's API; it needs network). The fake configs' "⋮" has no Test. → Statistics → Costs. ✓ "Test requests" under "LLM calls with unknown cost", "–" (a refused request costs nothing), the chart and failed calls without it.
12. ★ → Delete "Opus again". ✓ "Are you sure?", the text about stages that ran with it and those that haven't, "Delete config". → Confirm. ✓ Gone.
13. ★ → New project from Kinderscenen p3, Manual mode. Layout's "⋮" → "Change config". ✓ The model configs offered, the default first picked; none deleted. → "fake-next (Fake (dev))" with "Apply to the remaining stages planned in this pipeline" ticked, Save. ✓ Every LLM card shows it. → Run through Layout. ✓ It runs (the fake answers any model string); its details show costs, from Fake model's made-up prices.
14. → A new list of models, as a new version of the app brings one: in `apps/worker/model-list/fake-dev.json`, add the model `{"id": "fake-next", "name": "Fake Next", "family": "fake", "string": "fake-next"}` and a price for it (copy the `fake` price, change `model` to `fake-next` and the input to `2`); run `npm run model-list -w apps/worker`. ✓ Its report lists "Model added: Fake Next (fake-next)". → Let the Worker reload (restart it if it doesn't), reload the settings page. ✓ The priced-as config and "Next unpriced" are now plain listed configs, with Fake Next's own prices and no "priced as" or "Unpriced" mark; their names unchanged; "Next free" still "Free tier". → "+": Fake (dev)'s models now include "Fake Next"; "Unlisted model" with `fake-next` is refused like step 6 ("Fake Next is in the app's list: pick it there").
15. → Run Analyze in the project of step 13. ✓ Its details: costs from Fake Next's own prices (input $2 per million tokens); Layout's details unchanged (a call keeps the prices it was recorded with).
16. → Fake Next leaves the list: remove its model and price from `fake-dev.json` again, run the script (✓ "Model retired: Fake Next (fake-next)"), let the Worker reload, reload the page. ✓ The configs on Fake Next show the red "No longer supported" badge; "Next free" (added by hand, free) is still usable. → The default picker. ✓ They aren't offered. → Back to the project: ✓ the planned LLM cards show "… (no longer supported)" in red; Run says the stage can't run (its model config "… uses Fake Next on Fake (dev), which the app no longer supports"); "Change config" shows it as the current one but doesn't offer it otherwise, Save refused until another is picked. Layout's and Analyze's cards (done) show the name with the mark, not in red. → Pick "Fake model" for the remaining stages, Run to the end. ✓ Runs.
17. → Clone a config on Fake Next. ✓ Its model first in the picker, "(no longer supported)"; "Create config" disabled, saying the app no longer supports Fake Next on Fake (dev). → Pick "Fake model". ✓ Allowed again. → Cancel.
18. → Put the files back: `git checkout apps/worker/model-list apps/worker/src/llm/modelList.ts`, let the Worker reload. ✓ The configs on Fake Next stay "No longer supported" (the list in git never had the model, so they name it by its id, `fake-next`); everything else as before step 13.

*Worth automating:* the form's pickers following each other and its refusals (pure functions in `configForm.ts`, mostly tested already); the conversion and the marks after a new list (a Worker test with two lists).

## Story 11: Export and import

*A user who saves a project as a file, deletes it to free storage, brings it back, and takes it to another instance.* About 40 minutes (the ★ steps about 10). Covers: `docs/database.md`, "Exporting and importing a project" (the file, what it holds, the dialog, the import looked up like a run, configs matched by their values, deleted calls brought back, the format's version), the known-PDF dialog for project files, the costs of imports. Needs a finished project (story 1's Für Elise) and one run with "Fake (priced)" as its config (made here).

1. ★ → Für Elise's project "⋮". ✓ "Rename", "Export", a line, "Delete project" in red. → Export. ✓ "Export project", the file's name `<name>.s3l` under it, the two paragraphs ("Saves the project as a zipped archive…", "Earlier attempts stay out…"), Cancel and Export. → Export. ✓ "Exporting…" with a bar, then the file saved as `<name>.s3l`.
2. → Look inside: `unzip -l <name>.s3l` (or a copy renamed `.zip`). ✓ `manifest.json`, `project.json`, `pdf/<sha256>.pdf`, and `content/…` files. `manifest.json`: `"format": 1`, the app's version and commit (as on the About page), the date, the project's name.
3. → Start a stage running in another project (Run), and Export that project meanwhile. ✓ The dialog stays open with "A stage of this project is running, here or on another device. Stop it, or let it finish, then export the project."
4. ★ → "+ New project", pick Für Elise's `.s3l`. ✓ The picker offers `.pdf` and `.s3l` files. ✓ "Projects already based on this file", the file's name under it, Für Elise's projects, and last "→ Import as a new project" with "<name> (1)". → Pick it. ✓ "Importing "<name> (1)"…" for a moment, then the new project opens: every stage in the state it had, the same notes and times, the artifacts open (the Transcription with its issues, the MEI, the PDF). Statistics → Costs: nothing new (its done stages are the original's).
5. → "+ New project", a zip that isn't a project, renamed to `x.s3l` (e.g. a download bundle). ✓ "Importing the project failed: The file isn't a score3ly project: it has no manifest.json." → A PDF renamed `y.s3l`. ✓ "… it isn't a zip."
6. → New project from Kinderscenen p3 with "Fake (priced)" as the default, run it to the end. Note the total in Costs. → Export it, then delete it. ✓ Costs: still there (under the deleted project). → Import the file. ✓ No dialog (no other project on that PDF): the project comes back under its own name, every stage done. ✓ Costs: the same total as before, not twice.
7. → Another instance: stop the Worker, apply the migrations to a second state folder and start it there (the commands of "Setup", with `.wrangler/manual-2`), clear the site's storage, reload. ✓ No projects; Settings: only "Fake model". → Import story 6's file. ✓ The project, complete; Settings: "Fake (priced)" created, with the values it had (no secrets: it needs none); Costs: its spending on the days it really happened; the cap's "last 24 hours" counts it only if those were in the last 24 hours.
8. → Import the same file again here. ✓ "<name> (1)", via the known-PDF dialog; no second "Fake (priced)" (the same values: reused); Costs: unchanged (the done stages are the first import's).
9. → In that project, Analyze's "⋮" → "Fix metadata manually", change the composer, Finish, Run. ✓ The stages after it run again (with the fake models, nothing to pay beyond "Fake (priced)"'s made-up prices), and the pipeline finishes. (The dialog's "Earlier attempts stay out": had the project been exported with the fix still WIP, the stages after it would run again here too.)
10. → A newer file: unzip story 6's file, set `"format": 2` in `manifest.json`, zip it again as `newer.s3l`, import it. ✓ "Importing the project failed: The file was exported by a newer version of score3ly (export format 2). Update the app to import it." Nothing created.
11. → Back to the first instance: stop the Worker, start it on `.wrangler/manual` again, reload. ✓ Everything as before step 7.

*Worth automating:* already in the Worker's tests (export, the import while the original lives, after deleting it, from elsewhere, the formats) and the app's (the file read back, the refusals); `fixtures/exports/` keeps a file of each format, which a test imports. Left to the hand: the dialogs and the files on disk.

## While going through the stories

Things to watch all along, rather than steps of their own:
- **Wording** follows the style guide (`docs/style.md`): stage names bold in toasts, no period at their end, no costs in the pipeline panel, errors that say what to do.
- **Both themes:** a story run in the dark theme once, then in the light one, shows every screen in both over a full run.
- **Leaving loses nothing:** whenever a manual stage is open, closing it, reloading or opening another project keeps what was done.
- **The console** (DevTools): errors and warnings there are worth a note even when nothing looks wrong.
- **Speed:** anything that leaves the app without a sign of life for more than a second or two.

## Waiting for a deployment

Multi-device tests, and tests on real phones and other browsers, wait until the app is deployed with its remote D1 and R2 (§16, "Deployment"). To write as stories then:
- **Two devices on one project:** a stage running on one, the other following it (the pipeline fetched every 5 seconds, a grey spinner in the collapsed strip, the toasts at its end), stopping it from the other device, "Interrupted" there 3 minutes after the first device's tab closed, deleting refused while it runs elsewhere; two devices changing the pipeline at once (optimistic locking, §15).
- **Continuing on another device** (§15, "Try regeneration on a second device"): a project run on a laptop continued on a phone with an empty cache, the cached calls served without images being made.
- **Real phones** (§15, "Test the installed app on a real Android phone and an iPhone", "Try the editors with touch and on a real phone", "Try a run on a real phone that goes to sleep or to another app"): the wake lock, the system's back gesture, memory for large scans.
- **Firefox and Safari** (§15, "Try the page images in Firefox, Safari and on phones").
- **Cloudflare Access** in front of the app, and the secrets in the dashboard.
- **Real models:** a short story with a real key and a cheap model, with the configs' Test (story 10 only tries it with a dummy key).

Also still to add, once built: the format gap report (Settings, "Developer").
