# Problems, risks and follow-ups — Student/user flow and route refactor

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Decision record: [ADR](../../adr/refactor-student-user-flow-route-adr.md).

This file was migrated to the repository templates and translated to English on 2026-10-05. The full Vietnamese entries, including per-checkpoint evidence logs and implementation audit items, are in Git: `git show eb36618:docs/refactors/student-user-flow-route/problems.md`. Risks by wave are in the master plan, section 6.

## Open

### STUDENT-003: Visual composition of `/learn` is a temporary solution

- Status: Accepted for now (tracked; accepted in B2 after manual QA on 2026-07-13). Not a final design approval.
- Problem: the layout puts review, course path and payment reminder in the right responsibility zones, but visual quality and density balance do not yet meet the final quality bar for a workspace used often.
- Evidence: B2 manual QA of the dashboard, 2026-07-13. Desktop keeps review and payment in the left column and the learning path in the right; mobile orders `Nhịp ôn tập`, then course path, then payment. Course CTA, review action and payment interactions are unchanged.
- Direction: a separate frontend polish task (D8) re-evaluates hierarchy, density, card height and responsive rhythm; it is not merged with C2 URL synchronization or deeper payment history.
- Exit condition: that polish task is delivered.

### STUDENT-004: Review-session completion and return actions need correction

- Status: Open (all current UI, including the completion and iPad Mini spacing corrections, accepted by Owner on 2026-10-08; isolated smoke and delivery pending).
- Problem: exhausted review queues still offered another batch and reload; return copy mixed English dashboard terminology into Vietnamese. Owner also noted slightly fast animation and rating buttons lacking color distinction, but accepted their appearance.
- Evidence: Owner confirmed content is accessible by vertical scrolling at actual 200% zoom. The local correction uses existing due counts for next-batch eligibility, congratulates exhausted queues, removes empty reload and uses `Quay lại`. Component/type/lint checks pass; current browser checks are blocked before fixture setup by Windows excluded TCP 55397–55496, including E2E ports 55441/55442. Historical D6/L1 passes do not substitute for current correction verification; details are in [progress.md](./progress.md).
- Direction: deliver the bounded completion correction and verify its zero/2/51-card journeys when the configured isolated runtime can bind ports; optional motion/color polish remains in FUTURE-REVIEW-001. Preserve the accepted composition, existing actions and FSRS.
- Exit condition: the completion correction is delivered with its empty/final-batch/remaining-batch behavior verified and accepted.

### STUDENT-008: Desktop dashboard flashes a narrow layout during loading

- Status: Open (fixed and browser-verified locally on 2026-10-08; delivery pending).
- Problem: the server media-query snapshot selected a one-column dashboard on desktop until hydration switched the component tree.
- Evidence: Owner video/screenshot and delayed JavaScript reproduction. CSS now places one DOM tree responsively; root browser probes at 1440/768/375 preserve course/review geometry before and after hydration, with no horizontal overflow. Tall-sidebar independence and filter retention on resize also pass. Component/type/lint checks pass; the added isolated smoke remains unavailable under the excluded-port blocker documented in [progress.md](./progress.md).
- Direction: deliver the bounded layout correction while preserving mobile order, accepted composition and existing responsive item limits.
- Exit condition: the correction is delivered with responsive loading evidence; do not infer publication from local checks.

### LEARNING-INTEGRITY-001: The database does not enforce learner-write relation integrity

- Status: Open (L1 implemented and verified locally on 2026-10-08; delivery and hosted rollout remain pending).
- Problem: hosted Q7 still uses enrollment-only answer/card write eligibility and independent parent/option FKs. It does not enforce the Owner's new full active/published write chain or derive saved correctness. D4 already owns progress through its server-derived RPC; direct learner progress writes are denied, so that earlier part of the gap is closed separately by PROGRESS-001.
- Evidence: L1 migration `20261008130544_l1_learner_integrity.sql` replaces five FKs with composite relations under their original names/delete actions; private eligibility composes Q7 enrollment and checks active course/chapter/topic/content/profile with published course/topic. INSERT and both UPDATE targets are protected. An invoker trigger derives correctness on every answer write; historical attempts remain unchanged when an author edits the key. Populated upgrade, invalid-history rollback, isolated rebuild and 86 integration cases passed, including cross-graph privileged writes, parent-key concurrency, historical SELECT and D4/PostgREST compatibility. This migration has not run on root dev or hosted.
- Direction: deliver [L1](./implementation-plans/integrity-closeout/plan.md) after local review; before separately authorized hosted rollout repeat existing-data inventory and verify applied constraints/policies/grants plus allowed/denied writes. Preserve Q7 enrollment ownership, D4 completion, historical SELECT and FSRS semantics. Availability is statement-visible; no global serialization or automatic historical repair is claimed.
- Exit condition: the integrity PR is merged with upgrade/reset and allowed/denied integration evidence, followed by separately authorized hosted verification. Local tests alone do not close this entry.

### PREVIEW-001: Preview topic rollout prerequisites on the target environment

- Status: Open (D2 migration/deployment/inventory and denied-route evidence verified read-only on 2026-10-08; successful production Preview/private-media journey remains unavailable).
- Problem: the preview marker is managed by owner, co_owner and editor with quota `ceil(A * 20%)` (A counts topics not removed under chapters not removed; drafts count in the denominator); a draft may keep a marker but is not public; public Preview opens only for a published and public course and a published, active, marked topic. Without enough control a public user could read locked content, exceed the hard cap or write persistent progress, answer or review from a preview-only flow.
- Evidence: D2 merged in PR 102 (`2074279`); all three migrations are present in hosted history. Deployment `dpl_FhBS5Vme698SJmPGMJweK4hNqRUs` is READY at `fd24f0f`, with D1/D2 verified ancestors and `vocaspace.com` alias confirmed. Read-only creator/owner/media inventories, public catalog/course detail and an existing unmarked Preview-unavailable route are recorded in [progress.md](./progress.md). There are zero marked Preview topics, zero managed/legacy group-media references and zero objects in the private group-media buckets; no positive production Preview or private-content response is claimed.
- Direction: preserve this partial rollout result. When a legitimate production Preview/media state and permission are available, verify the positive journey and read-only boundaries; do not create a marker or content merely to close the tracker.
- Exit condition: inventory, deployment and functional post-deploy checks are recorded, including a successful eligible Preview/private-media journey when that content exists. Missing positive coverage cannot be inferred from READY or local fixtures.

### QUALITY-001: The repository-wide lint baseline is not green

- Status: Open.
- Problem: the full-lint command cannot be used as a green repository-wide gate. The remaining errors are in test, action, webhook and discount files outside any unit diff; D1 did not create them.
- Evidence: (2026-09-15; found at the B1.7 release gate on 2026-07-11) `npm run lint` returned 7 errors and 13 warnings repository-wide, in `__tests__/actions/admin-dashboard.test.ts`, `app/api/webhook/payos/route.ts` and `lib/discounts/discount-pricing.ts`. D1 targeted lint passed with 0 errors and 2 pre-existing warnings in `AddExerciseDialog.tsx`.
- Direction: keep targeted lint green for each workstream's files and do not fix or mask baseline errors inside unrelated units; a separate follow-up PR fixes the existing errors and warnings and restores `npm run lint` as a green gate without weakening the ESLint configuration.
- Exit condition: full lint on an updated base reports 0 errors and the warning policy is reconciled.

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
- Direction: handle each deferred item as its own unit with its own contract; remote migration and production remediation need separate authority.
- Exit condition: each listed limit is delivered or remediated by its own unit.

### FUTURE-REVIEW-001: FSRS review route or deeper review UX

- Status: Deferred.
- Problem: FSRS review must be discoverable from `/learn`; a dedicated `/learn/review` route can wait until the dashboard and workspace are stable.
- Evidence: `ReviewSheet` is the current review flow (see `FEAT-005` and plan unit D6). On 2026-10-08 the Owner accepted the delivered UI and confirmed scrolling at 200% preserves content, with non-blocking feedback that animation feels slightly fast and rating buttons lack color distinction between levels.
- Direction: retain those motion/color notes for a bounded polish task when opened; no such implementation is claimed. Add a dedicated route only if the product needs it. Verification needed for a route change: dashboard data states and review card navigation.
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
- PROGRESS-001 — Resolved 2026-10-02: RPC `public.d4_sync_topic_progress` derives completion on the server (all active cards reviewed at least once, memory check passed when present, all active exercise questions answered correctly) and clients no longer write `user_topic_progress`; migration `20261002130000` applied to hosted (PR 118, `ab92e21`).
- STUDENT-007 — Resolved 2026-10-02: the do-nothing "Hoàn thành bài học" button was removed; once a topic is complete, "Bài sau" or "Về tổng quan khóa học" is the primary button and completion shows in the header and chapter list (PR 118, `ab92e21`).
- D1-AUTHORSHIP-001 — Resolved 2026-09-22: topic-level authorship and responsibility (P0-A to P4-A and corrections) are implemented and merged; the browser smoke does not extend to the full M17 to M28 matrix or production deployment (PR 98, `861e7c7`).
- D1-NAV-001 — Resolved 2026-09-16: create-topic navigation uses the authoritative new topic id with 0, 1 or many existing drafts, proven by a current-route smoke and by ordering side effects after the navigation push (PR 98, `861e7c7`).
- AUTH-002 — Moved 2026-10-02 to the [Auth onboarding problems](../auth-onboarding/problems.md) with the same ID; it is no longer tracked here.
- E2E-001 — Resolved 2026-10-07: co-owner/draft fixtures with D1/D2 provenance, current teacher routes and public syllabus expectations restore the four affected specs in two full local smoke runs; AUTH-010 remains open and this correction is local only.

- NAVIGATION-001 — Resolved 2026-10-08: mobile/desktop account destinations, logout and keyboard close/focus parity merged in F1 (PR 139, `ee46176`); D6 CP2 names the avatar and verifies first-open/navigation/reopen on seeded roles. The reported blank first-open was not reproduced; no mount fix is claimed.
- STUDENT-005 — Resolved 2026-10-08: the user-facing not-found surface and consistent title/noindex metadata merged in F1 (PR 139, `ee46176`).
- AUTH-003 — Resolved 2026-10-08: redirect sign-in notice merged with unchanged route guards in F1 (PR 139, `ee46176`).
