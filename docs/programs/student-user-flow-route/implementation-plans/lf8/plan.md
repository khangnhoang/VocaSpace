# LF8 detail plan — Instant card rating

Revision: r5, 2026-10-16. r2 resolved the r1 plan review (time-independent reveal guard, armed queue end, pending status line, ReviewSheet close on failure, saves that survive unmount, preview and dashboard tests); r3 resolved the r2 re-review (test reset of the shared chain, status line placement, shared-chain wording, unload prompt tied to the chain); r4 resolves the r3 re-review (status element only while pending, module state and reset wording); r5 resolves the r4 re-review (status line targeted by text, end-state text aligned). Owner decisions of 2026-10-16 (UI-only first, retry once then requeue, wait for pending saves before the queue-end decision, unload warning, both rating surfaces). Owner approval: granted by the Owner's workflow instruction of 2026-10-16 once the plan review passed (r5 PASS). Master plan: [plan.md](../../plan.md) (Decision 32).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges, rating a flashcard shows the next card at once on both rating surfaces: the topic workspace (`LearningWorkspace`) and the dashboard review dialog (`ReviewSheet`). The rating is saved in the background. The learner no longer waits for the Server Action round trip, about 450 ms median in production (PERF-ACTION-001). Saves still go through the unchanged `submitCardReview`, one at a time in rating order. Everything the server decides stays server-decided:

- seen, rated and due sets;
- the flashcard-done mark;
- topic completion;
- the memory-check unlock.

A failed save is retried once and then puts the card back in the queue, so a rating is never shown as saved when it was not. The program docs also record the AD4 merge and the Owner's ADMIN-004 production acceptance in the admin-console program.

Terms used below:

- "Save queue": the single FIFO of ratings waiting to be saved, shared by both surfaces (G5).
- "Pending": a rating that is in the save queue or in flight.
- "Drained": no pending rating.

| ID | Observable result |
| --- | --- |
| AC1 | On either surface, after the learner reveals a card and picks a rating, the next card's front (or the end state of AC5) renders in the same interaction, before `submitCardReview` resolves. A component test with a never-resolving `submitCardReview` sees the next card's front word and a single call with that card id and rating. |
| AC2 | Ratings are saved strictly one at a time, in the order given. A rating starts its first attempt only after the previous rating has settled, success or final failure. A test that rates three cards while the first save is held sees one call in flight, then the second and third calls in order, each with its own card id and rating. Again or Hard on a one-card queue shows the same card again. The second rating of that card is sent only after the first settles. |
| AC3 | A rating changes only the queue order at once. Every server-derived local value changes only when that rating's save succeeds, exactly as today's success branch does: <ul><li>workspace: `unseenCardIds`, `unratedCardIds`, `dueCardIds`, `canSkipToQuiz`, `flashcardStageDone`, `announceTopicProgress` (and with it `markTopicCompleted` and the progress-error toast);</li><li>ReviewSheet: `dueLeft`, `warning`, `hasSaved`.</li></ul> So the Memory check step unlocks only after the save that gives the last unseen card a row has succeeded (LF3 AC6), and the queue order never changes a gate. |
| AC4 | Failure:<ul><li>When a save returns `{ error }` or throws, it is retried once after about 1 s.</li><li>If the retry also fails:<ul><li>the card goes back to the end of the current queue, unless it is already queued or a later rating of the same card is still pending;</li><li>no local server-derived value changes;</li><li>the learner is told. The workspace shows one error toast naming the card's word and saying it was put back to rate again. ReviewSheet shows its alert line with that meaning.</li></ul></li><li>The next pending rating then starts.</li><li>A requeue disarms the queue end (AC5): the queue is no longer empty.</li><li>A failure that settles after the queue was replaced by a new one (`startQueue`, or a new ReviewSheet batch) only tells the learner and does not insert the card into the new queue.</li></ul> |
| AC5 | Queue end:<ul><li>The queue end is armed only when a rating empties the current generation's queue. `startQueue` (and a new ReviewSheet batch) disarms it, and so does a requeue (AC4). An empty queue at load (LF4: all cards seen) is never armed, so it shows the vocabulary end screen as today and runs no queue-end logic.</li><li>When the queue end is armed while ratings are pending, the surface shows a short saving state ("Đang lưu kết quả các thẻ…") instead of the finished screen.</li><li>When the queue end is armed and the save queue is drained, today's queue-end logic runs once and the queue end is disarmed: <ul><li>workspace: the unconditional `setCanSkipToQuiz(true)`; `setFlashcardStageDone(true)` when the last successful save of this generation returned no `topicProgress` or no save of this generation succeeded (today's `LW:526-528` fallback); then the LF5 AC4 completion screen, the LF6 AC10 queue-kind toast and destination, and the memory/exercise transition and toasts;</li><li>ReviewSheet: finished state and `onReviewComplete`.</li></ul></li><li>The workspace queue-end logic runs whatever stage the learner is on, as today's code does after an await (this keeps `learning-workspace-presentation.test.tsx:1664-1691`). A learner who jumped to Bài tập while the last save was pending may therefore be moved to memory check. This is accepted.</li><li>If a failure has put a card back (AC4), the surface shows that card instead, and the queue-end logic does not run.</li></ul> |
| AC5b | Pending status: while anything is pending, each surface shows one polite live-region status line ("Đang lưu…"), and it is cleared once drained. In the workspace it is rendered by `LearningWorkspace` outside the keyed stage content (`LearningWorkspace.tsx:1276`), so it stays visible on every stage and screen (card queue, saving end state, vocabulary end screen, memory, exercise, completion) while anything is pending. Its `role="status"` element is rendered only while anything is pending, so `question-navigator.test.tsx:436` and `topic-completion-ui.test.tsx:220` (no status on the exercise stage) stay unchanged. The AC5 saving end state uses different text ("Đang lưu kết quả các thẻ…"). Other `role="status"` elements can show at the same time (locked memory or exercise, empty topic, unrated hint, `MemoryCheckStage`), so tests and smokes target this line by its text: Playwright `getByRole("status").filter({ hasText: "Đang lưu…" })` (pattern at `e2e/smoke/course-structure.smoke.spec.ts:172`), component tests `getByText("Đang lưu…")`. "Cleared" means that filtered locator has count 0. In ReviewSheet it replaces the sr-only "Đang lưu đánh giá…" (`ReviewSheet.tsx:152`), and `review-sheet.test.tsx:172` is updated on purpose. Tests and smokes use this line, or `expect.poll` on the database, to wait for drain. |
| AC6 | Leaving: <ul><li>While anything is pending on the shared chain, including ratings of a surface that has already unmounted, closing or reloading the tab triggers the browser's leave-page prompt (`beforeunload` with `preventDefault()` and `event.returnValue = ""` for Safari). The listener is tied to the chain's pending count: added when it becomes non-zero and removed once drained.</li><li>ReviewSheet's close, Escape and outside click, while pending, wait until drained and then close as today, refreshing after saved ratings. The back button shows the pending state meanwhile. While a close is pending, reveal and rate do nothing. If a final failure (AC4) settles while a close is pending, the close is cancelled: the sheet stays open and shows the put-back card and the alert.</li><li>In the workspace, `recoverFromCardsRequired` waits until drained before `router.refresh()`. A refresh that remounts the workspace therefore never drops a pending rating or re-offers a card whose save was in flight.</li></ul> |
| AC7 | Double activation: the rating buttons are no longer disabled while saving. <ul><li>One rating activation is accepted per revealed card (a ref guard, same tick included).</li><li>The reveal button ignores a pointer activation that belongs to a gesture started on the previous card: a `click` whose `pointerdown` happened before the current card was shown, or a `click` with `event.detail > 1` (the second click of a double click or double tap). The guard uses no timer, so tests that reveal right after rating, with or without fake timers, behave as today.</li><li>Keyboard activation (`event.detail === 0`) is not guarded, as today. A held or auto-repeated Enter on the reveal button (focused after a rating, `FlashcardStage.tsx:137-141`) can reveal the next card, as it can today; accepted.</li><li>ReviewSheet's own reveal button (`ReviewSheet.tsx:199`) gets the same guard.</li><li>The public course preview (`PublicCoursePreviewExperience.tsx:522-529`) uses `FlashcardStage` too and gets the same reveal guard. Its ratings make no save, so it is otherwise unchanged.</li><li>CP4 checks in a real browser that a fast double tap/click on a rating does not reveal the next card. If it does, stop and report rather than add a timer.</li></ul> |
| AC8 | Tests and smoke reflect the new contract. <ul><li>These tests assert the awaited behaviour and are rewritten to AC1–AC7, with the same scenarios and no weaker assertion:<ul><li>`learning-workspace-presentation.test.tsx` "keeps the revealed card and the ratings when saving the rating fails";</li><li>the `review-sheet.test.tsx` cases on pending, duplicate, disabled-while-saving, failure and completion-after-success (focus after drain stays on the "Chúc mừng" heading, `:149`);</li><li>`e2e/smoke/review-session-recovery.smoke.spec.ts` (the save abort now needs two aborted attempts and shows the card back in the batch; it waits for drain before reload, `:46-48`).</li></ul></li><li>The other rating tests keep passing unchanged, or only wait for the background save before asserting server-derived state.</li><li>Smokes that reload or read the database after a rating wait for drain first (AC5b status cleared, or `expect.poll` on the database): `learning-memory-cards-gate.smoke.spec.ts:313`, `:325`, `:334`; `review-session.smoke.spec.ts:56-57`; and the one-shot reads of `scripts/e2e/review-session-fixture.mjs:76-83` become polls or are called after drain.</li><li>One browser smoke on the isolated runtime rates cards in the workspace quickly: Again, then Easy, then Good with no wait between them. After drain it checks in the database that every card has the last rating given, and that the topic ends as the server decides.</li></ul> |
| AC9 | Docs: <ul><li>master plan Decision 32 and the LF8 unit row (added with this plan);</li><li>progress State describes LF8 and the milestones record each checkpoint;</li><li>PERF-ACTION-001 records LF8 as the UI-only step. Its server medians are unchanged, and it stays open until the Owner's production QA either accepts the perceived latency or asks for the server follow-up;</li><li>admin-console: the AD4 merge milestone (PR 160, `090ddda`), State updated, ADMIN-004 resolved, citing as its source the Owner's in-session message of 2026-10-16 confirming both production checks (an admin cannot change their own role; a removed admin loses admin power). This is the admin-console program's closeout, carried here only because the Owner asked for it in this PR; and ADMIN-003's status updated to merged, still open for the header search;</li><li>`npm run docs:check` passes.</li></ul> |

### 1.2 Scope and non-goals

- In scope: AC1–AC9 (with AC5b), a shared client save-queue helper used by both surfaces, the tests named in AC8.
- Non-goals:
  - any change to `submitCardReview`, its result type, `lf2_submit_card_review`, FSRS, RLS, gates or any migration;
  - `getClaims` or any server-side latency work (Owner, 2026-10-16: a later follow-up only if this is not enough);
  - an idempotency key for saves;
  - memory-check and exercise answers;
  - persisting the save queue across reloads;
  - blocking in-app navigation (sidebar or next-topic links) while ratings are pending (see §5).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. One save in flight across both surfaces (the shared chain of G5), FIFO, no parallel attempts. The retry of a rating happens before the next rating starts. | FSRS is computed from the row read at save time. Two overlapping saves of the same card both start from the old state, so the later one loses a step. Two first saves of an unseen card both take the insert path, and the second fails on `unique_user_card`. |
| G2. Server-derived local state changes only in the success callback, through functional state updates or refs. It never reads the queue or flags captured when the rating started. | Gates unlock before the row exists. A stale closure overwrites a newer queue, which is the bug the current `[...learningQueue.slice(1)]` would cause once ratings overlap. |
| G3. The queue-end decision runs only once per armed queue end (AC5), when the save queue is drained. It reads `queueKind`, `nextStageAfterFlashcards`, `pendingCompletionRef` and `topicCompletedRef` at that moment. | The completion screen or a stage jump fires before the server reports `newlyCompleted` or the memory unlock, fires on load for an empty initial queue (breaking LF5 landing, `LW:383-386`), or a stale queue end leaks into a new due queue. That would break LF5 AC4 and LF6 AC10. |
| G4. Each pending rating carries the queue generation it belongs to. A failure requeues only into the same generation, and only results of the armed generation feed its queue end. | A failed save from an earlier queue inserts a card into a due or full review it does not belong to. |
| G5. Saves are serialized through one module-level promise chain shared by all instances of the hook; the chain, its pending count and the `beforeunload` listener it drives are the only module state. Ratings already queued keep being sent after the owning component unmounts, but every callback that sets state or shows UI is skipped once it has unmounted. The helper exports a test-only reset, called by the CP1–CP3 test files in `afterEach`, that resets the chain, zeroes the pending count and removes the window listener; tests with a never-resolving or deferred action settle it in cleanup, and retry tests advance fake timers past the retry delay. | Unmount drops queued ratings, or a remounted workspace's first rating of a card overlaps the old instance's in-flight save of the same card (G1 broken across instances), or state is set on an unmounted component, or (without the test reset) a stuck item from one test blocks every later test in the same Vitest file. |

### 1.4 Owner decisions that bind this unit

Owner decisions of 2026-10-16:

- UI-only optimistic advance first; `getClaims` later only if needed.
- A failed save is retried once, then the card is put back in the queue.
- Wait for pending saves before completion or a stage change.
- `beforeunload` warning while saving.
- Apply to both the workspace and ReviewSheet; ReviewSheet's close waits for the saves.

Decision 32 records them. They supersede LF2 Q1 ("optimistic advance: no") and the LF6 AC5 "disabled-while-saving" rule for the rating buttons. LF6 AC5's shared rating classes stay.

## 2. Repository facts

Baseline: `090ddda`, checked 2026-10-16.

- `LearningWorkspace.handleRateCard` (`LearningWorkspace.tsx:491-550`) awaits `submitCardReview` inside `startTransition`. Only after success does it update the sets, the queue and `isFlipped`, and run the queue-end branch. `isPending` only disables the rating buttons (`FlashcardStage.tsx:222`). This justifies AC1 and AC3.
- The queue-end branch reads `pendingCompletionRef` and `topicCompletedRef`, which `announceTopicProgress` sets from the same rating's result (`LearningWorkspace.tsx:501`, `:525-548`). It also reads `queueKind` and `nextStageAfterFlashcards` from the render's closure. This justifies G3.
- `ReviewSheet.handleRate` (`ReviewSheet.tsx:87-116`) blocks with `operation.current`, disables ratings and the back button while saving, and does not advance on failure. `close()` is refused during a rate (`:118-124`). It calls `onReviewComplete` (`router.refresh()`) when the batch empties after a success (`:107`). This justifies AC5, AC6 and AC8.
- `lf2_submit_card_review` inserts without `on conflict` when no row id is passed, and otherwise updates unconditionally (`20261010150000_lf2_learning_action_rpcs.sql:176-185`). The action computes FSRS from a read made before the RPC (`app/actions/review.ts:82-156`). `unique (user_id, card_id)` exists (`remote_schema.sql:1106`). This justifies G1.
- The memory-check write gate requires a `user_flashcards` row for every active card (`20261011120000_lf3_memory_check_cards_seen_gate.sql:13-40`). This justifies AC3: the client must not unlock before the row exists.
- After a card is rated, `isFlipped` becomes false, and the full-width reveal button takes the place of the rating row (`FlashcardStage.tsx:204-232`; `ReviewSheet.tsx:196-199`). This justifies AC7.
- No `beforeunload` handler and no shared save queue exist in `app/`, `components/`, `lib/` or `hooks/`. This justifies the in-scope helper and AC6.
- Next 16.2.6 runs Server Actions through a router FIFO. A navigation discards only the router's state for a pending action; the caller's promise still resolves (`node_modules/next/dist/client/components/app-router-instance.js:144-152`, `server-action-reducer.js:237`, read by review, not by a test). So a rating is lost on navigation only if the client stops sending it, which G5 prevents.
- `FlashcardStage` is also rendered by the public course preview (`PublicCoursePreviewExperience.tsx:28`, `:522-529`), which makes no save. This justifies the preview line in AC7 and the preview tests in CP2.

## 3. Bounded implementation hypotheses

- A small hook, for example `hooks/use-card-review-queue.ts`, owns the FIFO:
  - `enqueue(cardId, rating, generation)`;
  - per-item success and final-failure callbacks;
  - the pending count;
  - one retry with a delay;
  - the `beforeunload` listener;
  - a way to run a callback once drained;
  - a mounted flag that gates callbacks, with sends continuing on a module-level chain (G5);
  - a module-level pending count that drives the `beforeunload` listener (AC6), and a test-only reset.

  It may change shape as long as G1 and G5 hold.
- `LearningWorkspace.handleRateCard`:
  - advances the queue at once with a functional update (Again/Hard push the card back);
  - moves today's success branch into the success callback;
  - moves the queue-end branch into an effect or drained callback that satisfies G3, with an armed-generation ref set by the emptying rating and cleared by `startQueue`, a requeue, or running it;
  - keeps the last successful save result of the armed generation for the AC5 fallback.

  `startTransition` and `isPending` may be removed for ratings.
- `FlashcardStage` gets the reveal guard of AC7, and a saving end state for AC5 (the AC5b status line lives in `LearningWorkspace`, outside the keyed stage div), without changing the flip, focus or progress behaviour of LF6 AC6.
- `ReviewSheet` uses the same hook:
  - `generation` doubles as the queue generation;
  - `batch` updates become functional;
  - the processed count moves with the queue;
  - `dueLeft` moves only on success;
  - close waits for drain, and a final failure cancels a pending close (AC6);
  - the saving state keeps the `stateHeading` ref so the focus effect (`ReviewSheet.tsx:81-85`) has a target.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | The shared save-queue hook, with unit tests for: FIFO order, one in flight, retry once then final failure, success and failure callbacks, drained callback, pending count, and the `beforeunload` listener added and removed. Progress State moves to CP1. | `npx vitest run` on the new test file; `npx tsc --noEmit --incremental false`; `npm run lint`; `npm run docs:check` |
| CP2 | The workspace uses it (AC1–AC7 for the workspace), and the workspace tests are updated and added for AC1–AC7. | `npx vitest run __tests__/components/learning-workspace-presentation.test.tsx __tests__/components/learning-workspace.test.tsx __tests__/components/topic-completion-ui.test.tsx __tests__/components/memory-check-stage.test.tsx __tests__/components/question-navigator.test.tsx __tests__/components/public-course-preview.test.tsx`; tsc; lint |
| CP3 | ReviewSheet uses it (AC1–AC7 for the sheet). `review-sheet.test.tsx` and the dashboard integration test are updated. | `npx vitest run __tests__/components/review-sheet.test.tsx __tests__/components/learn-dashboard-interactions.test.tsx __tests__/components/learn-dashboard.test.tsx`; tsc; lint |
| CP4 | Browser evidence and docs (AC8, AC9): <ul><li>the recovery smoke is rewritten;</li><li>the new fast-rating smoke is added;</li><li>the existing card smokes pass;</li><li>PERF-ACTION-001 and the admin-console docs are updated.</li></ul> | `npm run test:ci`; isolated runtime (`scripts/dev/cloud-isolated-db.sh`, API 45441) running `review-session`, `review-session-recovery`, `learning-topic-completion`, `learning-memory-cards-gate`, `learning-workspace-matrix`, `e2e/d2/public-course-preview.spec.ts` and the new smoke; the AC7 double-tap browser check; `npm run build`; `npm run docs:check` |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A retry after a lost response, when the first attempt did commit, applies the rating twice: one extra FSRS step. | The same happens today when the learner re-clicks after an error. It is accepted for LF8. An idempotency key is a server change and out of scope. |
| An in-app link (sidebar topic, next topic) followed while ratings are pending. | G5 keeps sending queued ratings after unmount, on the shared chain, so they are not dropped and cannot overlap a remounted instance's save of the same card. A failure that settles after unmount is not shown; the card stays unseen or due on the server and comes back on the next visit. No data is corrupted. CP4 reports what the browser actually does. Blocking those links while saving stays out of scope. |
| A persistent failure makes every rating of a card fail and come back, so the queue never ends: an expired session, a card removed from the course (`review.ts:107`, `:122`), no longer enrolled (`:133`), or invalid FSRS data (`:147`). | Each failure is visible: a toast or alert names the card, and nothing is shown as saved. The learner can leave; the server state is unchanged. Telling these errors apart needs a result-type change, which is out of scope. Accepted for LF8. |
| The "Ôn ngay" due queue is built from the local due set, which pending saves have not updated yet. | The window is under about 1 s, and a card shown due again is just rated again. Accepted. |
| The saving end state flashes briefly on fast networks. | Accepted; it is the honest state. The Owner judges it in QA. |

- Rollout runbook: none beyond the normal merge and deploy. There is no migration and no hosted step.
- Stop when:
  - a gate or completion test can only pass by deciding from client state;
  - G1 cannot hold with the Server Action as it is;
  - a smoke shows a lost or doubled rating in the normal path.
- Rollback: revert the PR. Pending ratings are not persisted, so nothing is left to clean up.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
