# FEAT12 detail plan — Catch-up prompt on a completed topic

Revision: r3, 2026-10-19. Codex CLI `gpt-6.1-sol` / `high` plan review PASS at round 3 (r1 and r2 findings applied). Owner approval: 2026-10-19, implementation by one `sonnet-high-implementor` session with local commits. Product decisions: Owner-confirmed 2026-10-19 (four answers below). Source: [FEAT-012](../../future-features.md). Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: a learner who opens a completed topic whose current content still has work they have not passed (an exercise question or memory-check question with no currently correct answer, typically after an author adds a question or changes a correct answer under Decision 39) sees that at the top of the completion screen and reaches the first such question in one click. Completion, grading and progress stay as they are.

| ID | Observable result |
| --- | --- |
| AC1 | A learner on the completion screen of a topic with N > 0 exercise questions not currently answered correctly sees, above the progress bars, a box titled `Bài học vừa được cập nhật` with the line `Còn N câu bài tập cần làm` and a `Làm ngay` button. |
| AC2 | When M > 0 memory-check questions are not currently answered correctly, the line reads `Còn M câu Memory check cần làm`; when both counts are non-zero it names both (memory check first), for example `Còn 1 câu Memory check và 2 câu bài tập cần làm`. |
| AC3 | `Làm ngay` follows the existing gate order and never opens a locked step: the vocabulary step while memory-check cards are still pending (`memoryCardsLocked`); else the memory-check step while it is not passed (exercises are locked behind it), opening directly at the first not-yet-correct question in authoring order (a settled correct answer the learner had not continued past is not shown again; a pending or failed attempt is kept); else the exercise step at the first exercise question not currently answered correctly, in the order the question navigator uses. |
| AC4 | With nothing left to do (both counts zero), the completion screen is unchanged: no box, same heading, bars, hint and buttons as today. |
| AC5 | The topic stays completed throughout: the heading, the sidebar tick and the course and chapter counts do not change because of the box, and showing the box or clicking `Làm ngay` adds no progress write of its own. Returning to the completion screen uses only the existing actions (`Xem kết quả chủ đề`, or `Hoàn thành` on the last question per Decision 38); no auto-advance is added. Each time the screen shows, the box reflects the current counts, so it is gone once nothing is left. |
| AC7 | When the workspace already knows its local progress is unconfirmed (`queueProgressUnavailable`), the box is not shown; the existing reload path owns that state. The counts describe the loaded data plus answers made in this session; the box never claims the topic has nothing left beyond that. |
| AC6 | The box is announced with the screen (heading order, accessible name of the button includes the count) and works at phone width without horizontal scroll. |

### 1.2 Scope and non-goals

- In scope: the learner completion screen and the workspace wiring that feeds it; component tests; master-plan Decision 40 and unit row; progress State and milestones (including the pending TFEAT1 merge/hosted/deploy State refresh); FEAT-012 status in future-features.
- Non-goals: new cards (a completed topic with an unseen or memory-pending card already lands on the vocabulary step, `lib/learning-landing.ts`); cards rated Again/Hard (covered by the existing `Ôn ngay` due prompt); demoting completion; re-grading stored answers; server actions, Zod schemas, DB, migrations; notifying learners elsewhere (dashboard, course page, email); the topic builder redesign (TFEAT-004); hosted or deploy actions without separate grants.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Counts come from the same client state that drives the step ticks and the question navigator (`userAnswers` for exercises and memory questions), not a new server read or a second correctness rule. | The box and the step ticks/navigator disagree about what is left, or a new read path adds load and drift. |
| G2. The box never changes `isTopicCompleted`, completion counts or the completion animation entry; it only adds a navigation action. | The sticky completion contract (D4) breaks or the earned-completion animation replays. |
| G3. The click target is chosen from the gates (`memoryCardsLocked`, `memoryPassed`), not from the counts alone, and reuses the existing stage navigation (`goToStage`) and first-remaining-question positioning. | The learner lands on a locked step (`returnToMemoryCheck` can set `memoryPassed` false while every memory answer is correct, and pending memory cards lock the memory step), or on a question that is already correct. |

### 1.4 Owner decisions that bind this unit (2026-10-19)

- Counts: exercise questions and memory-check questions (new cards are already handled by the landing rule).
- `Làm ngay` goes to the first question not yet passed, not just the step.
- Placement: top of the completion screen, before the progress bars.
- Copy: title `Bài học vừa được cập nhật`, line `Còn N câu ... cần làm`, button `Làm ngay` (chosen over "N câu mới" because a changed answer is not a new question).

## 2. Repository facts

Baseline: `7ce9b35`, checked 2026-10-19.

- `resolveLandingStage` (`lib/learning-landing.ts:26-39`) returns `complete` for a completed topic unless a card is unseen or memory-pending — justifies AC1/AC2 (the gap) and the new-card non-goal.
- `isMemoryCheckPassed` (`lib/memory-check.ts:155-158`) is computed on load from current correctness, so a new or re-keyed memory question makes `memoryPassed` false on a completed topic; `exercisesLocked = memoryCheck !== null && !memoryPassed` (`LearningWorkspace.tsx:458`) — justifies AC3 ordering and G3.
- `userAnswers` holds only answers correct under the current key (`app/actions/learning-workspace.ts:283-291`); `remainingQuestions` and `goToFirstRemainingQuestion` (`LearningWorkspace.tsx:701-712`) and the step ticks (`:783-807`) derive from it — justifies G1 and AC3.
- `MemoryCheckStage` builds its queue from not-yet-correct questions in authoring order, plus any question whose result the learner has not continued past (`MemoryCheckStage.tsx:90-101`), by design; attempts live in `LearningWorkspace` (`:372-382`, `clearAttempt`) — justifies the AC3 entry rule.
- A completed topic with memory-pending cards lands on the vocabulary step, but `Xem kết quả chủ đề` (`LearningWorkspace.tsx:1292-1296`) can still open the completion screen while `memoryCardsLocked` is true; the memory step then shows its locked screen (`:1056-1068`) — justifies AC3 and G3.
- `returnToMemoryCheck` sets `memoryPassed` false without touching `userAnswers` (`LearningWorkspace.tsx:488-491`); `queueProgressUnavailable` already routes to a reload screen (`:1158-1164`) — justifies G3 and AC7.
- On an exercise answer, `Câu tiếp theo` stays while a later question exists and the answer did not just complete the topic (`hasNextQuestion && !pendingCompletion`, `LearningWorkspace.tsx:978`); on the last question the end action is `Hoàn thành` for a just-completed topic, `Làm câu còn thiếu` while a question is still missing, else `Hoàn thành` for a completed topic (`:979-986`, Decision 38, LF9 AC11); `Xem kết quả chủ đề` is always offered on a completed topic outside the completion screen (`:1292-1296`) — justifies AC5.
- `TopicCompletionPanel` (`TopicCompletionPanel.tsx`) renders heading, then the progress block, then the due/next buttons; it receives no remaining-work data today (`LearningWorkspace.tsx:1022-1050`) — justifies AC1 placement and the scope.
- Completion-screen tests live in `__tests__/components/topic-completion-ui.test.tsx` and workspace tests in `__tests__/components/learning-workspace.test.tsx`.

## 3. Bounded implementation hypotheses

- `TopicCompletionPanel` gains an optional catch-up prop (counts plus an `onCatchUp` callback) and renders the box between the heading and the progress block; the box is absent when both counts are zero. Any equivalent prop shape is allowed if AC1-AC6 hold.
- `LearningWorkspace` computes the two counts from `userAnswers`, the memory-check questions and `remainingQuestions`, and its `onCatchUp` picks the target by G3 (`goToStage("flashcard")`, `goToStage("memory")`, or `goToFirstRemainingQuestion` then `goToStage("exercise")`), with the existing plane-focus request. For the memory target it first clears the settled correct attempts of memory questions already in `userAnswers` (`clearAttempt`), leaving pending and error attempts alone.
- Visual treatment follows `frontend-design` and the existing completion-screen tokens; the `Làm ngay` button is the box's own action, and the lower due/next buttons keep their current order and styles.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Catch-up box and navigation on the completion screen, with docs (Decision 40, unit row, State, FEAT-012 status, TFEAT1 State refresh) | Component tests for AC1-AC7 in the two test files above; `npx tsc --noEmit --incremental false`; lint on changed paths; `npm run docs:check`; `git diff --check`; Owner manual QA on local |

### Test intent

- Panel: box absent with zero counts; title, line and button for exercise-only, memory-only and both; the button's accessible name includes the count; the box sits before the progress bars.
- Workspace: a completed topic loaded with one exercise question whose stored answer is no longer correct lands on the completion screen with `Còn 1 câu bài tập cần làm`; clicking `Làm ngay` shows that question (not the first question when it is a later one); with an unpassed memory check it opens the memory step (not a locked exercise step); with pending memory cards reached through `Xem kết quả chủ đề` it opens the vocabulary step (not the locked memory screen); the completed state and course counts are unchanged and clicking `Làm ngay` calls no progress action. Return path: missing question in the middle, later questions already correct, answer response `newlyCompleted=false`; the learner still sees `Câu tiếp theo`, and after `Xem kết quả chủ đề` the completion screen shows without the box. With `queueProgressUnavailable` set the box is absent. Memory entry: answer memory question 1 correctly, do not continue, open the completion screen (count 1), `Làm ngay` shows question 2 directly and sends no answer; a pending attempt is not dropped.

### QA fixture readiness

- QA type: one learner on a completed published topic, then an author changes a correct answer and adds a memory-check question (TFEAT1 live edit).
- Source: the local root DB topic used in TFEAT1 QA, or the `full` fixture of `scripts/e2e/learning-workspace-matrix-fixture.mjs`; no new fixture.
- QA starts after CP1 automated checks pass. Never reset the root or hosted database.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The box counts differ from the navigator or step ticks | G1; workspace test asserts the count against a mixed correct/incorrect fixture. |
| The button opens a locked step | G3 picks the target from the gates; tests cover pending memory cards and an unpassed memory check. |
| The learner who left the memory check mid-feedback sees that feedback again instead of the next question | AC3 entry rule clears only settled correct attempts; a test covers it and a pending attempt. |
| The completion animation or focus replays on the catch-up return | G2; the return path is the existing `goToComplete`, tested to show the settled screen. |

- Rollout runbook: Owner plan approval; implementation with local commits as granted; Codex implementation review; Owner QA on local; separately granted push/PR/CI and merge. No migration, so no hosted step.
- Stop when: the counts need a server read or a new learner-state rule, or the click cannot reach the question without changing grading or completion.
- Rollback: revert the app commit; no data or schema change to undo.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
