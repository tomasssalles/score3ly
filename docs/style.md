# Style guide

How score3ly looks, speaks and behaves, as rules to follow when something new is built. It generalizes from what exists: the examples are there to show a rule, not to be the rule. Where the app and this guide disagree, one of them is wrong: fix the app or the guide, but don't let them drift apart. § numbers are `DESIGN.md`'s sections, where the decisions behind most of this are recorded.

## The character of the app

- **The pipeline is the main attraction.** The usual use is: new project, let it run, take the MEI, leave. Whatever shows where the pipeline is and what to do next gets the best place on every screen; inspecting results is secondary and may be less comfortable on a small screen.
- **The music is the content, everything else is chrome.** Chrome is dark (or light), quiet and thin; pages, renderings and engravings stay paper-white in every theme, framed by a neutral grey. Nothing is drawn over the music that doesn't need to be, and what is drawn can be hidden.
- **Calm.** The app runs long jobs that cost money. It never makes the user nervous: no money where they work, no numbers that tick, no alarms for things that aren't problems. Progress is shown as a shape, not a figure.
- **Honest and transparent.** Every step, input and output can be looked at. When something is unsure, the app says so (a confidence, a warning, an issue), and it never pretends something worked when it didn't.
- **Nothing urgent hides.** Whatever needs the user's attention is shown where the user is, never only in a menu or a settings page.
- **One way to do a thing.** The same kind of interaction looks and works the same everywhere: one dropdown menu, one dialog, one way to pick from a list, one way to confirm.
- **Runnable from anywhere.** Every feature works on a phone with touch, on a laptop with a mouse and a keyboard, in a browser, as an installed app and on the desktop. A feature that only works with a mouse, or only on a wide screen, isn't finished.

## Colour

**Every colour is a token of the theme** (`apps/web/src/themes.css`, and nowhere else; a test enforces it). Code and CSS name a token by its role, never a colour. A new role is a new token in every theme. Each theme is designed for high contrast: running text far above 7:1, secondary text around 6:1, coloured text at least 4.5:1 on its background.

**What each colour means.** A colour always means the same thing, everywhere, so the user learns it once:

| Role | Tokens | Means | Used for |
|---|---|---|---|
| Chrome | `--bg` | the frame of the app | header, the pipeline panel, toolbars |
| Page | `--surface` | the space content sits on | the background behind cards and views |
| Raised | `--raised`, `--hover` | something you can touch | cards, fields, menus, dialogs, toasts; a highlighted item in a list |
| Lines | `--line` | separation | hairline borders and dividers; prefer a line to a change of fill |
| Text | `--fg` | what to read | running text, names, values |
| Secondary text | `--muted` | context, not content | labels, facts, hints, timestamps, inactive icons, empty states |
| **Accent (coral)** | `--accent`, `--on-accent` | **identity and focus: "this one", "here", "do this"** | the wordmark's brackets, the main action of a screen or dialog, the focus ring, what is selected or current, an open picker, an active tool, a toggle that is on, links |
| **Green** | `--green`, `--progress` | **going, growing, done well** | progress bars and circles, a running stage's border, the button that starts a run, a done pipeline, what the user confirmed |
| **Red** | `--danger`, `--on-danger` | **broken, or destroys something** | failures and errors, a failed stage's border, a value that isn't accepted, destructive actions (in menus and on buttons), something stale that will mislead |
| **Amber** | `--warning` | **worth a look, not broken** | a result that may not be what it seems, a change not applied yet, a warning on a card or over an image |
| Paper | `--paper`, `--viewer` | the score | white behind music, grey around it |
| Marks on paper | `--mark`, `--highlight`, the layout colours | drawn by the app onto the music | lines that should be horizontal (red), what is selected in an engraving (amber), boxes and their labels |

**Rules that follow:**
- **Text that warns about a problem is red; text that asks for a look is amber; text that reports is muted.** "Layout failed" is red, "Some images differ from…" is amber, "2s · 54 systems" is muted.
- **The accent is never an error colour.** Coral and red are close; coral means "this", red means "wrong". An error is never coral, a selection never red.
- **The accent is used sparingly:** one main action per screen or dialog, one selection per list. If everything is coral, nothing is.
- **Green starts things and shows things moving;** the opposite, stopping, is red (Run is green, Stop is red), like a traffic light.
- **Colour is never the only signal.** Every state with a colour also has a word or an icon: a failed card says why, a selected tile has an outline, a confirmed field has a check mark, a running stage has a bar.
- **Text on a filled colour uses its `--on-…` token** (black on coral in the dark theme, white on darker coral in the light one).
- **Colours drawn over the music are the same in every theme,** because the paper is: the layout's seven box colours (chosen to be told apart by colour-blind people), the red of lines, the amber of a highlight. The UI around them follows the theme.
- **Things that belong together share a colour.** A box on the page and the card that explains it have the same colour; a system's bar lines have its box's colour. Colours cycle in a fixed order, so neighbours differ.
- **The app's icon and the manifest's colours are fixed,** not themed: they appear where the app's CSS can't reach (a home screen, a favicon, GitHub).

**Themes.** A dark and a light theme, chosen per device: Auto (the default) follows the system. A new theme is a block with every token and an entry in `THEMES`; nothing else in the app should need to change. In the light theme, colours are darkened until they read on white; the paper and what is drawn on it stay as they are.

## Type

- **Inter** for the interface. **JetBrains Mono** for anything that is code or a machine's value: the wordmark, LilyPond and MEI, file names, ids, issue numbers, page counters ("Page 1"), badges, times. Both are bundled; nothing is fetched from Google Fonts.
- **A serif in italic,** muted, only for the edition's name (*concerto*, *cadenza*), like a work's subtitle under its title.
- **Sizes:** 14 px for running text and buttons, 13 px for secondary text (facts, hints, warnings on cards), 12 px for the smallest labels (tile captions, small controls, badges at 11 px). Headings are few and only a step larger. Weight, not size, makes a name stand out (500–600).
- **Lines are short:** text blocks have a maximum width (about 60 characters for prose, up to 900 px for pages of content), centred in wide space.

## Shape, space and depth

- **Rounded rectangles, gently:** 8 px for controls (buttons, fields, pickers, icon buttons), 10–12 px for cards and dialogs, a pill for toasts, small radii (2–4 px) for badges and labels on the page.
- **Borders before fills:** areas are told apart by a hairline (`--line`), not by different backgrounds. Fills are for things to touch (`--raised`) and for the main action.
- **Shadows only for what floats:** menus, dialogs (with a dimmed backdrop), toasts, pages of music. Nothing that sits in the layout casts a shadow.
- **Buttons floating over content** (the close button of an artifact on a phone, a counter in a corner) are white on translucent grey, so they read over any picture.
- **A 16 px gutter** at the edges of the app and between its main parts; tighter spacing inside cards. Nothing scrolls sideways at phone width, except content that is wide by nature (code, a zoomed page).

## Where things are

**The header** is the same on every screen, one row from 1024 px wide and two below: the wordmark (always on the left), the project picker (the centre on wide screens, its own row on narrow ones), the main action of the app ("+ New project", coral), and the menu (☰, at the far right). Where there is no browser bar, back and forward arrows come first, left of the wordmark. The edition's name sits next to the wordmark on wide screens only. Nothing else goes into the header: it is not a toolbar.

**The menu (☰)** leads to the app's own pages, in groups separated by lines: what you look at (Statistics), what you change (Settings), help (Help, About). Each page has its own URL and replaces the project view while open; the back button returns.

**The settings page** holds the user's settings (shared by every device), then a "This device" section for what may differ between a phone and a laptop (theme, the image cache's size), then a "Developer" section. Each setting is one row: its label (with a short muted hint below where needed) on the left, its control on the right. **Settings save themselves** when the control is changed or left; there is no Save button. A value that isn't accepted says so, in red, and isn't saved.

**The project view** is the pipeline panel and the artifact view.
- **The pipeline panel** has a head that stays in view (the project's name with its "⋮", the run mode, the pipeline's progress, the Run or Stop button, and any error that isn't a stage's own) and the stages below it, as cards, top to bottom in pipeline order. Below the head and above the stages, small muted facts about the project.
- **Each stage card** shows its step's icon and name, its "⋮", the facts that matter (the model, the run time, a short result: "54 systems on 12 pages", "2 changed · 5 confirmed"), its state, its one button if it has one, and its artifacts as tiles. Facts are joined with " · ".
- **The artifact view** shows one artifact, without a header of its own: what is shown is visible as the selected tile in the panel. Its tools (a toolbar, toggles) sit at its top; a counter for a long list sits in a corner.

**Actions live with what they act on.** The project's actions are in the project's "⋮" (Rename, Delete project). A stage's actions are in the stage's "⋮" (Show details, Change config, Fix … manually, Edit, Drop stage). A tool's actions are in the tool's toolbar. The card itself keeps only its one obvious next step (Run, Retry, Finish, Download).

**The place for urgent things is where the user is:** a failing stage on its card; a pipeline-wide problem in the panel's head; a missing key or a reached cap where the run is started, not in Settings.

**Money** appears only where the user goes to look at it: a stage's details, the costs view, the settings of a model config. Never on the cards, never in the pipeline panel, never in a toast.

## Wide and narrow

- **Two layouts, nothing in between,** switched at 1024 px, live as the window changes.
- **Wide:** the pipeline panel on the left, the artifact view on the right, much larger. The panel can collapse into a narrow strip that still shows the essentials (progress, the current stage's state) as icons; the choice is remembered per device. The artifact view follows the pipeline (shows the latest stage's main result) only while the user hasn't picked something.
- **Narrow:** the pipeline panel is the only view. Whatever is opened from it (an artifact, a stage's details) covers the whole app, with one floating close button (×) at its top right. **There is never more than one close button on screen:** a view opened inside an opened view closes itself and brings back the one below.
- **Things the user can't see are told in a toast** (narrow only, below).
- **Small screens drop words, not functions:** "+ New" instead of "+ New project" when the header gets crowded; the edition's name only on wide screens; facts may wrap. Every action stays reachable.

## Browser, installed app and desktop app

- **One app, three hosts.** The same web bundle runs in a browser tab, installed from the browser (a phone's home screen, a desktop install) and in the desktop app (*cadenza*, Electron). The app asks the server which host it is (`GET /api/info`) and decides nothing else by guessing.
- **The condition is "no browser bar", not "desktop" or "phone":** where there is no browser bar (an installed app, the desktop app), the app shows its own back and forward arrows in the header and supports the usual shortcuts and mouse buttons. In a browser tab, the browser's own controls do it, and the app's are hidden.
- **The desktop app is a window, not a web page:** no menu bar (macOS keeps a minimal one), links to other sites open in the browser, the window's frame follows the app's theme, its splash and icon are *cadenza*'s.
- **Texts follow the host** where it matters: the desktop app keeps everything on one device, so it never mentions "another device" or "the remote storage"; the web app does. Secrets are Worker secrets on Cloudflare, a file on the desktop: each says so in its own words, in the same place.

## Navigation and URLs

- **Everything that can be opened has a URL** (the hash): a project, an artifact, a stage's details, a menu page. So back closes it, a reload keeps it, a bookmark finds it, and each tab has its own.
- **The back button closes what was opened,** in every host: an artifact, a stage's details, a page from the menu.
- **A URL that would lead nowhere is replaced, not pushed:** after deleting a project, back doesn't land on it.
- **Opening is not changing:** viewing a project, reloading or going back never marks anything as modified or opened; only a deliberate pick does.
- **What was open stays selected** when it closes, so the user sees what they last looked at.
- **Lists scroll to what matters:** the pipeline brings the current stage to about the middle of the view whenever the current stage changes; the MEI view centres what was gone to; a box tapped brings its text into view.

## Components

**Buttons.**
- **Primary:** filled coral with `--on-accent` text. The one main action of a screen, a dialog or a card ("+ New project", "Finish", "Change config").
- **Secondary:** outlined, transparent ("Cancel", "Download").
- **Run** (green, with ▶) and **Stop** (red, with ■): starting and stopping the pipeline. **Retry** replaces Run after a failure, with a circular arrow, in the same place.
- **Danger:** filled red, for an action that destroys ("Delete project").
- **Icon buttons:** 36 px square, muted icon, no border; for tools, toggles and the "⋮". A tooltip names them. An icon button that is on (a toggle, the current tool) has a coral outline and a coral icon.
- **Disabled** is faded (about 45% opacity) and keeps its place; it is used when an action applies but can't be done yet ("Rename" until the name changed). An action that doesn't apply at all is hidden instead.
- **A button names its action** with a verb ("Delete project", "Change config", "Apply"), never "OK" or "Yes".

**The "⋮" menu** (one component, `DropdownMenu`, for every menu): opens under its button, closes on a pick, on Escape and on a click elsewhere, and works with the arrow keys. Items are groups separated by lines, the most used first. Only what applies now is listed. A destructive item comes last, alone in its group, in red. Items open a dialog when they need more input or a confirmation.

**Pickers** (the run mode, a theme, a page, a system, a kind of field): the app's own small dropdown, not the browser's native select: it looks the same everywhere and can show items dimmed and not selectable. **Pick, don't type,** wherever the valid values are known: a picker can't hold an invalid value.

**The project picker** turns into a filter field when opened: typing filters, the arrow keys move, Enter picks, Escape closes. Each entry has the name and muted facts (when it was opened, the file name).

**Dialogs** (one component for every dialog, centred over a dimmed backdrop):
- a short title, a close button (×) at the top right, the text, then the buttons at the bottom right: secondary first, the main action last, in coral (red when it destroys);
- the title of a plain confirmation is "Are you sure?"; the text says what will happen, plainly, and ends with "This action cannot be undone." when it can't;
- the main action is disabled until the input is valid; a refusal from the server is shown in the dialog, and the dialog stays open;
- **an action that destroys a lot asks for proof of intent:** the user types the name, exactly; pasting doesn't count;
- Escape and × cancel. A dialog never opens by itself, only in answer to the user.

**Cards** are bordered `--raised` rectangles with a header line (icon, name, badges, "⋮") and their content indented under the name. A card's state shows in its border and its text: green border while running, red border and the error in red when failed, dimmed and only the title while not its turn yet, a coral outline when it is the selection.

**Tiles** stand for artifacts: a square with an icon for the kind of artifact (never a thumbnail: at that size nothing is recognizable), its name under it, and a count in a corner for a group ("×54"). A group of items is one tile, never one tile per item. The selected tile has a coral outline. Three per row.

**Badges** are small, outlined, monospaced words after a name: "WIP", "Default", "Free tier". Coral for a state that matters ("WIP", "Default"), muted for a fact.

**Progress:**
- a thin green bar for a known fraction (the pipeline's, a stage's); a green circle where there is no room for a bar (the collapsed strip); never a percentage or a count;
- a grey spinner for something that happens where the progress isn't known (a stage running on another device): grey, so it doesn't read as progress;
- a waiting LLM call fills its share of the bar by the time elapsed out of its timeout, so the bar always moves;
- **state icons** where there is no room for words: a green check (done), a red warning triangle (failed), an empty circle with a grey pause sign (waiting for the user).

**Status words** are short and consistent: "Layout…" (running, with an ellipsis, muted), "Layout failed", "Layout interrupted" (red, no ellipsis), "Layout (not started)", "Fix layout (WIP)", "Done". The same words are used wherever the state is shown.

**Lists of fields** (the forms of the manual stages): each field reads like the read-only view (label, value, where it comes from, how sure the model was), with a "⋮" holding Edit, Confirm and Remove. One field is edited at a time; ✓, Enter or leaving the field ends the edit, Escape cancels it. One "+" for the whole list, which offers everything that can be added, grouped. **Confidence** shows as symbols, always the same: low ???, medium ?, high ✓ (grey), confirmed ✓ (green).

**Filmstrips** show a group of items (pages, systems) one below the other with a small gap, scrolling continuously, so the end of one and the start of the next are seen together. A counter in a corner says where the user is ("12 / 54").

**Editors on a page** (lines, boxes, bar lines; later, issues) share one frame: a toolbar at the top with page arrows and "Page 3/10", the tools as an icon-only toggle (hand first), zoom out, zoom in and fit, delete, then undo and redo; a one-line muted hint below the toolbar saying what to draw; the page below, zoomable and pannable. Every change is saved at once; nothing needs a Save button.

**Toggles that change what a view shows** (the score beside the MEI, the boxes over the crops, rendered or raw music) are icon buttons at the view's top, remembered per device.

**Hints and empty states** are muted text: one line under a toolbar ("Boxes tight around each system…"), one sentence where there is nothing to show ("No metadata was found on the pages."). They say what to do or why it's empty, never "Error" or "Nothing here".

## Feedback and notifications

From the most local to the most interrupting; always the most local one that the user will see:
1. **On the thing itself:** a stage's error on its card, a field's problem under the field, an error over a page where the page failed. Most feedback is here.
2. **In the panel's head:** what concerns the whole pipeline and isn't a stage's own (a stage that can't start, a request that failed), so it doesn't scroll away.
3. **A banner over an image:** amber, inside the image's top edge (or below a crop, where a banner would hide the music), for something about that image ("This image differs from…").
4. **A toast:** one line near the bottom, centred, a pill on `--raised`, for what just happened somewhere the user can't see right now. Only on narrow screens while an opened view covers the pipeline (on wide screens the pipeline is in view). It disappears after about 4 seconds, one at a time (a new one replaces the old one), and never needs an answer. Stage names in bold, no period: "**Layout** done. Starting **Analyze**".
5. **A dialog:** only to confirm what the user asked for, never to report.

**Rules:**
- **Nothing reports the user's own action back to them:** what follows directly from a click (a run they started, a stage they added) makes no toast for a moment; the change itself is the feedback.
- **Errors say what happened and what is kept:** "Couldn't parse the answer for system 17. The answers for systems 1–16 are kept." Not "Error", not a stack trace, not a code.
- **Errors suggest the way out** where there is one: "split the score into several projects", "add a key in the settings".
- **No success messages for ordinary success.** A done stage shows its result; a saved field shows its value.
- **Courtesy notices are quiet:** a stage dropped by a re-run leaves a dimmed card with a struck-through name and one line saying why, dismissible with ×.

## Confirmations, saving and undo

- **Ask before anything is lost:** replacing stages that ran, dropping a stage, deleting a project. The dialog says what will happen, in general terms that are true (not a list the app can't promise), and names the action on its button.
- **Don't ask for what can't hurt:** changing the config of a stage that hasn't run, opening, viewing, saving.
- **Everything saves as it happens.** No Save buttons, no "unsaved changes" state that the user has to manage: leaving a view, a project or the app loses nothing. Text being typed is saved when the field is left or the typing pauses.
- **Finish ends a manual stage,** explicitly; Edit opens a finished one again. A finished thing never changes in place.
- **Undo and redo exist inside a tool while it is open,** with buttons and the usual keys; leaving the tool ends its history. Elsewhere, changes are made deliberate instead of undoable (a "⋮" with Edit and Remove rather than inline editing everywhere).
- **Confirming is explicit, item by item;** finishing doesn't confirm anything on the user's behalf.

## Mouse, touch and keyboard

- **Touch first, mouse equal.** Every interaction works with one finger on a phone. Touch targets are large (handles get a big invisible hit area); nothing relies on hover. Hover may add something (a tooltip, the full name of a shortened one), never something needed.
- **No press-and-drag to create things** (a line, a box): tap, tap at two points, with a rubber band following the mouse in between. Zooming and panning between the two taps keep what was started. Dragging moves what exists (a handle, a bar line) or pans.
- **Two fingers always pan and zoom,** in every mode; one finger pans in the hand tool. Pinch, Ctrl + wheel (and a trackpad's pinch) and + / − buttons zoom.
- **Keyboard conventions,** wherever they apply:
  - Escape cancels: a started line or box, an edit, a menu, a dialog, a search;
  - Enter confirms: a field's edit, a search, a dialog's main action;
  - Delete or Backspace deletes what is selected;
  - the arrow keys move in a list or menu, flip pages, or nudge what is selected (one pixel, ten with Shift);
  - Ctrl or Cmd + Z undoes, with Shift (or Ctrl + Y) redoes;
  - Alt + ← / → (Cmd + [ / ] on macOS) go back and forward where the app shows its own arrows.
- **Focus is always visible,** as a coral ring, and keys keep working after a toolbar button was clicked (the editor keeps the focus).
- **Everything that can be clicked has a name** for screen readers: icon buttons a label, fields without a visible label a hidden one.

## Words

- **English, plain and short,** in sentence case ("Change config", "Fix layout manually", "Run mode for new projects"). No jargon where a plain word exists; the user is a musician, not an engineer. Technical names (MEI, LilyPond, PDF) are fine where they are the thing itself.
- **Names of things are consistent:** a step is called the same on its card, in its menu items, in toasts and in the docs. A manual stage is "Fix X", added with "Fix X manually".
- **Labels and buttons have no period; sentences do.** Toasts and status lines are labels.
- **An ellipsis (…) means "in progress"** ("Analyze…", "Preparing…"); never used for decoration.
- **The middle dot (·) joins facts** on one line: "2s · 54 systems · 3 issues".
- **Numbers, dates and money have one fixed format,** independent of the browser's locale: "7 Oct", "7 Oct 2025" (never all-numeric); "20min ago", "5h ago", "2d ago" for less than a week; "$0.12", "<$0.01", "$0.00" only for free calls; durations "8s", "3min 12s", "1h 5min".
- **Names are never cut at the end:** they wrap over up to three lines, and only when even that isn't enough are they shortened in the middle ("villa-lobos_bach…prelude.orig (1)"), because names on the same PDF differ at the end. The full name is one hover or one tap away.
- **Messages speak about the work, not about the user:** "The fake provider failed, as asked", "A project with that name already exists. Names must be unique (case-insensitive)." Never "You did…", never "Oops".
- **Say what the app can't know as a possibility,** not as a fact: "boxes or answers may not fit it", "probably on another device".

## Icons

- **Small line icons** in the current text colour (24-unit grid, strokes, no fills), drawn by us (`icons.tsx`), so they follow the theme.
- **An icon stands for a thing, consistently:** each automated step has its own (an upload arrow for Ingest, an image for images, a note turning into a letter for `extract` and the reverse for `engrave`); all manual stages share the wrench; each kind of artifact has its own (a sheet with "PDF" or "MEI" on it, an image, a note, braces for structured data).
- **Chevrons collapse, expand and open dropdowns; arrows navigate** (back and forward, pages). Never the other way round.
- **Icon-only controls** are used where the meaning is visual and the set is small (editor tools, view toggles); they always have a tooltip and an accessible name. Everywhere else, words.

## Motion

- **Little, and only to explain a change:** a chevron turning, a toast sliding in, a spinner. No decoration, no transitions on layout.
- **Reduced motion is respected:** with the system's setting, transitions stop and spinners slow down.

## In detail

The decisions behind the rules above, as they were made for the parts that exist (moved from `DESIGN.md`, §5.6 and §5.7). Where a detail and a rule above disagree, check with the project owner which one is right.

### How the app shows a project

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
  - for LLM stages, the model config on a line of its own: its name, or without one its model string as the config has it, shortened in the middle if it doesn't fit ("Look and feel", §7.2; built). Then one line of facts: once done, the run time and a short result ("54 systems", "3 boxes moved, 1 added"). **No costs, prices, providers or token counts on the cards** (decided): users shouldn't be worried about money while a project runs, and the panel has little room. They belong to the stage's details and the costs view (§10);
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
- **Project actions:** a "⋮" button next to the project's name in the pipeline panel opens a menu of things to do with the project: "Rename", then a line, then "Delete project" in red (`--danger`, kept apart from the coral accent), which opens the dialog of §4.
  - **Rename** opens a dialog with the name selected. "Rename" stays disabled while the name is empty (after trimming) or unchanged; a name over 200 characters gets a message right away. A name another project has (ignoring case) is refused by the Worker (409) with "A project with that name already exists. Names must be unique (case-insensitive).", and the dialog stays open. The field has no visible label (the dialog's title says it all), only one for screen readers. Both menus share one component (`DropdownMenu`).
- **The About page:** the wordmark (centered), what the app does ("A music transcription tool, driven by vision LLMs, that converts printed scores into MEI, an open, XML-based standard for encoding music notation."), its version (§11), the author (Tomás Silveira Salles), a link to the repository on GitHub, the license (§3, "License": its name, linking to `LICENSE` on GitHub, and what it means in one sentence), and a link to the third-party notices.
- **Leaving a project loses nothing,** whether for a page from the menu, another project or a closed tab, because manual work is saved as it happens (§5.4). Once editing exists, changes not saved yet are saved or confirmed before the project view goes away.

### Look and feel

- **Modern and clean, for desktop, tablet and phone.** A dark and a light theme, both high-contrast.
- **Themes** (built: dark and light):
  - **Every colour is a token of the theme,** in `apps/web/src/themes.css` and nowhere else: one block per theme (`:root[data-theme="<id>"]`), each with every token; the first also applies before the app has picked one. The rest of the CSS, and CodeMirror's colours (`MeiCode.tsx`), use only the tokens (`var(--…)`). Besides the chrome's (`--bg`, `--surface`, `--accent`, …): depth (shadows, the backdrop, floating buttons), the colours around and on the paper (`--viewer`, `--paper`, `--mark`, `--highlight`, …: page images, renderings and engravings stay paper-coloured in every theme), and the MEI file's syntax colours.
  - **Tests** (`colors.test.ts`): no colour literal (hex, `rgb()`, `hsl()` and the like, or a named colour in a colour property) in any CSS, TS or TSX file of the web app but `themes.css`, and that file holds only blocks of tokens; `themes.test.ts`: every theme listed in `themes.ts` has a block with the same tokens as the first. Out of their reach on purpose: the app icon (`public/icon.svg`, the same in every theme, with its own test), the web app manifest's colours, and the layout's box colours, which are drawn on the pages for the models too (`packages/imaging`, `LAYOUT_COLORS`), the same in every theme.
  - **The list of themes** is `THEMES` in `themes.ts` (an id, a label, whether it is dark). **The choice is a device setting** (§5.8), in the settings' "This device" section (in the desktop app, which is the only device, the section has no heading): Auto (the default) or a theme by name. Auto follows the system's light or dark preference (`prefers-color-scheme`, which browsers pass on from the system), choosing the first theme that matches it, else the first theme; it follows a change of the preference at once. The chosen theme is `data-theme` on the document.
  - **The light theme** (built, 2026-10-24): white chrome and cards on a light grey page (`--surface` #f4f5f7), near-black text, secondary text at about 6:1; the coral, the green and the amber darkened so that they read on white (the coral #c93a30, about 5:1, with white text on it instead of black); the background around pages and tiles a mid-light grey; the paper, the marks drawn on it and the layout's box colours as in the dark theme; the MEI file's colours after GitHub's light theme. Drafted on a static copy of one screen (the DOM and CSS saved from the running app, re-rendered with a draft in seconds), then checked on every screen with the screenshot script. Adding another theme works the same way: a block in `themes.css` with every token, an entry in `THEMES`.
  - **The app icon** is the same in every theme (below, "Compact mark").
- **Screenshots** (built, `npm run screenshots`, `scripts/screenshots.ts`): to compare versions and themes at a glance, without clicking through the app. It starts its own Worker and Vite on the test ports (8887 and 5273, §12), with a database and storage in a temporary folder, seeds them through the app with the fake model (a finished project, one with the card of a dropped stage (§5.5), one with `fix_layout` in progress, one whose `layout` failed, one whose page images differ from their fingerprints, §8.3), and takes, for every theme and three layouts (wide with the pipeline panel expanded, wide collapsed, narrow at 390 px), each artifact, a stage's details, the editor, the failed card, the warning, the menu pages, and, by a few scripted clicks, the open menus (the project picker, the header's menu, the project's and a stage's "⋮") and dialogs (rename, delete, a config, the confirmation before a re-run, a PDF already known), and the project as an installed app, with its back and forward buttons (Chromium can't emulate the display mode, so the script answers the app's `matchMedia` question). `--only <text>` takes only the shots whose names contain it. `--desktop` runs them against the desktop version's server (§3) instead of Wrangler, which tests it end to end. `screenshots/<theme>/<layout>/<shot>.png` (ignored by git) and `index.html`, a contact sheet of all of them. Needs Playwright's Chromium (`npx playwright install chromium` once locally). About four minutes; 146 shots with both themes.
- **Wordmark:** `<score3ly>` in JetBrains Mono, white, with the angle brackets in the accent color. It nods at the source code the app turns music into. It is always on the left of the header, at every width.
- **Accent color: coral** (`#ff7b72`, 8.4:1 on black). It is used for the wordmark's brackets, the "+ New project" button (black text), focus rings, the open picker and the selected pipeline item. Chosen from a set of candidates in a mockup.
- **Fonts:** JetBrains Mono for the wordmark and anything that is code (LilyPond, file names, IDs, times); Inter for interface text. Both are bundled with the app (Fontsource), so no request goes to Google Fonts.
- **Progress is green** (`--green`, `#3fb950`), not coral: bars and circles use `--progress`, which points to `--green`, so changing the progress color is one line.
- **Colors are CSS variables,** tokens of the theme (above): `--bg` black for the header and side panel, `--surface` near-black for the page, `--accent`, ....
- **Compact mark:** `< >` in coral with a white quarter note inside, on a coal rounded square (`apps/web/public/icon.svg`). **The same in every theme** (decided, 2026-10-24): an installed app's icon and a favicon can't follow the app's theme, and the README shows it on GitHub's light and dark pages. So: a coal tile (#303237), which keeps its edge on black and on white (the black tile it replaced vanished on dark backgrounds), and brackets in a coral halfway between the two themes' accents (#e45a51), standing for both looks of the app; chosen among several tiles and bracket colours shown on black and on white. A quarter note rather than an eighth: the flag made the note lopsided between the brackets and is too much detail for a favicon. Besides angle brackets as a tag, `<c e g>` is a chord in LilyPond.
  - It is the favicon, and the icon on a phone's home screen: PNG files in three sizes, listed in a web app manifest. The desktop app, *cadenza*, has its own variant on a light grey tile (§3, "Editions"). `npm run icons` makes the PNGs from the SVG. They are committed, so after changing the icon the command has to be run again (with `-- --force`, since it doesn't replace existing files otherwise).
  - The icon is a separate image and can't use the app's CSS variables: its coral is named `.accent` in the SVG, and a test checks that it is halfway between the dark and the light theme's `--accent`.
  - **Installed, the app opens as an app** (decided, built: the manifest's `"display": "standalone"`, with `id`, `start_url` and `scope` "/"): from a phone's home screen, or installed from a desktop browser, it gets its own window or the whole screen, without the browser's bar. It then shows its own back and forward buttons (§3, "Navigation"). Opened in a browser tab, nothing changes.
  - **The splash screen's colour** (the manifest's `background_color`, which Android fills the screen with around the icon while an installed app starts) is the tile's coal, #303237 (decided): the brackets and the note appear on a uniform coal screen. **The toolbar colour** (the manifest's `theme_color`: the status bar of an installed app on Android, the title bar of one installed on the desktop) is the icon's coral, #e45a51 (decided), the same in both themes; making it follow the theme (a `<meta name="theme-color">` changed by script) is left for later (§15).
- **Project and file names are never cut off at the end.** They wrap over up to three lines wherever there is room (the picker's list, the dialogs, the pipeline panel); a name with spaces breaks between words; a name without any (typically a file name) fills each line and breaks wherever it ends, since breaking early at a hyphen wastes most of a line. Only the picker's field in the header is a single line. A name that needs more lines than it may have is shortened **in the middle** ("villa-lobos_bach…prelude.orig (1)"), because names on the same PDF differ at the end, and hovering then shows all of it. This works the same with a mouse and on touch: the full name of the open project is one tap away, in the picker's list. The browser can only cut text at the end, so one component (`FittedText`) measures and shortens.
- **Dates, times and numbers have one fixed English format everywhere.** They don't follow the browser's language or region: the interface text is English, and a browser's idea of the locale often differs from the user's.
  - **Dates:** day and the month's short name, "7 Oct", plus the year when it isn't the current one, "7 Oct 2025". Never all-numeric, which is ambiguous between day-first and month-first. The day is the device's local one.
  - **How long ago:** compact, "20min ago", "5h ago", "2d ago", for times less than a week old; older ones as a date (built: `when` in `apps/web/src/time.ts`, in the project picker, the dialog for a known PDF, and the panel's "Created … · changed …").
  - **Money:** US dollars with two decimals, "$0.12" (§10).
