# Notes: baselines, music formats, MEI (discussion of 2026-10-02 to 2026-10-06)

> Status: **exploration, no decisions.** Nothing here changes `DESIGN.md` yet. Ideas and findings to come back to.
> **Conclusion (2026-10-06):** the early assessment is done; the app will be built (DESIGN §16 step 4). Next: review the design and these notes, update the decisions and fold everything into `DESIGN.md` (§16 step 5), then delete this file.
> Prices and tool facts were gathered from web search snippets (vendor sites were not reachable); verify before relying on them.

## 1–3. Folded into `DESIGN.md` (2026-10-11)
- §1, baselines: DESIGN §13, "Baselines".
- §2, why the target format was in question, and §3, the canonical representation: DESIGN §1, "Why a text encoding, and which one", and §6, "MEI" and "The lens". The early sketches of corrections and of a first draft via the lens were replaced by the stages in DESIGN §6.

## 4–7. Folded into `DESIGN.md` or dropped (2026-10-11)
- §4, image region linking: DESIGN §6, "MEI" (`facsimile`).
- §5 (things to verify), §6 (Gemini's prompt for a content box) and §7 (Gemini counting measures from the full page): dropped as no longer relevant.

## 8. Manual run with Claude Opus 5.5 on Bendel p4 (claude.ai chat)

A first hand-run of the intended pipeline (DESIGN §16 step 3) on `bendel_la_cascade_p4.orig.pdf`, the obscure piece no model identified. Done in a claude.ai chat, with code execution available to the model. The result is `testset/bendel_la_cascade_p4.claude-chat.ly`; its quality hasn't been checked in the viewer yet.

### 8.1–8.2 Folded into `DESIGN.md` (2026-10-11)
What was done and the findings: DESIGN §13, "The manual run". The result is `testset/bendel_la_cascade_p4.claude-chat.ly`.

### 8.3–8.4 Folded into `DESIGN.md` (2026-10-11)
Claude's retrospective: DESIGN §13, "The manual run"; pitch guides and the key-signature check as experiments in §15; chord plans dropped; no list of long marks in advance (§6, `extract`). Ideas for the pipeline: zoom crops on request (§6, "Zooming in"), loose ends matched by code and hints from the previous system (§6, `extract`); document-level notes and the measurement of each extra dropped.

### 8.5 Folded into `DESIGN.md` (2026-10-11)
The corrections and the lessons: DESIGN §13, "The manual run"; the prompt rules in §6 (`extract`, `review`, "Musical content and typesetting"); several slurs at once in "The lens".

### 8.6 Folded into `DESIGN.md` (2026-10-11)
Musical content and typesetting: DESIGN §6, "Musical content and typesetting".
