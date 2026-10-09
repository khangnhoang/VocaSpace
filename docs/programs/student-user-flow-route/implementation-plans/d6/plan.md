# D6 detail plan — review UX and scoped closeout follow-ups

Revision: r2, 2026-10-08. Owner scope decisions: confirmed in this chat on 2026-10-08. Candidate review and final plan acceptance are tracked in [progress.md](../../progress.md). Current implementation and Git authority: see progress.md. Master plan: [plan.md](../../plan.md), Decision 22.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: an authenticated learner can recall, reveal, rate and finish a bounded review batch from `/learn`, recover from failures, and deliberately start another batch. The same Owner-selected delivery batch includes F1/domain tracker closeout, the account-header regressions and the existing `issue-deep-links` smoke investigation.

| ID | Observable result |
| --- | --- |
| AC1 | `Ôn ngay` opens the existing `ReviewSheet`; no `/learn/review` route is introduced. One card and its response controls dominate the surface. |
| AC2 | The learner reveals the answer before rating with `Lại`, `Khó`, `Ổn` or `Dễ`. These are self-assessments, not server-checked correct/incorrect answers. Existing rating values and FSRS scheduling remain unchanged. |
| AC3 | Each batch contains only the cards returned by the existing action, at most 50. Show `Đã xử lý x/N thẻ trong lượt`, where N is the returned batch size and x is the number of cards removed after confirmed successful Good/Easy ratings. Again/Hard requeue at the end and do not advance x. |
| AC4 | No dialog counter pretends to track global learning/due totals by decrementing both. Keep dashboard statistics server-derived; remove the two mutable global-count badges from the dialog. |
| AC5 | A finished non-empty batch shows `Đã hoàn tất lượt này`, primary `Ôn lượt tiếp theo` while known due cards remain, and `Quay lại` to close. When no due cards remain it congratulates the learner and offers only `Quay lại`. The next-batch action fetches the current server queue and resets the local batch denominator. An empty successful fetch shows `Lượt tải này chưa có thẻ có thể ôn`, without claiming a finished batch or that the global due queue is empty. This holds even when the returned `counts.dueLeft` is positive. |
| AC6 | A queue-load failure keeps the dialog open with a contextual error, `Thử lại` and a close action. Loading never displays the completed state or stale cards from a previous batch. |
| AC7 | While a rating is saving, keep the revealed card, announce `Đang lưu đánh giá…` through a permanently mounted screen-reader-only status that adds no visible line or height change, and prevent duplicate ratings, starting another batch, or closing through button, Escape or outside interaction. A failed write retains the card, revealed answer and progress, and allows a manual retry. Browser navigation is not intercepted. |
| AC8 | Only explicit action success advances the queue. Success with `progressError` still advances because the rating is already saved; show the returned safe warning and do not retry that rating automatically. A thrown/rejected action is a recoverable error, not success. |
| AC9 | Obsolete load responses cannot replace a newer batch or a closed dialog. Reopening loads current server truth. Refresh the dashboard when a batch finishes or the learner closes after saved reviews; do not reload an active batch merely because a parent callback identity changes. |
| AC10 | At 320, 375, 768 and 1280 px, long content and controls remain usable without horizontal overflow. Reveal/rating/next/close work by keyboard and focus stays in the dialog. On close, focus returns to the opener if it is still present and focusable; otherwise it moves to the stable dashboard review-summary heading, including when a completed-batch refresh removes `Ôn ngay`. Reduced motion preserves the same content and actions. |
| AC11 | The account-avatar trigger has the accessible name `Mở menu tài khoản`. The signed-in desktop menu displays its role-appropriate destinations on first open, after navigation and on reopen; existing mobile parity and role-derived destinations remain intact. |
| AC12 | The `issue-deep-links` smoke retains meaningful assertions for stale-target recovery, tab/query changes, exit from issue mode and Back/Forward. Its reported instability is resolved by an evidenced bounded fix and two independent successful runs, or remains an explicit blocker if reliable reproduction/correction is unavailable. |
| AC13 | F1's three tracker entries and State cite merged PR 139 (`ee46176`), and Auth FEAT-004 status agrees with its existing rollout evidence. No new production check, configuration change or whole-program completion is claimed. |

### 1.2 Scope and non-goals

- In scope: ReviewSheet composition and local async lifecycle; review-only presentation in FlashcardStage; the existing dashboard review entry and refresh seam; the named header regressions; bounded issue-link test/fixture synchronization and, only if reproduction proves it necessary, its directly owning client-side navigation or feedback consumer; focused tests/local fixtures; the specified tracker reconciliation.
- Supporting closeout belongs to this Owner-selected batch but retains its existing semantic owner: F1 owns the menu/not-found/sign-in fixes; Auth owns domain rollout evidence; the teacher issue-link flow keeps its existing contract.
- Non-goals: D5, D8, D9, FEAT-008, whole-dashboard or profile redesign, public Preview redesign, new review routes, review filters or selection policies, audio/image feature additions, browser queue persistence, analytics, time estimates, ownership/review-note features, and production rollout work.
- No public API or DTO additions; no Server Action/business-rule changes, FSRS scheduling changes, migrations, RLS, RPC, generated types, package/font additions, shared primitive edits or seed-wide rewrites.
- The initial authoring request permitted branch preparation, these plan/State edits and the requested independent subagent review. Its initial grant excluded product implementation, local fixture execution/reset and Git publication. Subsequent Owner grants and current execution authority are recorded in progress.md.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Check the approved current candidate and separately granted implementation authority before product edits. | A planning/review request would silently become implementation or publication. |
| G2. Preserve `getDeckReviewCards()` and `submitCardReview(cardId, rating)` contracts and existing authorization. | UI polish could change eligibility, scheduling or write authority. |
| G3. Do not advance/requeue before checked rating success; distinguish `progressError` from a failed rating. | The learner could see false completion or repeat an already saved rating. |
| G4. Batch progress describes returned cards, never global due/learning totals. | The 50-card cap or overlapping counts could produce a misleading completion claim. |
| G5. Isolate review presentation changes from the workspace presentation and keep shared primitives unchanged. | D6 could regress the normal learning workspace or unrelated global consumers. |
| G6. Reproduce header/smoke failures before choosing a fix; keep all original behavioral assertions. No arbitrary sleeps, blanket timeout increases, `networkidle` waits, or broad error suppression. | A passing test could mask the original navigation/menu defect. |
| G7. Use only deterministic local/test fixtures on a verified isolated loopback Supabase runtime. | QA could mutate production data or depend on unrelated local work. |
| G8. Keep issue-link fixes inside the existing client-navigation/feedback contract. Stop if server, permission, shared-primitive or database changes are necessary. | A teacher smoke correction would expand an unrelated product or security boundary. |
| G9. Close only entries whose recorded exit is met. D6 does not close the deferred `/learn/review` feature, STUDENT-003 dashboard visuals, D1/D2 rollout gaps or database-integrity backlog. | A bounded review/closeout could falsely mark independent work complete. |

### 1.4 Owner decisions that bind this unit

- Master Decision 22 (2026-10-08): add D6 to the pictured follow-ups, retain ReviewSheet instead of a dedicated route, and offer another batch after finishing the current one while preserving the 50-card limit.
- The Owner requested a new branch from pulled `main`, a written plan, and independent review by `gpt-6.1-sol` at reasoning `high`. The initial request included no managed multi-agent E2E workflow or product execution; remain in `NORMAL` with one read-only reviewer.
- The inherited candidate defaults include temporarily blocking dialog dismissal during a rating save, preserving the existing four rating semantics, and using server truth on reopen. Candidate acceptance and implementation permission are separately recorded in progress.md.

## 2. Repository facts

Baseline: `5ae962fc2b02ae75c59434f8df61bc8818bf0852`, checked 2026-10-08 after `git fetch origin` and `git pull --ff-only origin main`; local main and origin/main matched and the tree was clean before branch creation.

- [ReviewSheet](../../../../../app/(client)/learn/_components/ReviewSheet.tsx) already fetches the deck, requeues Again/Hard, and removes Good/Easy only after the checked write. Load errors close the dialog; Good/Easy decrement both global badges; the completion toast claims all currently due cards are done. These facts justify AC3–AC9.
- `getDeckReviewCards` in `app/actions/profile.ts` orders due rows and limits the query to 50 before mapping/filtering eligible content. Its counts cover more than the returned batch and can overlap; the DTO supplies no per-card count classification. N must use the actual returned length, not 50 or a total count. Filtering after the cap can return an empty batch despite a positive due count or eligible rows beyond the cap; D6 keeps the query unchanged and makes only a batch-scoped empty claim.
- `submitCardReview` in `app/actions/review.ts` returns success plus `progressError` when the card write succeeded but D4 synchronization did not. Treating that warning as a failed card write would be incorrect.
- LearnDashboardClient already opens ReviewSheet and refreshes through its completion callback. Its ReviewCard omits `Ôn ngay` when dueCardCount becomes zero, while both summary states render the `review-summary-title` heading; focus return must handle the removed opener. The normal workspace shares FlashcardStage through a separate `presentation` value, justifying G5.
- Header lacks a reliable descriptive name on its avatar button and uses force-mounted dropdown content. These are inspection facts, not a proved root cause for the reported blank-menu observation.
- The existing `e2e/smoke/issue-deep-links.smoke.spec.ts` has its own course-structure fixture, catches `net::ERR_ABORTED` in a history helper and calls `networkidle` with suppressed failure. Root cause of the previously reported instability is not established at this authoring checkpoint.
- PR 139 is merged at `ee46176`, ancestor of the baseline, while the student tracker still describes F1 as unmerged. Auth progress records FEAT-004 Done and hosted domain rollout, while its future-feature entry remains Planned. These justify AC13, not a fresh hosted-state claim.
- Existing B2 seed data contains the canonical enrolled student and two due review cards plus a future-due card. It does not provide a deterministic 51-card review batch. Existing component review tests cover checked write failure and success, but not the planned batch/error/reopen matrix.
- Accepted visual owners are [Product Language](../../../../ui-design-system-and-review/product-language.md), [Learning Experience](../../../../ui-design-system-and-review/screen-types/learning-experience.md), and [Button](../../../../ui-design-system-and-review/components/button.md), routed by their [index](../../../../ui-design-system-and-review/index.md). The current CSS is not design acceptance evidence.

## 3. Bounded implementation hypotheses

### Review composition and integration

- Retain ReviewSheet as the feature owner and the existing dialog. Use one compact context/progress header, one uninterrupted recall/reveal region, a stable response area, and contextual pending/error feedback. Replace the task region with the empty or finished-batch state; do not stack a success card over an active card.
- Narrow/mobile: full-height dialog with safe scrolling; 2-by-2 ratings; primary touch actions at least 44 px. Wide: centered focused dialog; four ratings in one row when their labels fit. Long answers grow/scroll without covering controls; no sticky footer is required.
- Reuse theme-addressable product tokens and existing Button roles. Progress uses Recall Cyan, confirmed batch completion Growth Green, recoverable errors Correction Red, and dominant reveal/next actions Action Blue. Rating controls remain self-assessment choices, not color-only correctness feedback. Use the installed font roles and accepted geometry.
- The signature is the continuous recall → reveal → rating → confirmed-progress loop. Spend motion on reveal/progression with stable controls, not decorative metric cards or gradients. Use accepted motion timing and reduced-motion equivalence; no new motion package or confetti.
- ReviewSheet owns the local batch/status state. A stable loader/callback seam plus obsolete-response guard may be used to avoid overlapping loads and parent-rerender resets. No new global state library, durable log or orchestration framework is needed.
- Local `load`, `rate` and `next batch` operations need immediate synchronous duplicate guards in addition to disabled controls. Restore keyboard focus to the reveal control after advancing and the completion heading/action after finishing. On close, restore the original dashboard trigger only if it is still present and focusable; otherwise focus the current review-summary heading through a feature-local programmatic focus target. Resolve the live target after refresh rather than retaining a detached node. Preserve the rating control/answer context on a failed save; shared dialog primitives stay unchanged.
- If FlashcardStage is reused, adjust only its review branch. A feature-local review wrapper is equivalent if it preserves AC1–AC10 and does not refactor workspace behavior. Internal state/component wiring may change within those guards.

### Supporting corrections

- Begin the menu investigation with first-open, client-navigation and reopen observations on the seeded signed-in roles. A usage-site mount/visibility correction is a hypothesis; do not remove `forceMount` or change the dropdown primitive without validating the actual failure.
- Begin the smoke investigation on the unmodified scenario and capture the first failed action/assertion, trace and console/request evidence. Prefer explicit settled URL/UI assertions over load heuristics. Correct only an established fixture/locator/synchronization defect or the directly owning client feedback/navigation defect under G8. If reproduction is inconclusive, leave AC12 blocked instead of declaring it fixed.
- Tracker closeout moves the three F1 entries to one-line resolved records citing PR 139 and reconciles their State; Auth FEAT-004 uses existing progress evidence for Completed. Preserve frozen F1/Auth plans and historical rollout details. The D6 plan/State write itself does not execute this future closeout checkpoint.

### Verification and fixture readiness

- Required skills at execution: frontend-design, frontend-workflow, test-quality-strategy, nextjs-server-action-zod for unchanged boundary consumption, code-commenting-and-maintainability for test headers, playwright-cli for browser mechanics, repo-docs-system, git-checkpoint-workflow and code-review-and-quality. Supabase core/local fixture rules apply to isolated fixture preparation; migration/RLS/RPC work stays excluded.
- Component interaction coverage is the primary layer for pending/error/next-batch/stale-response behavior. Mock action results only to test client handling; do not use those tests as persistence or permission evidence. Use a real local browser journey for the retained integration and save/reload path.
- Fixture-readiness outcome: canonical fixture requires narrow additions. Reuse the B2 student/enrollment/published content and add a local/test-only review fixture helper for exactly 0, 2 and 51 due eligible cards, plus long optional content. Reuse header roles and the issue-link fixture. Do not rewrite `supabase/seed.sql` or create production data.
- Before browser QA, verify fixture cardinality, current parent/content eligibility, enrollment and valid FSRS metadata. Reset/setup uses the existing `npm run test:e2e -- <specs>` runner on its isolated E2E runtime; its reset is an execution action requiring the later implementation/QA grant. Preparation and cleanup must be deterministic and safe for another run.
- Expand `__tests__/components/review-sheet.test.tsx` for loading/initial empty/load failure/retry; an empty batch with `counts.dueLeft > 0`; all four ratings; same-tick duplicates; saved/failed/rejected results; success with progressError; next batches with data/empty/error; stale loads; close/reopen; and no fake global completion. Extend dashboard interaction tests for the refresh seam and both close-focus cases: opener retained, and opener removed after refreshed due count becomes zero. Extend header tests for the named trigger and unchanged role destinations. Run workspace presentation tests if the shared feature component changes.
- Add a focused local `e2e/smoke/review-session.smoke.spec.ts` protecting a real saved batch, next-batch fetch, close/reopen persistence, the 51-card boundary and focus return, including closing after a refreshed zero-due dashboard removes the opener. Keep error-injection cases at the deterministic component layer unless browser injection is needed to verify a browser-specific failure. The detailed scenario matrix lives in this owning plan; do not add a duplicate workflow tracker or a separate test-planning framework.

## 4. Checkpoints

Plan authoring and independent plan review precede these implementation checkpoints; none is recorded as implemented by this file.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | F1/domain tracking reflects existing merged/rollout evidence without changing product or hosted state. | Git ancestry of `ee46176`; compare cited program records; `npm run docs:check`; `git diff --check`. |
| CP2 | Avatar accessible name is fixed; the menu/smoke regressions are evidenced and corrected within their contracts, or the affected part is explicitly blocked. | Related header tests; signed-in menu first-open/navigation/reopen checks; `npm run test:e2e -- e2e/smoke/issue-deep-links.smoke.spec.ts` in two independent runs after the fix; preserve trace/assertion evidence. |
| CP3 | D6 has the defined review-only composition, trustworthy batch progress, next batch and resilient async states; fixtures are ready. | Focused review/dashboard/workspace component tests; TypeScript; lint changed TS/TSX; local fixture readiness before browser execution. |
| CP4 | The combined changed surfaces are verified and their remaining limits are explicit. | Focused real review smoke and relevant workspace regression; planned viewport/keyboard/reduced-motion/200-percent-zoom matrix; rendered design review against accepted owners; docs/diff checks and final cumulative scope audit. |

- Suggested focused baseline command: `npx vitest run __tests__/components/review-sheet.test.tsx __tests__/components/learn-dashboard-interactions.test.tsx __tests__/components/header.test.tsx __tests__/actions/profile.test.ts __tests__/actions/review.test.ts`. Add workspace cases only when its shared feature component is edited.
- Run `npx tsc --noEmit --incremental false`, targeted ESLint, `npm run docs:check` and `git diff --check`. Do not automatically run full lint, all integration tests, a full unit suite or build for feature-local composition; broaden only for an evidenced affected boundary.
- Manual matrix: review loading/empty/active/revealed/pending/failed save/finished/next batch/long content at 320, 375, 768 and 1280 px, keyboard-only and pointer/touch; measure target sizes, text/focus contrast, no horizontal overflow and reduced-motion equivalence; inspect 200-percent zoom. Pending/error client states covered only by component tests remain unobserved browser states unless actually reached.
- Header matrix: guest, student, teacher and admin destinations, with membership/invitation variants where destinations differ; desktop first-open/navigation/reopen and mobile parity; trigger naming, keyboard/Escape and focus return. Do not claim menu fidelity from mocked dropdown primitives.
- A substantial review-surface reshape requires the frontend-ui-review domain result once the accepted sources, deterministic state and runnable target exist; it is not a merge verdict. Owner review of the rendered D6 remains an acceptance step. The ordinary main agent performs the cumulative review; no additional agents are implied.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A capped batch is mistaken for the whole due workload. | Label batch progress and completion explicitly; fetch server truth for another batch. |
| Eligibility filtering after the cap returns no cards while due rows remain. | Describe only the empty returned batch, cover a positive due count with no cards, and preserve the existing action/query contract. |
| A saved rating is retried because D4 synchronization failed. | Treat progressError as a warning after success; never automatically repeat the rating. |
| Parent refresh or delayed responses restart/overwrite an active batch. | Stable callback/load boundaries, obsolete-load protection and interaction regression coverage. |
| Dashboard refresh removes the review opener before dialog close. | Restore a live focusable opener or the stable review-summary heading; verify both paths. |
| Review styling or header repairs change shared behavior. | Keep review-only and consumer-level scope; verify affected workspace/menu boundaries. |
| The reported smoke/menu failure remains unreproduced or requires excluded writer domains. | Record exact evidence and stop that part; do not weaken assertions or invent a cause. |
| Fixture changes contaminate another runtime or leave residue. | Loopback/isolated-workdir checks, deterministic reset/setup and bounded cleanup; no root/production reset. |
| Old trackers are treated as production evidence. | Cite recorded observations/merges; preserve D1/D2 gaps and avoid fresh hosted claims. |

- Order: CP1 and CP2 precede CP3 in the selected workstream; this is a soft execution order, not a hard FSRS dependency. D5 remains deferred and does not block the Owner-opened D6. Existing B2/D4 and merged F1 are baseline prerequisites.
- Rollout runbook: no remote rollout is included. After separately authorized implementation, checks and Owner UI acceptance, report a local checkpoint; local commits use the current Owner grant; push, PR, merge and application deployment each require their own grant. There is no migration or hosted-settings step.
- Stop when: candidate acceptance or execution authority is missing; refreshed base/ownership is unclear; an API, FSRS, permission, schema or shared-primitive change is necessary; required fixture/environment evidence is unavailable; or the reviewer establishes a material unresolved contract conflict.
- Rollback: revert only this workstream's application/docs changes under the separately granted Git procedure. No data migration is introduced. Ratings already saved through the existing action are not undone by a UI rollback.
- Completion claim: each named AC must be evidenced; unavailable browser cells and unresolved smoke/menu reproduction remain pending/blocked. D6 must not be marked fully complete merely because the plan review or docs validator passes. STUDENT-004 may close after the review-surface acceptance is met; FUTURE-REVIEW-001 must retain the separately deferred dedicated-route decision.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md). This detail plan contains no execution State or review journal.
