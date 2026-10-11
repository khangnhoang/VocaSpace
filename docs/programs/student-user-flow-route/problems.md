# Problems, risks and follow-ups — Student/user flow and route refactor

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Decision record: [ADR](../../adr/refactor-student-user-flow-route-adr.md).

This file was migrated to the repository templates and translated to English on 2026-10-05. The full Vietnamese entries, including per-checkpoint evidence logs and implementation audit items, are in Git: `git show eb36618:docs/refactors/student-user-flow-route/problems.md`. Risks by wave are in the master plan, section 6.

## Open

### STUDENT-003: Visual composition of `/learn` is a temporary solution

- Status: Accepted for now (tracked; accepted in B2 after manual QA on 2026-07-13). Not a final design approval.
- Problem: the layout puts review, course path and payment reminder in the right responsibility zones, but visual quality and density balance do not yet meet the final quality bar for a workspace used often.
- Evidence: B2 manual QA of the dashboard, 2026-07-13. Desktop keeps review and payment in the left column and the learning path in the right; mobile orders `Nhịp ôn tập`, then course path, then payment. Course CTA, review action and payment interactions are unchanged.
- Direction: a separate frontend polish task (D8) re-evaluates hierarchy, density, card height and responsive rhythm; it is not merged with C2 URL synchronization or deeper payment history.
- Update (2026-10-09): D8-LUI (Decision 24) changes only semantic colors on `/learn`; hierarchy, density, card height and responsive rhythm are not revisited by it, so this entry stays open.
- Exit condition: that polish task is delivered.

### LEARNING-INTEGRITY-001: The database does not enforce learner-write relation integrity

- Status: Open (L1 merged in PR 142, `a92f371`; the hosted migration was applied and history synchronized by 2026-10-09; hosted constraint, grant and allow/deny smoke results are not recorded).
- Problem: hosted Q7 still uses enrollment-only answer/card write eligibility and independent parent/option FKs. It does not enforce the Owner's new full active/published write chain or derive saved correctness. D4 already owns progress through its server-derived RPC; direct learner progress writes are denied, so that earlier part of the gap is closed separately by PROGRESS-001.
- Evidence: L1 migration `20261008130544_l1_learner_integrity.sql` replaces five FKs with composite relations under their original names/delete actions; private eligibility composes Q7 enrollment and checks active course/chapter/topic/content/profile with published course/topic. INSERT and both UPDATE targets are protected. An invoker trigger derives correctness on every answer write; historical attempts remain unchanged when an author edits the key. Populated upgrade, invalid-history rollback, isolated rebuild and 86 integration cases passed, including cross-graph privileged writes, parent-key concurrency, historical SELECT and D4/PostgREST compatibility. Hosted rollout observations (2026-10-09): migration `20261008130544` applied once with one authorized history-version repair and no schema rerun; deployment READY at `a92f371`. Root dev has not run it.
- Direction: deliver [L1](./implementation-plans/integrity-closeout/plan.md) after local review; before separately authorized hosted rollout repeat existing-data inventory and verify applied constraints/policies/grants plus allowed/denied writes. Preserve Q7 enrollment ownership, D4 completion, historical SELECT and FSRS semantics. Availability is statement-visible; no global serialization or automatic historical repair is claimed.
- Update (2026-10-11): LF3 plan Q2 keeps this entry open until its hosted verification step (LF3 CP6, one read-only constraint/policy/grant check plus allowed/denied writes under an Owner grant) is recorded; nothing new is claimed here.
- Exit condition: the integrity PR is merged with upgrade/reset and allowed/denied integration evidence (met), and hosted verification covers applied constraints/policies/grants and allowed/denied writes (not yet recorded). Local tests alone do not close this entry.

### QUALITY-001: The repository-wide lint baseline is not green

- Status: Open.
- Problem: the full-lint command cannot be used as a green repository-wide gate. The remaining errors are in test, action, webhook and discount files outside any unit diff; D1 did not create them.
- Evidence: (2026-09-15; found at the B1.7 release gate on 2026-07-11) `npm run lint` returned 7 errors and 13 warnings repository-wide, in `__tests__/actions/admin-dashboard.test.ts`, `app/api/webhook/payos/route.ts` and `lib/discounts/discount-pricing.ts`. D1 targeted lint passed with 0 errors and 2 pre-existing warnings in `AddExerciseDialog.tsx`.
- Direction: keep targeted lint green for each workstream's files and do not fix or mask baseline errors inside unrelated units; a separate follow-up PR fixes the existing errors and warnings and restores `npm run lint` as a green gate without weakening the ESLint configuration.
- Exit condition: full lint on an updated base reports 0 errors and the warning policy is reconciled.

### PERF-RLS-001: Content read policies scan all readable content per query

- Status: Open (found 2026-10-10 during LF2; LF2 only routes its two learner actions around it; [LF3](./implementation-plans/lf3/plan.md) owns the fix and records the local baseline first).
- Problem: the hosted plan of the memory-check read evaluates the `question_options` SELECT policy over every readable topic instead of only the requested question. Questions, exercises and topics also call `private.q7_can_read_topic` per row. Hypothesis, to be measured: this cost grows with content and slows question reads in the workspace and Data API answer writes.
- Evidence: hosted `EXPLAIN` (no `ANALYZE`, `authenticated` role, 2026-10-10) plans the `question_options` SELECT policy as a hashed subplan with `Seq Scan on topics` filtered by `private.q7_can_read_topic`. Preview timing: question context query about 400 ms on hosted versus about 55 ms on the small local fixture. LF2 plan r4 section 2.
- Direction: in its own unit, make the content read policies check only the requested parent (for example a per-row `SECURITY DEFINER` helper keyed by the parent id). Measure page loads before and after, and run read-boundary tests for learner, previewer, collaborator and admin. Also optimize `private.q7_can_read_topic` itself: one call runs several helper queries (`has_course_content_read_access`, `is_admin`, `d1_topic_group_member`, `has_topic_review_access`), and every table on the parent path repeats it for the same topic, so the same answer is computed many times per request. Candidates: fold the helpers into one SQL query, and evaluate the check once per topic per statement. Count calls with `EXPLAIN ANALYZE` or function statistics before choosing.
- Update (2026-10-11): local baseline on the isolated runtime at the LF2 migrations (deterministic fixture of 200 topics, `ANALYZE`d, student claims): the `question_options` read of one question calls `private.q7_can_read_topic` 32 times (8 per returned option) and the exact PostgREST statement of the `getLearningWorkspace` topic request calls it 5885 times; medians 12.27 and 743.58 ms in a quiet session (15.5 and about 875 ms back-to-back with the rerun). After LF3 CP2 (per-parent policies plus the folded check, both applied locally only) the calls are 4 and 853 and the medians about 3 and about 100 ms; the single-question plan no longer scans `topics`. Hosted plan, hosted measurement and the Owner page-load comparison are still to be recorded after rollout (LF3 CP6).
- Exit condition: the `question_options` read for one question no longer scans unrelated topics in the hosted plan, the read-boundary suites pass, and the measured page and action reads improve.

### PERF-ACTION-001: LF2 missed the card-rating and answer latency targets in production

- Status: Open (found 2026-10-11 after the LF2 production measurement; the Owner decided not to do further card latency work in LF3, LF3 plan Q4).
- Problem: after LF2 the production browser medians (fetch start to the end of the response body of the Server Action POST) are rating-first 444 ms (n = 14), rating-update 471 ms (n = 10), memory answer 525 ms (n = 5) and exercise answer 640 ms (n = 8), against the Owner targets of 300 ms or less for a card rating and 500 ms or less for an answer. The baseline medians were 597, 524, 1602 and 4464 ms.
- Evidence: LF2 plan r4 section 2 (baseline and per-step preview timing) and the 2026-10-11 production re-measurement in [progress.md](./progress.md). Memory and exercise answers improved 3 to 7 times; the card rating improved by about 10 to 26 percent; the preview step timing (`auth.getUser` 47 to 56 ms, other steps 47 to 92 ms each) suggests the remaining cost is mostly hosted round trips and auth, which an in-database change does not remove (an inference, not a new measurement).
- Direction: no work is scheduled. A further reduction would need a different mechanism (for example optimistic UI or moving auth validation off the critical path), which is a new Owner decision with its own plan.
- Exit condition: the card-rating target is met on production, or the Owner accepts the measured level and closes the entry.

### FUTURE-OWNERSHIP-001: Ownership transfer is not available

- Status: Deferred (the singular-owner invariant was closed in D1; only ownership transfer remains).
- Problem: before the D1 correction the canonical seed gave `Local TOEIC Test Course` two `owner` rows and the schema had no guard against several active owners.
- Evidence: D1 keeps exactly one owner created by the supported course-creation RPC, allows `co_owner` as an additional privileged membership, and adds a partial unique index allowing at most one owner per course (migration `20260916110000_d1_single_course_owner.sql`, seed change, preflight that fails closed on existing duplicate owners, regression tests for course creation, authenticated Data API and RPC denial, service-boundary duplicate rejection and co_owner behavior). No ownership-transfer feature was opened.
- Direction: design ownership transfer as its own unit when the product needs it.
- Exit condition: an ownership-transfer unit is delivered; its timing is undecided until the product needs it.

### FUTURE-PUBLISH-001: Topic authoring, review and publication follow-ups

- Status: Deferred (D1 itself is delivered; the items below are what remains).
- Problem: D1 is merged, but these limits remain. The v3 target-attached review-note creation UI, email or push delivery, bulk UI and candidate revisions are not implemented (`FEAT-007`).
- Evidence: D1 foundation, authorship amendment and the v2 and v4 corrections are delivered in PR 98 (`861e7c7`, head `d93385a`, merged 2026-09-22); the [canonical D1 detail plan](./implementation-plans/d1/plan.md) holds the contract. The escalation, rescue and review-budget design (`topic_review_escalations`, `resolve_topic_review_escalation`, the hold errors, column `rescue_escalation_id`) was removed on 2026-09-18 and replaced by the `review_notes` table (migration `20260917120000_d1_review_notes.sql`); that supersedes the earlier "escalation after the third reject" Owner statement of 2026-09-15. Historical limits recorded at the 2026-09-17 closure and 2026-09-23 reconciliation: hosted/deployment evidence was then unavailable and the full manual matrix M17 to M28 was not claimed; the canonical seed has 11 active published topics missing an active exercise and 8 missing an active flashcard (seed and service-role writes sit outside the database guarantees and there is no production-data authority to remediate them); the integration fixture suite leaves residue when rerun after a reset (cleanup debt); the admin moderation surface was still a mock at that checkpoint, so it is no live UI evidence; question-group media replace and clear are DB-first with cleanup after commit, so a cleanup failure can leave an orphan object, and there is no candidate revision. Findings closed by D1 corrections (for example `D1-SEC-001`, `D1-AUTH-002`, `D1-UX-003` and `D1-MEDIA-DELETE-001`) are not separate entries. Per-checkpoint evidence of P0 to P4-A and the corrections is in `git show eb36618:docs/refactors/student-user-flow-route/problems.md` and in PR 98.
- Evidence update (2026-10-08, L1 read-only): hosted D1 migration history and current deployment ancestry are now confirmed; active creator/authorship and duplicate-owner inventories have no gaps, and all 16 active published production topics have active cards and exercise-stage content. Public course routes and an unavailable unmarked Preview route were observed. This resolves the absence of rollout evidence, not canonical seed debt, cleanup debt, candidate revisions, media cleanup atomicity or the full M17 to M28 manual matrix. See [progress.md](./progress.md).
- Evidence update (2026-10-09): the Owner confirmed that the D1 UI cases he listed were already tested by him locally during D1 development. This is historical Owner-reported local evidence with no original SHA and no production scope, kept separate from the hosted DB/RPC probes above; it closes the local manual-evidence gap (including exercise creation and browser navigation) for the listed cases only. Whether that list equals the labels M17 to M28 is not independently verified. Seed debt, cleanup debt, media cleanup atomicity and candidate revisions stay open.
- Direction: handle each deferred item as its own unit with its own contract; remote migration and production remediation need separate authority.
- Exit condition: each listed limit is delivered or remediated by its own unit.

### FUTURE-REVIEW-001: FSRS review route or deeper review UX

- Status: Deferred.
- Problem: FSRS review must be discoverable from `/learn`; a dedicated `/learn/review` route can wait until the dashboard and workspace are stable.
- Evidence: `ReviewSheet` is the current review flow (see `FEAT-005` and plan unit D6). On 2026-10-08 the Owner accepted the delivered UI and confirmed scrolling at 200% preserves content, with non-blocking feedback that animation feels slightly fast and rating buttons lack color distinction between levels.
- Direction: retain those motion/color notes for a bounded polish task when opened; D8-LUI does not restyle ReviewSheet, so no such implementation is claimed. Add a dedicated route only if the product needs it. Verification needed for a route change: dashboard data states and review card navigation.
- Exit condition: the product decides on the dedicated route and the chosen scope is delivered.

### FUTURE-PAYMENT-001: Deeper payment dashboard and history

- Status: Deferred.
- Problem: the dashboard only needs a pending-payment reminder; full payment history and dashboard are a separate scope.
- Evidence: current dashboard shows only the pending payment reminder (`FEAT-006`, plan unit D9).
- Direction: keep the initial DTO narrow and add deeper payment history only when the product need is clear. Verification needed: behavior of pending, paid, cancelled, expired and failed states.
- Exit condition: the product need is clear and a payment unit with its data and query boundary is delivered.

## Resolved

One line each. Details stay in Git (`git show eb36618:docs/refactors/student-user-flow-route/problems.md`) and in the cited PR.

- ROUTE-001 — Resolved 2026-07-11: teacher authoring moved wholesale to `app/(teacher)/teacher/courses` (Wave A, PR 43, `59680afb`); `/courses` is the public catalog (PR 42 to 44).
- ROUTE-002 — Resolved 2026-07-11: route helpers, tests and docs now use `/teacher/courses`; remaining `/courses` mentions are historical baseline or the public contract (PR 42, `d800d648`; PR 43, `59680afb`; PR 44, `6a639d5e`).
- AUTH-001 — Resolved 2026-07-11: teacher routes are under `/teacher/*` and the proxy matcher is segment-aware, with coverage for `/teacherish` and `/courses/*` negatives (PR 43, `59680afb`; PR 44, `6a639d5e`).
- STUDENT-001 — Resolved 2026-07-13: `/learn` is the student dashboard reading `getLearnDashboard()`, and `/profile` no longer carries it (PR 48, `00bdadab`).
- STUDENT-002 — Resolved 2026-08-19: exact `/learn/[course-slug]` renders the enrolled overview with a public-safe identity and no protected syllabus or progress for an unenrolled learner; public discovery stays at `/courses/[slug]`; workspace sync continued as `WORKSPACE-001` (PR 75, `3cb7a9f`).
- STUDENT-006 — Resolved 2026-08-19: each enrolled course card keeps its fast-path CTA and adds a secondary `Xem tổng quan` to `/learn/[course-slug]` (PR 75, `3cb7a9f`).
- PAYMENT-001 — Resolved 2026-07-13: course detail owns the detailed pending payment state and the dashboard shows a `PendingPaymentSummary` with per-`paymentId` dismissal in `sessionStorage` (PR 48, `00bdadab`).
- PAYMENT-002 — Resolved 2026-07-11: PayOS `cancelUrl` is built from the server-resolved published course slug as the canonical `/courses/[course-slug]`; the PayOS sandbox cancellation manual QA was not run, so no manual result is claimed (PR 46, `079ad46`).
- WORKSPACE-001 — Resolved 2026-09-14: the URL is the workspace source of truth with parent-before-child access, no fallback, and trusted relation checks before progress, question and review writes; the B2 initial-topic seam and the old syllabus, content and history paths were retired (PR 96, `3a95c310`).
- MEMORY-001 — Resolved 2026-10-02: `exercises.activity_stage` (`exercise` or `memory_check`) is separate from `part_type`, and a memory check has a null `part_type` (PR 117, `fb8030f`).
- PROFILE-001 — Resolved 2026-07-13: `/profile` renders only the account surface, `CoursesPlaceholder` is gone and navigation has a `/learn` entry (PR 48, `00bdadab`).
- PROGRESS-001 — Resolved 2026-10-02: RPC `public.d4_sync_topic_progress` derives completion on the server (every active card has latest rating Good or Easy since LF1, previously reviewed at least once; memory check passed when present; all active exercise questions answered correctly) and clients no longer write `user_topic_progress`; migration `20261002130000` applied to hosted (PR 118, `ab92e21`).
- LEARNING-FOLLOWUP-001 — Resolved 2026-10-10: merged in PR 144 (`7bb92ce`), migration `20261010090000` applied to hosted and verified read-only; latest-rating flashcard completion and authored explanations on correct exercise answers are delivered, with the learning flow accepted by the Owner. The memory-check bypass remains tracked as MEMORY-002.
- STUDENT-007 — Resolved 2026-10-02: the do-nothing "Hoàn thành bài học" button was removed; once a topic is complete, "Bài sau" or "Về tổng quan khóa học" is the primary button and completion shows in the header and chapter list (PR 118, `ab92e21`).
- D1-AUTHORSHIP-001 — Resolved 2026-09-22: topic-level authorship and responsibility (P0-A to P4-A and corrections) are implemented and merged; the browser smoke does not extend to the full M17 to M28 matrix or production deployment (PR 98, `861e7c7`).
- D1-NAV-001 — Resolved 2026-09-16: create-topic navigation uses the authoritative new topic id with 0, 1 or many existing drafts, proven by a current-route smoke and by ordering side effects after the navigation push (PR 98, `861e7c7`).
- AUTH-002 — Moved 2026-10-02 to the [Auth onboarding problems](../auth-onboarding/problems.md) with the same ID; it is no longer tracked here.
- E2E-001 — Resolved 2026-10-07: co-owner/draft fixtures with D1/D2 provenance, current teacher routes and public syllabus expectations restore the four affected specs in two full local smoke runs; AUTH-010 remains open and this correction is local only.

- STUDENT-004 — Resolved 2026-10-09: the review-session completion and return correction (existing due counts for next-batch eligibility, congratulation on exhaustion, `Quay lại`, no empty reload) was verified on the zero/2/51-card journeys, accepted by the Owner on 2026-10-08 and merged in L1 (PR 142, `a92f371`); optional motion/color polish stays in FUTURE-REVIEW-001.
- STUDENT-008 — Resolved 2026-10-09: CSS owns the dashboard column placement with one DOM tree, so desktop no longer flashes a narrow layout before hydration; responsive loading evidence recorded and merged in L1 (PR 142, `a92f371`).
- NAVIGATION-001 — Resolved 2026-10-08: mobile/desktop account destinations, logout and keyboard close/focus parity merged in F1 (PR 139, `ee46176`); D6 CP2 names the avatar and verifies first-open/navigation/reopen on seeded roles. The reported blank first-open was not reproduced; no mount fix is claimed.
- STUDENT-005 — Resolved 2026-10-08: the user-facing not-found surface and consistent title/noindex metadata merged in F1 (PR 139, `ee46176`).
- AUTH-003 — Resolved 2026-10-08: redirect sign-in notice merged with unchanged route guards in F1 (PR 139, `ee46176`).
- MEMORY-002 — Resolved 2026-10-11: the L1 answer INSERT/UPDATE `WITH CHECK` and the definer answer RPC refuse an exercise answer until the memory check is passed, while memory-check questions stay answerable; migrations `20261010120000` and `20261010150000` are applied to hosted and verified, LF2 merged in PR 146 (`fc8abde`).
- PREVIEW-001 — Resolved 2026-10-11: the Owner marked a topic as Preview from the teacher side, opened it with another not-enrolled account on production and finished it (end screen "Tiến độ không được lưu" with the enroll call to action); this counts as the eligible Preview journey on top of the 2026-10-08 and 2026-10-09 read-only and guest observations (LF3 plan Q3).
