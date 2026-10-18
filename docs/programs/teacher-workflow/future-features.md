# Teacher workflow future features

Owner direction outside current scope, recorded 2026-10-11 during LF3 QA. Discussion only; open questions are asked when each item is planned. Technical defects belong in [problems.md](./problems.md).

## TFEAT-001: Editing published content without reverting to draft

- Status: Planned as [TFEAT1](../student-user-flow-route/implementation-plans/tfeat1/plan.md) (Decision 39 of the student-user-flow-route program), 2026-10-18.
- Direction: adding or editing a card (and other content) in a published topic no longer moves the topic back to draft for re-review; today the author confirms a browser `confirm()` ("Bài học đã xuất bản… chuyển bài học về bản nháp…") and the topic leaves published.
- Options noted: edit live with a change history (who changed what, when), optionally warning only on breaking changes (removing items, changing a correct answer); or keep the published version while a pending revision waits for approval (needs content versioning, much larger).
- Interactions to settle at planning: learner progress after an edit (LF3 relocks the memory check on a new card, by design), stored answers when a correct option changes, and replacing the native `confirm()` with an app dialog.

## TFEAT-002: Chapter-owned authoring instead of review approval

- Status: Deferred. Needs its own program plan (touches the D1/D41/D42 role and review model).
- Direction: drop the review step; an editor manages the chapters they create and can add members to help; members signal "ready to publish". The Owner floated publishing automatically once more than half of the members (rounded up, creator included) mark ready.
- Notes from discussion: a one-member chapter would publish on its own vote; votes after later edits need a rule; a simpler variant lets the chapter owner publish while members only signal readiness. Who may create chapters is decided later.

## TFEAT-003: Author communication

- Status: Deferred, after TFEAT-002.
- Direction: group chat per topic, per chapter and per course for authors.
- Notes from discussion: start with topic-level comments (optionally anchored to a card or question, with notifications, building on `review_notes`) before realtime chat; chat is new user data, so `/privacy` must be updated in the same change.
