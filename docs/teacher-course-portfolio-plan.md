# Teacher course portfolio redesign plan

Revision: r4, 2026-10-21. Baseline: `0fd187a91a694d9180365d8827ffebfe4ab3aff6` on `feat/teacher-courses-redesign`. The Owner accepted the `Ưu tiên tiếp tục` UI composition from the interactive aid on 2026-10-21 and subsequently authorized committing the current planning/design checkpoint and pushing this branch. r4 records the Owner's acceptance of the four section 1.5 proposals on 2026-10-21; the read mechanism is now an accepted CP1 decision procedure rather than a pending proposal. The earlier independent `gpt-6.1-sol/high` review and local plan checkpoint covered r2 (`979053b`); that PASS is not r3 or r4 review evidence. No grant so far authorizes runtime implementation, a pull request, merge, deployment, or database changes for the redesign.

## State

| Field | Value |
| --- | --- |
| Spec revision | `docs/teacher-course-portfolio-plan.md` r4 |
| Current unit / checkpoint | CP1 (trusted portfolio read) implemented locally; CP2 and CP3 not started |
| Status | CP1 correction round 1 applied after Codex FAIL (2 major, 2 minor); automated checks passed on the isolated runtime; re-review pending |
| Completed evidence | r2 independently reviewed and committed in `979053b`; Owner accepted the selected `Ưu tiên tiếp tục` aid and the section 1.5 proposals on 2026-10-21. CP1 (2026-10-21, isolated E2E runtime API 45441 only): `db reset` applied `20261021120000_tport1_teacher_course_portfolio.sql`; `npm run test:integration -- __tests__/integration/tport1-teacher-course-portfolio.test.ts` 30/30 passed (round 1 added cross-submitter latest-selection, `id DESC` tie-break, soft-deleted profile/topic, responsible-not-submitter and late-contributor cases, each with a positive control); `npm run test:run -- __tests__/schemas/teacher-course-portfolio.test.ts __tests__/actions/teacher-course-portfolio.test.ts __tests__/actions/course.test.ts` 39/39 passed (round 1: strict topic identity in the schema, `AUTH_REQUIRED` from the action when there is no session); `npx tsc --noEmit` and `npm run lint` on the changed files clean; `supabase db diff --schema public` reported no drift; function ACL is `postgres`, `authenticated`, `service_role` only (anon denied, zero arguments, `SECURITY DEFINER`, `search_path=""`). Prototype checks from the preceding task are not production evidence. |
| Accepted deviations | None |
| Blockers / Owner decisions | No open product decision. CP1 mechanism (new RPC) is reported to the Owner per section 1.5 before CP2 starts. |
| Next action | Main re-runs the independent Codex review of CP1 and sends corrections back to the CP1 implementor; then the Owner hands CP2/CP3 to the frontend developer, who consumes the contract in section 4.4 |
| Current authority | Local commits of CP1 (Owner, 2026-10-21); no push, PR, merge, hosted/root database change, or CP2/CP3 work. |

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

### 1.3 Scope

In scope:

- the `/teacher/courses` route composition and route-owned components;
- a minimal permission-sensitive read model for courses and cross-course attention;
- a reusable schema/type at the server-to-UI boundary;
- preservation of invitation, create, edit, open, rejection, and soft-delete behavior;
- sparse/dense portfolio behavior, responsive hierarchy, accessibility, and focused automated/manual verification;
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

These acceptances settle product and scope choices only; they do not grant runtime implementation, a migration apply, or any remote action. A change to the accepted composition, attention taxonomy, or reviewer/correction ownership must be reconciled before dependent implementation continues.

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
