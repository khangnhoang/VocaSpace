# LF2 detail plan — Learning action latency, memory-gate enforcement and production evidence

Revision: r4, 2026-10-10 (plan correction after the CP2 gate, based on the production baseline, preview per-step timing, hosted `EXPLAIN` and the Owner target). r3 was Owner-approved on 2026-10-10; r4 was Owner-approved on 2026-10-10 with Q5 (a) and Q6 accepted. Master plan: [plan.md](../../plan.md) (Decision 26).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after this unit merges and its separately authorized hosted steps run, rating a flashcard and answering a question show a lower local server-side action duration and a lower production Server Action POST duration, with measured before/after numbers, the database refuses an exercise answer written while the memory check is not passed, and the open production-evidence gaps of L1 (`LEARNING-INTEGRITY-001`), D2 (`PREVIEW-001`) and D4 are either recorded as observed or left explicitly open with the reason.

| ID | Observable result |
| --- | --- |
| AC1 | Before any latency change, a baseline is recorded for four paths, each identified separately: card rating creating a new `user_flashcards` row, card rating updating an existing row, memory-check answer, exercise answer. Local (isolated runtime, baseline code plus the off-by-default timer): round-trip count, server-side action duration from action entry to return, and per-step durations. Production (current deployed code, no new deployment): the duration of the Server Action POST as seen by the browser (request start to response end, which includes the proxy and network), attributed to a path by its `Next-Action` id, the workspace stage and whether the card had a prior rating. Each record states environment, warm or cold, sample size and median. |
| AC2 | After CP3 and CP4 (the new policy also adds cost), the same four paths are measured with the same method per environment: local server-side median below its local baseline before merge; production POST median below its production baseline after the merge deploy, and compared with the target the Owner accepted at the CP2 gate (§1.4 Q4): card rating ≤ 300 ms, memory and exercise answers ≤ 500 ms, as production POST median per path. A missed target does not block acceptance (Owner decision Q5 (a), §1.4); it is reported with numbers. Only measured numbers are claimed. |
| AC3 | The latency change keeps every observable result of both actions: the same success/error messages and error codes, the same error precedence (invalid input, auth, unavailable target, enrollment, option, memory gate), the same grading and explanation rule (LF1), the same FSRS record and `last_rating`, the same `topicProgress` payload and the D4 H4 rule that a saved write always returns `success: true` even when a follow-up read fails. Existing action tests pass. A test may change only where it asserted call order, asserted a Data API call that §3 replaces with an RPC, or fixed the source of the memory status after a memory answer (AC3a). One accepted narrowing: on the question path, a database or transport failure of the single RPC returns the generic save error `Không thể lưu câu trả lời lúc này.`. Today a failed context read returns `Không thể kiểm tra câu hỏi lúc này.` instead; both are generic, non-actionable messages. |
| AC3a | After a memory answer is saved, the memory status comes from the answer RPC's progress sync (`is_memory_check_passed`). When that sync fails inside the RPC, the RPC derives the status from the same memory definition in its own subtransaction. When that also fails, or the returned shape is invalid, the status is omitted. In every case the response is `success: true` with grading and explanation unchanged, and `progressError` is present whenever `topicProgress` is absent. Tests that asserted the old source (`__tests__/actions/progress.test.ts` around lines 108, 373 and 400) are moved to these branches. |
| AC4 | An authenticated learner who writes `user_question_answers` through the Data API for a question of an `exercise`-stage exercise — direct INSERT, direct UPDATE of an existing answer, and upsert on both the insert and the conflict branch — is refused while the topic's memory check is not passed, and allowed once it is passed. Memory-check questions stay answerable at any time. A topic with no active memory-check question does not block exercise answers. After a wrong memory answer relocks the topic, a new write to an existing exercise answer is refused, and the existing answer stays readable. The SQL gate and the action gate agree on the same state, including after an answer-key change or an added memory question. |
| AC5 | `submitQuestionAnswer` returns `MEMORY_CHECK_REQUIRED` with its current message for a locked exercise answer, when the answer RPC's gate check sees the lock, evaluated in the same transaction as the write. Any other write failure keeps the current generic save error. The learner never sees a raw database error. |
| AC6 | On hosted, after separately authorized rollout: applied L1 constraints, policies and grants and the new memory-gate policy and helper (owner, `SECURITY DEFINER`, `search_path`, grants) are listed by read-only catalog queries and match the migrations; allowed/denied learner writes are recorded by the rolled-back smoke if the Owner grants it at rollout time, otherwise recorded as not run and `LEARNING-INTEGRITY-001` stays open. |
| AC7 | D4 on production: the Owner, as an enrolled learner, starts on a free TOEIC course topic whose `user_topic_progress` is not completed (read-only check first), completes flashcards with Good/Easy, the memory check and the exercises, and the topic shows as completed; a read-only readback shows the transition from not completed to completed with a `completed_at` from the session. If no such topic exists for that account, AC7 stays pending; progress is never reset and no content is created. |
| AC8 | `PREVIEW-001`: if the Owner has made a standing Preview topic on production, a guest Preview journey, the no-persistence boundary and the denied path are recorded; otherwise the entry stays open with that reason. |
| AC9 | Program docs are reconciled: Decision 26 and the LF2 row exist, State is current, and `problems.md` entries are updated or shrunk only when their exit condition is actually met. |

### 1.2 Scope and non-goals

- In scope: measurement and reduction of server-side work in `submitCardReview` and `submitQuestionAnswer`; a migration adding the memory-check gate to the answer write policies, with integration tests and adjustment of existing tests that relied on the bypass; read-only hosted verification; Owner-run production learner QA; program docs.
- Non-goals: optimistic UI (Decision 26 Q1); replacing or skipping `auth.getUser()` in the actions or the proxy; changing the content read policies (`questions`, `question_options`, `exercises`, `topics`) or `private.q7_can_read_topic`, whose cost also slows page loads (recorded as a follow-up in `problems.md`); changes to grading, FSRS, D4 completion rules or LF1 semantics; backfilling, grandfathering or deleting historical answers; moving `user_flashcards` writes off the Data API; Preview, dashboard, review-sheet or page-load performance; creating production content, markers or progress resets; `STUDENT-003`, `QUALITY-001`, `MEMORY-001`, D5, D9.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Measure before changing, with the same path identification, timer boundaries, environment and warm/cold state before and after. | A gain is claimed from a different path, environment or cold start. |
| G2. Keep `auth.getUser()` as the action's identity check. | `getClaims` with asymmetric keys only checks signature and expiry, so a revoked session or deleted user could keep writing until the token expires. |
| G3. The SQL gate reuses the existing memory definition (`private.d3_active_memory_questions` and the current-correct-option rule of `private.d4_topic_completion_state`); no second definition. | Database and action/workspace gates disagree and lock or unlock the wrong learners. |
| G4. The gate helper is `SECURITY DEFINER`, `set search_path = ''`, schema-qualified, takes the actor from `auth.uid()` (no caller-supplied user id), revokes `PUBLIC` and `anon`, and grants execute only to `authenticated`. | The D3/D4 helpers are revoked from `authenticated`, so an invoker wrapper fails; a caller-supplied user id or broad grant would let anyone probe other learners' gate state. |
| G5. The gate is added with `AND` inside the existing L1 `User_answers - Auth Insert` and `Auth Update` `WITH CHECK`; L1 `USING` and the self/target/option conditions stay unchanged; no new permissive policy. | A separate permissive policy is OR-ed with L1 and silently reopens the bypass, or historical SELECT breaks. |
| G6. Integration tests run only on the isolated loopback runtime; never reset root 45321 or hosted. | Owner's local data or production data is destroyed. |
| G7. Every hosted step runs under its own grant. Runbook steps 1–3 (§5) run before the merge (Q6): the read-only history and gate-parity check, the push of the two LF2 migrations, and the read-only catalog verification. The new app code needs the RPCs, and both migrations are compatible with the deployed code. The production QA and measurement steps run after the merge deploy is READY. Hosted SQL is read-only, except for the rolled-back smoke when granted. The production baseline in CP2 is observation of the currently deployed app through the Owner's own learning and needs no deployment or hosted write beyond that learning. | A fail-closed window or an unauthorized production mutation. |
| G8. Timing instrumentation is off by default behind an env flag, logs durations and path labels only, and is removed or left disabled before merge. | User ids, answers or tokens in production logs. |
| G9. The question-answer RPC is `SECURITY DEFINER`, `set search_path = ''` and schema-qualified, and takes the actor only from `auth.uid()` (null returns the auth status, no write). It revokes `PUBLIC` and `anon` and grants execute only to `authenticated`. It writes only when every condition of the L1 `User_answers` INSERT/UPDATE `WITH CHECK` holds, including the MEMORY-002 gate. These conditions are evaluated with the same helpers the policies use (`private.l1_can_write_learning_target`, the active-option-of-this-question rule, `private.lf2_memory_gate_open`). They sit inside the write statement itself, on both the insert branch and the `ON CONFLICT DO UPDATE … WHERE` branch, so they share the write's snapshot as the policies do. The actor and question of an existing row never change. Grading comes from the written row (`RETURNING`, after the L1 correctness trigger). When the write affects no row, the status is classified again and the result is never success. No condition gets a second definition. The RPC is `VOLATILE`. | A definer function bypasses RLS, so a missing or re-implemented condition reopens the L1 or MEMORY-002 bypass that the policies close for direct writes. |
| G10. The card-review write RPC is `SECURITY INVOKER`, so the existing L1 `user_flashcards` policies still decide the write. It confirms that exactly one row was written (`RETURNING` or row count). If no row was written, it returns the current mutation error status and does not sync. It changes only the number of round trips. | The card write loses its RLS authority, or an UPDATE that RLS hides silently affects 0 rows and is reported as saved. |
| G11. Inside each RPC, the D4 sync and the AC3a fallback run after the write in a subtransaction whose handler catches `OTHERS` and `QUERY_CANCELED` (SQLSTATE `57014`). Their failure or cancellation never rolls back the saved write, and the result is success with null progress (D4 H4). | A sync failure or statement timeout undoes a saved answer or review, or turns it into an error. |

### 1.4 Owner decisions that bind this unit

- Decision 26 (2026-10-10): group the learning-action latency follow-up, `MEMORY-002`, the hosted `LEARNING-INTEGRITY-001` evidence, `PREVIEW-001` and D4 production QA into one PR from pulled `main`. The Owner accepted all four defaults below on 2026-10-10:
  - Q1. Optimistic advance in the UI? Accepted: no; reduce server work first and decide after AC2 numbers.
  - Q2. Hosted allowed/denied smoke as the `authenticated` role inside `BEGIN … ROLLBACK` on production? Accepted: allowed only with an explicit grant at rollout time; without it, AC6 records catalog evidence only and `LEARNING-INTEGRITY-001` stays open.
  - Q3. Does the Owner mark a standing Preview topic on the free course? Accepted: the Owner decides as a product choice; LF2 never creates one.
  - Q4. Latency target? Accepted: no fixed number before the baseline; the Owner sets or accepts a target at the gate after CP2. Set on 2026-10-10 after the production baseline: production POST median of 300 ms or less for card rating, and 500 ms or less for memory and exercise answers.
- Q5 (decided 2026-10-10: (a)). The r4 design is projected to miss the card target (§5). Two options:
  - (a) Accept LF2 as an improvement step. A missed target is reported with numbers and returned to the Owner after CP6, and it does not block merge or rollout.
  - (b) Keep the target as an acceptance condition. A miss at CP5 (local projection) or CP6 stops the unit before closeout.

  The Owner chose (a).
- Q6 (decided 2026-10-10: accepted). The new rollout order in §5 runs runbook steps 1–3 before the merge, each under its own grant: the read-only history and parity check, the push of the LF2 migrations, and the read-only catalog verification. This differs from G7 r3, which allowed hosted steps only after the merge deploy is READY.

## 2. Repository facts

Baseline: `86b5c8e`, checked 2026-10-10.

- `submitQuestionAnswer` (`app/actions/progress.ts`) awaits in sequence: `auth.getUser()`, the question context query, `hasLearningEnrollment`, `loadMemoryCheck` (exercise answers only), the answer upsert, a second `loadMemoryCheck` (memory answers only, before the sync), then the `d4_sync_topic_progress` RPC. A failed upsert returns the generic save error. Justifies AC1–AC3 and AC5.
- `submitCardReview` (`app/actions/review.ts`) awaits in sequence: `auth.getUser()`, the card context query, `hasLearningEnrollment`, the FSRS insert or update, then the RPC. Justifies AC1.
- `proxy.ts` runs `updateSession` on every non-static request and calls `auth.getUser()`, so a Server Action POST verifies the user in the proxy and again in the action; the proxy does not deny `/learn` when the user is missing. Justifies AC1 (user-observed time) and G2.
- `@supabase/auth-js` `getClaims` verifies signature and expiry locally for asymmetric keys and falls back to `getUser` for symmetric keys. Justifies G2.
- The workspace waits for the action result before advancing the card (`LearningWorkspace.tsx` `handleRateCard`). Justifies Q1.
- Production runs in Vercel region `sin1` (deployment `dpl_AZVNR3uEnPVWQh4ioqmjUT1S9d94` at `86b5c8e`) and Supabase in `ap-southeast-1`; region mismatch is not the cause. Justifies focusing AC2 on round trips.
- L1 answer policies (migration `20261008130544`) check self, `private.l1_can_write_learning_target` and option ownership, not the memory gate. `private.d4_topic_completion_state` (latest in `20261010090000`) computes `memory_check_done`; it and `private.d3_active_memory_questions` are revoked from `authenticated`. Justifies AC4, G3 and G4.
- Production baseline (Owner, browser POST timing on `86b5c8e`, medians): rating-first 597 ms (n 10), rating-update 524 ms (n 10), memory answer 1602 ms (n 6), exercise answer 4464 ms (n 6). Justifies §3 and the AC2 projection in §5.
- Preview per-step timing (deployment `dpl_CuAdGs4kZsps1Ups3L7dgWbcc3ej` at `d49e20e`, shared production database without the LF2 migration, server-side medians):
  - Totals: rating-create 370 ms, rating-update 317 ms, memory answer 1621 ms, exercise answer 1129 ms.
  - Card path: each round trip takes about 45–90 ms. The browser POST is about 200–250 ms longer than the server-side duration (proxy `getUser`, network, response).
  - Question path: context query about 406–408 ms; memory read about 231 ms on exercise answers and 366 ms (reload) on memory answers; answer upsert about 204–260 ms.
- Hosted `EXPLAIN` (no `ANALYZE`, `authenticated` role, 2026-10-10) of the memory-check read:
  - The `question_options` SELECT policy is planned as a hashed subplan that scans every readable topic (`Seq Scan on topics`). It evaluates `private.q7_can_read_topic` per topic, exercise and question row instead of checking only the requested question. The `questions` and `exercises` policies call it again per row.
  - The L1 answer `WITH CHECK` reads `question_options` under the same policy.
  - Hypothesis, not proven by a plan without `ANALYZE`: the cost of question-path RLS reads and writes grows with readable content. This would explain about 400 ms on hosted versus about 55 ms on the small local fixture. CP5 and CP6 measure whether bypassing these policies in the RPC removes the cost.
  - Card paths do not read `question_options`.

  Justifies trying the definer RPC (G9) and the content-policy non-goal.
- The preview logs record `region=hkg1`; the deployment's configured function region is `sin1`. LF2 does not treat the region as a cause.
- `__tests__/integration/topic-completion.test.ts` (around line 296) saves a wrong memory answer and then writes an exercise answer directly as the learner; the new policy refuses that setup. `memory-check-learner-gate.test.ts` (around line 265) and `topic-completion.test.ts` (around line 379) show that exercise answers with a currently false memory check and sticky completion are valid history. Justifies CP4 test adjustment and the rollout aggregate rule.

## 3. Implementation design (binding from r4)

- Timing method (unchanged): locally, the env-flagged server-side timer per step; on production, the browser POST timing of the CP2 baseline, with the same path identification (G1, G8).
- Question path. `submitQuestionAnswer` keeps Zod input parsing and `auth.getUser()` (G2), then makes one call to a new `public` answer RPC (name free). In one transaction the RPC:
  1. Checks the current read boundary of the requested question, then the trusted parent chain with the same fields the action checks today (`hasTrustedParentChain`). If either fails, returns the unavailable status. The read boundary means the question would be visible to the caller through today's RLS read: the question is active, its exercise is active and `private.q7_can_read_topic` is true for that one topic, which includes the profile and enrollment or preview rights. So a learner who cannot read the question still gets unavailable, as today, even when not enrolled.
  2. Checks enrollment; if missing, returns the not-enrolled status. This case covers callers who can read without enrollment, such as a previewer or collaborator.
  3. Checks that the option is active and belongs to this question; if not, returns the option-unavailable status.
  4. For an `exercise`-stage question, checks `private.lf2_memory_gate_open`; if closed, returns the memory-locked status.
  5. Upserts the same row fields on `(user_id, question_id)` with the full L1 and gate condition set inside the write statement (G9). If no row is written, it classifies again with steps 1–4 and returns that status, or the generic save-failure status. Grading is `is_correct` from `RETURNING`.
  6. Runs the D4 sync and the AC3a memory status, per G11.

  On success it returns a status code, `is_correct`, the raw `explanation`, the raw progress payload or null, and, for memory questions, the memory status or null. A failure status returns nothing else: no grading, explanation or progress. The action maps each status to today's message and error code, applies the LF1 explanation rule and parses the progress with the existing schema. The order of the checks follows the AC3 precedence.
- Card path:
  - Enrollment is read in the same round trip as the card context. Either the context query embeds the learner's enrollment without changing today's unavailable result (an optional, non-`!inner` embed), or an independent lookup keyed by the trusted card id runs in parallel. The course id never comes from the client. Results are resolved in the AC3 precedence. On the server this gives `getUser`, context plus enrollment, then the write RPC: three sequential round trips.
  - FSRS stays in TypeScript.
  - One `SECURITY INVOKER` RPC (G10) then performs the insert or update with the same values. It confirms the write and runs the D4 sync per G11. It returns a status and the raw progress payload or null.
- The CP4 action re-read on `42501` is removed once the question path no longer writes through the Data API; AC5 is then covered by the RPC's memory-locked status.
- The MEMORY-002 policy and `private.lf2_memory_gate_open` stay as committed in CP4 for direct Data API writes. A cheaper memory-only predicate is added only if CP5 measurement shows that the gate itself takes a meaningful share, and it must keep the same definition (G3).

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Docs: Decision 26, LF2 unit row, State, this plan linked. | `npm run docs:check`. |
| CP2 | Baseline recorded (AC1) for the four paths, locally and on production. **Gate:** the Owner accepts a target per path (Q4) before CP3 starts. | Local timer output; production POST timings from the Owner's own learning on the free course on the current deployment, with method, warm/cold, sample size and median. |
| CP3 | Latency change per §3 (AC3, AC3a, AC5, G9–G11). Requires Q5 and Q6 answered. Delivers one migration for the two RPCs with its own down script, separate from the CP4 gate migration, plus the action changes and their tests. | Integration tests on the isolated runtime. Answer RPC: each status in precedence order; anon; a learner who cannot read the question (unavailable, as today); a collaborator or previewer who can read but is not enrolled (not enrolled); removed profile; removed or unpublished parent; foreign or removed option; locked gate and relock; every case the L1 and MEMORY-002 policies refuse is also refused; grading from `RETURNING` and row values; controlled races in which a relock, an enrollment deletion and an answer-key change commit between the classification and the write; a sync failure and a sync cancellation (SQLSTATE `57014`) keep the write and return null progress; catalog contract (owner, definer, volatility, `search_path`, grants). Card RPC under RLS: allowed write; another user's row denied; a row deleted before the update returns the mutation error without a sync; sync failure and cancellation after a real write keep the write. Failure injection uses a test-only override on the isolated runtime. Existing D3, D4, L1, LF1 and LF2 suites pass. Also `npm run test:run` (action and workspace suites), `npx tsc --noEmit`, scoped ESLint, and a local re-measurement with the timer. |
| CP4 | MEMORY-002 migration with down script, action race handling and tests (AC4, AC5). | `npm run test:integration` on the isolated runtime: new matrix (direct INSERT/UPDATE, upsert insert and conflict branch, unlock, no-memory topic, relock on an existing answer, answer-key change, added memory question, historical read, SQL/action/D4 parity, controlled race for AC5); existing D3, D4, L1, LF1 suites pass, with the D4 setup that relied on the bypass rewritten to reach the same state through allowed writes or an explicit privileged fixture while keeping its completion assertions; isolated reset rebuild. |
| CP5 | Local closeout: AC2 local re-measurement after CP3+CP4; cumulative self-review; browser smoke. Fixture readiness: ready — `e2e/smoke/learning-workspace.smoke.spec.ts` and `learning-workspace-matrix.smoke.spec.ts` with `scripts/e2e/learning-workspace-matrix-fixture.mjs` on the isolated runtime. | `npm run test:e2e -- e2e/smoke/learning-workspace.smoke.spec.ts e2e/smoke/learning-workspace-matrix.smoke.spec.ts`; review report. |
| CP6 | Hosted steps in the §5 runbook order, each under its own grant: the migrations and catalog check before the merge; AC2 production numbers, AC7 and AC8 after the merge deploy. Then `problems.md` and State are reconciled. | Migration list, read-only aggregate and catalog queries, rolled-back smoke if granted, Owner D4 journey with before/after read-only readback, Preview journey if a standing topic exists, production after-numbers; `npm run docs:check`. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Parallel reads change which error the learner sees first. | Resolve in the AC3 precedence and cover it with tests. |
| The definer answer RPC writes something the policies would refuse. | G9; the CP3 parity matrix against the policy cases. |
| The strict target is not reached. | Projection from the preview steps: on the server, the question paths become `getUser` plus one RPC, expected to land within 500 ms in the browser. Card rating keeps three sequential round trips plus about 200–250 ms outside the action, expected at about 400–450 ms, which is above 300 ms. Reaching 300 ms on the card path needs work this plan excludes (skipping the proxy `getUser` on action POSTs, or optimistic UI). Handled per Q5. |
| SQL gate and action gate disagree on the same state. | G3; parity tests in CP4; before rollout a read-only check on hosted that compares both definitions on existing learner/topic pairs. Exercise answers with a false memory check are counted as history, not as breakage. |
| The policy is OR-ed with L1 or breaks historical reads. | G5; historical read case in CP4. |
| Window between migration and deploy. | Both LF2 migrations go to hosted before the merge (Q6). The RPC migration only adds functions, so the deployed app is unaffected. The gate policy only refuses what the deployed action already refuses, apart from a race that the deployed action reports with its generic save error. The new app is deployed only after both migrations are verified, so it never runs without its RPCs. |
| Production timing is noisy at low traffic. | G1; record sample size and median. |

- Rollout runbook. Each step needs its own grant.
  1. Run the read-only history aggregate and the gate-parity check on hosted.
  2. Push the CP4 gate migration, then the CP3 RPC migration, from the reviewed branch head (Q6).
  3. Run the read-only catalog verification of the helpers, policies and RPCs (AC6).
  4. Merge, and wait for the production deployment to be READY.
  5. Then: rolled-back smoke if granted; Owner D4 journey with before/after readback (AC7); Preview checks if a standing topic exists (AC8); production after-numbers (AC2).
- Stop when:
  - the target is missed and the stop applies per Q5: under (b) at CP5 or CP6; under (a) the miss is only reported after CP6, and no extra scope is added without a decision;
  - Q5 or Q6 is unanswered before CP3; the parity check finds a state where the SQL gate and the current action gate differ; a hosted step lacks its grant; a review finding needs a new Owner decision. Historical exercise answers with a currently false memory check are not a stop reason; any exception for them needs its own Owner decision.
- Rollback. The latency change and the gate roll back separately.
  - To roll back latency: revert the action change by commit and deploy it. Only then run the RPC migration's down script, which drops the two RPCs. The gate stays in place.
  - To roll back the gate, which needs its own decision: first make sure no deployed code calls the answer RPC (it uses `private.lf2_memory_gate_open`). Then run the gate migration's down script, which restores the L1 policy definitions and drops the helper. Writes refused during the window are not replayed; the learner retries.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
