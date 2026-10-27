# Teacher workflow future features

Owner direction outside current scope, recorded 2026-10-11 during LF3 QA. Discussion only; open questions are asked when each item is planned. Technical defects belong in [problems.md](./problems.md).

## TFEAT-001: Editing published content without reverting to draft

- Status: Done (2026-10-18): delivered as [TFEAT1](../student-user-flow-route/implementation-plans/tfeat1/plan.md) (Decision 39 of the student-user-flow-route program), merged in PR 166 (`7ce9b35`) after hosted migration `20261018120000`, production deployed.
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

## TFEAT-004: Topic builder UI/UX redesign

- Status: Planned (2026-10-28) as [TFEAT4](../student-user-flow-route/implementation-plans/tfeat4/plan.md); Owner approved r3 on 2026-10-28, implementation not started.
- Direction: redesign the topic builder screens; the Owner finds the current layout hard to use and unattractive. In particular, the memory check and the exercises share one tab and should be separated.
- Also in scope: edit dialogs (for example "Sửa Câu hỏi & Đáp án") close when the author clicks or tabs outside mid-edit and drop the typed changes without asking; add an unsaved-changes prompt (save / discard / keep editing).
- Source: Owner QA of TFEAT1, 2026-10-18.

## TFEAT-005: Add question groups and questions to a saved exercise

- Status: Deferred (recorded 2026-10-28 while planning TFEAT4).
- Direction: in the topic builder, let an author add a question group to a saved exercise, or a question to a saved group (or to a saved Part 5 exercise), instead of deleting and recreating the exercise. Today `createExercise` (`app/actions/exercise.ts`) writes a whole exercise at once through `create_exercise_with_content`, and no action or RPC adds a group or question later. Needs new RPCs that keep the TOEIC Part rules, ordering and topic-group permission checks, plus the TFEAT1 published-topic behavior (learners must answer a new question). TFEAT4 leaves this out of the redesigned UI.
- Target program: none yet; needs a DB unit (migration, RPC, integration tests) before the UI.
- Source: Owner, 2026-10-28.

## TFEAT-006: Change the TOEIC Part of a saved exercise

- Status: Deferred (recorded 2026-10-28 while planning TFEAT4).
- Direction: allow changing `part_type` after an exercise is saved; today the edit form shows the Part as read-only. Changing it must revalidate existing groups and questions against the new Part's context rules (passage, audio, image, standalone questions) and say what must be added or removed before the change saves. Needs a server-side rule and RPC; TFEAT4 keeps the Part read-only.
- Target program: none yet; needs a DB unit together with or after TFEAT-005.
- Source: Owner, 2026-10-28.
