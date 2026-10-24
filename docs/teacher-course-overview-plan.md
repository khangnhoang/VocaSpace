# Teacher course overview redesign plan

Revision: r3, 2026-10-23. r3 places the rejected-course edit dialog in scope (embedded `CourseForm` layout and a shared save hook) after re-review R9. Baseline: `8932c6a` on `main`; work branch `feat/teacher-course-overview-redesign`. Status of this revision: Owner-approved on 2026-10-23 after independent review PASS. The Owner accepted the layout of the interactive aid [`assets/teacher-course-overview/overview-aid.html`](./assets/teacher-course-overview/overview-aid.html) and the decisions in section 1.5 on 2026-10-23. r2 answers the independent review of r1 (8 Required, 0 Critical): the next-action region now follows the AD2 listing rules, editors keep seeing the rejection reason, the enrollment total moves into the insight boundary, progress categories match the learner view (Owner D4 revised), removed profiles are denied, the attention read has its own failure state, and verification names the runtimes and CI routing.

## State

| Field | Value |
| --- | --- |
| Spec revision | `docs/teacher-course-overview-plan.md` r3 |
| Current unit / checkpoint | CP3 complete; delivery (push, PR, hosted migration) not started |
| Status | CP1–CP3 done 2026-10-24 — Owner rendered QA passed; independent reviews passed (plan r3, `07dab69`, `ba27cd9`); awaiting delivery grants |
| Completed evidence | Planning: layout aid checked in the browser pane at desktop and 390px with no console errors (2026-10-23). Independent Opus 5.5 high review: r1 CHANGES REQUIRED (8 Required), r2 CHANGES REQUIRED (1 Required), r3 PASS (0 Critical, 0 Required). `npm run docs:check`: 0 structure violations, 0 new broken links; no product file changed during planning. CP1 (2026-10-23): root `npx supabase db reset` and `.e2e-runtime` rebuild + reset applied `20261023120000_tov1_teacher_course_insights.sql`; `tov1-teacher-course-insights.test.ts` 19 passed on API 45441; schema + action tests 32 passed; `npx tsc --noEmit` and ESLint on changed files clean; `ci.yml` parses with the file in both job lists; `explain analyze` with 20,001 synthetic enrollments (rolled back): RPC 28 ms, no index needed; Codex review r1 PASS (0 Critical, 0 Required). CP2 (2026-10-23): `npx tsc --noEmit` clean; ESLint on changed TS/TSX/MJS clean; focused suites (`teacher-course-overview`, `course-insights-format`, `legal-pages`, `course-listing-review-controls`, `course-workspace-routes`, `teacher-course-portfolio`, `teacher-portfolio-demo`) passed; `npm run test:ci` 2089/2089 in 139 files (before the final aria-label/route-test correction, after which the two affected files passed 64/64). Smoke: `course-leave-navigation` and `teacher-course-portfolio` passed; `dashboard-return-freshness` (return to overview, line 82/84) and `issue-deep-links` (settings refresh tab, line 131; stale-target notice, line 144) failed, and the same two steps also fail on the pre-CP2 baseline `11b7374` in this environment, so they are not attributed to CP2. Root-local seed applied (`--apply`): demo course 6 has 24 enrollments over 6 months and 10/10/4 progress; rendered check in the browser pane at 1024, 390 and 320px: no page overflow, labels and values correct, rejected-course dialog opens with focus on the title and returns focus on close. CP2 correction after independent Opus review (CHANGES REQUIRED: 3 Required, 0 Critical): R1 the page now filters portfolio attention on the server (`selectCourseAttention`) and passes only this course's review/correction items to the client; R2 a failed save is shown inside the dialog as `role="alert"` as well as the toast; R3 the seed now moves demo course 5 to `pending` (teacher submit) and course 7 to `published` (admin submit and approve) through the AD2 RPCs and reports both; S3 an empty course skips both extra reads; nits fixed (neutral zero change, live regions inside list items). After the correction: `npx tsc --noEmit`, ESLint on changed files, 30 focused files / 391 tests passed; seed rerun idempotent; rendered check of courses 5 and 7. S1 (`t.course_id = p_course_id` in the RPC) not taken: it needs a new migration and only matters for already-inconsistent rows. Independent Opus 5.5 high implementation review of `a5d22f0..07dab69`: round 1 CHANGES REQUIRED (3 Required), round 2 PASS (0 Critical, 0 Required; S1 and two Nits left non-blocking). QA data (Owner request, 2026-10-23): seed adds a large data set on demo course 7 (published, teacher is editor): 177 enrollments over 6 months (18/26/31/42/37/23) and 53/90/34 progress over 4 published topics; rendered at 1024 and 390px with no page overflow. Seed adds demo courses 17 (clean draft: owner/co-owner primary is Gửi duyệt) and 18 (admin-rejected with no readiness issues: primary is Sửa thông tin khóa học), with a published topic whose part5 exercise has a standalone question; verified as teacher (co-owner) on 2026-10-24. Owner request (2026-10-24): the enrollment chart now has three tabs (Cột / Xu hướng / Bảng) like /admin, drawn from the same `enrollments_by_month` (no RPC change); panels slide horizontally (480ms) and the reveal runs 1.0–1.6s per column (whole sequence about 2.2s) and 1.6s for the trend line; reduced motion shows everything at once. Verified in the browser pane on demo course 7; overview component suite 24/24. Further Owner QA requests (2026-10-24): table view without scrolling (chart body 272px); other-work list header separated, then restyled like the portfolio attention panel (bold heading, item count, white background); kind filters Tất cả / Hoàn thiện / Chờ duyệt / Cần sửa with counts (count under the label because four filters do not fit on one line in the 1024px right column); collaborator strip reserves three rows on narrow screens. Re-verified on `ee6993c`: `npm run test:ci` 2094/2094 in 140 files; smoke `teacher-course-portfolio` and `course-leave-navigation` passed; `dashboard-return-freshness` (line 84, return from Topic Builder) and `issue-deep-links` (line 131, settings refresh tab) failed at the same pre-existing steps as on baseline `11b7374`, after passing their overview steps. Independent Opus 5.5 high review of `07dab69..ee6993c`: round 1 CHANGES REQUIRED (2 Required: tab panel focus ring, undocumented motion decision), round 2 PASS on `ba27cd9` (0 Critical, 0 Required). Owner CP3 QA (2026-10-24): checklist sections 1–5 passed (next-action rows by role, edit dialog, other-work filters, insights, identity/previewer); section 6 passed; the chart tab arrow/Home/End keys first seemed not to work, then passed when the Owner retested with focus on a tab (Main had confirmed the same in the browser pane on course 7). |
| Accepted deviations | CP1 independent review ran in Codex (`gpt-6.1-sol`, high, read-only) on the Owner's 2026-10-23 instruction instead of the Opus session in D5. The RPC returns `progress: null` when the course has no counted topic (section 4 listed only the object shape). CP2: root-local DB lacked the CP1 migration (CP1 ran on another machine), applied with `npx supabase migration up --local` (no reset); the existing portfolio seed wrote `part_type: "part_5"`, which fails the readiness schema and broke every demo overview, so the seed now writes `part5` and the 19 demo exercises in the root-local DB were corrected in place; the E2E kong container was restarted after it returned 502 for auth. `CourseReadinessIssueList` was removed as unused. `LEGAL_LAST_UPDATED` is shared, so `/terms` shows the new date too. On wide screens the next-action panel comes before the insights in DOM and keyboard order while it sits in the right column; this needs Owner confirmation in CP3 (AC14). The enrollment chart reuses `RevealScope` from `app/admin/_components/reveal-scope.tsx` (unchanged) with its own slower CSS module; /admin timings are unchanged. Owner decision 2026-10-24 (D9): the enrollment table is a third tab (Cột / Xu hướng / Bảng) instead of the disclosure in AC7; the reveal runs 1.0–1.6s per column and 1.6s for the trend line; the panel slide and tab indicator run 480ms. These intentionally exceed Product Language §9 and Teacher Authoring §13 (220ms tab change, 240ms spatial reveal); reduced motion removes them. The trend area fill is a data fill under the line, as in /admin, not decoration (AC15). Filters showing a count under the label differ from the one-line portfolio filters for width reasons only. Owner accepted the wide-screen keyboard order (next-action panel before insights) in CP3 on 2026-10-24 (AC14). |
| Blockers / Owner decisions | Owner approved the `/privacy` wording (D6). Owner decision 2026-10-24: the two pre-existing smoke failures (`dashboard-return-freshness` return from Topic Builder, `issue-deep-links` settings refresh tab) are a separate follow-up, not fixed in this PR. |
| Next action | Owner: grant push and PR creation; apply `get_teacher_course_insights` on hosted before the UI deploys (separate grant); then merge |
| Current authority | Plan r3 approved. Local commits per checkpoint are granted (2026-10-23). CP1 and CP2 implemented on Owner request. No push, PR, hosted migration apply or deployment is granted. |
| Hosted state | Not started. `get_teacher_course_insights` must be applied on hosted before the UI deploys (section 7). |

## 1. Binding specification

### 1.1 Outcome

Redesign `/teacher/courses/[id]` (Course Overview) into the Teacher Authoring insight-and-action surface defined by [`teacher-authoring.md` section 6](./ui-design-system-and-review/screen-types/teacher-authoring.md), so an owner, co-owner or editor can:

1. recognize the course, its lifecycle state, their role and the collaborator context;
2. see how the course is being used: enrollment total, new enrollments per month and the current learner progress distribution, as aggregates;
3. find the one most useful next authoring, readiness, listing, correction or review action and act on it; and
4. reach Structure and collaborator management without the Overview duplicating Structure.

### 1.2 Observable acceptance criteria

| ID | Observable result |
| --- | --- |
| AC1 | The page opens with a course identity region built only from readiness data: cover (`thumbnail_url`, or a neutral non-remote fallback), title as the only `h1`, description (or an explicit "no description" text), lifecycle label from `courseStatusLabels`, a rejected marker when the AC3 rejected condition holds, the viewer's role, price, and published topics over total topics. No slug, UUID or other technical key is shown. |
| AC2 | A collaboration strip attached to the identity region shows the member summary. Owner and co-owner see the existing collaborator management entry; every non-owner sees the existing leave entry. Their dialogs and behavior are unchanged. |
| AC3 | The next-action region follows the table in section 1.2.1. It always shows exactly one filled primary action; every other action is outline or text. "Gửi duyệt" and "Rút yêu cầu duyệt" remain reachable for owner and co-owner exactly when AD2 AC8 shows them today (`draft` → submit, disabled with the existing hint when there is no published topic; `pending` → withdraw with confirmation; `published` → none). Editors never get either control. An issue's consequence text describes its effect on learners or content; it never claims the issue blocks listing. |
| AC4 | When a draft course's last review was a rejection (`status = draft`, `reviewed_at` set, non-empty `reject_message`), every role on the page sees the reason, as today. Owner, co-owner and editor get "Sửa thông tin khóa học", which opens the course-info form in a dialog on the Overview with the same fields, validation, `updateCourse` action, permissions and duplicate-submit lock as the portfolio edit. A failed save keeps the dialog open with the input and shows the error; a successful save closes the dialog, returns focus to the trigger and refreshes the page. The portfolio edit behaves as before. |
| AC5 | Below the main action, a bounded internally scrolling list shows, for this course: the remaining readiness issues, the current user's `topic_review` items and the current user's `topic_correction` items from `get_teacher_course_portfolio`, each with its own action (review and correction items link through the existing `attentionPath` in `lib/course-authoring/portfolio.ts`; issues use their existing destinations). Nobody gains an item or action that the portfolio read would not grant. `course_rejection` items are not repeated (AC4 covers them). |
| AC6 | If the portfolio read fails, readiness issues, the next action, collaborators and Structure entry still render and work; the list shows a non-blocking message that review and correction items could not load, with retry. While it loads, the list shows readiness issues and a labeled pending row for the rest. |
| AC7 | The enrollment insight shows the enrollment total and new enrollments for the last 6 calendar months including the current month, bucketed in `Asia/Ho_Chi_Minh` by the database, with months that have none shown as 0. Each value is visible as a label, available as a table behind a disclosure, and summarized in text. The current month is labeled "tính đến hôm nay" and compared with the previous month. |
| AC8 | The progress insight splits every enrolled learner into exactly one category, matching the learner-side status in `lib/learn-dashboard.ts:183-190`. Counted topics are active published topics in active chapters of the course. Completed: completed rows for every counted topic. In progress: at least one but not all counted topics completed. Not started: no counted topic completed. When the course has no counted topic, the distribution is replaced by a text state ("Chưa có bài học đã xuất bản") and no percentages are shown. Counts and percentages are shown in text; percentages are rounded so the three values sum to 100 (largest remainder). |
| AC9 | When the course has no enrollments, the enrollment and progress insights show a designed no-data state with the earliest truthful signal (status, 0 enrollments) and draw no chart, zero bars or percentages. |
| AC10 | Insight loading and failure are isolated: the identity region, next action, collaborators, content summary and Structure entry render and work while insights load or after they fail. Loading shows labeled placeholders; failure shows a recoverable message with retry and never shows 0 as a value. |
| AC11 | The insights read returns data only when the caller has an active profile (`profiles.removed_at is null`) and is an owner, co-owner or editor of an active course (`has_course_authoring_access`). Anonymous callers, removed profiles, non-members, previewers and callers of a soft-deleted or missing course receive a coded error and no data. The result contains only aggregate counts; no learner id, name, email or per-learner row. |
| AC12 | A compact content summary (chapters, topics with published count, flashcards, exercises and questions) links to Structure. The five-card KPI strip and the slug/order block are removed. |
| AC13 | Existing behavior is preserved: `CourseOverviewError` states (including `PREVIEWER_STRUCTURE_ONLY`), `EmptyCourseDashboard` for a course with no active chapter, `CoursePreviewOverviewNotice` for non-previewers, the `#collaborators` anchor, and every existing route. |
| AC14 | At 320px and 390px there is no page-level horizontal overflow; the order is identity → next action → insights → content summary; touch targets are at least 44×44px; content works at 200% zoom; keyboard order follows visual order; reduced motion removes non-essential movement. |
| AC15 | The page uses Product Language tokens and the accepted Button contract, adds no npm dependency, chart library, font, shared primitive change, gradient decoration or remote stock image. The chart is inline SVG. |
| AC16 | `/privacy` states that collaborators of a course can see aggregate enrollment and progress figures for that course, and that in a course with very few learners these figures can reflect an individual learner's progress. The "Cập nhật lần cuối" date is updated and `__tests__/components/legal-pages.test.tsx` asserts the new statement. The wording is Owner-approved before merge. |
| AC17 | Real-database tests prove AC7, AC8 and AC11; schema and action tests prove the parsed boundary and safe errors; component tests prove every row of section 1.2.1 by role, AC4–AC6, AC9, AC10, AC12 and AC13. |

#### 1.2.1 Next-action states

"Issue CTA" is the first readiness issue's action (`primaryCta`), named with its object and remaining work. "Submit" and "Withdraw" are the existing `CourseListingReviewControls` actions with AD2 behavior. "Structure" opens the Structure page.

| Course state | Readiness issues | Owner / co-owner | Editor |
| --- | --- | --- | --- |
| `draft`, not rejected | yes | Primary: issue CTA. Secondary: Submit (outline; disabled with hint when no published topic) | Primary: issue CTA |
| `draft`, not rejected | no | Primary: Submit when a published topic exists; otherwise primary Structure and secondary Submit (outline, disabled) with the existing hint | Primary: Structure, with text that an owner or co-owner submits for listing |
| `draft`, rejected | yes | Reason shown. Primary: issue CTA. Secondary: Sửa thông tin khóa học, Submit (outline) | Reason shown. Primary: issue CTA. Secondary: Sửa thông tin khóa học |
| `draft`, rejected | no | Reason shown. Primary: Sửa thông tin khóa học. Secondary: Submit (outline) | Reason shown. Primary: Sửa thông tin khóa học |
| `pending` | either | Text: waiting for admin review. Primary: issue CTA if any, else Structure. Secondary: Withdraw (outline, confirm dialog) | Same text. Primary: issue CTA if any, else Structure |
| `published` | either | Primary: issue CTA if any, else Structure. No listing control | Same |

### 1.3 Scope

In scope:

- the route `app/(teacher)/teacher/courses/[id]/page.tsx` and route-owned components under its `_components/`, including a presentation-only emphasis and reason-placement option on `CourseListingReviewControls` whose defaults reproduce today's rendering, so `EmptyCourseDashboard` is unchanged (its submit/withdraw logic and visibility rules unchanged);
- a presentation-only embedded layout option on `CourseForm` (today a full-page shell, `CourseForm.tsx:65`) with fields and validation unchanged, and moving the portfolio's course-info save handling (`TeacherCoursePortfolio.tsx:73-98`: form data, `updateCourse`, mutation lock, toasts, focus) into one shared hook used by the portfolio and the Overview dialog, with no behavior change for the portfolio;
- one new read-only RPC with rollback, its Zod schema and its Server Action;
- reading the existing portfolio attention for this course;
- reusing `CourseForm` for the rejected-course edit dialog;
- the `/privacy` change in AC16;
- tests, a narrow root-local QA seed addition, CI test routing for the new integration file, and this plan's State.

Non-goals:

- a shared Tổng quan / Cấu trúc tab bar (D3); the Structure page is unchanged;
- most-active learners, revenue, activity over time, and any per-learner analytics (D2);
- editing course info outside the rejected state;
- a structured admin rejection (admin ticks the chapters/topics to fix and the Overview lists them as paths). Owner noted it as the better UX on 2026-10-23 and marked it out of scope; it is a follow-up candidate;
- redesigning `EmptyCourseDashboard`, `CourseOverviewError`, collaborator dialogs, or `CourseForm` fields and validation;
- changing readiness rules, review or listing lifecycle, permissions, RLS, `get_teacher_course_portfolio`, or any table;
- analytics caching, materialized views or new indexes unless CP1 measurement shows a need;
- hosted migration apply or deployment.

### 1.4 Execution guardrails

| ID | Guardrail | Failure it prevents |
| --- | --- | --- |
| G1 | The RPC is read-only, `stable`, `security definer`, `set search_path = ''`; identity comes only from `auth.uid()`; it raises coded errors for anonymous, removed-profile and unauthorized callers; `execute` is revoked from `public` and `anon` and granted to `authenticated` and `service_role`, as in tport1. | `enrollments` and `user_topic_progress` SELECT policies allow only the learner's own rows (plus admins), so a definer function without its own check would leak other learners' data. |
| G2 | Authorization reuses `public.has_course_authoring_access(p_course_id)` plus the active-profile check used by tport1 and the AD2 RPCs; no new permission helper. | A second role rule could drift from course authoring access; `has_course_authoring_access` alone admits removed profiles. |
| G3 | The RPC returns only counts. | Returning ids or rows would disclose learner data beyond D6. |
| G4 | The Server Action parses `p_course_id` before calling, never forwards raw input, checks the session first, parses the RPC payload with a schema in `lib/schemas/`, and maps errors to safe codes following `app/actions/teacher-course-portfolio.ts`. | Unparsed input or raw Supabase errors at the boundary. |
| G5 | Insights and the portfolio attention are fetched separately from readiness and rendered inside their own boundaries. | A failure of either would hide the next action (TA recovery contract). |
| G6 | Review and correction items come from `getTeacherCoursePortfolio()` filtered server-side to this `course_id` and `kind in (topic_review, topic_correction)`. | A new predicate would drift from D1 review and correction rules. |
| G7 | Month buckets and "current month" use `Asia/Ho_Chi_Minh` and are produced by the database. | Server or browser timezone would shift enrollments across months. |
| G8 | The new integration test runs only on the isolated E2E runtime (API 45441), refuses other targets in `beforeAll`, and is added to the `learner-integrity` CI job list and the `integration` job exclude list together. | TPORT1 delivery failed when the file ran in the wrong job. |

### 1.5 Owner decisions (2026-10-23)

| ID | Decision |
| --- | --- |
| D1 | The layout in the accepted aid is the composition: identity region with attached collaboration strip; insights on the wide left column; next action and content summary on the right; next action directly after identity on narrow screens. The aid's per-role rejection note is superseded by AC4. |
| D2 | Analytics in this PR: enrollment total, monthly new enrollments for 6 months, and the progress distribution. Most-active learners and revenue are deferred. |
| D3 | This PR changes only the Overview. No shared tab bar; the Overview links to Structure with a button. |
| D4 | Progress categories match the learner view: Completed = every counted topic completed at viewing time (adding a topic moves such learners back to In progress); In progress = at least one counted topic completed; Not started = none completed. Revised from "any progress row" after review found that would disagree with the learner's own status. |
| D5 | Independent plan and implementation review runs in a separate Opus 5.5 high session instead of the Codex gate. |
| D6 | Update `/privacy` for the aggregate read in the same PR; the Owner approves the wording. |
| D7 | The Overview list shows both pending reviews and topic corrections for this course. |
| D8 | A rejected course offers "Sửa thông tin khóa học" on the Overview through the existing `CourseForm`; structured rejection is out of scope. |

## 2. Governing design sources

[Product Language](./ui-design-system-and-review/product-language.md), [Teacher Authoring](./ui-design-system-and-review/screen-types/teacher-authoring.md) sections 2, 6, 9–13, and [Button](./ui-design-system-and-review/components/button.md). The aid is review evidence for D1 only; its synthetic values are not a contract. Composition choices that TA leaves to a surface specification are recorded in D1, AC3–AC14 and section 1.2.1. The Owner's review of the running screen before merge accepts the result (CP3).

## 3. Repository facts at the baseline (`8932c6a`)

- `page.tsx` reads only `getCourseDashboardReadiness`, which returns `course` (including `reject_message`, `reviewed_at`), `role`, `counts`, `publishedTopicCount`, `issues` and `primaryCta`, and returns `PREVIEWER_STRUCTURE_ONLY` for previewers (`app/actions/course-readiness.ts:173-178`, `lib/schemas/course-readiness.ts:270-278`). It has no enrollment data.
- Listing controls today: owner/co-owner see "Gửi duyệt" on `draft` (disabled with a hint when no published topic) and "Rút yêu cầu duyệt" on `pending`; every role sees the latest rejection reason on a rejected draft (`_components/CourseListingReviewControls.tsx:38-44,71-123`). AD2 requires this on both Overview branches (`docs/programs/admin-console/implementation-plans/ad2/plan.md`, AC8). Submitting needs one active published topic, not a clean readiness check (same plan, AC1).
- Course info is edited only from `/teacher/courses` through `CourseForm` (`_components/CourseList.tsx:61`, `_components/TeacherCoursePortfolio.tsx:148`).
- `enrollments` and `user_topic_progress` SELECT policies allow only `auth.uid() = user_id` (`supabase/migrations/20260609114505_remote_schema.sql:1617,1625`), plus an admin read policy (`supabase/migrations/20261007100000_a5_admin_learning_reads.sql`). `enrollments(course_id)` is indexed (`supabase/migrations/20260710182617_public_course_read_model.sql:1-2`); `user_topic_progress` has unique `(user_id, topic_id)` (`remote_schema.sql:1130`).
- `has_course_authoring_access(course_id)` is true for an owner, co-owner or editor of an active course and does not check `profiles.removed_at` (`supabase/migrations/20260915090000_d1_foundation.sql:145-171`). tport1 rejects removed profiles itself (`supabase/migrations/20261021120000_tport1_teacher_course_portfolio.sql:26-29`).
- `get_teacher_course_portfolio()` returns `topic_review`, `topic_correction` and `course_rejection` items per course (same tport1 file), wrapped by `app/actions/teacher-course-portfolio.ts`.
- Learner course status: no counted topic → no content; zero completed → not started; all completed → completed; otherwise in progress (`lib/learn-dashboard.ts:183-190`); counted topics are active published topics in active chapters (`app/actions/enrolled-course-overview.ts:124-176`).
- `CourseCollaboratorSummary` fetches members on the client (`_components/CourseCollaboratorSummary.tsx:26-35`). No chart library is installed.
- CI runs root-runtime integration tests in the `integration` job with an exclude list and isolated-runtime tests in the `learner-integrity` job with an explicit list (`.github/workflows/ci.yml:174,208`); `ALLOW_DB_INTEGRATION_TESTS` is set globally in CI (`ci.yml:18`).
- Tests and specs that render or open the Overview: `__tests__/components/course-listing-review-controls.test.tsx`, `__tests__/components/course-workspace-routes.test.tsx`, `e2e/smoke/course-leave-navigation.smoke.spec.ts`, `e2e/smoke/dashboard-return-freshness.smoke.spec.ts`, `e2e/smoke/issue-deep-links.smoke.spec.ts`, `e2e/smoke/teacher-course-portfolio.smoke.spec.ts` (fails on any console message), `e2e/d2/public-course-preview.spec.ts`.

## 4. Bounded implementation hypotheses

These may change during implementation if the Spec and guardrails still hold; record any change as an accepted deviation in State.

- Migration `supabase/migrations/<timestamp>_tov1_teacher_course_insights.sql` with rollback under `supabase/rollbacks/`, defining `public.get_teacher_course_insights(p_course_id uuid) returns jsonb` with `enrollment_total`, `enrollments_by_month` (6 entries `{month: 'YYYY-MM', count}`, oldest first), `progress {not_started, in_progress, completed}` and `counted_topic_total`.
- `lib/schemas/teacher-course-insights.ts`, `app/actions/teacher-course-insights.ts` (`getTeacherCourseInsights(courseId)`), mirroring the portfolio action's result shape.
- `page.tsx` renders the readiness-based composition immediately and passes the insights and portfolio promises to components inside `Suspense` boundaries with retry via `router.refresh()`.
- New route-local components such as `CourseIdentityHero`, `CourseNextActionPanel`, `CourseEnrollmentInsight`, `CourseProgressInsight`, `CourseContentSummary`; `CourseReadinessIssueList` may be reused or replaced.
- `CourseListingReviewControls` gains an emphasis prop (filled or outline) and renders the rejection reason only where AC4 places it.
- The rejected-course dialog composes the existing shared `Dialog` with `CourseForm` in its embedded layout; the shared save hook lives next to the portfolio components (for example `app/(teacher)/teacher/courses/_components/use-course-info-edit.ts`).
- `CourseCollaboratorSummary` keeps its client fetch and reserves its height.
- QA data: extend `scripts/dev/seed-teacher-portfolio-demo.mjs` (root-local API 45321 only; run with `--apply`) to create deterministic learner profiles, enrollments with fixed `enrolled_at` across 6 months, and progress rows written with the service role, on one demo course; keep one demo course with chapters and no enrollments.

## 5. Dependency order and checkpoints

The UI depends on the insights contract, so the read comes first. One PR; checkpoints are review and resume boundaries, not commit authority.

| ID | Outcome | Verification |
| --- | --- | --- |
| CP1 | Insights read: migration and rollback, schema, Server Action, integration test, CI routing (G8) | `npx supabase db reset`; rebuild `.e2e-runtime` with the migration and run the new file there with `ALLOW_DB_INTEGRATION_TESTS=true` (`npm run test:integration -- <file>`), covering the auth matrix (anon, removed profile, non-member, previewer, removed or missing course, owner, co-owner, editor), month buckets computed from the database's current Asia/Ho_Chi_Minh month (zero months, a month-boundary timestamp), each progress category including removed or unpublished topics, removed chapters, a learner with progress rows but no completion, and a course with no counted topic; `explain analyze` on seeded data; schema and action tests with hostile input and error mapping; `npx tsc --noEmit`; ESLint on changed files; YAML parse of `ci.yml` |
| CP2 | Overview UI, attention list, rejected-course edit dialog with the shared save hook, `/privacy`, QA seed, updated tests | Component tests for AC1–AC6, AC9, AC10, AC12, AC13 and every section 1.2.1 row by role; dialog tests (failed save keeps input and stays open, success closes, refreshes and restores focus, double submit blocked); existing portfolio edit tests still pass unchanged; `EmptyCourseDashboard` still shows reason and controls; `legal-pages.test.tsx`; updated existing component tests; `npx tsc --noEmit`; ESLint on changed files; `npm run test:ci` (justified: Overview copy is asserted across several suites); the smoke specs listed in section 3, after confirming the CP1 migration exists in `.e2e-runtime` |
| CP3 | Rendered QA and review | Browser QA matrix in section 6 on root-local data; independent Opus 5.5 high implementation review to PASS; Owner review of the running screen and of the `/privacy` wording |

### QA fixture readiness

- QA type: rendered manual QA of the Overview by role and data state.
- Canonical fixture source: `scripts/dev/seed-teacher-portfolio-demo.mjs` (root-local 45321, `--apply`).
- Existing covered states: teacher, editor and previewer actors; courses with readiness issues, a rejected listing, pending topic reviews and topic corrections.
- Missing states: enrollments across 6 months; mixed learner progress; a course with chapters and zero enrollments; a pending and a published course for the listing rows.
- Required fixture additions: the hypothesis in section 4, plus one pending and one published demo course if the script lacks them.
- Reset/setup command: `npx supabase db reset`, then `node scripts/dev/seed-teacher-portfolio-demo.mjs --apply`.
- Fixture checkpoint: CP2.
- Browser QA may begin when: CP2 checks pass and the seed reports the populated, empty, pending and published demo courses.

## 6. Verification

Automated coverage is listed per checkpoint. Manual QA in CP3 covers: owner, co-owner and editor; every section 1.2.1 row; the rejected-course edit dialog; populated and no-enrollment insights; a course with no published topic; forced insight failure and forced attention failure; widths 320, 390, 768 and 1280px; 200% zoom; keyboard order; reduced motion; no console messages. Previewer access stays the existing error page and is checked once.

## 7. Risks, rollout and rollback

| Risk | Mitigation | Exposed at |
| --- | --- | --- |
| The definer RPC leaks learner data | G1–G3 and the denied-path integration matrix, including removed profiles | CP1 |
| Progress counts disagree with the learner view | AC8 uses the learner-side status rule and topic set; tests include removed and unpublished topics and progress rows without completion | CP1 |
| Large courses make the RPC slow | Uses `idx_enrollments_course_id` and unique `(user_id, topic_id)`; measure with `explain analyze` in CP1 and stop for a decision before adding an index | CP1 |
| The new integration file runs in the wrong CI job | G8; check both job lists in the diff | CP1 |
| Changing listing-control emphasis alters AD2 behavior | Section 1.2.1 keeps AD2 visibility; existing `course-listing-review-controls.test.tsx` cases stay and new cases cover each row | CP2 |
| Existing tests and smoke specs depend on old Overview copy | Update only assertions tied to removed UI and keep the behavior each test protects | CP2 |
| Collaborator strip shifts layout while loading | Reserve height and check during QA | CP3 |

Rollout: apply `get_teacher_course_insights` to hosted before the merged UI deploys, as a separately authorized step; otherwise every teacher sees the insight failure state. Record it in the Hosted state field. Rollback: run the rollback SQL and revert the PR; the RPC writes nothing and nothing else calls it.

## 8. Plan review and approval gates

Before implementation: independent Opus 5.5 high plan review PASS, then Owner approval and an explicit implementation grant. Each checkpoint ends with the author self-review in `docs/agent-self-review.md` and a checkpoint report; commit, push and PR remain separate Owner authorities.
