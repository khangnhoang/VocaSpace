---
title: "C1 — Enrolled Course Overview"
wave: C1
status: "Implemented and verified on branch; PR/merge pending"
branch: feat/enrolled-course-overview
baseline: "origin/main @ 59d08104f78a4eb744c2420c8ec5db7ab712e1e3"
depends_on: "PR #74 đã merge bằng 59d08104f78a4eb744c2420c8ec5db7ab712e1e3"
planning_date: 2026-08-18
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
adr: ../../../../adr/refactor-student-user-flow-route-adr.md
owner_review: ./owner-review-brief.md
---

# Kế hoạch triển khai C1 — Enrolled Course Overview

## 1. Mục tiêu và trạng thái

C1 reclaim exact route `/learn/[course-slug]` từ temporary redirect của B3 thành enrolled-course overview dành cho learner đã đăng ký. Trang giúp learner hiểu vị trí hiện tại trong course, thấy topic đã hoàn thành/chưa hoàn thành và đi tới đúng topic tiếp theo mà không tự động redirect.

Planning package này được lập trên `feat/enrolled-course-overview` từ synchronized baseline `origin/main @ 59d08104f78a4eb744c2420c8ec5db7ab712e1e3`. Commit đó là merge commit của PR #74/B3, nên dependency B3 đã thỏa mãn; tại thời điểm planning, exact route còn dùng temporary redirect sang `/courses/[course-slug]`.

Owner đã chốt product decision cho enrolled, unenrolled, invalid, nonexistent/non-visible và recoverable-error states. C1 đã được triển khai và verified end-to-end trên branch hiện tại; chưa tạo/update PR, chưa merge và chưa deploy.

Kích thước cuối cùng: **Medium**. C1 là một PR vertical slice với một read boundary, một page-level learning experience, focused regressions và seed-backed browser QA. Không có migration hoặc dependency chain độc lập cần tách PR.

## 2. Nguồn sự thật và dependency

- [Master plan](../../plan.md) sở hữu scope, route semantics, dependency order và high-level C1 acceptance criteria.
- [Progress tracker](../../progress.md) sở hữu delivery status và verification evidence hiện tại.
- [Problems log](../../problems.md) sở hữu `STUDENT-002`, `WORKSPACE-001`, `PROGRESS-001` và `STUDENT-005`.
- [ADR](../../../../adr/refactor-student-user-flow-route-adr.md) sở hữu durable route, dashboard, B2 progress và deferred-scope decisions.
- [B2 plan](../../plans/b2-student-learn-dashboard.md) cùng source/tests hiện tại sở hữu delivered dashboard semantics cần reuse.
- [B3 plan](../b3/plan.md) sở hữu historical temporary-redirect contract; C1 thay exact page nhưng không sửa nested workspace behavior.
- File này là detailed implementation contract của C1. [Owner-review brief](./owner-review-brief.md) chỉ tóm tắt decision surface và không override file này.
- Repository code và Git history là evidence cuối cùng khi status documentation mâu thuẫn.

Dependency graph:

```text
PR #48 / B2 dashboard semantics (merged)
  + PR #74 / B3 exact-route bridge (merged)
      -> CP1 C1 data contract/shared projection
          -> CP2 C1 route/UI states
              -> CP3 browser/manual QA + final docs
                  -> C2 workspace hardening (future, separate permission)
```

C1 không chạy song song với C2 vì hai PR chạm cùng route namespace và C2 phụ thuộc stable overview/access contract của C1.

## 3. Sự thật đã xác nhận

1. `app/(client)/learn/[course-slug]/page.tsx` hiện parse `publicCourseSlugSchema`, gọi `notFound()` cho invalid slug và temporary `redirect()` sang canonical public detail.
2. `/learn` dùng authenticated `getLearnDashboard()`; `AUTH_REQUIRED` được page chuyển thành `redirect("/login")`.
3. B2 chỉ hiển thị enrolled course có `status = published` và `removed_at IS NULL`.
4. Eligible content của B2 chỉ gồm chapter chưa soft-delete và topic `published`, chưa soft-delete, xếp theo `chapter.order_index`, `topic.order_index`, rồi stable ID tie-break.
5. Progress hiện tại dùng `user_topic_progress.is_topic_completed = true`; first incomplete eligible topic là `nextTopic`, eligible topic cuối là `lastTopic`.
6. `completed` trong C1/B2 là semantics hiện hành, chưa phải final completion truth có memory check và all-exercise correctness.
7. `getLearnDashboard()` trả summary theo tất cả course cùng review/payment data; gọi action này từ C1 sẽ overfetch và không phân biệt `unenrolled` với `not_found`.
8. `getCourseSyllabus()` của workspace không phải C1 access contract: không trả progress DTO và không phân loại explicit enrollment/not-found/error states.
9. RLS hiện có cho phép authenticated enrollment đọc course content; enrollment và user progress vẫn bị giới hạn theo user. C1 không cần nới policy hoặc dùng service role.
10. `supabase/seed.sql` đã có deterministic in-progress, completed, no-content và published-with-protected-content-but-unenrolled scenarios.

Không còn open product question ảnh hưởng implementation. Nếu implementation discovery mới phủ định một sự thật trên, dừng và reconcile plan trước khi viết tiếp.

## 4. Product contract và state matrix

| Actor/data state | Server/page outcome | Visible behavior | CTA/route |
| --- | --- | --- | --- |
| Slug invalid sau shared normalization | `not_found`; page gọi `notFound()` trước DB access | Framework safe not-found boundary | Không có C1 CTA |
| Guest, slug hợp lệ | `auth_required`; page redirect `/login` | Không render overview | `/login` |
| Authenticated, slug hợp lệ nhưng course không tồn tại | `not_found` | Framework safe not-found boundary | Không có C1 CTA |
| Authenticated, course draft/pending/soft-deleted hoặc không learner-visible | `not_found` | Không expose course overview/access detail | Không có C1 CTA |
| Authenticated, published active course nhưng không có enrollment | `unenrolled` chỉ với public-safe course identity | Clear access state trên chính `/learn/[course-slug]`; giải thích account hiện tại chưa đăng ký; không render protected syllabus/progress; không toast-only và không auto-redirect | Primary `/courses/[slug]`; secondary `/learn` |
| Enrolled, chưa hoàn thành topic nào | `success`, `not-started`, 0% | Course identity, ordered topic path, mọi eligible topic incomplete; không auto-redirect | `Bắt đầu học` tới first eligible topic |
| Enrolled, đang học | `success`, `in-progress` | Progress count/percentage, completed/incomplete topics, first incomplete topic nổi bật | `Tiếp tục học` tới `/learn/[course]/[next-topic]` |
| Enrolled, hoàn thành mọi eligible topic | `success`, `completed`, 100%, `nextTopic = null` | Tất cả topic completed theo B2 semantics hiện hành | `Xem lại bài học cuối` tới `lastTopic` |
| Enrolled, không có eligible topic | `success`, `no-content`, progress percentage `null` | Clear no-content state; không render progressbar giả hoặc learning CTA | Secondary `/learn` nếu cần |
| Query hoặc output-contract failure | `error` với safe code/message | Recoverable error state tách biệt với unenrolled/not-found; có retry | `router.refresh()`; optional secondary `/learn` |

Các invariant:

- Exact overview route không tự động redirect sang topic hoặc public detail.
- `unenrolled` không được query hoặc serialize chapter/topic/progress rows.
- Array chapter/topic trong success DTO đã được server sắp xếp; UI không reimplement ordering.
- Empty chapter và unpublished/removed topic không xuất hiện trong learning path và không tham gia denominator.
- Không dùng `lastAccessTopic`; non-linear completion quay về first incomplete eligible topic theo full course order.
- `completed` không được đổi thành final completion truth trong C1.

## 5. Action, validation và access boundary

Tạo read-only Server Action:

```text
app/actions/enrolled-course-overview.ts
getEnrolledCourseOverview(rawCourseSlug: string)
```

Boundary sequence bắt buộc:

```text
raw route slug
  -> publicCourseSlugSchema.safeParse
     -> invalid: { status: "not_found" }, không tạo Supabase client
     -> parsed slug only
         -> supabase.auth.getUser()
            -> no user: { status: "auth_required" }
            -> auth service/query error: recoverable QUERY_FAILED
            -> authenticated user: query published active course basic identity by parsed slug
              -> query error: recoverable QUERY_FAILED
              -> no row: not_found
              -> query current user's enrollment by trusted course id
                 -> query error: recoverable QUERY_FAILED
                 -> no row: unenrolled public-safe identity; STOP protected reads
                 -> enrolled: read chapters -> topics -> current user's completed progress
                    -> shared pure progress projection
                    -> strict output validation
                       -> success or recoverable INVALID_DATA
```

Action responsibilities:

1. Parse untrusted slug server-side và chỉ dùng parsed value.
2. Authenticate bằng `getUser()`; không nhận `userId`, `courseId`, enrollment hoặc status từ client. Chỉ `user = null` không kèm service error mới là `auth_required`; `authError` là recoverable `QUERY_FAILED`.
3. Enforce learner-visible course state bằng trusted query: `published` và `removed_at IS NULL`.
4. Phân biệt course không tồn tại/non-visible với published course tồn tại nhưng user chưa enroll.
5. Check enrollment rõ ràng trước protected content reads; RLS tiếp tục là final enforcement.
6. Query theo tập, không N+1 theo chapter/topic.
7. Preserve B2 pagination behavior để không silent truncate PostgREST rows.
8. Trả stable serializable result; chỉ log server-side internal Supabase/Zod detail.
9. Không mutate, revalidate, cache optimistic state hoặc tạo side effect.

Không gọi `getPublicCourseDetail()` để phân loại unenrolled: RPC đó trả public-detail payload rộng, temporary preview overlay và enrollment overlay khác responsibility. C1 chỉ cần basic public-safe identity trước enrollment check.

## 6. DTO/schema contract

Tạo:

```text
lib/schemas/enrolled-course-overview.ts
```

Schema-owned result là discriminated union theo `status`:

```ts
type EnrolledCourseOverviewResult =
  | { status: "auth_required" }
  | { status: "not_found" }
  | {
      status: "unenrolled";
      course: { slug: string; title: string };
    }
  | {
      status: "success";
      data: EnrolledCourseOverviewData;
    }
  | {
      status: "error";
      errorCode: "QUERY_FAILED" | "INVALID_DATA";
      error: string;
    };
```

Success DTO tối thiểu:

```ts
type EnrolledCourseOverviewData = {
  courseSlug: string;
  courseTitle: string;
  courseThumbnailUrl: string | null;
  totalTopicCount: number;
  completedTopicCount: number;
  progressPercentage: number | null;
  status: "not-started" | "in-progress" | "completed" | "no-content";
  nextTopic: TopicSummary | null;
  lastTopic: TopicSummary | null;
  chapters: Array<{
    id: string;
    title: string;
    topics: Array<{
      id: string;
      slug: string;
      title: string;
      isCompleted: boolean;
    }>;
  }>;
};
```

Rules:

- Compose existing `publicCourseSlugSchema` và `learnCourseStatusSchema`; không tạo duplicate slug/status enum.
- DTO không chứa raw `removed_at`, publication fields, enrollment row, user ID, progress row, cards, exercises, questions hoặc answer history.
- `nextTopic`/`lastTopic` giữ shape B2 hiện có gồm `slug`, `title`, `chapterTitle`.
- `no-content` bắt buộc có `chapters = []`, counts `0`, `progressPercentage = null`, `nextTopic = null`, `lastTopic = null`.
- Unenrolled result chỉ chứa public-safe `slug` và `title`; CTA path được tạo bằng `getPublicCourseDetailPath()` từ trusted parsed/server result.
- Strict schema validation xảy ra ở server boundary trước khi render.

## 7. Reuse B2 và narrow shared extraction

Không duplicate filtering, ordering, progress percentage, status, `nextTopic` hoặc `lastTopic` trong C1.

Narrow extraction được phép trong CP1:

1. Trong `lib/learn-dashboard.ts`, tách pure `buildLearnCourseProgressProjection()` từ inner per-course logic hiện có.
   - Input: trusted `courseId`, chapter/topic/progress rows theo existing row types.
   - Output: ordered eligible chapter/topic projection cùng counts/status/next/last.
   - `buildLearnDashboardCourses()` gọi helper này và vẫn trả exact `LearnDashboardCourse[]` hiện tại.
   - Không rename/remove public B2 helpers, DTO fields hoặc status values.
2. Tách paged-row loader hiện có khỏi `app/actions/learn-dashboard.ts` vào một server-only helper hẹp, dự kiến `lib/supabase-pagination.ts`, để B2 và C1 cùng bảo toàn completeness mà không copy loop `.range()`.
   - `readChunkedDashboardRows()` có thể tiếp tục private trong B2 nếu C1 không cần chunk-by-ID.
   - Existing 501-row B2 action regression phải tiếp tục đạt.

Không tạo repository-wide query framework, generic repository layer, new RPC/view hoặc shared UI abstraction.

## 8. Route và component responsibilities

### Page orchestrator

`app/(client)/learn/[course-slug]/page.tsx`:

- Đọc raw route param và gọi `getEnrolledCourseOverview()`.
- `auth_required` -> `redirect("/login")`.
- `not_found` -> `notFound()`.
- `unenrolled` -> render access feedback trên same route.
- `error` -> render recoverable feedback.
- `success` -> render overview.
- Không chứa data aggregation, direct Supabase query hoặc auto-topic redirect.

### Feature-local components

```text
app/(client)/learn/[course-slug]/_components/EnrolledCourseOverview.tsx
app/(client)/learn/[course-slug]/_components/EnrolledCourseOverviewFeedback.tsx
app/(client)/learn/[course-slug]/_components/EnrolledCourseOverviewRetryButton.tsx
app/(client)/learn/[course-slug]/loading.tsx
```

- `EnrolledCourseOverview`: server-compatible presentational success view; course identity, progress summary, current/next action và ordered chapter/topic path. Nó nhận validated DTO, không fetch hoặc sort lại.
- `EnrolledCourseOverviewFeedback`: semantic `status`/`alert` surface cho unenrolled và recoverable error. Unenrolled copy nêu rõ account hiện tại chưa đăng ký; primary public detail, secondary `/learn`; không toast.
- `EnrolledCourseOverviewRetryButton`: client island tối thiểu dùng `router.refresh()` với pending/disabled label; không kéo toàn overview sang client.
- Route-local `loading.tsx`: overview-shaped skeleton để parent dashboard skeleton không mô tả sai page.
- Giữ topic row trong overview component trừ khi implementation size thật sự yêu cầu feature-local split; không tạo global primitive.

### UI/UX direction

- Screen type: **Learning Experience**, design latitude trung bình.
- Audience/job: learner đã enroll cần hiểu “đang ở đâu” và “học gì tiếp theo” trong vài giây.
- Visual system: giữ slate/blue/cyan, white surfaces, typography và radius hiện có của B2; không thêm token, font, package, global CSS hoặc animation library.
- Desktop: learning path là main column; compact progress/next-action summary là supporting rail hoặc top summary tùy composition cuối, nhưng primary CTA phải xuất hiện trước long topic list.
- Mobile: course identity -> progress/next action -> learning path; CTA full-width, topic text wrap an toàn, không horizontal overflow tại 375px.
- Signature: ordered learning path theo chapter với completed/current/upcoming state language; không dùng decoration generic.
- Aesthetic choice: deliberate restraint. Boldness nằm ở progress/current-topic state, không ở gradient, glassmorphism, bento hoặc motion.
- Accessibility: một `h1`, ordered semantic sections, progressbar có label/value, visible focus, icon có text/accessible label, error dùng `role="alert"`, access/no-content dùng status/section semantics.

## 9. Expected implementation/test surface

### Expected application/helper files

```text
app/(client)/learn/[course-slug]/page.tsx
app/(client)/learn/[course-slug]/loading.tsx
app/(client)/learn/[course-slug]/_components/*
app/(client)/learn/_components/CourseRow.tsx
app/actions/enrolled-course-overview.ts
lib/schemas/enrolled-course-overview.ts
lib/learn-dashboard.ts
lib/supabase-pagination.ts
app/actions/learn-dashboard.ts
```

### Expected tests

```text
__tests__/actions/enrolled-course-overview.test.ts
__tests__/components/enrolled-course-overview.test.tsx
__tests__/actions/learn-dashboard.test.ts
__tests__/utils/learn-dashboard.test.ts
__tests__/components/learn-dashboard.test.tsx
__tests__/components/public-course-detail.test.tsx
e2e/smoke/public-course-discovery.smoke.spec.ts
e2e/smoke/enrolled-course-overview.smoke.spec.ts
```

- New multi-branch action/component/smoke files cần Vietnamese test-plan header và truthful latest verification result.
- Public-detail test/smoke phải bỏ B3 assertion rằng exact `/learn/[slug]` redirect public detail; canonical `/courses/[slug]` behavior vẫn giữ.
- New C1 smoke sở hữu authenticated overview/access route flow. Public-discovery smoke chỉ giữ public catalog/detail responsibilities.
- Không tạo schema-only test riêng nếu action tests đã chứng minh valid DTO và malformed aggregate -> `INVALID_DATA`; chỉ thêm khi schema có transform/invariant độc lập đáng bảo vệ.
- Không thêm DB integration test nếu implementation chỉ dùng existing RLS/read model và smoke chạy trên isolated seeded Supabase. Nếu phải đổi policy/RPC hoặc không thể chứng minh denied path ở action/browser layer, dừng để re-scope test/database work.

### Files/domains không được chạm

```text
app/(client)/learn/[course-slug]/[topic-slug]/**
app/actions/learn.ts
app/actions/progress.ts
lib/learn-navigation.ts
components/ui/**
supabase/migrations/**
supabase/seed.sql
types/database.ts
proxy.ts
utils/supabase/middleware.ts
package.json
```

Chỉ được chạm một path trên khi fresh implementation evidence chứng minh C1 không thể hoàn tất đúng contract; khi đó dừng và xin owner quyết định thay vì tự mở scope.

## 10. Checkpoint breakdown

### CP1 — Course-specific data contract + shared progress projection

Outcome:

- Tạo schema/result DTO và `getEnrolledCourseOverview()`.
- Phân biệt invalid/auth/not-found/unenrolled/success/error trước UI.
- Chỉ đọc protected content sau enrollment.
- Tách/reuse B2 progress projection và paged-row reader; B2 output/behavior unchanged.
- Thêm action/pure-logic regressions trong cùng checkpoint.

Gate:

```bash
npm run test:run -- \
  __tests__/actions/enrolled-course-overview.test.ts \
  __tests__/actions/learn-dashboard.test.ts \
  __tests__/utils/learn-dashboard.test.ts
npx tsc --noEmit --incremental false
npm run lint -- \
  "app/actions/enrolled-course-overview.ts" \
  "app/actions/learn-dashboard.ts" \
  "lib/schemas/enrolled-course-overview.ts" \
  "lib/learn-dashboard.ts" \
  "lib/supabase-pagination.ts" \
  "__tests__/actions/enrolled-course-overview.test.ts" \
  "__tests__/actions/learn-dashboard.test.ts" \
  "__tests__/utils/learn-dashboard.test.ts"
git diff --check
```

CP1 dừng nếu cần migration/RLS/RPC/service role, public-detail RPC reuse, client-provided actor/course state hoặc duplicate B2 aggregation.

### CP2 — `/learn/[course-slug]` overview route/UI + visible states

Outcome:

- Thay B3 redirect bằng page orchestrator C1.
- Render success progress/topic path, completed, no-content, unenrolled và recoverable-error states.
- Giữ framework not-found, login redirect và exact nested workspace route boundary.
- Thêm route-local loading, responsive/accessibility behavior và component regressions.
- Gỡ/rewrite B3 legacy redirect assertions không còn đúng.

Gate:

```bash
npm run test:run -- \
  __tests__/actions/enrolled-course-overview.test.ts \
  __tests__/components/enrolled-course-overview.test.tsx \
  __tests__/components/public-course-detail.test.tsx \
  __tests__/components/learn-dashboard.test.tsx \
  __tests__/utils/public-course-routes.test.ts
npx tsc --noEmit --incremental false
npm run lint -- \
  "app/(client)/learn/[course-slug]/page.tsx" \
  "app/(client)/learn/[course-slug]/loading.tsx" \
  "app/(client)/learn/[course-slug]/_components" \
  "__tests__/components/enrolled-course-overview.test.tsx" \
  "__tests__/components/public-course-detail.test.tsx"
git diff --check
```

CP2 dừng nếu implementation cần đổi nested workspace, global 404, shared design primitives, memory/completion actions hoặc auto-redirect semantics.

### CP3 — Seed-backed browser/manual QA + regression/docs reconciliation

Outcome:

- Chuyển B3 smoke responsibility sang canonical public discovery + C1 overview smoke.
- Chạy isolated seeded browser flow cho in-progress/completed/no-content/unenrolled và route boundaries.
- Chạy final regression/build gates phù hợp với shared B2 helper và route change.
- Reconcile actual implementation evidence vào plan/progress/problems/ADR/brief; không mark complete trước khi gates đạt.
- Final diff/self-review và implementation handoff; commit/push chỉ khi được owner cấp quyền ở implementation turn.

Gate:

```bash
npm run test:run
npx tsc --noEmit --incremental false
npm run test:e2e -- \
  e2e/smoke/public-course-discovery.smoke.spec.ts \
  e2e/smoke/enrolled-course-overview.smoke.spec.ts
npm run build
git diff --check
```

`npm run test:integration`, repository-wide lint hoặc root `supabase db reset` không mặc định bắt buộc vì C1 không đổi database. Chỉ mở rộng khi focused evidence hoặc CI cho thấy shared/database risk thực tế.

Các checkpoint là coherent review boundaries; tests trực tiếp của mỗi behavior đi cùng checkpoint, không tách thành test-only prompt. CP1 -> CP2 -> CP3 tuần tự; không parallel vì cùng contract/files.

## 11. Acceptance criteria

1. Enrolled learner mở `/learn/[course-slug]` và thấy overview ở nguyên URL, không auto-redirect.
2. In-progress learner thấy exact completed/total count, percentage, ordered completed/incomplete topics và CTA tới first incomplete topic.
3. Non-linear completion vẫn chọn earliest incomplete topic theo full eligible course order.
4. Completed course hiển thị 100%, không có `nextTopic`, và CTA `Xem lại bài học cuối` tới final eligible topic.
5. Enrolled course không có eligible content hiển thị no-content state, không có progressbar giả hoặc learning CTA.
6. Authenticated unenrolled learner thấy clear access state trên same route, primary CTA `/courses/[slug]`, optional secondary `/learn`, và không nhận protected syllabus/progress.
7. Invalid slug không tạo DB client và kết thúc ở safe `notFound()`.
8. Valid nonexistent/non-visible course kết thúc ở safe not-found behavior.
9. Query/contract failure hiển thị recoverable retry state, không bị trình bày như unenrolled/not-found.
10. B2 dashboard DTO, course visibility, ordering, next-topic, completed/no-content behavior và 501-row completeness regressions không đổi.
11. `/learn/[course]/[topic]` vẫn thuộc C2/workspace và không bị C1 route bắt nhầm.
12. Không có migration, RLS/RPC/view/trigger/seed/service-role/package/shared-primitive change.
13. Mỗi enrolled course card trên `/learn` giữ nguyên primary fast-path CTA tới exact next/final topic và có secondary `Xem tổng quan` tới `/learn/[course-slug]`; no-content vẫn có course-level overview entry mà không tạo topic CTA giả.

## 12. QA fixture readiness và manual matrix

### QA fixture readiness

- QA type: authenticated route/browser + responsive/manual state matrix.
- Canonical fixture source: `supabase/seed.sql`, qua isolated runner `scripts/e2e/run-e2e.mjs`.
- Existing covered states:
  - in-progress: `/learn/b2-qa-in-progress` (`2/4`, next `b2-qa-progress-topic-2`);
  - completed: `/learn/b2-qa-completed` (`3/3`, last `b2-qa-completed-final-topic`);
  - no-content: `/learn/b2-qa-no-content`;
  - published active, protected topic, learner unenrolled: `/learn/local-toeic-test-course`;
  - invalid/nonexistent: deterministic URL only, không cần row.
- Missing states: không có state bắt buộc nào thiếu; recoverable backend error được chứng minh bằng action/component tests thay vì phá fixture.
- Required fixture additions: không có; `supabase/seed.sql` không đổi.
- Reset/setup command: focused `npm run test:e2e -- ...`; runner tự reset isolated local Supabase và dùng repository seed.
- Fixture checkpoint: CP3, sau CP1/CP2 green.
- Browser QA may begin when: focused action/component tests, TypeScript và targeted lint đạt; isolated runner xác nhận local-safe environment.

Manual/browser matrix:

| Actor/start state | Action | Expected visible result/evidence |
| --- | --- | --- |
| Guest | Mở `/learn/b2-qa-in-progress` | Login redirect; không render course overview |
| Seeded student, in-progress | Mở `/learn/b2-qa-in-progress` | URL giữ nguyên, `2/4`, 50%, Topic 1/4 completed states đúng, CTA tới topic 2 |
| Seeded student, completed | Mở `/learn/b2-qa-completed` | 100%, all completed, `Xem lại bài học cuối` đúng slug |
| Seeded student, no-content | Mở `/learn/b2-qa-no-content` | No-content copy, không learning CTA/link topic |
| Seeded student, unenrolled | Mở `/learn/local-toeic-test-course` | Clear unenrolled state; primary `/courses/local-toeic-test-course`, secondary `/learn`; protected `Local Test Topic` không xuất hiện |
| Seeded student | Mở invalid slug như `/learn/UPPERCASE` | Safe framework not-found; không runtime crash |
| Seeded student | Mở `/learn/course-slug-that-does-not-exist` | Safe not-found; không unenrolled/error copy |
| Seeded student | Dùng primary CTA từ in-progress | Nested URL đúng và workspace initial topic vẫn đúng; không yêu cầu sidebar sync |
| Seeded student, dashboard | Dùng `Xem tổng quan` trên course card | Đi đúng `/learn/[course-slug]`; primary next/final-topic CTA vẫn hiện và giữ exact destination |
| 375px và desktop | Mở success/unenrolled/no-content | Đúng hierarchy, CTA discoverable, text wrap, focus visible, không horizontal overflow |

Manual QA không tuyên bố `STUDENT-005` hoàn tất; framework not-found an toàn là đủ cho C1.

## 13. Scope exclusions và stop conditions

Ngoài C1:

- C2 URL/sidebar/back-forward synchronization, locked/invalid topic hardening hoặc workspace fallback change.
- Memory check, exercise-attempt semantics, required-question correctness hoặc final completion truth.
- `STUDENT-005` custom/global 404, metadata/title redesign.
- Preview percentage/locked content contract.
- Public course detail, enrollment/payment checkout hoặc pending-payment UX redesign.
- Dashboard/profile/review visual redesign; `STUDENT-003`/`STUDENT-004` follow-up.
- New route, state library, package, font, animation system, shared design primitive hoặc global theme.
- Database schema, migration, RLS, RPC, trigger, view, seed, production data hoặc service-role bypass.

Stop và báo owner nếu:

1. Existing RLS không cho enrolled learner đọc required rows hoặc cho unenrolled learner đọc protected rows theo cách action boundary không thể phân loại an toàn.
2. Course visibility model khác `published` + active hoặc collaborator/preview behavior phải được đưa vào C1.
3. C1 không thể phân biệt nonexistent với query failure bằng existing Supabase result semantics.
4. Shared projection làm thay đổi B2 output/order/status/next-topic hoặc yêu cầu broad refactor.
5. Required data vượt existing tables/fields hoặc cần migration/RPC/index.
6. UI cần sửa `components/ui/**`, nested workspace hoặc global 404 để đạt acceptance criteria.
7. Existing seed không tái tạo được state matrix sau isolated reset.
8. Baseline/branch diverge hoặc C2/another branch đã chạm overlapping route/contract.

Rollback implementation về sau là revert C1 page/action/schema/helper/components/tests/docs như một coherent PR. Không có database rollback vì C1 plan không thay data layer.

## 14. Documentation và progress updates

CP3 đã reconcile evidence thực tế vào detailed plan/brief, master plan, progress tracker, problems log, ADR, index và B3 historical handoff. `STUDENT-002` được ghi đã xử lý trên implementation branch vì exact route đã được C1 reclaim; `WORKSPACE-001`, `PROGRESS-001` và `STUDENT-005` vẫn giữ nguyên owner/follow-up scope.

## 15. Implementation outcome, verification và handoff

Checkpoint commits:

- CP1 `bff4f9f`: course-specific action/DTO, explicit access classification, shared B2 progress projection và reusable pagination.
- CP2 `bb7fa36`: exact overview route, success/access/error/loading UI và focused route/component regressions.
- CP3 `f1234f2`: guest missing-session correction, seeded C1 browser matrix và public smoke ownership reconciliation.

Verification đạt ngày 2026-08-18:

- Focused action/helper/component regressions đạt trong từng checkpoint; final full Vitest đạt `39 files / 383 tests`.
- `npx tsc --noEmit --incremental false`, targeted ESLint cho toàn bộ TypeScript/TSX C1 và `git diff --check` đạt.
- Isolated seeded Playwright đạt C1 `3/3` scenarios; canonical public discovery đạt `1/1` trong focused CP3 run.
- Production `npm run build` compiled, TypeScript, page data và static generation thành công. Lần chạy sandbox đầu không tải được Google Fonts; rerun cùng command ngoài sandbox đạt, không cần code workaround.
- Visual/manual QA đạt cho mobile `375x812` và desktop `1280x900`: success/no-content/unenrolled hierarchy, wrapping, CTA discoverability và horizontal overflow đều đúng; nested workspace exact topic vẫn giữ nguyên.

Implementation finding đã xử lý: Supabase guest `getUser()` trả `AuthSessionMissingError`; action ban đầu phân loại thành query failure. CP3 đổi riêng missing-session thành `auth_required`, giữ auth-service errors khác là recoverable `QUERY_FAILED`, và thêm action/browser regression.

Post-manual-QA correction đã xử lý `STUDENT-006`: B2 dashboard trước đó chỉ expose fast-path topic CTA nên C1 overview chưa discoverable trong learner flow. `CourseRow` nay thêm secondary `Xem tổng quan` cho mọi enrolled course state, trong khi primary `Tiếp tục học`/`Bắt đầu học`/`Xem lại bài học cuối` vẫn giữ exact B2 destination và no-content không tạo topic CTA giả. Không đổi action, DTO, shared projection hoặc dashboard layout ngoài action group hẹp. `NAVIGATION-001` được ghi riêng trong problems log vì mobile account-menu parity là vấn đề header/navigation toàn cục ngoài C1.

Correction verification đạt: focused dashboard/overview regressions `3 files / 31 tests`; TypeScript, targeted ESLint và `git diff --check`; isolated seeded C1 Playwright `3/3`, gồm exact dashboard primary/overview href, navigation thật và no-overflow tại mobile `375x812` lẫn desktop `1280x900`.

Final self-review: **Pass — không còn finding `Critical` hoặc `Required` trong scope C1**. Shared extraction giữ nguyên B2 dashboard output/order/status/next-topic; không chạm nested workspace C2, memory/final-completion truth, global 404, database/schema/RLS/RPC/seed, shared primitives hoặc unrelated redesign. Branch sẵn sàng cho owner review/PR riêng; workflow này không tạo/update PR, merge hay deploy.
