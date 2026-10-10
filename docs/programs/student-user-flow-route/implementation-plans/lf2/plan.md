# LF2 detail plan — Learning action latency, memory-gate enforcement and production evidence

Revision: r3, 2026-10-10. Owner approval: pending. Master plan: [plan.md](../../plan.md) (Decision 26).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges and its separately authorized hosted steps run, rating a flashcard and answering a question show a lower local server-side action duration and a lower production Server Action POST duration, with measured before/after numbers, the database refuses an exercise answer written while the memory check is not passed, and the open production-evidence gaps of L1 (`LEARNING-INTEGRITY-001`), D2 (`PREVIEW-001`) and D4 are either recorded as observed or left explicitly open with the reason.

| ID | Observable result |
| --- | --- |
| AC1 | Before any latency change, a baseline is recorded for four paths, each identified separately: card rating creating a new `user_flashcards` row, card rating updating an existing row, memory-check answer, exercise answer. Local (isolated runtime, baseline code plus the off-by-default timer): round-trip count, server-side action duration from action entry to return, and per-step durations. Production (current deployed code, no new deployment): the duration of the Server Action POST as seen by the browser (request start to response end, which includes the proxy and network), attributed to a path by its `Next-Action` id, the workspace stage and whether the card had a prior rating. Each record states environment, warm or cold, sample size and median. |
| AC2 | After CP3 and CP4 (the new policy also adds cost), the same four paths are measured with the same method per environment: local server-side median below its local baseline before merge; production POST median below its production baseline after the merge deploy, and meeting the target the Owner accepted at the CP2 gate. Only measured numbers are claimed. |
| AC3 | The latency change keeps every observable result of both actions: the same success/error messages and error codes, the same error precedence (invalid input, auth, unavailable target, enrollment, option, memory gate), the same grading and explanation rule (LF1), the same FSRS record and `last_rating`, the same `topicProgress` payload and the D4 H4 rule that a saved write always returns `success: true` even when a follow-up read fails. Existing action tests pass; a test may change only where it asserted call order, or where it fixed the source of the memory status after a memory answer (AC3a). |
| AC3a | After a memory answer is saved: when the RPC succeeds with a valid shape, its `is_memory_check_passed` is the returned status and no separate memory read runs; when the RPC fails or its shape is invalid, the separate memory read supplies the status; when that read also fails, the status is omitted. In every case the response is `success: true` with grading and explanation unchanged, and `progressError` is present whenever `topicProgress` is absent. Tests that asserted the old source (`__tests__/actions/progress.test.ts` around lines 108, 373 and 400) are moved to these branches. |
| AC4 | An authenticated learner who writes `user_question_answers` through the Data API for a question of an `exercise`-stage exercise — direct INSERT, direct UPDATE of an existing answer, and upsert on both the insert and the conflict branch — is refused while the topic's memory check is not passed, and allowed once it is passed. Memory-check questions stay answerable at any time. A topic with no active memory-check question does not block exercise answers. After a wrong memory answer relocks the topic, a new write to an existing exercise answer is refused, and the existing answer stays readable. The SQL gate and the action gate agree on the same state, including after an answer-key change or an added memory question. |
| AC5 | `submitQuestionAnswer` returns `MEMORY_CHECK_REQUIRED` with its current message for a locked exercise answer, both when its own pre-check sees the lock and when the database refuses the write because the gate closed after the pre-check (re-read confirms the lock). Any other write failure keeps the current generic save error. The learner never sees a raw database error. |
| AC6 | On hosted, after separately authorized rollout: applied L1 constraints, policies and grants and the new memory-gate policy and helper (owner, `SECURITY DEFINER`, `search_path`, grants) are listed by read-only catalog queries and match the migrations; allowed/denied learner writes are recorded by the rolled-back smoke if the Owner grants it at rollout time, otherwise recorded as not run and `LEARNING-INTEGRITY-001` stays open. |
| AC7 | D4 on production: the Owner, as an enrolled learner, starts on a free TOEIC course topic whose `user_topic_progress` is not completed (read-only check first), completes flashcards with Good/Easy, the memory check and the exercises, and the topic shows as completed; a read-only readback shows the transition from not completed to completed with a `completed_at` from the session. If no such topic exists for that account, AC7 stays pending; progress is never reset and no content is created. |
| AC8 | `PREVIEW-001`: if the Owner has made a standing Preview topic on production, a guest Preview journey, the no-persistence boundary and the denied path are recorded; otherwise the entry stays open with that reason. |
| AC9 | Program docs are reconciled: Decision 26 and the LF2 row exist, State is current, and `problems.md` entries are updated or shrunk only when their exit condition is actually met. |

### 1.2 Scope and non-goals

- In scope: measurement and reduction of server-side work in `submitCardReview` and `submitQuestionAnswer`; a migration adding the memory-check gate to the answer write policies, with integration tests and adjustment of existing tests that relied on the bypass; read-only hosted verification; Owner-run production learner QA; program docs.
- Non-goals: optimistic UI (Decision 26 Q1); replacing `auth.getUser()` in the actions or the proxy; changes to grading, FSRS, D4 completion rules or LF1 semantics; backfilling, grandfathering or deleting historical answers; moving `user_flashcards` writes off the Data API; Preview, dashboard, review-sheet or page-load performance; creating production content, markers or progress resets; `STUDENT-003`, `QUALITY-001`, `MEMORY-001`, D5, D9.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Measure before changing, with the same path identification, timer boundaries, environment and warm/cold state before and after. | A gain is claimed from a different path, environment or cold start. |
| G2. Keep `auth.getUser()` as the action's identity check. | `getClaims` with asymmetric keys only checks signature and expiry, so a revoked session or deleted user could keep writing until the token expires. |
| G3. The SQL gate reuses the existing memory definition (`private.d3_active_memory_questions` and the current-correct-option rule of `private.d4_topic_completion_state`); no second definition. | Database and action/workspace gates disagree and lock or unlock the wrong learners. |
| G4. The gate helper is `SECURITY DEFINER`, `set search_path = ''`, schema-qualified, takes the actor from `auth.uid()` (no caller-supplied user id), revokes `PUBLIC` and `anon`, and grants execute only to `authenticated`. | The D3/D4 helpers are revoked from `authenticated`, so an invoker wrapper fails; a caller-supplied user id or broad grant would let anyone probe other learners' gate state. |
| G5. The gate is added with `AND` inside the existing L1 `User_answers - Auth Insert` and `Auth Update` `WITH CHECK`; L1 `USING` and the self/target/option conditions stay unchanged; no new permissive policy. | A separate permissive policy is OR-ed with L1 and silently reopens the bypass, or historical SELECT breaks. |
| G6. Integration tests run only on the isolated loopback runtime; never reset root 45321 or hosted. | Owner's local data or production data is destroyed. |
| G7. Hosted rollout steps run only after the merge deploy is READY and under their own grant; hosted SQL is read-only except the rolled-back smoke when granted. The production baseline in CP2 is observation of the currently deployed app through the Owner's own learning and needs no deployment or hosted write beyond that learning. | A fail-closed window or an unauthorized production mutation. |
| G8. Timing instrumentation is off by default behind an env flag, logs durations and path labels only, and is removed or left disabled before merge. | User ids, answers or tokens in production logs. |

### 1.4 Owner decisions that bind this unit

- Decision 26 (2026-10-10): group the learning-action latency follow-up, `MEMORY-002`, the hosted `LEARNING-INTEGRITY-001` evidence, `PREVIEW-001` and D4 production QA into one PR from pulled `main`. The Owner accepted all four defaults below on 2026-10-10:
  - Q1. Optimistic advance in the UI? Accepted: no; reduce server work first and decide after AC2 numbers.
  - Q2. Hosted allowed/denied smoke as the `authenticated` role inside `BEGIN … ROLLBACK` on production? Accepted: allowed only with an explicit grant at rollout time; without it, AC6 records catalog evidence only and `LEARNING-INTEGRITY-001` stays open.
  - Q3. Does the Owner mark a standing Preview topic on the free course? Accepted: the Owner decides as a product choice; LF2 never creates one.
  - Q4. Latency target? Accepted: no fixed number before the baseline; the Owner sets or accepts a target at the gate after CP2.

## 2. Repository facts

Baseline: `86b5c8e`, checked 2026-10-10.

- `submitQuestionAnswer` (`app/actions/progress.ts`) awaits in sequence: `auth.getUser()`, the question context query, `hasLearningEnrollment`, `loadMemoryCheck` (exercise answers only), the answer upsert, a second `loadMemoryCheck` (memory answers only, before the sync), then the `d4_sync_topic_progress` RPC. A failed upsert returns the generic save error. Justifies AC1–AC3 and AC5.
- `submitCardReview` (`app/actions/review.ts`) awaits in sequence: `auth.getUser()`, the card context query, `hasLearningEnrollment`, the FSRS insert or update, then the RPC. Justifies AC1.
- `proxy.ts` runs `updateSession` on every non-static request and calls `auth.getUser()`, so a Server Action POST verifies the user in the proxy and again in the action; the proxy does not deny `/learn` when the user is missing. Justifies AC1 (user-observed time) and G2.
- `@supabase/auth-js` `getClaims` verifies signature and expiry locally for asymmetric keys and falls back to `getUser` for symmetric keys. Justifies G2.
- The workspace waits for the action result before advancing the card (`LearningWorkspace.tsx` `handleRateCard`). Justifies Q1.
- Production runs in Vercel region `sin1` (deployment `dpl_AZVNR3uEnPVWQh4ioqmjUT1S9d94` at `86b5c8e`) and Supabase in `ap-southeast-1`; region mismatch is not the cause. Justifies focusing AC2 on round trips.
- L1 answer policies (migration `20261008130544`) check self, `private.l1_can_write_learning_target` and option ownership, not the memory gate. `private.d4_topic_completion_state` (latest in `20261010090000`) computes `memory_check_done`; it and `private.d3_active_memory_questions` are revoked from `authenticated`. Justifies AC4, G3 and G4.
- `__tests__/integration/topic-completion.test.ts` (around line 296) saves a wrong memory answer and then writes an exercise answer directly as the learner; the new policy refuses that setup. `memory-check-learner-gate.test.ts` (around line 265) and `topic-completion.test.ts` (around line 379) show that exercise answers with a currently false memory check and sticky completion are valid history. Justifies CP4 test adjustment and the rollout aggregate rule.

## 3. Bounded implementation hypotheses

- Timing: locally, a server-side timer around the whole action and each awaited step, enabled by an env flag and labelled by path; on production, browser network timing of the action POST (DevTools export or a Performance API snippet in the Owner's session). Any equivalent method is fine if G1 and G8 hold and it needs no new deployment before merge.
- Run independent reads in parallel (enrollment with the memory-check read, or with the context query), while resolving results in the AC3 error precedence.
- AC3a is implemented by reading `isMemoryCheckPassed` from the existing `syncTopicProgress` DTO (`is_memory_check_passed` in the raw RPC payload) and moving the current separate read into the failure branch.
- On an upsert refusal for an exercise answer, re-read the gate; return `MEMORY_CHECK_REQUIRED` only when the re-read confirms the lock, otherwise the generic error.
- If those are not enough, one learner-write RPC that validates, writes and syncs in a single round trip; that needs a plan correction before use.
- MEMORY-002 helper: a `private` function (name free) answering "is this question's gate open for `auth.uid()`": true for `memory_check` questions and when `memory_check_done` is true for the question's topic. CP4 checks that insert and upsert with `.select().single()` hit no permission or recursion error.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Docs: Decision 26, LF2 unit row, State, this plan linked. | `npm run docs:check`. |
| CP2 | Baseline recorded (AC1) for the four paths, locally and on production. **Gate:** the Owner accepts a target per path (Q4) before CP3 starts. | Local timer output; production POST timings from the Owner's own learning on the free course on the current deployment, with method, warm/cold, sample size and median. |
| CP3 | Latency change (AC3). | `npm run test:run` (action and workspace suites, including new RPC-failure pass/relock cases), `npx tsc --noEmit`, scoped ESLint; local re-measurement. |
| CP4 | MEMORY-002 migration with down script, action race handling and tests (AC4, AC5). | `npm run test:integration` on the isolated runtime: new matrix (direct INSERT/UPDATE, upsert insert and conflict branch, unlock, no-memory topic, relock on an existing answer, answer-key change, added memory question, historical read, SQL/action/D4 parity, controlled race for AC5); existing D3, D4, L1, LF1 suites pass, with the D4 setup that relied on the bypass rewritten to reach the same state through allowed writes or an explicit privileged fixture while keeping its completion assertions; isolated reset rebuild. |
| CP5 | Local closeout: AC2 local re-measurement after CP3+CP4; cumulative self-review; browser smoke. Fixture readiness: ready — `e2e/smoke/learning-workspace.smoke.spec.ts` and `learning-workspace-matrix.smoke.spec.ts` with `scripts/e2e/learning-workspace-matrix-fixture.mjs` on the isolated runtime. | `npm run test:e2e -- e2e/smoke/learning-workspace.smoke.spec.ts e2e/smoke/learning-workspace-matrix.smoke.spec.ts`; review report. |
| CP6 | Hosted, after merge and separate grants (AC2 production, AC6–AC8), then problems and State reconciled. | Migration list, read-only aggregate and catalog queries, rolled-back smoke if granted, Owner D4 journey with before/after read-only readback, Preview journey if a standing topic exists, production after-numbers; `npm run docs:check`. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Parallel reads change which error the learner sees first. | Resolve in the AC3 precedence and cover it with tests. |
| SQL gate and action gate disagree on the same state. | G3; parity tests in CP4; before rollout a read-only check on hosted that compares both definitions on existing learner/topic pairs. Exercise answers with a false memory check are counted as history, not as breakage. |
| The policy is OR-ed with L1 or breaks historical reads. | G5; historical read case in CP4. |
| Window between migration and deploy. | The policy only refuses what the action already refuses; still push the migration after the merge deploy is READY (G7). |
| Production timing is noisy at low traffic. | G1; record sample size and median. |

- Rollout runbook (each step needs its own grant): merge; wait for production deployment READY; read-only history aggregate and gate-parity check; push the LF2 migration; read-only catalog verification (AC6); rolled-back smoke if granted; Owner D4 journey with before/after readback (AC7); Preview checks if a standing topic exists (AC8); production after-numbers (AC2).
- Stop when: the baseline shows no meaningful server-side cost to remove; the Owner has not accepted a target at the CP2 gate; the parity check finds a state where the SQL gate and the current action gate differ; a hosted step lacks its grant; a review finding needs a new Owner decision. Historical exercise answers with a currently false memory check are not a stop reason; any exception for them needs its own Owner decision.
- Rollback: revert the action change by commit; the migration's down script restores the L1 policy definitions and drops the helper. Writes refused during the window are not replayed; the learner retries.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
