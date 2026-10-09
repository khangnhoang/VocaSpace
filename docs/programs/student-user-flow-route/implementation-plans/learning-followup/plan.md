# LF1 detail plan — flashcard completion by latest rating and explanation on correct answers

Revision: r4, 2026-10-10. Owner approval: 2026-10-10 (implementation after Codex plan review PASS in round 4; merge and hosted push not granted). Master plan: [plan.md](../../plan.md). Closes `LEARNING-FOLLOWUP-001` in [problems.md](../../problems.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome:
- The flashcard stage of a topic counts as done only when the latest saved rating of every active card is `Ổn` (Good) or `Dễ` (Easy). This matches the client queue, which requeues `Lại` and `Khó`.
- A correct exercise answer in the enrolled workspace shows the authored explanation, as Preview already does.
- Existing learners keep the progress they have.

| ID | Observable result |
| --- | --- |
| AC1 | An enrolled learner who rates every card of a cards-only topic `Lại` or `Khó` gets `isFlashcardCompleted = false` from `d4_sync_topic_progress`. The topic does not complete and no completion toast appears. |
| AC2 | When the latest rating of every active card is Good or Easy, the flashcard stage is done. Together with the memory check (when present) and every required exercise question, the topic completes exactly as in D4. |
| AC3 | A later `Lại`/`Khó` on a card, from the workspace or ReviewSheet, makes `is_flashcard_completed` false again on the next sync. The workspace stage thread then stops showing the flashcard stage as done, in the same session and after reload. `is_topic_completed`, `completed_at` and the memory-check gate are unchanged (D4 G4). |
| AC4 | Every `user_flashcards` row that exists before the migration counts as rated Good until it is rated again. No learner's stored progress changes because of the migration. |
| AC5 | `submitCardReview` saves the submitted rating in the same write as `fsrs_meta`, for both insert and update. |
| AC6 | `submitQuestionAnswer` returns the authored `explanation` on a correct answer when one exists, and no explanation key when it is empty. Incorrect answers keep today's explanation and fallback text. The exercise response area shows that explanation inline. The memory-check UI is unchanged. |
| AC7 | The database rejects a `user_flashcards` insert or upsert without a rating, and any insert or update that would store NULL or a value outside 1–4. It accepts 1–4. An update that does not touch the rating keeps the stored value. |
| AC8 | Preview, the D3 memory-check gate, exercise grading, the D6 ReviewSheet presentation and every RLS boundary keep their current behavior. |

### 1.2 Scope and non-goals

- In scope:
  - one migration that adds the rating column, backfills it and redefines `private.d4_topic_completion_state`;
  - the card-review action write;
  - the workspace's flashcard-done display;
  - the correct-answer explanation in `submitQuestionAnswer`;
  - writer and fixture updates, types, and unit, component and integration tests;
  - documentation: close `LEARNING-FOLLOWUP-001`, refine Decision 14, and open one new problem for the memory-check-gate bypass through the Data API.
- Non-goals:
  - the memory-check UI for a correct explanation;
  - an explanation when revisiting an already-saved correct answer (the learner DTO still omits `explanation`);
  - making learner progress writes server-only, or tightening Data API writes on `user_flashcards`/`user_question_answers` (Owner decision 2026-10-10);
  - any FSRS scheduling change, the Preview contract, the ReviewSheet UI, or re-syncing stored progress rows;
  - running the hosted migration push. It needs its own Owner grant; the runbook in section 5 orders it right after the merge deploy is READY.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. New migration only; never edit `20261002130000`. Keep the function signature, `stable`, `set search_path = ''` and the revoke. | A published migration diverges from hosted history, or the helper becomes callable or unsafe. |
| G2. Backfill existing rows in the same migration, before the new rule reads them. `submitCardReview` always sets the rating. | Learners lose the flashcard stage on their next sync, or new rows count without a rating. |
| G3. Store the rating as `not null`, constrained to 1–4 (ts-fsrs `Rating.Again..Easy`), with no column default. The rule reads only "latest rating is 3 or 4". The legacy backfill is data, not a NULL or default exception. | Unconstrained values, or a default/NULL path that counts a card as recalled when a writer forgot the rating. |
| G4. Return the explanation only for a validated, graded answer of an active question, from the query the action already runs. | A correct-answer path leaks content of questions the learner cannot answer. |
| G5. Topic completion stays sticky. The exercise and memory-check parts of the rule are unchanged, and so is every lock that derives from them. | Learners lose completed topics, a gate opens or closes wrongly, or the D3/D4 parity tests break. |

### 1.4 Owner decisions that bind this unit

- 2026-10-09 (Decision 24 follow-up, `LEARNING-FOLLOWUP-001`): one PR after D8 merges, covering the flashcard rule (option B) and the correct-answer explanation.
- 2026-10-10: a card counts by its **latest** rating being Good or Easy (not "ever"). A later `Lại` in review clears the stage flag while topic completion stays sticky.
- 2026-10-10: every existing `user_flashcards` row counts as recalled (backfilled), so no learner regresses.
- 2026-10-10: the correct-answer explanation is shown in exercises only; the memory-check UI is unchanged.
- 2026-10-10: learner Data API writes stay as they are. L1 already derives correctness and limits writes to enrolled, published, active targets. A direct write therefore gains nothing over the UI, except writing exercise answers before the memory check passes. That bypass is recorded as a new open problem and is not part of this unit.
- To record during CP1: Decision 25 in the master plan, which refines the flashcard part of Decision 14 to these rules.
- Pending before merge (does not block implementation): the Owner accepts the fail-closed rollout window in section 5, or chooses another rollout. The window starts when the merged app serves traffic, so merge waits for this acceptance.

## 2. Repository facts

Baseline: `e847658` (main), checked 2026-10-10.

- `private.d4_topic_completion_state` (`20261002130000_d4_topic_completion.sql:7-86`) sets `flashcards_done` when every active card has any `user_flashcards` row. No later migration redefines it. This is the rule AC1 changes.
- `user_flashcards` has no rating column. FSRS state lives only in `fsrs_meta`, and `state` cannot tell Again from Good on a new card. This justifies the new column (G3).
- `submitCardReview` (`app/actions/review.ts:42-161`) is the only application writer and serves both the workspace and ReviewSheet. It writes `next_review_date`, `fsrs_meta` and `updated_at`, then calls `d4_sync_topic_progress`. This justifies AC3 and AC5.
- The sync recomputes `is_flashcard_completed` on every call and keeps `is_topic_completed`/`completed_at` sticky (`…d4_topic_completion.sql:144-153`). This justifies AC3 and G5.
- `LearningWorkspace.tsx:283` requeues `Rating.Again` and `Rating.Hard`. This justifies the Good/Easy rule.
- `LearningWorkspace.tsx:179-180,280,464` initialises `canSkipToQuiz` from the stored flag, only ever sets it to `true` after a rating, and uses it for the stage thread's done state. This conflicts with AC3 and needs a UI change.
- L1 RLS (`20261008130544_l1_learner_integrity.sql:49-132`) lets the learner insert and update their own `user_flashcards`/`user_question_answers` rows for enrolled, published, active targets, and a trigger derives `is_correct`. A direct `last_rating` write is the same as pressing that rating, so the rating needs no extra boundary (decision 2026-10-10).
- `submitQuestionAnswer` (`app/actions/progress.ts:208-213`) adds `explanation` only when `!isCorrect`. `QuestionResponse.tsx:116,192,324` already renders `phase.explanation` for a correct result. `MemoryCheckStage` has no slot for a correct explanation (non-goal).
- Several writers insert `user_flashcards` rows without a rating: `supabase/seed.sql:1466`, `e2e/support/d2-preview-fixture.ts`, `scripts/e2e/review-session-fixture.mjs` and integration tests. G3 therefore needs fixture updates.
- Integration tests use two runtimes.
  - Most suites read `.env.test.local`, which points at the root DB 45321.
  - `learner-integrity.test.ts` requires the isolated runtime on 45441 with `E2E_SUPABASE_WORKDIR=.e2e-runtime`, and CI runs it as a separate step (`.github/workflows/ci.yml:127-150`).
  - CI starts both runtimes from all migrations.
- Vercel deploys `main` on merge (`implementation-plans/integrity-closeout/plan.md` rollout). This decides when the hosted migration must run relative to the merge.
- `submitCardReview` writes `user_flashcards` before calling the sync and returns the retriable error `Chưa thể đồng bộ tiến độ ôn tập.` without syncing when that write fails (`app/actions/review.ts:139-143`). New code against the old schema therefore fails closed: nothing is written and no progress is synced.

## 3. Bounded implementation hypotheses

- Migration `supabase/migrations/<ts>_lf1_flashcard_latest_rating.sql`:
  - add nullable `last_rating smallint`;
  - backfill every existing row to `3`;
  - `set not null` and add `check (last_rating between 1 and 4)`, with no default;
  - `create or replace` the state function with `and uf.last_rating >= 3` in the flashcard sub-query.
- Every non-action writer of `user_flashcards` sets an explicit rating: `supabase/seed.sql`, `e2e/support/d2-preview-fixture.ts`, `scripts/e2e/review-session-fixture.mjs` and the integration-test inserts found by `rg "user_flashcards"`.
- `app/actions/review.ts`: add `last_rating: parsed.data.rating` to `nextValues`.
- `types/database.ts` `UserFlashcard`: add `last_rating`.
- `LearningWorkspace.tsx`: after a rating, when `topicProgress` is present, set the flashcard-done state from `result.topicProgress.isFlashcardCompleted`, whether it is true or false. The memory-check and exercise locks keep their own sources.
- `app/actions/progress.ts`: return `question.explanation` on a correct answer when it is non-empty. `QuestionResponse` already renders it; touch it only if a test proves it drops the field.
- Tests:
  - `__tests__/integration/topic-completion.test.ts`: Again/Hard-only is not done; Good/Easy is done; a later Again clears the flag while completion and `completed_at` stay sticky.
  - Rating constraint cases (AC7):
    - 1–4 are accepted;
    - an insert or upsert without the rating, an explicit NULL, 0 and 5 are rejected;
    - an update that sets NULL or a value out of range is rejected;
    - an update that does not include the rating succeeds and keeps the stored value;
    - the row is unchanged after a rejection;
    - RLS denied-path cases send a valid rating, so the denial is not a constraint error.
  - `__tests__/actions/review.test.ts`: the rating is written on insert and on update.
  - `__tests__/actions/progress.test.ts`: an explanation on a correct answer, none when it is empty, wrong answers unchanged.
  - A component regression:
    - start with the flashcard stage done and assert that the thread shows it done once the learner has left the flashcard stage;
    - return to flashcards and rate `Lại` (the server returns `isFlashcardCompleted: false`);
    - leave the flashcard stage again and assert that the thread no longer shows flashcards as done. The memory-check and exercise locks follow the Spec unchanged.
    - The test must fail on the pre-fix code. The thread marks the active stage `current` whatever the flag (`LearningWorkspace.tsx:161,464`), so an assertion made while on the flashcard stage proves nothing.
  - The D8 matrix smoke stays green.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Migration, card-review write, writer and fixture updates, types, completion and constraint integration tests, and the workspace stage-done fix. Master Decision 25 is recorded. | Populated upgrade on the root local DB 45321, which already holds learner data, using `npx supabase migration up` (never `db reset` the root DB). Before and after, record `user_flashcards` counts and a `user_topic_progress` snapshot. After the migration, every row has `last_rating = 3`, the counts and progress are unchanged, and `pg_get_functiondef('private.d4_topic_completion_state'::regproc)` shows the new predicate with `search_path=''`. Then run `npm run test:integration -- --exclude __tests__/integration/learner-integrity.test.ts` against root. The fresh-rebuild check uses the isolated runtime. Run `prepareSupabaseWorkdir` and `npx supabase --workdir .e2e-runtime start`. Verify that the workdir, project id and ports (45441/45442) belong to that runtime and not root. Run `npx supabase --workdir .e2e-runtime db reset --local` so every migration and the seed apply from scratch, and confirm that `last_rating` exists there. Then run `learner-integrity.test.ts` with env from that runtime's status, `ALLOW_DB_INTEGRATION_TESTS=true` and `E2E_SUPABASE_WORKDIR=.e2e-runtime`, as the CI step does. Never reset root. Also run `npx supabase db diff --schema public,private` on root (no drift), `npx vitest run __tests__/actions/review.test.ts` with the stage-done component test, `npx tsc --noEmit` and targeted `npx eslint`. |
| CP2 | Correct-answer explanation in `submitQuestionAnswer`, with unit tests | `npx vitest run __tests__/actions/progress.test.ts __tests__/components/question-navigator.test.tsx __tests__/components/learning-workspace-presentation.test.tsx`, then the full `npm run test:run`. |
| CP3 | Docs: `LEARNING-FOLLOWUP-001` resolved, `PROGRESS-001` wording updated, a new open problem for the memory-check-gate bypass through the Data API, and progress State and milestone. Plus E2E. | `npm run docs:check`, then `npm run test:e2e -- e2e/smoke/learning-workspace-matrix.smoke.spec.ts e2e/smoke/review-session.smoke.spec.ts`. Stop and restart the Owner's dev server under the standing permission, and clear `.next` before restarting it. |

Manual QA (Owner, local, after CP3):
- On `d8-matrix-vocabulary`, rate each card `Lại` once; the queue keeps all three. Expect no completion toast and no `Đã hoàn thành` badge, and the stage is still not done after reload.
- Then rate Good/Easy and expect completion.
- Answer an exercise question that has an explanation correctly, and expect the explanation inline.

Before manual QA, reseed the matrix on the root dev DB with `node scripts/e2e/learning-workspace-matrix-cli.mjs seed --allow-dev-db`, then confirm that `d8-matrix-vocabulary` starts not completed for `student@gmail.com`. E2E runs on the isolated runtime and does not prepare the dev DB, and an earlier completion would stay sticky (AC3).

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Learners regress after deploy | Backfill to Good before the rule reads the column (AC4). The populated upgrade in CP1 proves counts and progress are unchanged. |
| The old app and the new schema are incompatible during rollout. With the migration first, the old action's update keeps the backfilled rating 3 after an Again/Hard press, and the sync could then write a wrong topic completion that stays sticky. | Use the fail-closed order instead: merge first, wait for the deployment to be READY, then push the migration at once. Between READY and the push, the new action's write names a column that does not exist yet, so every card review fails with the existing retriable error before any write or sync (repository fact on `review.ts`). No wrong rating and no wrong completion can be stored. The Owner accepts this short window of failed reviews before merge. Never push the migration before the new app serves traffic. |
| A direct Data API write bypasses the memory-check lock for exercise answers | Not changed here (decision 2026-10-10); recorded as a new open problem in CP3. |
| A ReviewSheet `Lại` clears the workspace's flashcard-done display | Intended (AC3); topic completion and gates are unaffected. |

- Rollout runbook, after PR CI is green, after the Owner has accepted the rollout window (1.4), and with a separate Owner grant for the merge and the hosted push:
  1. Merge; Vercel deploys.
  2. When the production deployment is READY, push only this migration to hosted at once.
  3. Verify on hosted that `last_rating` is NOT NULL with the CHECK, that no row is NULL, and that the function definition is the new one.
  4. Verify that one card review succeeds and stores its rating.
- Stop when: the backfill or the rule needs a product choice not recorded in 1.4; any test shows a stored completion regressing; or a hosted step is needed without a grant.
- Rollback: reverting only the app is unsafe while the column is NOT NULL without a default, because old inserts would fail. Rollback needs a follow-up migration that drops NOT NULL on `last_rating` and restores the old function body; the column can stay. After that, backfilled values cannot be told apart from real Good ratings.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
