# Teacher course portfolio redesign plan

Revision: r6, 2026-10-22. Baseline: `0fd187a91a694d9180365d8827ffebfe4ab3aff6` on `feat/teacher-courses-redesign`. The Owner accepted the `Ưu tiên tiếp tục` UI composition from the interactive aid on 2026-10-21 and subsequently authorized committing the planning/design checkpoint and pushing this branch. r4 recorded the four section 1.5 proposals; r5 added Owner-requested pagination and dropdown refinement. r6 supersedes pagination with the Owner's subsequent choice of a two-course-preview scroll region and corrects dropdown layout shift. CP1 read/write ownership and continuation hierarchy are unchanged. The independent `gpt-6.1-sol/high` review covered r2 (`979053b`), not this revision. Current authority and remaining QA are recorded in State.

## State

| Field | Value |
| --- | --- |
| Spec revision | `docs/teacher-course-portfolio-plan.md` r6 |
| Current unit / checkpoint | CP1/CP2 implemented; CP3 local checks and Owner UI/UX QA accepted; isolated-CI routing corrected and verified |
| Status | Ready for the Owner-authorized commit, normal push and PR creation; remote CI and rollout remain separate evidence |
| Completed evidence | Final checkpoint: 75/75 focused tests across six files, isolated CP1 integration 35/35, isolated persistence smoke 1/1, TypeScript and changed-file lint passed. Integration used the real PostgreSQL client inside the isolated Docker container because host psql is absent; no test assertion was changed. Owner declared UI/UX QA complete after the corrections. Earlier agent browser matrices and exact observation limits remain historical in sections 6.3–6.6; final acceptance/corrections are recorded in section 6.7. Root API 45321 remains intact with 78 migrations and the opt-in local demo; this delivery did not reset or reseed it. |
| Accepted deviations | Separately authorized environment maintenance: root-local migration apply and legacy canonical-seed topic/chapter/collaborator backfill, preserving custom data and backups. Owner-requested follow-up also corrects Button consumers in the existing shared feature CourseForm (edit/create) without redesigning that form or changing validation/writes. No backend source, shared primitive/token, permission, or hosted change. |
| Blockers / Owner decisions | No remaining local delivery blocker or unresolved product, architecture, implementation, ownership or acceptance decision. Owner explicitly authorized the two-command CI correction after verifying runtime and dependencies; TPORT1 is now excluded from the root job and included in the existing isolated job. Its guard, test assertions and production gate are unchanged. Agent-unobserved native-device cells remain independent evidence limits, not an expanded acceptance claim. |
| Next action | Complete the staged audit, commit, normally push this branch and create the PR as authorized. Remote CI, hosted migration apply and deployment are not claimed complete. |
| Current authority | Owner (2026-10-22) completed UI/UX QA and authorized the bounded CI routing correction, verification, then commit/push/PR if passing. The correction and related local tests passed; no delivery action is claimed by this pre-commit State. No merge, force-push, hosted migration apply or deployment is authorized. |

## 1. Binding specification candidate

### 1.1 Outcome

Redesign `/teacher/courses` as a private teacher-authoring portfolio that lets an authenticated collaborator:

1. recognize the courses they can access and their actual role/lifecycle state;
2. resume the most relevant course without scanning a catalog-like card grid;
3. see a bounded, complete cross-course queue of work they can legally act on; and
4. create, edit, open, or soft-delete courses only when their existing permissions allow it.

The route remains a course collaboration and authoring surface. It does not become a public catalog, analytics dashboard, generic activity feed, or replacement for the per-course Overview/Structure workspaces.

### 1.2 Observable acceptance criteria

| ID | Observable result |
| --- | --- |
| AC1 | The page loads its initial portfolio from a trusted server boundary and shows only active courses for which the current user has a current collaborator row and satisfies the existing profile/access gates. Anonymous or ineligible callers receive no portfolio data. |
| AC2 | The header identifies `Khóa học của tôi`; its utility area groups `Khóa học đang cộng tác`, a plain-text course count, and the create action when the current user may create a course. The count is not rendered as a decorative pill. |
| AC3 | Pending collaboration invitations remain visible and actionable. Accepting or rejecting an invitation refreshes the authoritative portfolio without requiring a full manual reload. |
| AC4 | A sparse portfolio of one to four courses prioritizes one deterministic continuation course, actionable work, and compact subordinate course rows. It does not stretch a generic card grid or invent KPI cards to fill space. |
| AC5 | A dense portfolio of five or more courses uses a scan-friendly list and exposes local search plus meaningful lifecycle/role filters and deterministic sorting. Search/filter controls are absent from sparse and empty states. |
| AC6 | The continuation course is selected deterministically: first from the highest-priority current attention item; otherwise by the newest active collaboration, with a stable course-ID tie-breaker. The UI does not claim untracked “recent activity.” |
| AC7 | The cross-course attention queue shows its total and a bounded internally scrollable result set. `Tất cả`, `Chờ duyệt`, and `Cần sửa` are mutually exclusive filters over the complete returned queue; there is no redundant `Xem tất cả` action. |
| AC8 | `Chờ duyệt` contains only an active pending topic submission the current user is currently permitted to review. The original creator, responsible teacher, contributors, submitter, historically excluded reviewer, and otherwise ineligible collaborator never receive a false review action. |
| AC9 | `Cần sửa` contains only actionable correction work: a course listing rejection editable by the current collaborator, or an active draft topic whose latest submission across all submitters, ordered by `(submitted_at DESC, id DESC)`, is `rejected`, with no active pending request, when the caller can edit it and is its original creator or current responsible author. Newer pending, approved, or cancelled submissions supersede older rejections; restoring a topic does not bypass this rule. Each item links to the existing course or topic recovery surface. |
| AC10 | Every course row exposes truthful role, lifecycle, rejection, and action state. Course-level previewers do not receive course edit/delete controls. Global course creation follows `canCreateCourse` independently of course role; topic correction and review entry points follow their own D1 capabilities, including legal capabilities held by a previewer. |
| AC11 | Existing course creation, edit submission, rejection-reason display, course opening, invitation handling, and soft-delete confirmation retain their behavior and routes. Mutations continue to use their existing semantic owners. |
| AC12 | Empty, loading/pending, recoverable error, sparse, dense, invitation, review, correction, and read-only states are understandable without relying on color alone. Keyboard focus, labels, narrow-width overflow, 200% zoom, and reduced-motion behavior are verified. |
| AC13 | The redesign uses the accepted product-language tokens and Button contract, creates no route-specific design system, and adds no decorative gradients, glass effects, remote stock fallback images, or unrelated shared primitives. |
| AC14 | Real-database tests prove the new read boundary's membership and reviewer/correction rules; component tests prove state/action rendering; a focused smoke test proves authenticated load, navigation, and one authoritative refresh path. |
| AC15 | Course results use a bounded internally scrollable region, initially sized to the actual first two rows and capped at 70svh for unusually tall content/short viewports. All matching courses remain accessible by scrolling and keyboard, without pagination. Search, lifecycle/role filters and sorting operate on the complete portfolio and reset the result region to the top. Continuation and attention remain independent. The three dropdowns compose the existing Select with modest corners, spaced icon-labeled options, a detached rounded menu, selected-state feedback and a state-linked arrow. Opening/closing any dropdown must not shift the portfolio horizontally under classic or overlay scrollbars; motion is restrained and removed under reduced motion. |

### 1.3 Scope

In scope:

- the `/teacher/courses` route composition and route-owned components;
- a minimal permission-sensitive read model for courses and cross-course attention;
- a reusable schema/type at the server-to-UI boundary;
- preservation of invitation, create, edit, open, rejection, and soft-delete behavior;
- sparse/dense portfolio behavior, responsive hierarchy, accessibility, and focused automated/manual verification;
- bounded course-list scrolling and feature-local Select presentation for status, role and sort;
- a narrow local/test-only browser fixture when the canonical data set cannot express the required role and workflow states.

Out of scope:

- changing course, collaborator, reviewer, publishing, rejection, or deletion permissions;
- redesigning `/teacher/courses/new`, Course Overview, Course Structure, Topic Builder, global navigation, or the public catalog;
- adding course analytics, readiness aggregation, generic notifications, activity history, pagination, drag-and-drop, bulk actions, or a new search service;
- changing existing semantic write owners or combining mutations into the new read RPC;
- changing shared tokens, fonts, Button, or other accepted design-system primitives unless implementation proves a concrete contract defect and the Owner approves that scope separately;
- adding a tracker, third party, new user-data field, or a read audience beyond the authenticated collaborator. No `/privacy` or `/terms` change is planned under this scope;
- applying a migration to the root development database, hosted database, or production environment.

### 1.4 Guardrails

| Guardrail | Failure prevented |
| --- | --- |
| G1. Treat reviewer/correction eligibility as a database authorization problem, not a client filter. | The UI could expose another teacher's private submission or a review action the caller cannot legally perform. |
| G2. Reuse the effective D1 reviewer predicates and current active-course/topic/collaborator rules; do not create a broader parallel definition. | Portfolio and Topic Builder could disagree about who may review or recover work. |
| G3. If a new definer read RPC is justified, make it argument-free for the caller identity, use explicit `auth.uid()`, fully qualify referenced objects, set a safe `search_path`, revoke PUBLIC/anon execution, and grant only the intended roles. Existing reads retain their current authorization boundaries. | A definer function could become an identity-confusion or privilege-escalation boundary. |
| G4. Return only the fields needed to render and route portfolio items; build application URLs in TypeScript rather than SQL. | The read model could leak unrelated profile/submission data or couple the database to Next.js routing. |
| G5. Preserve existing Server Actions and forms as write owners; refresh server data after successful mutations. | A visual refactor could duplicate business logic, report false success, or leave stale permission state. |
| G6. Derive compact and dense modes from the unfiltered portfolio count. Empty/search results do not silently switch the page's information architecture. | Filters could cause unstable layout and hidden controls. |
| G7. Use native page/list/scroll composition and existing primitives before adding abstractions. | The route could introduce an unneeded component system or design-token fork. |
| G8. Keep course identity and recovery context visible in every destructive or correction flow. | Teachers could edit/delete the wrong object or lose the reason they must correct it. |
| G9. Test the operation, permission result, and resulting UI rather than SQL/component implementation details. | Structural tests could pass while access or user-visible behavior is wrong. |
| G10. Keep database rollout and live visual acceptance as separate Owner gates. | Local completion could be mistaken for hosted application or accepted UI. |

### 1.5 Owner decisions and proposals

Confirmed by the current request:

- synchronize from `main`, create a new branch, investigate the repository, and write a plan before implementation;
- use the accepted general design sources and account for the earlier unimplemented `/teacher/courses` design work;
- read the governing skills and operating documentation before acting.
- (2026-10-21, follow-up) use an independent `gpt-6.1-sol/high` subagent to review this plan, correct supported findings and repeat until PASS, then commit the plan locally. This grants the planning checkpoint only; it does not authorize runtime implementation.
- (2026-10-21, design review) inspect an aid before deciding the final interface or whether an RPC is necessary; the read mechanism must follow the visible data requirements.
- (2026-10-21, acceptance) `chốt giao diện`, with `Ưu tiên tiếp tục` selected in the aid. Accept that variant's page composition: header utility/count/create, continuation and subordinate course rows, and the adjacent bounded attention queue with its real category filters. The `Danh sách trước` alternative is not selected. This is UI acceptance, not acceptance of synthetic records, permission changes, a specific RPC, or runtime implementation authority.
- (2026-10-21, delivery) commit the current branch's planning/design changes and push `feat/teacher-courses-redesign` to `origin`; runtime implementation remains a later step.
- (2026-10-21, proposals) dense threshold: five or more courses switch to the dense list with search/filter/sort, derived from the unfiltered count (AC5, G6).
- (2026-10-21, proposals) continuation: the AC6 rule with the section 4.2 comparator (correction before review, oldest actionable timestamp first, stable identity tie-break; newest active collaboration and course ID as fallback); queue filters do not change it.
- (2026-10-21, proposals) read mechanism: CP1 first maps every visible field and queue eligibility rule to existing reads using the existing permission semantics. Reuse safe existing reads when they meet the contract; otherwise add one read-only `get_teacher_course_portfolio()` (provisional name) migration under G3, and report that selection with its evidence to the Owner before CP2.
- (2026-10-21, proposals) delivery scope: exclude cross-course content-readiness calculations; deliver one vertical pull request with three sequential checkpoints (CP1 read, CP2 route, CP3 validation), with no separate PR for CP1.

- (2026-10-21, ownership split) CP1 (backend read contract) is implemented by a Sonnet implementor session with local commits only; CP2/CP3 (route composition and validation) are handed to a separate frontend developer, who builds on the CP1 contract and does not edit the CP1 database/schema/action files without reconciling with the CP1 owner.
- (2026-10-22, UI correction) After inspecting the data-rich page, the Owner requested pagination because roughly ten courses made the page too long, plus modest dropdown corners, detached rounded menus, spaced icon-labeled options, arrow open/close motion and smoother selection. This supersedes the previous pagination exclusion only for local presentation of the existing complete CP1 portfolio. It grants implementation, not commit/push or a shared Select redesign.
- (2026-10-22, subsequent UI correction) The Owner reported all three dropdowns shifting left on open and found five-course pages still too long; replace pagination with a two-course-preview scroll region and fix the shift. This supersedes the preceding pagination choice, retains complete filtering and the r5 dropdown presentation, and grants no shared-primitive/backend or Git/remote changes.
- (2026-10-22, final UI acceptance and delivery) After requesting touch-primary Action Blue/white CTAs, animated attention-filter indication and hidden course thumbnails below 768px, the Owner declared UI/UX QA complete and authorized commit, normal push and PR creation when no blocker remains; merge and hosted rollout are not included.

The 2026-10-21 acceptances settled product and scope choices only. The Owner subsequently granted frontend implementation and separately approved local environment migration/seed remediation on 2026-10-22, as recorded in State. A change to the accepted composition, attention taxonomy, or reviewer/correction ownership still requires reconciliation before dependent implementation continues.

## 2. Governing design contract

- [Product language](./ui-design-system-and-review/product-language.md) owns the Canvas/Surface hierarchy, Plus Jakarta Sans, semantic action/route/recall/growth/attention/correction tokens, restrained motion, and the prohibition on generic glass/gradient/card decoration.
- [Teacher Authoring](./ui-design-system-and-review/screen-types/teacher-authoring.md) defines `/teacher/courses` as a private collaborator portfolio combining direct continuation, conditional creation, and a bounded complete actionable queue. It also requires truthful role/lifecycle/rejection/readiness context and allows search/filter/sort only when portfolio size warrants them.
- [Button](./ui-design-system-and-review/components/button.md) owns action hierarchy, variants, focus, loading, and disabled behavior. This route consumes it without reopening the shared primitive.
- The closed design program's [progress record](./ui-design-system-and-review/progress.md) records the prior `/teacher/courses` refinement: `Khóa học đang cộng tác`, compact no-pill count, permitted create action in the header utility area, subordinate course rows without an extra list heading, and the complete filtered attention queue. That record is accepted design evidence, not proof of runtime implementation and not a fixed pixel geometry.
- [Retained aid](./assets/teacher-course-portfolio/accepted-aid.html) preserves the exact prototype presented for this decision. Only `Ưu tiên tiếp tục` is the selected composition; the retained file also contains the unselected `Danh sách trước` comparison. Its default has a sparse three-course portfolio, attention enabled, and invitations absent; controls expose illustrative states. Prototype records, notices, visual shortcuts, simulated navigation, and control settings are not data, permission, or production-behavior authority. Product Language, Teacher Authoring, Button, and this plan's explicit invariants continue to govern implementation.

Screen classification: Teacher Authoring. Primary job: resume a course or take the next legally actionable authoring/review step. Subject grounding comes from stewardship state—course identity, collaborator role, lifecycle, rejection reason, assignment, and review ownership—not decoration. Visual latitude is medium but deliberately restrained because this is a permission-sensitive productivity surface.

Responsive composition:

- Wide view: the accepted `Ưu tiên tiếp tục` composition places the continuation course and subordinate rows on the left, with the bounded attention queue on the right. Header utility/count/create remain together; pending invitations appear before the main regions when present. Preserve this hierarchy while allowing responsive sizing and content wrapping rather than copying fixed prototype dimensions.
- Sparse view: one continuation emphasis plus compact subordinate rows; the queue remains visible without manufacturing empty analytics.
- Dense view: list scanning, local search/filter/sort, and the same queue semantics.
- Narrow view: preserve the page title and essential actions, place attention before the full course list, keep filters horizontally safe or wrapped, and avoid hidden hover-only actions.

## 3. Repository-confirmed facts at the baseline

- `app/(teacher)/teacher/courses/page.tsx` is currently a client component. It loads courses and permissions in an effect and owns edit/delete/modal state; it has no cross-course attention read, server-first initial load, or sparse/dense composition.
- `app/(teacher)/teacher/courses/_components/CourseList.tsx` renders a responsive catalog-like card grid with a remote stock-image fallback, lifecycle overlays, rejection text, and icon actions. It already receives the caller's course role and hides mutation controls from previewers.
- `CollaboratorInvitationPanel.tsx`, `CourseForm.tsx`, and `DeleteCourseModal.tsx` are existing semantic interaction owners that the redesign must preserve rather than replace casually.
- `app/actions/course.ts` owns the current course list, permission, create, update, and soft-delete operations. Existing tests in `__tests__/actions/course.test.ts` protect rejection metadata and mutation truthfulness.
- `lib/schemas/course.ts` owns current course status, collaborator role, and `TeacherCourse` contracts. `__tests__/components/course-authoring-trust.test.tsx` protects the separate create route, valid rejection display, previewer restrictions, route ownership, and soft-delete wording.
- `topic_review_submissions` is RLS-protected and unavailable for direct authenticated-table reads. Effective review behavior already uses restricted `SECURITY DEFINER` functions and reviewer predicates. The table has a `(topic_id, status)` index; `course_collaborators` has a unique `(user_id, course_id)` index.
- `20260919100000_d1_topic_authority_split.sql` separates topic-content authority from course role; a creator/responsible/contributor may retain topic editing after a downgrade to previewer. `has_topic_review_access` also permits eligible previewers with `can_review_topics`. Course creation instead follows the caller's global teacher profile through `getTeacherCoursePermissions`.
- `20261002100000_d3_memory_check_stage.sql` retains topic-wide rejection history. Cancellation/withdrawal leaves historical rejected submissions stored while returning the topic to draft; history alone therefore cannot identify a current correction item.
- The current per-course readiness action traverses a course graph and is not an appropriate cross-course portfolio query. Calling it once per course would create avoidable N+1 work and duplicate Course Overview's concern.
- Existing authoring surfaces and `app/globals.css` already expose the accepted semantic tokens. No new palette or shared token is needed for this route.
- `supabase/seed.sql` contains course and collaborator roles but no canonical pending/rejected topic-review set sufficient for the full portfolio matrix. Existing E2E helpers establish the repository pattern for deterministic local fixtures.
- The prior Teacher Workflow and UI Design System programs are closed. This standalone plan does not reopen either program or claim their historical work was implemented in the route.

## 4. Bounded implementation hypotheses

The exact file split may change while the acceptance criteria and ownership boundaries remain true.

### 4.1 UI-to-data mapping and trusted read contract

- First map every accepted visible field/action to an existing read or a demonstrated gap. `getCoursesForTeacher` already reads participating courses and `getTeacherCoursePermissions` reads global creation permission. The cross-course attention queue is the main candidate gap; UI acceptance alone does not justify a new RPC or migration.
- Compare safe reuse/composition of existing reads against a route-specific aggregate read, accounting for authorization, completeness, query count, and payload size. Do not choose a service-role table read merely to bypass the existing protected submission boundary.
- If that comparison demonstrates the need for a new RPC, the candidate is an argument-free `get_teacher_course_portfolio()` (provisional name) introduced by one focused migration. If safe existing reads fully meet the contract, use them without a new RPC/migration. Record the selection and its repository evidence before implementation.
- A new aggregate RPC, if selected, would return a minimal JSONB document containing:
  - `canCreateCourse`;
  - active collaborator courses with the fields already needed by the portfolio plus membership creation time for deterministic fallback ordering;
  - minimal attention items: kind, course/topic identity and title, safe lifecycle/reason context, and a stable ordering timestamp.
- Reuse current reviewer eligibility helpers/predicates. Encode topic-correction eligibility at the same database boundary so UI rendering cannot broaden it.
- Select the latest topic submission across all statuses and submitters before testing whether it is rejected; do not select the latest rejected row from history. Apply current course/chapter/topic/profile/membership and topic-content capability gates as well as AC9's creator/responsible ownership.
- Add a reusable Zod schema/inferred type such as `lib/schemas/teacher-course-portfolio.ts` and a focused server-side read wrapper/Server Action. Safe parsing must reject drift rather than render a partially trusted payload.
- Keep any selected RPC read-only and keep route construction, labels, filtering, and presentation ordering in the application unless permission semantics require database ordering.

### 4.2 Route composition

- Make `page.tsx` a server-first route that obtains the initial authoritative portfolio and renders a route-owned client workspace for search, filters, edit/delete dialogs, invitation mutation feedback, and refresh behavior.
- Replace the generic `CourseList` card grid with route-owned continuation, compact course-row, dense-list, and attention-queue composition. Reuse small existing components when their contracts still match; do not preserve a component name merely to avoid a targeted replacement.
- Continue to route creation to `/teacher/courses/new`, opening to `/teacher/courses/[id]`, and topic correction/review to existing Topic Builder settings/workflow surfaces.
- After a successful invitation, course edit, or delete mutation, call `router.refresh()` (or the smallest equivalent authoritative refresh) and reconcile local selection/modal state. Do not optimistically grant a role or remove a course before the server confirms it.
- Use semantic HTML, visible labels/tooltips for icon-only actions, stable focus return, non-color status text, and CSS/layout tokens already in the repository.
- Default deterministic comparator: correction items before review items, then oldest actionable timestamp first (`reviewed_at` for corrections, `submitted_at` for reviews), then stable item identity `(kind, courseId, topicId or courseId)`. Use that same unfiltered ordering for the queue and continuation selection; queue filters must not change the continuation course. This is a bounded presentation hypothesis, not a claim of measured urgency; an equivalent comparator may change without altering eligibility or completeness. Cover category ordering, equal timestamps, and filter independence with focused pure-logic tests.

### 4.3 Test fixture

Fixture readiness outcome: **canonical fixture requires narrow additions**.

- Prefer a dedicated local/test-only `scripts/e2e/teacher-course-portfolio-fixture.mjs` using existing fixture helpers and isolated E2E Supabase runtime.
- Create only deterministic records needed for an empty/sparse/dense actor, ordinary previewer, previewer with creator/responsible authority, previewer with review permission, legally eligible reviewer, excluded original creator, current topic correction, superseded correction (newer pending, approved, and cancelled/withdrawn cycles, including restore), course rejection, and pending invitation.
- Clean up only owned records and restore any reused actor state. Do not change production seed data solely to serve one smoke spec unless implementation proves broader reusable value.

### 4.4 CP1 read-strategy record (2026-10-21)

Field-to-read mapping at baseline `4725c000`:

| Visible field / rule | Existing read | Result |
| --- | --- | --- |
| Course rows: title, slug, thumbnail, status, role, rejection reason | `getCoursesForTeacher` (`app/actions/course.ts`) reads `course_collaborators` under RLS | Covered, but it omits the membership creation time that AC6's fallback ordering needs |
| `canCreateCourse` | `getTeacherCoursePermissions` (profile role) | Covered; folded into the read so one session snapshot answers both and the removed-profile gate matches `createCourse` |
| Review queue (`Chờ duyệt`) | None. `topic_review_submissions` has no authenticated table read; `get_topic_workflow_state` is per-topic and needs known topic IDs (no cross-course listing) | Gap |
| Correction queue (`Cần sửa`, topics) | None. `get_topic_workflow_state` returns only rejected rows (`rejectionHistory`), not the latest submission across submitters, so a newer pending/approved/cancelled row cannot be detected | Gap |
| Course rejection editable by the caller | Rejection fields exist on the course row; edit capability is `has_course_authoring_access` (owner/co_owner/editor) | Derivable client-side from role, but folded so the queue is one complete result |

Selected mechanism: one new argument-free read-only RPC `public.get_teacher_course_portfolio()` (`supabase/migrations/20261021120000_tport1_teacher_course_portfolio.sql`). Reusing existing reads would need one structure read per course plus one workflow call per topic (N+1) and still could not express supersession. Eligibility reuses the effective D1 predicates instead of defining new ones: review = pending topic and pending submission, submitter excluded, `has_topic_review_access` (as `approve_topic_review`/`reject_topic_review` use it); topic correction = latest submission across all submitters is `rejected`, topic is `draft`, `d1_topic_group_member` and the caller is original creator or responsible author; course rejection = draft course with `reviewed_at` and a non-blank `reject_message`, plus `has_course_authoring_access`. Topics must also sit in an active chapter/course (the same gate as `get_topic_workflow_state`). No reviewer semantics were changed, so no Owner decision was triggered. Note: `d1_topic_group_member` includes the original creator, so a creator who is no longer responsible keeps correction entry (consistent with AC9).

Hand-off contract for CP2: schema and types in `lib/schemas/teacher-course-portfolio.ts` (`teacherCoursePortfolioSchema`, `TeacherCoursePortfolio`, `TeacherPortfolioCourse`, `TeacherAttentionItem`, `TeacherAttentionKind`, `TeacherCoursePortfolioResult`); server read `getTeacherCoursePortfolio()` in `app/actions/teacher-course-portfolio.ts`. Payload fields are snake_case; `courses[]` is `TeacherCourse` plus `membership_created_at`; `attention[]` carries `kind` (`topic_review` maps to `Chờ duyệt`; `topic_correction` and `course_rejection` map to `Cần sửa`), course/topic identity, `reason`, and `ordering_at` (submission time for review, review time for corrections). The RPC returns attention in a stable order but the section 4.2 comparator, routes and labels stay in the application.

## 5. Checkpoints

| Checkpoint | Outcome | Required evidence |
| --- | --- | --- |
| CP1 — confirmed read strategy and trusted portfolio read | Map accepted UI data to existing reads/gaps, record the smallest safe mechanism, and then provide the portfolio/attention result with correct membership, reviewer, correction, active-state, and error behavior. A new RPC is conditional on that mapping. | Field-to-owner/read reconciliation; schema/action tests; real-database integration matrix. If a new migration/RPC is needed: migration review, isolated reset, and permission/grant inspection. Focused lint/TypeScript; no hosted application. |
| CP2 — responsive route composition | The route implements the accepted sparse/dense/attention hierarchy while preserving invitations and course mutations. | Component/form interaction tests for every visible state and role; current authoring trust regressions; focused lint/TypeScript; author self-review against AC1–AC13. |
| CP3 — integrated validation and handoff | Database, server, client, and navigation behavior compose; remaining visual judgment is explicitly Owner-reviewed. | Focused Chromium smoke with deterministic fixture; desktop/narrow manual matrix; accessibility and console checks; `npm run docs:check`; `git diff --check`; formal completed-implementation review before merge readiness. |

Checkpoints are sequential because CP2 consumes CP1's returned contract and CP3 validates their composition. Parallel implementation is not recommended for this unit. Completion of a checkpoint does not authorize a commit, push, PR, database apply, or the next lifecycle action.

## 6. Verification plan

Planned commands are selected from the baseline repository and are not implementation evidence yet:

```powershell
npm run test:run -- __tests__/actions/course.test.ts __tests__/components/course-authoring-trust.test.tsx <new focused schema/action/component tests>
npm run test:integration -- <new teacher course portfolio integration test>
npx tsc --noEmit
npm run lint -- <changed TypeScript and TSX files>
npm run test:e2e -- e2e/smoke/teacher-course-portfolio.smoke.spec.ts
npm run docs:check
git diff --check
```

The implementation must use the repository's isolated Supabase/E2E workdir and its target guards for reset and fixture operations. It must not reset the Owner's persistent root development database. Exact migration commands and environment setup are taken from the then-current Supabase skill/workflow rather than copied into this plan as stale ceremony.

### 6.1 Automated behavior matrix

| Layer | Required cases |
| --- | --- |
| Schema/read wrapper | Valid full/empty payload; malformed enum/UUID/nullable reason; safe failure without leaking raw SQL details. |
| Real database | Anonymous denied; no membership excluded; active owner/co-owner/editor/previewer course visibility; removed course/topic and lost collaboration excluded; legal reviewer included; submitter/original creator/responsible/contributor/historical preapproval exclusion; permission flag denial; topic correction ownership; latest-submission selection across submitters; newer pending, approved, and cancelled/withdrawn submissions suppress historical correction, including after restore; previewer with creator/responsible authority retains legal correction entry; eligible previewer with review permission receives review work; global teacher creation is independent of course role; course rejection mutation eligibility; no duplicate items. |
| Server/action | Auth failure, RPC failure, parse failure, successful empty/sparse/dense data, and no client-supplied actor identity. |
| Component | Empty/create, sparse continuation, dense search/filter/sort, queue totals and filters, no-action empty filter, invitations, course/topic rejection, ordinary previewer course read-only controls plus independently authorized create/correction/review entry points, loading/pending and recoverable failure, edit/delete success and failure refresh behavior. |
| Regression | Existing create route, rejection reason, collaborator entry points, mutation truthfulness, route builders, and soft-delete identity/copy. |
| Smoke | Authenticated route load, representative sparse or dense portfolio, one attention navigation, one server-authoritative invitation or edit refresh, no page/console error. |

### 6.2 Manual UI matrix

Run against deterministic non-production data after CP2 automated checks pass:

| State / actor | Widths and checks |
| --- | --- |
| Empty portfolio with create permission | `1440`, `768`, `375`, `320`; clear next action, no fake metrics/search, no horizontal page scroll. |
| Sparse portfolio, no attention | `1440`, `1024`, `375`; continuation hierarchy, compact remaining rows, truthful no-attention state. |
| Dense portfolio with mixed lifecycle/roles | `1440`, `1024`, `768`, `375`; search/filter/sort stability, count truthfulness, long Vietnamese text, internal queue scroll. |
| Pending invitation | Keyboard accept/reject, pending/disabled state, failure recovery, focus return, authoritative refresh. |
| Eligible review versus excluded author | The queue exposes the review item/CTA only to the eligible reviewer. Existing Topic Builder read access and topic-wide rejection history remain governed by their current contract. |
| Course/topic correction | Reason and object identity remain visible; link lands on the existing recovery surface; historical correction is absent after a newer pending, approved, or cancelled/withdrawn submission, including after restore. |
| Ordinary previewer without topic capabilities | Course edit/delete controls are absent; open/preview remains usable. Global create is shown only when `canCreateCourse` is true, independently of the course role. |
| Previewer with creator/responsible topic authority | Eligible topic correction entry remains available while course edit/delete stays absent. |
| Previewer with `can_review_topics` | Eligible pending review appears; original-creator/responsible/contributor/history exclusions still suppress ineligible work. |

Across the matrix: inspect focus visibility/order, icon labels, status meaning without color, 200% zoom, reduced motion, loading stability, empty/error recovery, and browser console. Owner live review is required for final hierarchy/visual acceptance because static tests cannot establish design quality. Unobserved rows remain explicitly pending.

### 6.3 Focused rendered handoff — 2026-10-22

Target: dirty frontend diff over `ddd2c7a`, local dev `/teacher/courses` on port 3000. Actor: canonical `teacher@gmail.com`, two real collaborator courses, empty attention queue; the existing custom course was opened/cancelled only, not edited or deleted. The isolated smoke fixture additionally proves one current course-rejection item, navigation and a successful persisted edit. No runtime mocks were added.

Accepted sources (SHA-256): Product Language `9382DC47EA589B9167906EA28EBB500AD31D0BA9F0170FEA6F72459007B053DA`; Teacher Authoring `F0378668E208E2E5A4F861CFFC89321E092FBFA9538E10DC8C9E9B96B8F9B160`; Button `BC2FB95AF7103649C6CE2201B123C66614C46707C00CE4D73D85B1A277166404`. The Owner-selected continuation composition is recorded in section 2; the retained aid remains illustrative, not runtime or permission evidence.

| Coverage | Result |
| --- | --- |
| Sparse real portfolio at 1440/1024/768/375/320px | Observed: no horizontal page overflow; attention precedes courses below the desktop breakpoint; no stock-image fallback. Screenshots: ignored `test-results/teacher-portfolio-desktop.png`, `teacher-portfolio-mobile.png`, `teacher-portfolio-320.png`. |
| Keyboard/focus and confirmation | Observed: native focus ring on create; edit cancel returns focus to the page heading; confirmation names the object, fits 375px and closes with Escape. No destructive operation executed on root data. |
| Zoom/reduced motion | CSS 200% zoom emulation had no page overflow; reduced-motion preference retained the same actions. Native browser zoom and physical touch remain not verified. |
| Measured colors/geometry | Primary white/action contrast 4.70:1; body/canvas 7.25:1; route/white 5.17:1; filter boundary/white 4.76:1. Primary CTA height 44px, queue filters 46px; rendered font Plus Jakarta Sans. These are measured pairs, not a whole-screen accessibility certification. |
| Functional journey | Isolated Chromium smoke passed: real login, correction-to-course navigation, edit/refresh, database title check, reload persistence and 375px no-overflow. |
| Dense, empty/create, invitation, reviewer and previewer variants | Component/logic coverage passed; rendered data-rich matrix remains `not_run` because these fixtures were not prepared for the focused root-local review. No full section 6.2 completion claim. |

Rendered domain result: `incomplete` (remaining required matrix cells unobserved); no unresolved class (A) or (B) finding in the observed scope. During author review, nested landmark/long uppercase drift, missing-image handling, sparse duplication and recoverable-failure state were corrected before the final checks. The final observed page/form/confirmation journey had no application console error; a Canvas2D performance warning came from the QA color-measurement script, not application code. The shared existing CourseForm/create route was preserved, not visually redesigned.

`npm run docs:check`: 0 structure violations; one baseline broken link, zero new. `git diff --check` is required at the final checkpoint. No production build, full test suite or new CP1 integration rerun was needed for this frontend-only source diff; CP1 real-DB evidence is historical and the new focused smoke establishes the composed path only.

### 6.4 Data-rich responsive correction — 2026-10-22

Owner follow-up: add about twenty actionable tasks, many collaboration invitations and enough courses to inspect continuation/list scale, then audit responsive Button application. The binding layout/permission contract remains r4. Target: dirty frontend diff over `ddd2c7a`, root-local dev port 3000; accepted source identities are unchanged from section 6.3.

Fixture command (explicit local write): `node scripts/dev/seed-teacher-portfolio-demo.mjs --apply`. The script reads root CLI runtime env without printing keys, refuses any API other than `http://127.0.0.1:45321`, verifies existing seed actor identities, and only inserts missing records in its `f9200000-0000-4000-8000-*` namespace. It does not reset/delete data, rewrite existing records or restore actioned invitations. It is opt-in, not part of canonical `seed.sql`, app startup or CI. Topic submission/rejection and invitations use existing lifecycle RPCs; schema/RLS/RPC definitions are unchanged. The Supabase migration-and-seed and RPC references governed fixture safety; RLS/Storage changes were not needed.

For `teacher@gmail.com` / local seed password `123123`, both fixture runs returned: 8 new collaborator courses, 20 new actionable items (10 topic reviews, 6 topic corrections, 4 course-listing corrections), and 8 pending invitations. Total visible courses at verification: 12, including pre-existing Owner data. The single continuation comes from the unfiltered priority comparator; additional courses remain in the dense portfolio, not a second continuation carousel. Records are explicitly labeled `[UI demo]`. The demo is intentionally left for Owner interaction; accepting/rejecting work changes its counts normally.

Corrections prompted by observation: the former invitation panel was 978px high at 1440px and 1794px at 320px. Its complete list now scrolls inside 256px with a visible total. Queue height remains bounded at 400px with 20 items; category changes create a fresh native scroll viewport so old keyboard/touch momentum cannot retain the previous filter's position. Pending invitations use immediate local state rather than a deferred transition, stable-size labels and a truthful distinction between an unconfirmed response and a confirmed response whose subsequent refresh failed. Slugs are not shown as ordinary invitation metadata.

| Observed matrix | Result |
| --- | --- |
| Mouse/fine pointer: 1920 and 1366px; 768px comparison | Ordinary primary and local icon actions measured 36px, icons 18px, Button radius 8px, standard labeled padding 14px. Queue navigation remains a subordinate text action. |
| Touch/coarse input: 1024, 768, 375, 320px; 1366px hybrid comparison | Critical standalone actions measured 44px, icons 20px, radius 8px; Comfortable labeled padding is 20px. Contextual icon controls retain a visible boundary. Queue/list navigation switches to a visible secondary affordance rather than a bare text action. |
| Layout | Two main columns at 1280px and above; attention precedes the course area below that width. Invitation actions and form footer stack/full-width on narrow screens and sit alongside content/actions when space permits. Viewport width selects composition independently of pointer capability. No horizontal overflow in the portfolio or edit form at the tested widths. |
| Queue/invitations | All 20 tasks and all 8 invitations remain in the DOM/accessible lists, native scrolling works, category counts are 10/10, continuation is filter-independent, and the final laptop/375/320px reset probe measured `scrollTop=0` after changing filters from the bottom. |
| Pending/failure | At 1366px mouse and 375px touch, a request held then aborted before reaching the server proved disabled/progressive feedback and exactly stable Button width/height; all 8 invitations remained. Deliberately injected network errors are not counted as normal application errors. Component tests also prove denied responses and confirmed-response/refresh-failure copy. |
| Form/keyboard/motion | Image chooser is opened by a native keyboard-accessible Button without submitting the form. Footer Buttons use shared Action Blue/8px geometry, not old custom cyan/padding. Settled Tab focus measured the 2px Route ring with 2px offset; reduced motion measured `transition-property: none`. Existing shared destructive confirmation was preserved, not globally redesigned. |
| Read-only actor | `previewer@gmail.com` at 375px touch: zero course mutation controls, 10 legitimate review entries, global create still available, and no overflow. |
| Zoom limitation | 200% CSS zoom at 1366px had no overflow. Combining CSS zoom 200% with a 320px physical viewport produced 441px overflow (about 160 effective CSS pixels, below the supported 320px layout minimum); no claim covers that combination. Native browser zoom and physical-device behavior are not certified by these emulations. |

Evidence is ignored output: `test-results/portfolio-scale-before.png`, `portfolio-desktop.png`, `portfolio-tablet.png`, `portfolio-laptop-ready.png`, `portfolio-mobile-ready.png`, `portfolio-minimum-ready.png`, `portfolio-previewer-mobile.png`; reproduction drivers remain under ignored `test-results/`. Final measurements cover mouse/touch independently, not device-name guesses. After the final geometry/scroll correction, the narrow/laptop probes were rerun; unchanged wider matrix observations remain valid for the unchanged behaviors.

Checks: `npm run test:run -- __tests__/components/teacher-course-portfolio.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/utils/teacher-portfolio-demo.test.ts` passed 33/33, `npx tsc --noEmit` passed, and changed-file lint passed. No new full-suite/build or database reset was needed for this focused consumer/fixture correction. The earlier real-persistence smoke is historical, not a newly rerun smoke. `frontend-ui-review` result remains `incomplete` for the full section 6.2 matrix/native-device acceptance; the recorded responsive/Button subset has no unresolved (A)/(B) mismatch. Owner acceptance, empty/read-only-correction variants not reproduced here, native zoom and the rest of section 6.2 remain pending. No commit/push/hosted action was performed.

### 6.5 Owner-requested pagination and dropdown correction — 2026-10-22

The Owner's feedback supersedes the local-pagination exclusion in r4; r5/AC15 records the bounded change. The route now slices the filtered/sorted complete CP1 course array into five-course pages, shows the result range and previous/current/next navigation, resets to page one when search/filter/sort changes, and clamps the displayed page when refreshed server data shrinks. Paging restores focus to the result summary and brings the new results into view. Continuation, queue, permissions and mutation owners are unchanged. This is presentation pagination, not a smaller server query or a new RPC.

The three dropdowns reuse the existing Radix-backed Select through the feature-local `PortfolioFilterSelect`; no shared primitive, package, backend, seed or token changed. Triggers have 8px corners; menus have 12px corners, an 8px gap from the trigger, 6px inner padding and 4px between icon-labeled options. The arrow points toward the label when closed and down when open (220ms); the floating menu uses the inherited 240ms reveal and selected/hover colors transition over 220ms. Reduced motion removes these animations/transitions. A usage-site override prevents the shared Select viewport minimum width from consuming the menu padding; another resolves the state-animation specificity under reduced motion.

Fixture readiness: existing `scripts/dev/seed-teacher-portfolio-demo.mjs` data is sufficient; no reset, reseed or action on invitations/courses was performed. The browser matrix used `teacher@gmail.com` at 1920px/1366px mouse, 768px/375px/320px touch and 1366px touch. Every case exposed 12 distinct course URLs over pages 5/5/2, search reset to page one, and continuation stayed unchanged. All three menus stayed inside the viewport with the measured 8px external gap, about 7px inset including the border, 4px option spacing, and 36px mouse / 44px touch targets. Arrow state changed from 90deg to 0deg; default durations measured 220ms/240ms. Keyboard ArrowDown/End/Enter selected the final role; Escape returned focus to the trigger. Reduced-motion probes measured menu `animation-name: none` and option/arrow `transition-property: none`. No horizontal overflow, page error or console error occurred in these six fresh-context journeys.

Evidence: ignored `test-results/portfolio-dropdown-review.js` and `portfolio-dropdown-{laptop,mobile,minimum}.png`; laptop/mobile screenshots were visually inspected after the final padding/layout correction. Component command `npm run test:run -- __tests__/components/teacher-course-portfolio.test.tsx` passed 20/20, including real Select interaction, full/partial last pages, no duplicates, global search/filter/sort reset, server-data shrink and unchanged continuation. TypeScript and changed-file lint passed. Only the verification comment changed after the last component run; test/runtime bytes are otherwise identical. Previous persistence/integration evidence is historical and was not rerun for this client-only correction. Native browser zoom, physical devices, full section 6.2 coverage and Owner visual acceptance remain pending; no full accessibility or merge-readiness claim is made. No commit or push was performed.

### 6.6 Two-course-preview scrolling and dropdown layout stability — 2026-10-22

The Owner found five-course pages still too long and replaced that choice with bounded scrolling. Pagination state, slicing, result-range calculations and pager controls are removed. `CourseList` now retains every matching row inside a labeled, focusable native scroll region. A local ResizeObserver measures the first two real rows, including long titles/rejection context and touch controls; that measurement bounds the viewport, with a 70svh ceiling so unusually tall rows or short windows cannot recreate an excessively long page. Native scrolling exposes the remaining content rather than truncating it. The region reserves its own scrollbar gutter; changing search, status, role or sort resets its scroll position without changing continuation or the complete-result semantics. No backend/data/shared-primitive changes were needed.

The dropdown shift was not reproduced in headless Chromium's overlay-scrollbar environment. Headed Chromium with Windows scrollbars reproduced all triggers moving left 4.5px: root `scrollbar-gutter: stable` already reserved the gutter, while Radix's RemoveScroll added a 9px body margin. The portfolio root now locally compensates that duplicate margin using the library's `--removed-body-scroll-bar-size` variable. Scroll locking, focus containment, pinch zoom and the shared Select/global CSS remain untouched. With overlay scrollbars the variable is zero, so no compensation is added.

Existing local demo data was sufficient; no seed, reset or mutation was performed. Six headed and six headless contexts covered 1920/1366px mouse, 768/375/320px touch and 1366px touch. Each had 12 rows, exactly two fully visible initially in default order, and keyboard End reached the final course. Headed default heights were approximately 311px laptop, 431px at 375px and 479px at 320px; headless values were 312/432/480px. Long correction rows after title sorting may hit the 70svh ceiling and require scrolling before the second row is fully visible; this deliberately preserves readable content rather than clipping text or growing the whole page. All three dropdowns measured 0px position/width delta before/open/closed in every context, including classic 9–10px body-gap compensation. Search/sort reset to scrollTop 0, all eight `[UI demo]` courses were searchable, continuation was unchanged, and no horizontal overflow/page error/console error occurred in these journeys.

Verification: `npm run test:run -- __tests__/components/teacher-course-portfolio.test.tsx __tests__/components/course-authoring-trust.test.tsx` passed 31/31; `npx tsc --noEmit` and changed-file ESLint passed. The only subsequent test edit updates its verification comment, so these results remain applicable. Browser driver and visually inspected laptop/mobile screenshots are ignored output under `test-results/portfolio-scroll-review.js` and `portfolio-scroll-{laptop,mobile,minimum}.png`. Section 6.5's unchanged dropdown-motion observations are reused; they are not a new motion run. Full QA/native zoom/physical-device and Owner visual acceptance remain pending; no commit, push or merge claim is made.

### 6.7 Owner acceptance and final delivery checkpoint — 2026-10-22

The Owner explicitly declared UI/UX QA complete after reviewing the running local page and the follow-up corrections. This is the visual acceptance source; it does not retroactively convert the agent's unobserved matrix cells into independent browser evidence. The historical `frontend-ui-review: incomplete` records above remain truthful for their stated matrices. No full WCAG/native-device certification is claimed.

Final corrections retained in the candidate: course open, clear-filter and attention CTAs use Action Blue with white text/icons on touch-primary inputs, while mouse/trackpad keeps quiet Route links; the attention selector has one persistent indicator moving over 220ms and color feedback, with no motion under reduced motion; course thumbnails are hidden below 768px and both content and row actions reclaim the horizontal space. Existing observed probes cover colors/44px targets at 320/375/768px touch, 36px mouse actions at 1366px, live indicator transitions at 320/375/768/1366px, and thumbnail/alignment boundaries at 320/375/767/768/1366px. These preceding probes are historical acceptance support, not newly rerun visual certification. No shared primitive/token, backend contract or permission changed during these refinements.

Final automated command: `npm run test:run -- __tests__/actions/teacher-course-portfolio.test.ts __tests__/schemas/teacher-course-portfolio.test.ts __tests__/components/teacher-course-portfolio.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/utils/teacher-portfolio-demo.test.ts __tests__/actions/course.test.ts` passed 75/75 across six files. `npx tsc --noEmit`, ESLint on all changed TS/TSX/MJS files and syntax checks of both new fixture scripts passed. Only test-header metadata and this document changed afterward, so the product/test behavior evidence remains applicable.

`npm run test:e2e -- e2e/smoke/teacher-course-portfolio.smoke.spec.ts` freshly passed 1/1 after rebuilding only `.e2e-runtime` / `voca_space_e2e` (API 45441, DB 45442), including all 78 migrations and canonical seed. The smoke proves correction navigation, a real saved edit, authoritative refresh, database title persistence, reload and 375px no-overflow. The dev runtime/port 3000 was left running and root-local data was not reset.

The isolated CP1 integration suite freshly passed 35/35. Its first host invocation produced 31 passes and four `spawnSync psql ENOENT` failures; the machine has no host PostgreSQL client. An ignored in-session Node preload then forwarded only the helper's guarded `127.0.0.1:45442` psql invocation, with unchanged SQL/stdin/flags, to real `psql` inside `supabase_db_voca_space_e2e`. This is a tooling adapter, not a mocked database or product/helper edit. Reproduction artifacts are ignored `test-results/run-portfolio-integration.mjs` and `portfolio-docker-psql-preload.mjs`; they are not delivered. Native CI environments with psql use the repository command directly.

Main self/integration review covered the current frontend diff over `ddd2c7a` and the cumulative CP1 read boundary against `0fd187a`: caller identity comes from auth.uid(), the read wrapper returns only parsed safe data, existing write owners enforce validation/auth/permissions, and local fixtures are opt-in and target-guarded. The final CI trace found one Required delivery blocker: the root-runtime integration command included TPORT1, whose beforeAll rejects every API except 45441, while the existing isolated integration job omitted it. On 2026-10-22 the Owner explicitly authorized only the necessary routing correction after prerequisite verification. The destination already installs Node/npm/project dependencies and Supabase CLI, prepares migrations/seed in `.e2e-runtime`, checks API 45441 and exports the required keys; global integration opt-in is enabled. The [official Ubuntu runner manifest](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md) confirms Docker and PostgreSQL availability. Only the two test-command lists changed; no guard, assertion, setup, condition or production gate changed.

Post-correction verification: YAML parsing and an exact semantic comparison against HEAD passed after removing only the two added routing tokens; the isolated command contains nine unique existing suite paths. All 17 workflow run blocks passed Git Bash `bash -n` outside the sandbox, without executing their commands; the sandbox attempt could not initialize MSYS (`NtCreateDirectoryObject`, `0xC0000022`). No local actionlint executable is available, so this is syntax/routing verification, not full GitHub Actions runtime validation. TPORT1 freshly passed 35/35 with the same real isolated PostgreSQL adapter. The six-file focused command above freshly passed 75/75 outside the sandbox; its sandbox attempt failed before tests because Vitest cache rename was denied (`EPERM`). No tests were skipped or weakened. Previous TypeScript, lint and persistence-smoke results remain applicable because only CI routing and delivery documentation changed afterward. Full-suite/build and the complete nine-suite CI job are not locally rerun; no remote CI pass is claimed. The candidate is ready for authorized delivery, not already committed/pushed by this record. Hosted application of `20261021120000_tport1_teacher_course_portfolio.sql` before UI rollout remains a separate authorized operation. No hosted database or deployment action is part of this checkpoint.

## 7. Risks, rollout, and rollback

| Risk | Mitigation / stop condition |
| --- | --- |
| The new queue disagrees with the effective D1 authorization contract. | Reuse effective predicates and prove both positive and exclusion paths in a rebuilt database. Stop if the existing helper cannot express portfolio eligibility without changing reviewer semantics. |
| One RPC becomes a broad analytics/read framework. | Keep the response route-specific and minimal. Omit readiness/activity data without a current acceptance criterion. |
| Sparse/dense behavior becomes arbitrary or unstable. | Freeze the approved threshold, derive mode from unfiltered count, and test boundary counts four/five. |
| Server-first refresh breaks forms or focus. | Keep mutation owners, add interaction tests, and verify focus/recovery manually. Stop rather than replacing a semantic owner only to simplify rendering. |
| An old mock is mistaken for the accepted geometry. | Judge against Product Language, Teacher Authoring, and recorded Owner decisions; treat old aids as non-authoritative composition evidence. |
| Browser data is non-reproducible. | Prepare the bounded fixture before smoke/manual QA; report fixture failure rather than testing with ad hoc Owner data. |
| A migration is locally correct but not deployed. | Record local/hosted state separately. Hosted apply requires a later explicit grant and read-only drift inspection. |

Rollout, only under later explicit authority:

1. Complete CP1–CP3 and completed-implementation review on the feature branch.
2. Obtain separate commit/push/PR authority and require CI green.
3. If CP1 selected a new migration, before any hosted apply inspect migration history, function/grant definitions, and drift read-only; stop on unexplained divergence.
4. Apply a selected migration only under explicit database authority, then verify the effective signature, owner, grants, and representative safe reads. If existing reads suffice, there is no new migration to apply.
5. Deploy the application under separate authority and complete the Owner's live visual/behavior acceptance before merge/rollout is called complete.

Rollback prefers a focused forward migration for a database-contract defect and an application rollback for presentation defects. Do not edit published migrations, restore broader data access, or mutate root/hosted environments as an unapproved recovery shortcut.

## 8. Plan self-review gates

Before implementation begins:

- every acceptance criterion must trace to the Owner request, accepted design contract, or a repository-confirmed correctness constraint;
- every proposed permission rule must match the effective database contract rather than UI inference;
- predicted files remain hypotheses unless required by a semantic owner;
- no closed program is reopened and no prior design aid is misreported as shipped runtime;
- the Owner explicitly accepts the pending proposals in section 1.5 (done 2026-10-21, r4);
- the Owner grants runtime implementation authority.

Before reporting implementation complete:

- review the actual cumulative diff and current evidence against AC1–AC14, scope, exclusions, and guardrails;
- record every failed, skipped, unavailable, or pending check without weakening the claim;
- report changed files, checks, fixture/manual QA state, migration/hosted state, remaining risk, and a recommended English Conventional Commit message;
- stop for a plan-contract mismatch, permission ambiguity, unverified reviewer boundary, unavailable required real-database evidence, or missing Owner authority.
