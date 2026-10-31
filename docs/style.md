# Style guide

How score3ly looks, speaks and behaves, as rules to follow when something new is built. It generalizes from what exists: the examples are there to show a rule, not to be the rule. Where the app and this guide disagree, one of them is wrong: fix the app or the guide, but don't let them drift apart. § numbers are `docs/overview.md`'s sections, where the decisions behind most of this are recorded.

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
| Charts | `--chart`, `--series-1` … `--series-6`, `--series-other` | data, not state | the statistics: one series in `--chart` (the accent); split, the groups in the series colours, the most expensive first, the rest in grey |
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

**Themes.** A dark and a light theme, chosen per device: Auto (the default) follows the system's light or dark preference, at once when it changes, picking the first theme of that kind. A new theme is a block in `themes.css` with every token and an entry in `THEMES` (`themes.ts`); nothing else in the app should need to change. Tests: no colour literal anywhere in the web app's CSS, TS or TSX but `themes.css` (`colors.test.ts`), and every theme with the same tokens as the first (`themes.test.ts`). Out of their reach on purpose, being the same in every theme: the app icon, the manifest's colours and the layout's box colours (`LAYOUT_COLORS` in `packages/imaging`, which are drawn on the pages for the models too).
- **The light theme:** white chrome and cards on a light grey page, near-black text, secondary text at about 6:1; the coral, the green and the amber darkened until they read on white (the coral #c93a30, about 5:1, with white text on it instead of black); the background around pages a mid-light grey; the paper and what is drawn on it as in the dark theme; the MEI file's colours after GitHub's light theme.
- **Designing a theme:** draft it on a static copy of one screen (the DOM and CSS saved from the running app, re-rendered in seconds), then check every screen with the screenshot script (`npm run screenshots`, docs/overview.md §5.7).

## Brand

- **The wordmark** is `<score3ly>` in JetBrains Mono, in the text colour, with the angle brackets in the accent. It nods at the source code the app turns music into. It is always on the left of the header, at every width.
- **The accent is coral:** #ff7b72 in the dark theme (8.4:1 on black, black text on it), #c93a30 in the light one. Chosen from a set of candidates in a mockup. **Progress is green** (#3fb950 dark, #1a7f37 light), never coral, through its own token (`--progress`), so changing it is one line.
- **The app's icon (the compact mark):** `< >` in coral with a quarter note inside, on a rounded square (`apps/web/public/icon.svg`). Besides angle brackets as a tag, `<c e g>` is a chord in LilyPond. A quarter note rather than an eighth: a flag makes the note lopsided between the brackets and is too much detail for a favicon.
  - **The same in every theme:** an installed app's icon and a favicon can't follow the app's theme, and the README shows it on GitHub's light and dark pages. So: a coal tile (#303237), which keeps its edge on black and on white, and brackets in a coral halfway between the two themes' accents (#e45a51), standing for both looks of the app; a test keeps it halfway. The note is white.
  - **The desktop app, *cadenza*,** has its own variant: the same mark on a light grey tile (#dfe1e5) with a black note (`icon-cadenza.svg`), which is also its splash.
  - It is the favicon and the icon on a home screen: PNGs in three sizes, made from the SVG by `npm run icons` (with `-- --force` to replace existing ones) and committed.
- **The installed app's colours** are fixed, not themed: the splash screen around the icon is the tile's coal (#303237), so the mark appears on a uniform coal screen; the toolbar (the status bar on Android, the title bar on the desktop) is the icon's coral (#e45a51).
- **The editions' names,** *concerto* (the web app) and *cadenza* (the desktop app), are written in a muted serif italic, like a work's subtitle.

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

**The header holds only what is global,** the same on every screen: the brand on the left, then whatever picks or creates the main object (the project), then the menu at the far right. Navigation arrows come first where there is no browser bar. It is never a toolbar: nothing that belongs to one view goes there.

**The menu (☰) leads to the app's own pages,** grouped by purpose (what you look at, what you change, help) with lines between the groups. A page from the menu replaces the current view, has its own URL, and back returns from it.

**Settings are rows,** each with its label (and a short muted hint below where needed) on the left and its control on the right, in sections: the user's settings first (shared by every device), then what belongs to this device (screen, input, storage: a phone and a laptop may differ), then what is for developers. **Settings save themselves** when a control is changed or left; there is no Save button. A value that isn't accepted says so, in red, and isn't saved.

**A main view puts its navigation on one side and its content on the other:** a panel listing the parts (in the project view, the pipeline's stages, as cards in their order) and a large area showing the one part picked. The panel has a head that stays in view, with the object's name, its "⋮", the controls that act on the whole and its overall state; the list scrolls below it. The content area has no header of its own: what it shows is visible as the selection in the panel. A content area's tools (a toolbar, toggles) sit at its top; a counter for a long list sits in a corner.

**Actions live with what they act on.** An object's actions are in its own "⋮", next to its name: the project's in the project's, a stage's in the stage's. A tool's actions are in the tool's toolbar. The object itself shows only its one obvious next step as a button (Run, Retry, Finish, Download), so it stays clean.

**The place for urgent things is where the user is:** a problem with one item on that item; a problem with the whole in the panel's head, where scrolling can't hide it; a missing key or a reached cap where the action that needs it is started, not in Settings.

**Money** appears only where the user goes to look at it: details, the costs view, the settings of a model config. Never on the items the user works with, never in a toast.

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
- **Corners:** every button has all four corners rounded, unless it is joined with others into one control (a segmented group, such as the editors' tools or the chart's bars | running total): only there do the inner corners turn square, and only the group's outer corners are round. A button that merely stands next to others (the split and filter buttons, the per-page filter) is on its own and keeps its round corners. In the CSS, joining is opt-in: only `.editor-mode`s inside an `.editor-modes` group lose corners, never by position among unrelated siblings (`:first-child`, `:last-child`), which broke this twice.
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

**Chips** are small pills for an on/off choice that sits among other controls (configs with the same name together): coral when on, like other toggles.

**Check lists** (`CheckList`) are how items are selected from a list, in every filter: a box per item (ticked in coral, empty when not selected), a box above them for all or none (a dash in it while only some are selected), and beside it a "⋮" for actions on the selection where there are any ("Remove projects with unfinished pipelines"). Each item has its name, muted facts under it, and amounts on the right. A filter with several lists has a section per list that can be collapsed (expanded at first, a coral dot on its name while collapsed with anything filtered out). Lists never scroll by themselves: the panel that holds them scrolls, as one.

**Charts** (`TimeChart`, for every statistic over time): stacked bars or a running total as lines, a fixed y axis with a few round steps, labels under the axis only where they fit, at least 4 px per bucket and sideways scrolling beyond that, starting at the newest end. The values of a bucket are read by tapping it, in a line above the plot, never from a floating tooltip; the arrow keys move between buckets. No smoothing, no log scales, no moving averages. One series looks best: the chart colour, a light fill under a line; many series put telling them apart first.

**Blocks of a statistics page** (`StatHead` in `statsParts.tsx`): a head with the title and an "i" on the left (it shows and hides what the block means, in plain words), and on the right the block's controls (a range picker, a filter button) and its value, large and monospaced, with a unit after it where it has one ("57 hours") and a short muted note under it ("on 23 days"); on a phone the right part goes to a line of its own. The title, the controls and the value's first line share a text baseline, and the note hangs below them (decided 2026-10-30, to be judged on screen: before, the right part was centred as a whole, so the controls sat between the value and its note); an icon button there gets an invisible line of text so that it sits on the title's line. Values line up on the right edge across blocks. Something urgent (the cap reached) is said under the head, never only behind the "i".

**Progress:**
- a thin green bar for a known fraction (the pipeline's, a stage's); a green circle where there is no room for a bar (the collapsed strip); never a percentage or a count;
- a grey spinner for something that happens where the progress isn't known (a stage running on another device): grey, so it doesn't read as progress;
- a waiting LLM call fills its share of the bar by the time elapsed out of its timeout, so the bar always moves;
- **state icons** where there is no room for words: a green check (done), a red warning triangle (failed), an empty circle with a grey pause sign (waiting for the user).

**Status words** are the name of the thing plus its state, short, and the same wherever the state is shown: an ellipsis while it runs, in muted text ("Layout…"); the state in red, without an ellipsis, when it failed ("Layout failed"); the state in parentheses while it waits ("Layout (not started)").

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

- **"Select", not "pick"** (decided), for choosing items in a list or filter: "no projects selected".
- **English, plain and short,** in sentence case ("Change config", "Fix layout manually", "Run mode for new projects"). No jargon where a plain word exists; the user is a musician, not an engineer. Technical names (MEI, LilyPond, PDF) are fine where they are the thing itself.
- **Names of things are consistent:** a step is called the same on its card, in its menu items, in toasts and in the docs. A manual stage is "Fix X", added with "Fix X manually".
- **Labels and buttons have no period; sentences do.** Toasts and status lines are labels.
- **An ellipsis (…) means "in progress"** ("Analyze…", "Preparing…"); never used for decoration.
- **The middle dot (·) joins facts** on one line: "2s · 54 systems · 3 issues".
- **Numbers, dates and money have one fixed format,** independent of the browser's locale: "7 Oct", "7 Oct 2025" (never all-numeric); "20min ago", "5h ago", "2d ago" for less than a week; "$0.12", "<$0.01", "$0.00" only for free calls; durations "8s", "3min 12s", "1h 5min".
- **A deleted project is marked "(deleted 12 Sep 2026)"** after its name, in muted italics, the same wherever deleted projects are listed (the statistics: lists, pickers, filters, tables, a chart's readout). The date, always with its year, tells apart two projects of the same name, one of them deleted (decided). A deleted or edited model config is marked the same way, with the day its row ended: "Opus EU *(until 15 Sep 2026)*".
- **Names are never cut at the end:** they wrap over up to three lines, and only when even that isn't enough are they shortened in the middle ("villa-lobos_bach…prelude.orig (1)"), because names on the same PDF differ at the end. The full name is one hover or one tap away. The browser can only cut text at the end, so one component (`FittedText`) measures and shortens.
- **Messages speak about the work, not about the user:** "The fake provider failed, as asked", "A project with that name already exists. Names must be unique (case-insensitive)." Never "You did…", never "Oops".
- **Say what the app can't know as a possibility,** not as a fact: "boxes or answers may not fit it", "probably on another device".

## Icons

- **Small line icons** in the current text colour (24-unit grid, strokes, no fills), drawn by us (`icons.tsx`), so they follow the theme.
- **An icon stands for a thing, consistently:** each automated step has its own (an upload arrow for Ingest, an image for images, a note turning into a letter for `extract` and the reverse for `engrave`, a letter struck through with the correction above it for `review`, its stroke a filled outline of varying width so that it looks written by hand, `.brush`); all manual stages share the wrench; each kind of artifact has its own (a sheet with "PDF" or "MEI" on it, an image, a note, braces for structured data).
- **Chevrons collapse, expand and open dropdowns; arrows navigate** (back and forward, pages). Never the other way round.
- **Icon-only controls** are used where the meaning is visual and the set is small (editor tools, view toggles); they always have a tooltip and an accessible name. Everywhere else, words.

## Motion

- **Little, and only to explain a change:** a chevron turning, a toast sliding in, a spinner. No decoration, no transitions on layout.
- **Reduced motion is respected:** with the system's setting, transitions stop and spinners slow down.
