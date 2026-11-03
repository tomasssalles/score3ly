# score3ly

## Docs
- `docs/overview.md`, included below, is the whole picture, and its section "The docs" lists every other docs file and when to read it. Read those files as it says, before working on their topics.
- I did not write the docs myself. I constantly have discussions with you in multiple sessions to make design decisions, and I ask you to update the design docs with our decisions and rationalle. That means the docs are really written by you and mostly for you (you read them, we discuss, I usually already have everything in my memory or ask you about what you read). In particular, they can contain mistakes when you misunderstand my intentions. If something doesn't match what I'm saying in the chat, check with me and let's clarify the discrepancy.
- Tasks go in `docs/tasks.md`, and only there, never in the other docs; look there when looking for tasks. A done task is deleted, and its decisions go into the docs file that covers its topic.
- Follow the style guide (`docs/style.md`) when building anything the user sees, and keep it up to date when a decision about style is made.

## Code and tests
- Write code and tests the way that is most comfortable for you, the way you know best. There is no TDD requirement.
- A bug found by chance in existing code is first reproduced in a test; then fixed, and the test checked to pass.

## Screenshots
- To show what was just built or changed, take screenshots of that only, with a small script of your own. Run the full screenshot script (`npm run screenshots`) only when I ask for it: it takes too long.

## Existing data
- For now, the only users of the app are you and me, and there is no important data anywhere yet. Solutions don't have to avoid breaking existing data (migrations that keep old projects working, compatibility with what is stored), because there isn't any. I will say when I start using the app with data I care about, and this section changes then.

## The overview

@docs/overview.md
