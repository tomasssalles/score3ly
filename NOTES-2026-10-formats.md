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

### 8.3 Folded into `DESIGN.md` (2026-10-11)
Claude's retrospective: DESIGN §13, "The manual run"; pitch guides and the key-signature check as experiments in §15; chord plans dropped. Still open here: listing the extents of all long marks (slurs, 8va, hairpins) before transcribing, which belongs with the loose ends (§8.4).

### 8.4 Ideas for the pipeline (open, not decided)
- **Replace self-directed actions with steps we control:**
  - measure crops precomputed from measure boxes and sent with the system crop in one request (one turn with several images is far cheaper than several turns)
  - structural checks by our parser instead of the model compiling LilyPond (§7.4)
  - renderings for comparison produced in review (§9)
- **Caps:**
  - one call per system by default, no tools
  - ~~a `zoom(box)` tool~~ folded: DESIGN §6, "Zooming in" (zoom crops on request, without tool calls)
  - reasoning effort or thinking budget set per step
- **Cross-system dependencies:**
  - **Loose ends:** each system's output lists spanners and voices continuing into the next system or arriving from the previous one. Code checks that both sides match and flags both systems on a mismatch.
  - **Document-level notes:** every call may add notes tagged with the measures they concern. The reviewer of a system sees all notes concerning it, including ones written later. Short text, so cheap to show in full; also covers observations not about neighbours.
  - **Review after the whole page is transcribed,** with neighbouring systems' images and transcriptions. A later finding that affects an earlier system marks it stale for re-review (as in DESIGN §5.4), within the review-loop limit.
- **Measure the value of each extra:** call records give tokens, cost and time per call. Compare one-shot with one-shot plus capped zoom on a few systems.


### 8.5 Folded into `DESIGN.md` (2026-10-11)
The corrections and the lessons: DESIGN §13, "The manual run"; the prompt rules in §6 (`extract`, `review`, "Musical content and typesetting"); several slurs at once in "The lens".

### 8.6 Folded into `DESIGN.md` (2026-10-11)
Musical content and typesetting: DESIGN §6, "Musical content and typesetting".
