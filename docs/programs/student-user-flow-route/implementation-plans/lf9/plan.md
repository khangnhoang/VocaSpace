# LF9 detail plan — Memory-check gate and continuous topic progression

Revision: r7, 2026-10-18. Product decisions: Owner-confirmed 2026-10-17 and 2026-10-18, including immediate memory progression, locked-stage actions, question keyboard/layout and question-boundary corrections during local QA, and the r7 exercise-navigation correction from production QA (master Decision 38). The initial r2 plan passed independent Codex CLI `gpt-6.1-sol` / `high` review before implementation; later amendments follow the Owner's explicit instructions. Master plan: [plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: learners finish the required vocabulary before their first memory check and continue to the next unfinished topic content without a redundant completion stop.

| ID | Observable result |
| --- | --- |
| AC1 | Before the first gate opening, every active card in the topic must have the learner's latest saved rating Good or Easy. Missing, Again and Hard ratings keep the memory check locked. UI, direct answer INSERT/UPDATE/upsert and the answer RPC agree. No active cards means no card gate. |
| AC2 | The first opening is retained across reloads and later Again/Hard ratings. A card added afterwards locks the memory check until that card is saved as Good/Easy; each new card's achievement is retained independently, and cards already cleared do not need to be cleared again. Removed cards do not block; restoring the same cleared card ID retains its achievement. Another learner's rows never open the gate. |
| AC3 | The migration preserves the existing gate achievement for a completed topic or a currently fully correct, non-empty memory check. Other existing topics use AC1. It never changes stored answers, ratings or sticky topic completion. |
| AC4 | After a first, due or full vocabulary queue drains and its saves settle, continue to the first unfinished stage: memory check, then exercises, then the server-confirmed topic result. A sticky historical topic-complete flag does not skip currently unfinished memory/exercise content at this transition. No completed-review interstitial. A failed save keeps the card available and never claims completion. Loading with an empty queue or deliberately revisiting vocabulary is not a queue-completion event. |
| AC5 | After a wrong memory answer, show `Câu tiếp theo` when another question is queued and `Thử lại` when only this question remains. Incorrect questions return through the queue and still require a correct answer. |
| AC6 | A confirmed final correct memory answer immediately continues to the first unfinished content or the server-confirmed topic result, including when exercises remain. No feedback delay or `Mở bài tập` action remains. A result arriving while the learner is on another stage does not navigate them away; returning to memory check consumes that result immediately without resubmitting. The existing ordinary-exercise feedback interval is unchanged. |
| AC7 | User-controlled stage navigation, focus transfer, pending/error recovery and reduced-motion semantics remain usable. Public Preview stays stateless and has no persistent card gate. FSRS, grading and sticky topic completion stay unchanged. |
| AC8 | Update the learning-data disclosure with the exact Owner-approved sentence: `Dữ liệu học tập: khoá học bạn tham gia, tiến độ học, trạng thái mở khoá các nội dung học, bài làm và kết quả ôn tập.` |
| AC9 | A forward `Tới…` stage action is hidden while its target is locked and available once that target is unlocked, subject to the existing stage/action visibility rules. In particular, Memory check must not offer `Tới Bài tập` before its pass. Preserve the stage thread's locked state and inline explanation, backward navigation, and stale/server-error recovery. |
| AC10 | (r7, Decision 38) Exercises have no `Câu trước`/`Câu sau` actions; `Danh sách câu hỏi` is the only way to move between questions and shows the visible caption `Chuyển nhanh giữa các câu` below its trigger on every screen size, linked by `aria-describedby`. The primary response action stays full width; `Câu tiếp theo` shows its arrow after the label. Each enabled answer is a Tab/Shift+Tab stop in option order; focus alone does not select/grade. Preserve arrows, Space/Enter, radio and disabled behavior across exercise, memory and stateless Preview; preserve submission and feedback rules. |
| AC11 | (r7, Decision 38) A correct answer shows `Câu tiếp theo` only when a later question exists and the answer did not just complete the topic. Otherwise the learner always presses the end action: `Hoàn thành` opens the completion screen when the answer newly completed the topic or the topic is already complete with no question missing; `Làm câu còn thiếu` goes to the first missing question; otherwise `Bài tiếp theo` or `Về tổng quan khóa học`. No exercise answer auto-advances. Preserve the separate backward-stage action, question navigator, focus restoration and the top-bar return to the completion screen. |

### 1.2 Scope and non-goals

- In scope: the memory card gate and its persisted achievement; loader and workspace state; queue-end routing; memory answer labels and final auto-advance; focused integration/component/schema coverage; program and affected surface documentation; the approved privacy sentence.
- Non-goals: GRANT-001; server latency optimization; FSRS; changing answer correctness; a new design system or palette; authoring workflow; Preview persistence; production data creation; automatic commit, push, PR, merge, deployment or hosted migration.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Reuse the existing single SQL gate consumed by both answer policies and both answer-RPC write branches. Keep the L1/LF2 checks and grants. | A direct write bypasses the new gate or a separate permissive policy widens authorization. |
| G2. Gate achievement is server-owned, scoped to the authenticated learner and topic; clients cannot write it. Capture it under the existing progress-row lock. | A forged marker opens another learner's gate, or concurrent sync loses achievement. |
| G2a. First-opening capture and new-card capture must cover every supported rating-write path, including direct Data API writes, and a successful rating with a failed progress sync must not falsely claim durable gate achievement. | A gate opens on current ratings without persisting its achievement, then unexpectedly relocks on the next Again/Hard or reload. |
| G3. Pending ratings never unlock a stage. Queue end waits for the existing serialized save chain and uses the latest confirmed state. | Optimistic UI grants access or navigates away despite a failed save. |
| G4. Preserve the old progress RPC response shape; do not break the deployed strict decoder while adding persisted state. | An additive JSON key makes the deployed app reject every progress response. |
| G5. A missing new schema object is a rollout failure, not an open/closed fallback. Apply the additive migration before deploying its loader, under separate hosted authority. | The new loader silently misclassifies learning state or fails during rollout. |
| G6. No client-derived topic-complete result. When progress sync is unavailable, keep an explicit retry/reload path. | An empty local queue falsely becomes persisted topic completion. |

### 1.4 Owner decisions that bind this unit

- 2026-10-17: group FEAT-010 with the three reported workspace changes in one unit; leave GRANT-001 separate.
- 2026-10-17: first opening requires all active topic cards to have latest Good/Easy together; later ratings do not relock already-cleared cards.
- 2026-10-17: new cards relock until Good/Easy; preserve old completed topics or fully passed memory checks, apply the new rule elsewhere.
- 2026-10-17: remove the review-finished stop and final `Mở bài tập` action; wrong-answer labels describe the retry-queue action.
- 2026-10-17: approve the exact privacy wording in AC8.
- 2026-10-17, local QA: remove the 1200 ms final memory-check wait; follow vocabulary progression and immediately open the next unfinished content or completion. Hide ordinary exercises of the local canonical `D8 Bài học trọn vẹn` topic for the memory-only completion case, preserving memory questions, cards and learner records; do not reset the root database.
- 2026-10-18, local QA: hide the forward action to a locked stage; show it after unlocking rather than navigating the learner to a locked panel and a return action. The stage thread and server gate behavior remain unchanged.
- 2026-10-18, local QA: put previous/next question links on one row and make the primary response action full width; change the shared choice group's single roving Tab stop to sequential Tab access to every enabled answer, retaining arrows and activation keys. Other response and persistence behavior stays unchanged.
- 2026-10-18, local QA: hide previous on the first exercise question and next on the last; keep navigation within questions. Of the Owner's offered layouts, use full-width outline for a lone navigation action and a separate full-width filled primary; retain the shared navigation row when both actions exist.
- 2026-10-17: finish the plan, revert all other implementation diffs to the base, then use Codex CLI `gpt-6.1-sol` / `high` for independent plan review; fix supported findings and re-review until PASS. On PASS, commit the plan and implement with local commit authority throughout. Push, PR, merge and hosted actions remain ungranted.

## 2. Repository facts

Baseline: `03fdeec6c58a510d3607715b1b4b2df350782aa4`, checked 2026-10-17.

- LF3's `private.lf3_cards_seen_gate_open` ignores ratings; both answer policies and the answer RPC already use it — AC1/G1.
- `d4_sync_topic_progress` owns progress writes and locks its row; learners have no progress write policies. It returns strict-decoded JSON — G2/G4.
- Current progress/card rows have no first-gate achievement history — AC2/AC3 require additive persistence.
- `runQueueEnd` explicitly keeps due/full review at its finished screen; `MemoryCheckStage` only auto-advances a pass when no exercises remain — AC4/AC6.
- LF8 is merged in PR 161 (`03fdeec`); progress still describes its earlier local delivery — update the current State, preserve historical evidence in a milestone.

## 3. Bounded implementation hypotheses

- Add a nullable cleared-card ID set to `user_topic_progress`; a null set means the initial gate has not opened. Reuse one server-owned capture operation under the progress-row lock, covering qualifying rating writes and progress sync as necessary. First achievement captures all active IDs; later new-card achievements append IDs independently. A narrow rating-write trigger is allowed if required to cover direct Data API writes; avoid duplicate writers or capture rules. Equivalent storage is allowed if AC1–AC3/G2/G2a hold.
- Preserve the existing gate's identity and progress RPC response keys. Extend the loader's schema-owned result with the cleared-card set; derive pending cards from own ratings plus that set. UI-only pending state remains local.
- Use the existing queue-end callback and shared first-unfinished-stage resolver where its semantics fit. Consume a confirmed memory pass only while its stage is mounted, before painting a redundant final stop. No new scheduler or state library.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Persisted gate, migration/backfill, direct-write/RPC enforcement and loader parity | Isolated local rebuild; focused LF9/LF3, LF2 gate/action, topic-completion integration; schema/action tests; TypeScript |
| CP2 | Continuous queue and memory progression with honest failure states | Focused memory-stage, workspace-presentation, completion and landing tests; regression failures on baseline where practical; focused lint |
| CP3 | Integrated local result, privacy/docs and QA evidence | `npm run docs:check`, `git diff --check`; focused browser journey when runtime is available; Owner subjective QA remains pending |

Planned focused commands (checks not yet run):

- `npm run test:run -- __tests__/components/memory-check-stage.test.tsx __tests__/components/learning-workspace-presentation.test.tsx __tests__/components/topic-completion-ui.test.tsx __tests__/utils/learning-landing.test.ts __tests__/schemas/learning-workspace.test.ts __tests__/actions/learning-workspace.test.ts`.
- `npm run test:integration -- __tests__/integration/lf3-memory-check-cards-seen-gate.test.ts __tests__/integration/lf2-memory-check-answer-gate.test.ts __tests__/integration/lf2-learning-action-rpcs.test.ts __tests__/integration/topic-completion.test.ts`, with the explicitly enabled isolated runtime and its local credentials; add focused upgrade/capture cases at CP1.
- `npx tsc --noEmit --incremental false`; lint only the actual changed source/test paths; `npm run docs:check`; `git diff --check`.
- `npm run test:e2e -- e2e/smoke/learning-memory-cards-gate.smoke.spec.ts e2e/smoke/learning-topic-completion.smoke.spec.ts e2e/smoke/learning-fast-rating.smoke.spec.ts` after the fixture and runtime gates are met, one run at a time.

### QA fixture readiness

- QA type: enrolled learner, persisted card/answer state and stage navigation.
- Canonical sources: existing `learning-memory-cards-gate`, `learning-topic-completion`, `learning-fast-rating` smoke fixtures and LF3 integration fixture.
- Narrow additions: first gate with Hard/Again; gate retained after downgrade/reload; newly added card; review-to-memory/exercise/result; wrong-answer retry labels; final memory auto-advance.
- Fixture checkpoint: CP1/CP2; use only the isolated runtime (API 45441), never reset the root or hosted database.
- Outcome: canonical fixtures require the narrow additions listed above. At plan preparation Docker was not running; Docker Desktop was launched, but no local rebuild, migration apply, fixture preparation or browser check has run.
- Browser QA begins after fixture readiness and focused automated checks pass. Unavailable runtime/browser means the corresponding evidence remains pending.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Old achievements cannot be reconstructed exactly | Apply the explicit AC3 migration rule, with an upgrade/backfill test. |
| New cards or overlapping saves make UI and SQL disagree | Own-row parity and direct-write tests; capture under progress-row lock; unlock UI only on confirmed saves. |
| A direct rating write or failed progress sync loses the latch | Test direct INSERT/UPDATE/upsert, supported RPC writes, sync failure, downgrade/reload and concurrent card ratings; successful capture is transactional with its owning write. |
| A late result pulls a learner out of their chosen stage | Preserve queue generations and stored-attempt ownership; consume final memory results only on the mounted stage, with focused departure/remount tests. |
| The new loader requires the additive column | Local compatibility check; hosted migration first under a separate grant, then deployment. Old response shape remains valid. |

- Rollout: independent plan PASS, authorized local plan commit, implementation and coherent local checkpoint commits; implementation review and local verification; separately authorized push/PR/CI; separately authorized hosted preflight, additive migration and read-only postflight; then separately authorized merge/deploy and Owner QA. The old application can be refused by the stricter gate during the migration-to-deployment window; coordinate these steps, require a fresh page after deployment, and roll back the gate if the new app cannot deploy. Do not claim uninterrupted old-client behavior or feature completion before both layers are active. No hosted action is granted here.
- Before implementation, append the new Owner decision/unit to the master plan, move FEAT-010 into the active unit, and replace stale LF8 State with LF9 State in the same authorized planning checkpoint; preserve LF8 merge evidence in a milestone. Update the affected current surface progression sentence with AC6; do not rewrite frozen LF3/LF5/LF6 plans.
- Stop on material product/ownership conflict, unsafe migration or unavailable evidence needed to establish a gate invariant.
- Rollback: revert app to the previous loader first; restore the old gate and progress-sync definitions afterwards under the corresponding DB grant. Retain the additive achievement column until its data is no longer needed; do not delete answers or ratings.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
