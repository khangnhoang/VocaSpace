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

### STUDENT-004: The review session UI opened from `/learn` is not the target experience

- Status: Accepted for now (tracked; accepted in B2 after manual QA of the review flow on 2026-07-13).
- Problem: direct mobile defects were fixed (cut-off title, horizontal overflow of phonetics, excessive blank space, rating buttons not fitting small viewports), but the composition is still a narrow variant of `FlashcardStage` and has had no full review-UX design pass on mobile and desktop.
- Evidence: the dialog uses the full viewport on mobile, card content shrinks safely, progress is clear and four ratings lay out 2x2 at 375px. Action, FSRS queue and review data are unchanged. Safe and usable for the `Ôn tập ngay` CTA, but not the final quality bar.
- Direction: a separate review-experience task evaluates information density, card anatomy, post-rating feedback and desktop composition; it does not become a new route, change the FSRS algorithm or change review actions without its own scope.
- Exit condition: that review-experience task is delivered.

### STUDENT-005: The app has no clear user-facing 404 or not-found surface

- Status: Open (tracked; non-blocking follow-up after B3 and C1).
- Problem: there is no custom 404 UI. Framework `notFound()` still handles routes safely, but the result can show only the header with an empty content area, tab titles can differ by route path, and an invalid legacy slug can keep the previous tab's title.
- Evidence: found in B3 manual QA on 2026-08-17. C1 seeded browser QA confirmed that invalid and nonexistent overview routes enter a safe framework `404` with no wrong redirect or runtime crash, so this is not a B3 or C1 defect and global not-found UX and metadata stayed out of scope.
- Direction: a separate UI and UX PR designs a user-facing not-found surface and unifies metadata and title behavior; it is not folded into C1 or C2 scope.
- Exit condition: a user-facing not-found surface with consistent metadata is merged.

### NAVIGATION-001: The mobile account menu lacks parity with desktop

- Status: Open (tracked; non-blocking follow-up after C1).
- Problem: the desktop account menu has logout, profile, settings and role destinations; the mobile menu exposes only part of the navigation and has no logout. The guest mobile menu also lacks full login and register parity.
- Evidence: found in C1 manual QA on 2026-08-18. It does not block C1 and is not part of the `/learn/[course-slug]` contract; `components/ui/header.tsx` was not changed in that correction. It is a global header and navigation parity gap.
- Direction: a separate header and navigation task builds the guest, authenticated and role action matrix, adds logout and the missing destinations on mobile and checks close behavior, focus and accessibility.
- Exit condition: mobile reaches parity with desktop for those actions, including logout.

### LEARNING-INTEGRITY-001: The database does not enforce learner-write relation integrity

- Status: Deferred (its own follow-up after C2 application-path hardening and the Q7 enrollment gate).
- Problem: `user_topic_progress`, `user_question_answers` and `user_flashcards` use self-owner RLS. Foreign keys only guarantee that each referenced id exists. The database does not prove that the progress topic is still active, accessible and enrolled, does not force `selected_option_id` to belong to `question_id`, does not derive `is_correct`, and does not prove that denormalized course ids match the parent chain. An authenticated client can call the Data API directly and create a learner-write row that violates the application relation if it knows a valid UUID. C2 must not claim database-wide security or integrity from application guards.
- Evidence: (2026-08-19) `user_topic_progress` policies are only `auth.uid() = user_id`, with FK `topic_id -> topics.id`; `user_question_answers.question_id` and `.selected_option_id` are two independent FKs with self-own policies; `questions.course_id`, `exercises.course_id` and `topics.course_id` have no composite parent-course consistency constraint. C2 boundary: parse untrusted ids, derive and verify the active parent relation in bounded reads and check every mutation error, with no migration, RLS, RPC, schema or seed change. If the Owner requires direct Data API writes blocked before C2 merge, C2 must stop and re-scope to database work (C2 has merged on the application-only path).
- Direction: after Q7, design a separate migration, RLS, RPC and constraint strategy for the remaining invalid learner writes, including relation and correctness, content-status transitions and admin and collaborator rights outside enrollment. Boundary with Q7: Q7 owns the narrow collaborator boundary (a previewer-only user cannot read drafts and a course collaborator role never becomes persistent learning-write authorization) and enforces `target topic/question/card -> course_id -> enrollments(user_id, course_id)` for the three learner-write Server Actions and for INSERT and UPDATE RLS and the Data API of the three tables. This entry keeps database-wide relation and correctness integrity outside that enrollment gate: option-question ownership, server-derived `is_correct`, whole parent-chain and course consistency, active and content relation, and the remaining direct Data API write cases. Q7 enrollment tests must not be used to close it. It is separate from `PROGRESS-001`: this entry owns relational authorization and integrity at write time, `PROGRESS-001` owned completion business truth. Do not add ad hoc policies or constraints in C2, and do not use Q7 to claim this entry closed.
- Exit condition: a future database-integrity PR is merged with local reset, allowed and denied RLS and integration cases and existing-data compatibility; it is not folded into a final completion PR while the two dependency chains stay independent.

### PREVIEW-001: Preview topic rollout prerequisites on the target environment

- Status: Open (D2 is merged and its three hosted migrations are applied, but D2 is not recorded as rolled out).
- Problem: the preview marker is managed by owner, co_owner and editor with quota `ceil(A * 20%)` (A counts topics not removed under chapters not removed; drafts count in the denominator); a draft may keep a marker but is not public; public Preview opens only for a published and public course and a published, active, marked topic. Without enough control a public user could read locked content, exceed the hard cap or write persistent progress, answer or review from a preview-only flow.
- Evidence: D1, then Q7, then D2 were delivered within their separate boundaries (D1 owns publish readiness, Q7 the internal previewer read boundary and the persistent learning-write authorization gap, D2 public readonly Preview with full content and media and transient correctness); deleting a topic or chapter removes the marker inside the target and an over-cap caused by a smaller denominator is resolved by the actor in the same flow. D2 passed final independent review at `39feb3a` and merged in PR 102 (`2074279`). Hosted migration history lists the three D2 migrations (read-only check, 2026-10-02). The repository records no creator or managed-media inventory preflight, deployment SHA or post-deploy check for D2.
- Direction: run the creator and managed-media inventory on the target environment and record the deployment and post-deploy check; local review does not replace this and grants no deploy permission.
- Exit condition: the inventory, deployment and post-deploy checks are recorded in `progress.md` or the PR.

### AUTH-003: Teacher auth redirect has no visible explanation for the user

- Status: Deferred (found in manual QA after PR A3).
- Problem: an unauthenticated request to `/teacher/*` correctly redirects to `/login`, but the login screen shows no message or toast explaining why. Proxy and session behavior are correct.
- Evidence: A3 manual QA. `AUTH-001` stays resolved; this UX gap is separate.
- Direction: a separate auth UX polish task adds a clear redirect reason without changing the authorization semantics of the proxy or session. Check login redirect query handling, login and register messaging, `proxy.ts` and `utils/supabase/middleware.ts`. The risk to avoid is widening auth behavior or replacing the teacher route guard instead of only explaining the redirect.
- Exit condition: the login screen explains the redirect and the teacher route guard behavior is unchanged.

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
- Evidence: D1 foundation, authorship amendment and the v2 and v4 corrections are delivered in PR 98 (`861e7c7`, head `d93385a`, merged 2026-09-22); the [canonical D1 detail plan](./implementation-plans/d1/plan.md) holds the contract. The escalation, rescue and review-budget design (`topic_review_escalations`, `resolve_topic_review_escalation`, the hold errors, column `rescue_escalation_id`) was removed on 2026-09-18 and replaced by the `review_notes` table (migration `20260917120000_d1_review_notes.sql`); that supersedes the earlier "escalation after the third reject" Owner statement of 2026-09-15. Limits recorded at the 2026-09-17 closure and 2026-09-23 reconciliation, none of which was remediated: no deploy or remote `db push` evidence for D1 and the full manual matrix M17 to M28 is not claimed; the canonical seed has 11 active published topics missing an active exercise and 8 missing an active flashcard (seed and service-role writes sit outside the database guarantees and there is no production-data authority to remediate them); the integration fixture suite leaves residue when rerun after a reset (cleanup debt); the admin moderation surface was still a mock at that checkpoint, so it is no live UI evidence; question-group media replace and clear are DB-first with cleanup after commit, so a cleanup failure can leave an orphan object, and there is no candidate revision. Findings closed by D1 corrections (for example `D1-SEC-001`, `D1-AUTH-002`, `D1-UX-003` and `D1-MEDIA-DELETE-001`) are not separate entries. Per-checkpoint evidence of P0 to P4-A and the corrections is in `git show eb36618:docs/refactors/student-user-flow-route/problems.md` and in PR 98.
- Direction: handle each deferred item as its own unit with its own contract; remote migration and production remediation need separate authority.
- Exit condition: each listed limit is delivered or remediated by its own unit.

### FUTURE-REVIEW-001: FSRS review route or deeper review UX

- Status: Deferred.
- Problem: FSRS review must be discoverable from `/learn`; a dedicated `/learn/review` route can wait until the dashboard and workspace are stable.
- Evidence: `ReviewSheet` is the current review flow (see `FEAT-005` and plan unit D6).
- Direction: first show a summary or card in `/learn`; add a dedicated route only if the product needs it. Verification needed: dashboard data states and review card navigation.
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
- AUTH-001 — Resolved 2026-07-11: teacher routes are under `/teacher/*` and the proxy matcher is segment-aware, with coverage for `/teacherish` and `/courses/*` negatives; `AUTH-003` stays open (PR 43, `59680afb`; PR 44, `6a639d5e`).
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
