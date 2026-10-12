# LF4 detail plan — Resumable flashcard queue, memory-check toast, isolated psql helper and LF3 closeout

Revision: r3, 2026-10-12 (r1 and r2 Codex review FAIL, corrected here). Owner approval: r3 approved 2026-10-12 after Codex plan review PASS (round 4). Master plan: [plan.md](../../plan.md) (Decision 28).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges, opening or reloading a topic no longer restarts the flashcards from the first card. The learner continues with the cards they have not seen yet, or, when every card has been seen, lands on the finished screen. That screen offers the cards that are due or still need `Ổn`/`Dễ`, and a full review. Passing the memory check shows a success toast. The two integration suites that use `runLocalPsql` send their SQL to the database of the runtime they target. The program docs record the finished LF3 rollout.

| ID | Observable result |
| --- | --- |
| AC1 | A learner answers the last required memory-check question, and the answer result reports the memory check as passed. If the workspace had not yet counted the memory check as passed, a success toast `Đã hoàn thành memory check!` is shown once. It is not shown when the page loads with the memory check already passed, or for later answers after the pass. If the same answer result also reports `topicProgress.newlyCompleted`, only the topic completion toast (`TOPIC_COMPLETED_MESSAGE`) is shown (§1.4 Q1). The decision uses that answer result's own `newlyCompleted` value, passed to the workspace callback. It is not inferred from state updated in the same tick or from `onPassed`. |
| AC2 | The same single-toast rule applies to the flashcard path. The final rating of the queue reports `topicProgress.newlyCompleted`, and the next stage is the memory check or exercises. In that case only the topic completion toast is shown, not the `Đã nạp xong từ vựng! …` toast. Other flashcard toasts are unchanged. |
| AC3 | When the topic page loads (first visit, F5, or the reload after `cards_locked`) and the learner has unseen cards (no own `user_flashcards` row), the flashcard queue contains only those cards, in authored card order. If the learner has already seen at least one card of the topic, the toast `Bạn còn N thẻ chưa học trong bài học này` is shown once on load. N is the number of unseen cards. No toast is shown on a first visit where every card is unseen (§1.4 Q2). `Lại`/`Khó` ratings keep re-queuing the card inside the session as today. |
| AC4 | For a topic with at least one active card: when the topic page loads and the learner has no unseen card, the queue starts empty, so whenever the flashcard stage is shown it is the finished screen `Bạn đã ôn xong từ vựng`, not a full queue. The flashcard stage is shown either as the initial stage or when the learner returns through an existing `Về Từ vựng` button (`LearningWorkspace.tsx:717`, `:873`) or the `CARDS_REQUIRED` recovery. The stage thread stays a non-interactive status display. The initial-stage choice (`LearningWorkspace.tsx:175`) and the automatic move to the memory check or exercises when an in-session queue runs out stay as they are. When N > 0 due cards exist (AC5), the finished screen shows `Bạn có N thẻ đến hạn thuộc bài học này` and the button `Ôn ngay N thẻ`. The button starts a queue of exactly those cards, in authored order. `Ôn lại từ vựng` still starts a queue of every active card. The finished screen shows the same due offer when the learner returns to the flashcard stage after an in-session queue ran out. Topics without active cards keep their current behaviour. |
| AC5 | A due card is an active card that has an own `user_flashcards` row and either has `next_review_date` at or before the loader's current time or does not have `last_rating >= 3` (§1.4 Q3). Only rows with `user_id` equal to the learner count (as in LF3). The loader returns `dueCardIds`, and the workspace page key includes them. A card the learner rates `Ổn`/`Dễ` in the session leaves the due set shown on the finished screen. |
| AC6 | After `cards_locked` (a teacher added a card after the page loaded), the learner returns to the flashcards. The rebuilt queue contains only the new unseen card or cards, and the AC3 toast is shown. After rating them, the memory check opens as in LF3. |
| AC7 | No database object, migration, RPC or policy changes. The LF1 flashcard-done rule, the LF3 cards-seen gate, the LF2 memory gate, D4 completion, FSRS scheduling, the stage thread, the hints and `CARDS_REQUIRED` recovery behave as before, apart from the queue start and the toasts above. |
| AC8 | `runLocalPsql` derives its database port from `NEXT_PUBLIC_SUPABASE_URL` with the same mapping as `local-postgres-coordination.ts`: API 45321 maps to DB 45322 and API 45441 maps to DB 45442. One shared helper owns the mapping. Any other host, protocol or port throws before `psql` runs. `a5-learner-deletion` and `a5-profile-gender-values` pass on the isolated runtime (45441) without temporary copies, and no SQL from them reaches 45322 in that run. The CI main step (root runtime) still runs them unchanged. |
| AC9 | The program docs record the LF3 rollout as milestones, with the details below. The LF3 evidence in State is shrunk to those milestones, and State describes LF4. Decision 28 and the LF4 unit row exist in the master plan. `LEARNING-INTEGRITY-001` and `PERF-RLS-001` are shrunk to one resolved line each (§1.4 Q4). `npm run docs:check` passes. The milestones cover: <ul><li>PR 147 merged (`ad224f1`) and the production deploy READY;</li><li>the three LF3 hosted migrations;</li><li>hosted catalog fingerprints 35/35 identical to local;</li><li>the hosted `question_options` `EXPLAIN` with no scan of `topics`;</li><li>L1 catalog 23/23 identical with every FK validated;</li><li>the rolled-back L1 allow/deny smoke 12/12 with 0 leftover rows;</li><li>the Owner production measurement: `responseEnd - requestStart` median 651 ms (n = 10) against 1418 ms, `responseStart` unchanged at 57 ms, and the first after-run discarded because of a slow-network intervention and a negative value;</li><li>the Owner learner journey (LF3 AC4, AC6, AC7, AC8 and AC10 passed, with the missing memory-check toast moved here).</li></ul> |

### 1.2 Scope and non-goals

- In scope:
  - the loader field `dueCardIds`, its schema and the page key;
  - the workspace queue start, the finished screen due offer and the three toast rules (AC1, AC2, AC3);
  - the shared local database port helper used by `runLocalPsql` and `local-postgres-coordination.ts`;
  - LF3 closeout docs;
  - updating the tests that assume a full queue on load.
- Non-goals:
  - changing which cards count as seen, done or due anywhere else (dashboard `ReviewSheet`, `lib/learn-dashboard.ts`);
  - persisting the in-session queue;
  - FSRS parameters;
  - any database change or hosted step;
  - fixing other hard-coded `45321` checks (`app/actions/public-course-preview.ts`, `lib/schemas/exercise.ts`, scripts), which are reported and not changed;
  - `PERF-ACTION-001`, `QUALITY-001`, Mailpit on the isolated runtime.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `dueCardIds` is computed from the rows that the existing topic request already embeds. That request adds `next_review_date` to the `ratings:user_flashcards` embed and keeps the `user_id` filter from `summarizeOwnCardProgress`. No new query, table or RPC is added. | An admin learner sees other learners' due state, or the page gains a round trip that LF3 removed. |
| G2. The memory-check toast fires only on the client transition from not passed to passed, driven by the answer result. It never fires from load data. | The toast repeats on every reload or every later answer. |
| G3. Restart (`Ôn lại từ vựng`) and the due offer only replace the in-memory queue. They call no server action, and the LF1/LF3 flags still come only from server results. | The UI marks the stage done or opens the memory check without server truth. |
| G4. The implementor's local integration and browser runs use the isolated runtime (API 45441, DB 45442). Root 45321/45322 and hosted are never reset or written by these runs. The CI main step keeps running the a5 suites against the CI job's own disposable root runtime; this exception is only for CI. The new port helper throws on any unknown target instead of falling back to 45322. | A local test run changes the Owner's root database, as the LF3 full-directory run did. |
| G5. Docs closeout records only the evidence listed in AC9, which was observed in the LF3 session. It invents no new hosted observation. | The State claims rollout evidence that does not exist. |

### 1.4 Owner decisions that bind this unit

- Decision 28 (master plan, 2026-10-12) opens LF4 as one PR from `main`.
- Q1 (2026-10-12): the memory-check pass shows a success toast. When the same result completes the topic, only the topic toast is shown.
- Q2 (2026-10-12): a reload does not restart the full queue. Unseen cards come first, with a `còn N thẻ chưa học` toast. When nothing is unseen, the learner lands on the finished screen, which has a review button. Owner confirmed 2026-10-12: no unseen-cards toast on a first visit where every card is unseen.
- Q3 (2026-10-12): due counts both FSRS-due cards and seen cards whose latest rating is not `Ổn`/`Dễ`. The offer sits on the finished screen, not in a toast.
- Q4 (2026-10-12): close `PERF-RLS-001` on the current evidence: hosted `EXPLAIN`, the read-boundary suites, the production page measurement, and action reads measured locally only. `LEARNING-INTEGRITY-001` closes with the hosted catalog and the rolled-back smoke.

## 2. Repository facts

Baseline: `ad224f1`, checked 2026-10-12.

- `LearningWorkspace.tsx:234-235` initializes `learningQueue` with every active card, and `restartFlashcards` (`:304`) resets it to every card. `page.tsx:41-46` keys the workspace on card ids, `unseenCardIds` and `unratedCardIds`, so a reload or `router.refresh()` that changes them remounts the workspace on a full queue. This justifies AC3, AC4 and AC6.
- `lib/card-progress.ts:25-34` derives `unseenCardIds` and `unratedCardIds` from rows with `user_id === userId`. The loader embeds `ratings:user_flashcards (user_id, last_rating)` (`app/actions/learning-workspace.ts:499`). `user_flashcards.next_review_date` exists and is written on every rating (`app/actions/review.ts:153`). This justifies AC5 and G1.
- `lib/learn-dashboard.ts:253-254` already treats a card as due when `next_review_date <= now`. This justifies the AC5 FSRS half.
- `LearningWorkspace.tsx:742` handles `onMemoryPassed` with `setMemoryPassed(true)` only. No toast fires on a memory pass. `MemoryCheckStage.tsx:197-205` calls `announceTopicProgress` before `onMemoryPassed`. This justifies AC1 and G2.
- `LearningWorkspace.tsx:343-348` fires `Đã nạp xong từ vựng! Chuyển sang …` without checking `newlyCompleted`. Only the last branch (`:349`) checks it. This justifies AC2.
- The finished screen `Bạn đã ôn xong từ vựng` with `Ôn lại từ vựng` already renders when the queue is empty (`LearningWorkspace.tsx:770-784`). This justifies AC4.
- `__tests__/integration/helpers/local-psql.ts:3` hard-codes `DATABASE_PORT = "45322"`. `helpers/local-postgres-coordination.ts:5-9` maps 45321→45322 and 45441→45442 and rejects other targets. Only `a5-learner-deletion` and `a5-profile-gender-values` import `runLocalPsql`. In CI they run in the main step on the root runtime (`.github/workflows/ci.yml:127-129`). This justifies AC8.
- At `ad224f1`, `progress.md` State still describes LF3 before push, and its Hosted state names `20261010150000` as the latest migration. `problems.md` keeps `LEARNING-INTEGRITY-001` and `PERF-RLS-001` open. The LF3 rollout evidence that meets their exit conditions is not in the repository. It comes from the LF3 rollout session (hosted read-only checks and the rolled-back smoke under Owner grants) and the Owner's production runs, and the closeout records it for the first time. This justifies AC9 and G5.

## 3. Bounded implementation hypotheses

- `lib/card-progress.ts` gains `dueCardIds` next to the two existing sets (same loop, a `now` parameter for tests). It may change if G1 holds and the LF3 parity suite stays green.
- `lib/schemas/learning-workspace.ts` adds `dueCardIds: z.array(z.uuid())`, and `page.tsx` adds it to `workspaceKey`.
- `LearningWorkspace.tsx`:
  - the initial queue becomes the unseen cards;
  - a `dueCardIds` state is shrunk on an `Ổn`/`Dễ` rating;
  - the finished screen gains the due offer;
  - an on-mount toast for unseen cards;
  - `onMemoryPassed` shows the toast unless the result already announced topic completion. This may need a `newlyCompleted` argument from `MemoryCheckStage`.
- The `FlashcardStage` counter keeps `totalCards` as every active card unless the component tests show a misleading count. Any change here is a presentational choice inside the frontend skills.
- A new helper (for example `__tests__/integration/helpers/local-database-port.ts`) exports the mapping, and both helpers import it.
- Tests to change or add:
  - `__tests__/components/learning-workspace-presentation.test.tsx` (queue start, finished screen, due offer, toasts);
  - `topic-completion-ui.test.tsx` (single toast for AC1 and AC2);
  - `memory-check-stage.test.tsx`;
  - `__tests__/actions/learning-workspace.test.ts` (due derivation, own rows only, the time boundary);
  - `e2e/smoke/learning-memory-cards-gate.smoke.spec.ts` (AC6: only the new card after relock);
  - a unit test of the port helper.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | LF3 closeout docs (AC9) and LF4 State, prepared by Main with the plan. After Owner approval and an explicit Owner grant to commit these docs, Main makes two docs commits: first the LF3 closeout (its milestone cites `(this commit)`), then the LF4 plan, Decision 28, the unit row and State (the closeout milestone gets the first commit's hash, and an `LF4 planned` milestone cites `(this commit)`). The implementor only keeps State current. | `npm run docs:check` after each commit; reread the closeout milestone and the two resolved problem lines against AC9 |
| CP2 | Shared port helper; `runLocalPsql` follows the target runtime (AC8) | port-helper unit test: 45321 and 45441 map correctly; an unknown port, a non-loopback host, a non-`http:` protocol and a malformed URL each throw, and with `spawnSync` mocked the test shows that `psql` is never called for a rejected target. `npm run test:integration` on 45441 for the two a5 suites with no copies. `rg -n '45322' __tests__/integration` shows only the mapping. |
| CP3 | Loader `dueCardIds`, schema and page key (AC5, G1) | action and lib tests: own rows only, `next_review_date` before, equal to and after now, `last_rating` < 3, an unseen card is never due; `lf3-memory-check-cards-seen-gate` suite still green on 45441 |
| CP4 | Workspace queue start, finished-screen due offer and toasts (AC1–AC4, AC6, AC7) | Component tests that fail on the baseline: queue start with unseen cards, the finished screen with and without the due offer, `Ôn ngay` and `Ôn lại` queues, the three toast rules, and unchanged LF3 gate, hint, stage thread and `CARDS_REQUIRED` recovery. A topic without cards is unchanged, and so is Preview if it shares `FlashcardStage`. Browser smoke at 375 and 1280 px, port 3100, against 45441, extending `learning-memory-cards-gate.smoke.spec.ts` and its existing fixture: (a) rate part of the cards, reload, and only the unseen cards are queued, with the toast; (b) rate every card with at least one `Lại`, reload, and the finished screen offers that card as due, `Ôn ngay` queues only it, and `Ôn lại` queues every card; (c) after a relock, only the new card is queued. The FSRS date half of AC5 is covered at the action layer, not in the browser. The existing learning-workspace smoke specs are run too. |
| CP5 | Full local verification and self-review | `npm run test:ci`; CI isolated-step suites plus the main integration directory on 45441 (Mailpit suites recorded as not run); `tsc --noEmit`; ESLint on changed files; `npm run docs:check`; `git diff --check` |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A learner who expects a full review on F5 now sees the finished screen | `Ôn lại từ vựng` stays on that screen, and the due offer names the count (Owner Q2) |
| The due time comes from the server clock at load, so a long-open page shows a stale count | Acceptable: the count refreshes on the next load. The key includes `dueCardIds` |
| Existing specs assume a full queue on load | Update them in CP4. Each changed assertion must reflect the new spec, not a weaker check |
| Port helper drift between the two helpers | One shared module owns the mapping (AC8) |

- Rollout runbook: merge after CI, then the production deploy. There is no migration or hosted step. The Owner runs a short production journey: F5 mid-topic, the finished screen, the memory-check toast.
- Stop when: the due set needs data the existing embed cannot provide without a new query, or a change would touch a database object, the LF1/LF3 gates or completion. In either case, report to the Owner.
- Rollback: revert the PR. No data or schema change.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
