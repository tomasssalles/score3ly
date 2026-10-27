# score3ly

## Docs
- `DESIGN.md` (repo root): the whole picture (architecture, the pipeline model, the stages in short, the formats, the decisions and their reasons). Read it at the start of a session to get up to speed.
- I did not write that document myself. I constantly have discussions with you in multiple sessions to make design decisions, and I ask you to update the design docs with our decisions and rationalle. That means the document itself is really written by you and mostly for you (you read it, we discuss, I usually already have everything in my memory or ask you about what you read). In particular, it can contain mistakes when you misunderstand my intentions. If something doesn't match what I'm saying in the chat, check with me and let's clarify the discrepancy.
- `docs/tasks.md`: the tasks, and only there: anything still to do (features, decisions to make, bugs, tests by hand, research, far-future ideas). Look there when looking for tasks, and write every new task there, never in `DESIGN.md`. The top of the file explains how the list works (no sections, numbers or checkboxes; tags; a done task is deleted, its decisions go into `DESIGN.md`).
- `docs/style.md`: the style guide, how the app looks, speaks and behaves. Read it before building or changing anything the user sees, follow it, and keep it up to date when a decision about style is made.
- `docs/project-view.md`: what the app shows around a project: the layouts, the artifact view, progress and toasts, the header, the pipeline panel and its stage cards, the pages of the menu. Read it before working on those screens.
- `docs/notation.md`: how the music is written down: the lens and its symbolic format (what models read and write), MEI (what users get), what is music and what is typesetting, stretches and measures, issues and warnings. Read it before working on the music stages, the prompts that write or read music, `packages/notation`, or the MEI.
- `docs/stages/`: the details of the stages, one file per group. Read the file of the stages a task touches before working on them:
  - `pages.md`: `rasterize`, `skew_analysis`, `fix_skew`, and how the skew is found (`findSkew`) and when a page is deskewed.
  - `layout.md`: `layout` (its prompt, rounds and checks) and `fix_layout` (the editor of boxes and bar lines, and the page editors' shared parts).
  - `analyze.md`: `analyze` (its prompts, the observations, their checks), `fix_metadata` and `fix_observations` (the forms), and the metadata (its fields and the MEI's header).
  - `music.md`: `extract` (its request, checks and loose ends across systems), `review`, `apply_review`, `human_review` (its screen), and the Transcription.
  - `engrave.md`: `engrave` (the MEI view, the PDF, the downloads and the run report) and `fix_mei` (the MEI editor and its checks).
