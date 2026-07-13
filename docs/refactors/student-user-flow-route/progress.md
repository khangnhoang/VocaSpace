# Theo dõi tiến độ tái cấu trúc luồng student/user và route

## Tài liệu liên quan

Nguồn plan chính thức: [plan.md](./plan.md).

Nhật ký vấn đề, rủi ro và follow-up chi tiết: [problems.md](./problems.md).

ADR quyết định: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

## Chú giải trạng thái

- Chưa bắt đầu
- Đang thực hiện
- Implementation complete
- Automated checks passed
- Manual QA pending
- Manual QA đã đạt
- Sẵn sàng code review
- Đã merge
- Bị chặn
- Deferred
- Post-MVP

## Snapshot ban đầu - 2026-07-05

- Tài liệu plan/progress/problems/ADR đã được tạo để chuẩn bị refactor.
- Chưa có route move trong branch tài liệu này.
- Chưa có public catalog implementation.
- Chưa có migration, RLS/RPC change, hoặc business logic change.
- Quyết định hard cut teacher `/courses` -> `/teacher/courses` đã được ghi nhận là accepted.
- `/courses` public catalog, `/learn` student dashboard, `/profile` account-only direction đã được ghi nhận là accepted.

## Tổng quan tiến độ

| Wave / PR | Trạng thái | Dependency | Branch / PR reference | Cập nhật lần cuối | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Wave A: Teacher route hard cut | Đã hoàn tất | Documentation plan | PR #42–#44, merged to `main` | 2026-07-11 | Teacher authoring ở `/teacher/courses`; public `/courses` đã được giải phóng. |
| PR A1: Prepare route helpers and docs | Đã merge/hoàn tất | Docs branch merged | PR #42, merge `d800d648` | 2026-07-08 | Helper centralization commit `cce28c9`; giữ behavior cũ trước hard cut. |
| PR A2: Move canonical teacher route | Đã merge/hoàn tất | PR A1 | PR #43, merge `59680afb` | 2026-07-08 | Implementation `701054b`; hard cut sang `/teacher/courses`, không legacy redirect. |
| PR A3: Teacher route tests and proxy hardening | Đã merge/hoàn tất; manual QA đạt | PR A2 | PR #44, merge `6a639d5e` | 2026-07-09 | Segment-aware guard, negative boundary tests và manual route QA. |
| Wave B: Public catalog/detail and student dashboard | Đang triển khai | Wave A stable | PR #46 merged; `feat/student-learn-dashboard` | 2026-07-13 | PR B1 merged; B2 implementation hoàn tất cục bộ, B3 chưa bắt đầu. |
| PR B1: Public catalog and detail | Đã merge/hoàn tất | PR A3 | PR #46, merge `079ad46` | 2026-07-12 | B1.1–B1.7 complete; merged to `main`. |
| PR B2: Student `/learn` dashboard | Implementation hoàn tất; manual QA một phần | PR B1 | `feat/student-learn-dashboard` | 2026-07-13 | Automated gates đạt; data-rich/mobile visual QA còn pending. |
| PR B3: Redirect old public detail | Chưa bắt đầu | PR B2 | Chưa có | 2026-07-05 | Redirect `/learn/[course-slug]` to `/courses/[course-slug]`. |
| Wave C: Enrolled learning routes and workspace hardening | Chưa bắt đầu | Wave B stable | Chưa có | 2026-07-05 | Course overview and URL-synced workspace. |
| PR C1: Enrolled course overview | Chưa bắt đầu | PR B3 | Chưa có | 2026-07-05 | `/learn/[course-slug]` no auto redirect. |
| PR C2: Workspace route hardening | Chưa bắt đầu | PR C1 | Chưa có | 2026-07-05 | Use actual `[topic-slug]`; clear invalid/locked/unenrolled states. |
| Wave D: Later backlog | Deferred | Stable route/dashboard/workspace contracts | Chưa có | 2026-07-05 | Topic publish, preview, memory check, completion truth, OAuth, deeper review/payment. |

## Wave A: Teacher route hard cut

- Merge evidence verified 2026-07-11: GitHub PR #42, #43 và #44 đều `MERGED` vào
  `main`; merge commits lần lượt là `d800d648`, `59680afb`, `6a639d5e`. GitHub check
  rollups ghi `Test and Build`, `production-gate` và Vercel success cho cả ba PR.

### PR A1: Prepare route helpers and docs

- Trạng thái: Đã merge/hoàn tất qua PR #42 (`d800d648`), implementation `cce28c9`.
- Planned:
  - Centralize teacher authoring route helpers around `lib/course-authoring/routes.ts`.
  - Update route contract docs if implementation discovers additional helper boundaries.
  - Keep existing behavior if possible.
- In progress:
  - Không còn.
- Done:
  - Documentation plan created.
  - Centralized current teacher authoring browser URL helpers around `lib/course-authoring/routes.ts` with current base `/courses`.
  - Replaced clear teacher-authoring hardcoded links and browser-visible revalidation paths in header, teacher course pages/components, and chapter/topic actions.
  - Wrapped internal `/(teacher)/courses` route-file revalidation separately from browser URL helpers.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - Do not move physical route files in A1.
  - Do not create public catalog in A1.
- Verification latest:
  - `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/actions/course-structure.test.ts __tests__/utils/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts` - passed, 5 files / 105 tests.
  - `npm.cmd run lint -- "lib/course-authoring/routes.ts" "components/ui/header.tsx" "app/(teacher)/courses/page.tsx" "app/(teacher)/courses/new/page.tsx" "app/(teacher)/courses/_components/CourseList.tsx" "app/(teacher)/courses/[id]/_components/CourseOverview.tsx" "app/(teacher)/courses/[id]/_components/CourseOverviewError.tsx" "app/(teacher)/courses/[id]/_components/EmptyCourseDashboard.tsx" "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "app/actions/chapter.ts" "app/actions/topic.ts"` - passed.
  - `npm.cmd run lint -- "app/actions/course.ts"` - passed.
  - `git diff --check` - passed with line-ending warnings only.

### PR A2: Move canonical teacher route to `/teacher/courses`

- Trạng thái: Đã merge/hoàn tất qua PR #43 (`59680afb`), implementation `701054b`.
- Planned:
  - Move/rename route namespace.
  - Update helper base path.
  - Update header/navigation/breadcrumbs/back links.
  - Update revalidation paths.
  - Update imports affected by route path changes.
- In progress:
  - Không còn.
- Done:
  - Moved physical route namespace from `app/(teacher)/courses` to `app/(teacher)/teacher/courses`.
  - Updated teacher authoring browser helper base from `/courses` to `/teacher/courses`.
  - Updated internal route-file revalidation helper from `/(teacher)/courses` to `/(teacher)/teacher/courses`.
  - Updated focused imports and tests for the new physical route path and browser URLs.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - No public catalog yet.
  - No legacy redirects for old teacher `/courses` routes.
  - No duplicate teacher UI.
- Verification target:
  - TypeScript.
  - Focused route/component/action tests.
  - Manual QA for teacher course list/create/overview/structure/topic builder.
- Verification latest:
  - `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/actions/course-structure.test.ts __tests__/utils/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts` - passed, 5 files / 105 tests.
  - `npm.cmd run typecheck --if-present` - passed; no typecheck script output was emitted.
  - `npm.cmd run lint -- "app/(teacher)/teacher/courses" "lib/course-authoring/routes.ts" "lib/course-authoring/issue-guidance.ts" "__tests__/components/course-workspace-routes.test.tsx" "__tests__/components/course-authoring-trust.test.tsx" "__tests__/components/question-group-media-field.test.tsx" "__tests__/actions/course-structure.test.ts" "__tests__/utils/course-readiness.test.ts" "__tests__/schemas/course-readiness.test.ts"` - passed with existing warnings only.
  - `git diff --check` - passed with line-ending warnings only.

### PR A3: Teacher route tests and proxy hardening

- Trạng thái: Đã merge/hoàn tất qua PR #44 (`6a639d5e`); automated và manual QA đã đạt.
- Planned:
  - Update tests to assert `/teacher/courses`.
  - Verify unauthenticated `/teacher/*` goes through `proxy.ts`.
  - Confirm Server Actions/RLS remain real data protection.
  - Clean stale teacher `/courses` references.
- In progress:
  - Không còn.
- Done:
  - Added focused `proxy.ts` wiring coverage.
  - Added direct `updateSession` coverage for unauthenticated `/teacher`, `/teacher/courses`, `/teacher/courses/new`, and `/teacher/courses/[id]`.
  - Hardened teacher route matching so only `/teacher` and `/teacher/...` are treated as teacher namespace routes.
  - Covered lookalike/non-teacher paths such as `/teacherish` and old `/courses/*` so they do not become teacher redirects.
  - Removed the stale login redirect comment that suggested `/teacher/courses` as an alternate post-login destination.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - Do not report middleware missing just because the project uses `proxy.ts`.
  - No public `/courses` catalog/detail.
  - No legacy redirects for old teacher `/courses` routes.
  - Server Actions/RLS remain the real data protection layer.
- Verification latest:
  - `npm.cmd run test:run -- __tests__/proxy.test.ts __tests__/utils/supabase-middleware.test.ts` - passed, 2 files / 8 tests.
  - `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/actions/course-structure.test.ts __tests__/utils/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts` - passed, 5 files / 105 tests.
  - `npm.cmd run lint -- proxy.ts utils/supabase/middleware.ts __tests__/utils/supabase-middleware.test.ts __tests__/proxy.test.ts` - passed.
  - `git diff --check` - passed with line-ending warnings only.
- Manual QA latest:
  - Unauthenticated `/teacher/courses` redirects to `/login` - passed.
  - Unauthenticated `/teacher/courses/new` redirects to `/login` - passed.
  - Unauthenticated `/teacher/courses/<id>` redirects to `/login` - passed.
  - `/teacherish` is not treated as teacher route - passed.
  - Teacher/admin navigation still points to `/teacher/courses` - passed.
  - Old `/courses/*` does not redirect to teacher authoring - passed.
  - UX follow-up recorded in `problems.md`: redirect has no visible explanation/toast.

## Wave B: Public catalog/detail and student dashboard

### PR B1: Public catalog and course detail

- Trạng thái: B1.1–B1.7 hoàn tất ở checkpoint level; PR B1 sẵn sàng cho final review.
- Kế hoạch chi tiết:
  - [pr-b1-public-catalog-detail-plan.md](./pr-b1-public-catalog-detail-plan.md).
- Base/branch:
  - Base: `main@f536b578879ea11b131a0b6d66bb032868fcb150`.
  - Branch: `feat/public-course-catalog-detail`.
- Planned:
  - Create public `/courses`.
  - Create public `/courses/[course-slug]`.
  - Homepage shows at most four courses by valid enrollment count with paid/free
    quota, fallback fill and deterministic tie-break.
  - Expose guest-safe syllabus metadata without protected content.
  - Keep first-topic preview as temporary compatibility metadata.
  - Fix payment cancel transition to canonical slug route.
  - Reconcile Wave A documentation in an isolated checkpoint.
  - Public course cards point to `/courses/[course-slug]`.
- In progress:
  - B1.3 retry-button error-state manual QA còn pending; homepage và `/courses`
    desktop/mobile layout smoke QA đã đạt theo evidence được cung cấp ngày 2026-07-11.
  - B1.4 manual QA đã xác nhận free enrollment row được tạo và enrollment overlay
    cập nhật đúng; đồng thời phát hiện modal không đóng và vẫn dùng payment/coupon copy.
  - B1.4 free-modal correction manual retest đã đạt: modal đóng sau đăng ký thành công
    và copy/UI miễn phí hiển thị đúng; close-button visual retest cũng đã đạt, không còn
    pill dọc. Guest detail desktop/mobile đầy đủ, signed-in/enrolled và paid-flow manual
    QA khác vẫn chưa hoàn tất.
  - B1.5 PayOS sandbox/manual cancellation QA chưa chạy vì task không xác nhận sẵn
    credential/môi trường sandbox; automated contract đã đạt.
  - B1.7 final release gate ngày 2026-07-11 đã chạy full test, TypeScript, targeted lint,
    production build, local integration và guest browser/E2E matrix. Heading hierarchy
    đã được sửa; repository-wide lint baseline được tách thành `QUALITY-001` vì toàn bộ
    finding nằm ngoài B1 diff. Signed-in/enrolled, retry-error fixture và PayOS sandbox
    QA chưa chạy.
- Done:
  - B1.1: thêm public catalog/detail RPC với metadata whitelist, explicit grants,
    stable ordering và giữ nguyên direct-table RLS cho syllabus/content/enrollment.
  - B1.1: thêm index `idx_enrollments_course_id` cho aggregate theo course.
  - B1.2: thêm strict Zod RPC/DTO boundary, public catalog/detail actions, canonical
    route helpers, temporary first-topic preview mapping và pure homepage selector.
  - B1.3: thêm `/courses`, homepage top-four, shared public course card/grid,
    loading/empty/error states và xóa `PublicCourseList`/`getPublishedCourses` cũ.
  - B1.3 corrections: card title dùng contextual `h3` trên homepage và `h2` trong
    catalog; recoverable error dùng retry refresh với pending/disabled state, còn
    empty state giữ navigation link.
  - B1.4: thêm canonical `/courses/[course-slug]` với request-scoped detail read,
    safe metadata/canonical path, loading và exact success/not-found/error mapping.
  - B1.4: canonical và legacy `/learn/[course-slug]` dùng chung public detail renderer;
    public stats chỉ có chapter/topic/enrollment, instructor DTO public-safe, syllabus
    presentation-only và temporary preview không mở content/workspace link.
  - B1.4 cleanup: xóa old `getCourseDetail`, legacy course-detail schema/test và các
    duplicate legacy detail components sau khi production caller audit về 0; payment
    presentation được chuyển sang canonical public-course ownership, B1.5 cancel URL
    chưa thay đổi.
  - B1.4 manual-QA correction: free course dùng confirmation-only modal, chặn submit
    lặp, đóng/xóa stale state trước refresh/first-topic navigation; paid flow giữ
    coupon/PayOS presentation và close control dùng shadcn icon button.
  - B1.4 review correction: CTA đứng trước các section dài trong mobile document order;
    paid modal stage không hoạt động bị loại khỏi accessibility/focus tree; local-IP
    image optimization chỉ bật bằng explicit server-side opt-in cho QA Supabase local.
  - B1.5: PayOS `cancelUrl` chuyển từ `/learn/${courseId}` sang canonical absolute
    `/courses/[course-slug]`; slug được resolve từ trusted published/non-removed course
    row, client không thể cung cấp redirect, và success `returnUrl` giữ nguyên.
  - B1.6: đối soát Wave A PR #42–#44 là merged vào `main`; đóng `ROUTE-001`,
    `ROUTE-002`, `AUTH-001` bằng route/helper/proxy/test evidence; giữ `AUTH-003` deferred
    và đồng bộ checkpoint B1.1–B1.5 với commit/verification đã ghi.
  - `npx.cmd supabase db reset --local` - passed ngày 2026-07-11.
  - `npm.cmd run test:integration -- __tests__/integration/public-course-read-model.test.ts`
    - passed, 1 file / 10 tests.
  - `npm.cmd run test:run -- __tests__/schemas/public-course.test.ts __tests__/utils/public-course-routes.test.ts __tests__/utils/public-course-selector.test.ts __tests__/actions/public-course.test.ts`
    - passed; B1.2 hiện có 39 focused tests sau correction coverage.
  - Targeted ESLint cho 8 file TypeScript B1.2 - passed.
  - Focused B1.3/B1.2 regression command ngày 2026-07-11
    - passed sau corrections, 6 files / 56 tests; riêng B1.3 là 1 file / 8 tests.
  - Targeted ESLint cho 7 file TypeScript/TSX thuộc B1.3 corrections - passed.
  - Focused B1.4/B1.3/action/schema/route/workspace regression command ngày 2026-07-11
    - passed sau free-modal correction, 6 files / 98 tests; riêng B1.4 là 1 file / 16 tests.
  - Targeted ESLint cho 13 file TypeScript/TSX thuộc B1.4 - passed.
  - Focused B1.4/B1.3/action/schema/route/workspace regression rerun sau review
    corrections ngày 2026-07-11 - passed, 6 files / 100 tests; riêng B1.4 là
    1 file / 18 tests.
  - Targeted ESLint cho 4 file TypeScript/TSX/config thuộc B1.4 review corrections
    - passed.
  - Focused regression rerun sau khi đồng bộ loading document order ngày 2026-07-11
    - passed, 6 files / 100 tests; targeted ESLint cho loading/test correction - passed.
  - `npx.cmd tsc --noEmit --incremental false` sau B1.4 final corrections và clean
    generated `.next` cache - passed trước commit `765a9b2`.
  - Focused B1.5 payment/route/detail regression command ngày 2026-07-11
    - passed, 3 files / 31 tests; payment action riêng 1 file / 10 tests.
  - `npx.cmd tsc --noEmit --incremental false` sau B1.5 - passed.
  - Targeted ESLint cho 3 file TypeScript/TSX thay đổi trong B1.5 - passed.
  - `git diff --check` sau B1.5 - passed.
  - B1.6 documentation audit ngày 2026-07-11: PR #42–#44 GitHub merge/check metadata,
    cited commit objects, current route/helper/proxy/test evidence và relative links đã
    được kiểm tra; stale-status search và `git diff --check` passed.
  - Public-course integration rerun trên local Supabase ngày 2026-07-11
    - passed, 1 file / 10 tests; lần chạy sandbox đầu tiên có 8/10 pass và 2 metadata
      query bị `EPERM` khi Supabase CLI ghi telemetry, rerun ngoài sandbox đã pass 10/10.
  - Local metadata audit xác nhận hai RPC là `STABLE SECURITY DEFINER`,
    `search_path = ''`, chỉ grant `anon`/`authenticated`/`service_role`, và index có
    leading column `course_id`.
  - B1.7 `npm.cmd run test:run` - passed, 30 files / 315 tests / 0 failures;
    `npx.cmd tsc --noEmit --incremental false` - passed.
  - B1.7 `npm.cmd run build` - passed ngoài sandbox sau khi lần chạy sandbox bị chặn
    network khi tải Google Fonts; compile, type-check và generate 17/17 static pages đạt.
  - B1.7 local Supabase reset - passed; `npm.cmd run test:integration` với gate local
    - passed, 9 files / 65 tests / 0 failures. Public read-model matrix tiếp tục đạt 10/10.
  - B1.7 guest browser QA - homepage/catalog/canonical detail/legacy adapter/unknown-slug,
    mobile overflow, mobile CTA/loading order và free-modal presentation đã đạt trên local
    fixtures. Legacy detail giữ URL `/learn/[course-slug]` và không sinh canonical cạnh tranh.
  - B1.7 heading correction: shared header brand và mobile account name không còn là
    heading; mobile sheet có accessible title; homepage giữ đúng một primary hero `<h1>`.
    Focused hierarchy/catalog/detail regression - passed, 3 files / 28 tests.
  - B1.7 final `npm.cmd run test:run` - passed, 31 files / 317 tests / 0 failures;
    targeted ESLint cho 4 TypeScript/TSX/test files - passed; final TypeScript - passed.
  - B1.7 public guest-discovery Playwright smoke - passed, 1 spec / 1 test. Test xác minh
    homepage có tối đa bốn highlighted cards, canonical detail/public preview boundary,
    catalog, public 404, mobile heading contract và legacy route không redirect.
  - B1.7 final production build - passed ngoài sandbox để tải Google Fonts; compile,
    type-check và generate 17/17 static pages đạt. `git diff --check` - passed.
- Blocked:
  - Không còn B1-scoped Critical/Required finding. Repository-wide `npm.cmd run lint`
    baseline vẫn có 13 errors và 12 warnings trong file ngoài B1 diff; được theo dõi riêng
    tại `QUALITY-001` và không được ghi nhận là full-lint pass.
- Notes:
  - Old public `/learn/[course-slug]` remains temporarily.
  - Không thêm `is_featured`, enrollment-status rule hoặc final preview management.
  - B1.4 correction không chạy full suite, full lint, production build, E2E hoặc
    browser automation; manual evidence đã xác nhận free enrollment backend/database,
    corrected free-modal UX và close-button visual. Guest detail desktop/mobile đầy đủ,
    signed-in/enrolled và paid flow vẫn pending.
  - B1.5 không chạy PayOS sandbox/manual cancellation QA; `PAYMENT-002` được đóng theo
    automated evidence, còn manual provider verification được ghi rõ là chưa chạy.
  - B1.7 E2E stability correction ngày 2026-07-12: runner tự reset đúng isolated local
    Supabase workdir sau loopback validation, nên mỗi run đều apply migration và seed sạch;
    public guest-discovery smoke chạy liên tiếp hai lần không reset thủ công và đều đạt 1/1.
    Smoke chờ canonical course link đầu tiên visible trước khi đọc số lượng Suspense grid;
    targeted lint cho runner/spec và `git diff --check` đều đạt.
  - Catalog recoverable-error retry manual QA, signed-in unenrolled/enrolled matrix và
    paid-flow browser QA chưa chạy vì không có stable local fixture/session tương ứng.
  - PayOS sandbox cancellation QA: not run.
  - CI chưa chạy vì chưa có PR. PR B1 sẵn sàng cho final review nhưng không suy diễn CI,
    PayOS sandbox hoặc các manual scenario còn thiếu là passed.
- Verification target:
  - Public catalog/detail action/component tests.
  - Manual QA for guest navigation.

### PR B2: Student `/learn` dashboard

- Trạng thái: Implementation hoàn tất cục bộ; automated gates đạt, manual QA một phần.
- Branch: `feat/student-learn-dashboard`.
- Base: `origin/main @ c70ed20` (post-PR #47, includes B1 merge).
- Kế hoạch chi tiết: [plans/b2-student-learn-dashboard.md](./plans/b2-student-learn-dashboard.md).
- Tài liệu deferred features: [future-features.md](./future-features.md).
- Planned:
  - Replace placeholder `/learn`.
  - Show enrolled courses.
  - Show continue learning and next topic.
  - Show course progress.
  - Show due flashcards summary.
  - Show pending payment reminder if any.
  - Move dashboard responsibility away from `/profile`.
  - Minimal workspace initial-topic route support.
- In progress:
  - Manual visual QA ở viewport mobile thật và các state có enrolled course/pending payment
    còn pending vì local seeded student không có dữ liệu tương ứng.
- Done:
  - Dashboard contract/action dùng strict Zod DTO, authenticated grouped reads và không N+1.
  - Course visibility chỉ gồm enrollment của user trên course `published` chưa soft-delete.
  - Eligible topic chỉ gồm topic `published` chưa soft-delete trong chapter chưa soft-delete;
    progress, next topic và last topic dùng đúng full course order.
  - `/learn` có review summary, payment reminders, course progress/CTA, loading/error/empty
    states và responsive presentation; không thêm unpublished collaborator tab.
  - Active payment dùng `creating`/`pending`, newest-first, mặc định tối đa ba item, có view-all,
    dismiss độc lập theo `paymentId` trong `sessionStorage`, và tiếp tục qua `/courses/[slug]`.
  - Workspace nhận initial route topic slug, fallback an toàn nếu invalid/empty, không mở rộng
    sang full C2 URL synchronization.
  - `/profile` trở về account responsibility; review entry/component được chuyển hẹp sang
    `/learn`; authenticated desktop/mobile navigation có entry `/learn`.
  - Checkpoint commits sau planning commit: `05e2355`, `f3ca302`, `5155c55`, `951c030`,
    `86d1035`, `fa8179f`.
  - Focused dashboard/workspace/profile/header tests: passed.
  - `npm run test:run`: passed, 36 files / 347 tests sau final review corrections.
  - `npm run test:integration`: passed ngoài sandbox, 9 files / 65 tests; sandbox run trước đó
    chỉ fail vì Supabase CLI không ghi được telemetry dưới user profile.
  - `npx tsc --noEmit --incremental false`: passed.
  - Targeted ESLint cho toàn bộ TypeScript/TSX thay đổi: passed.
  - `npm run build`: passed ngoài sandbox; sandbox run trước đó chỉ fail do không fetch được
    Google Fonts hiện hữu.
  - Authenticated browser smoke QA: `/learn` empty state, `/profile` cleanup, header menu link,
    unauthenticated `/learn` redirect và browser console đều đạt.
  - Final independent review correction: paginate/chunk toàn bộ dashboard reads, bổ sung
    query-error/invalid-output/ordering regression tests, đóng mobile Sheet khi điều hướng và
    dùng accessible Dialog primitive cho review flow.
- Blocked:
  - Không còn blocked bởi B1 (PR #46 đã merge).
- Notes:
  - Dashboard reminder leads to course detail, not direct payment modal.
  - Dismiss uses `sessionStorage` keyed by `paymentId`.
  - Chapter table không có `status` field; "chapter published" = `removed_at IS NULL`.
  - Column completion thực tế trong schema là `is_topic_completed`; implementation dùng tên
    cột này thay cho shorthand `topic_completed` trong yêu cầu handoff.
  - Không có migration, RLS/policy, RPC, function, trigger hoặc view change.
- Verification target:
  - Automated data-state coverage đã đạt cho auth, visibility, progress/ordering, payments,
    review summary và initial-topic route seam.
  - Manual data-rich QA cho enrolled/progress/completed/no-content/pending-payment và viewport
    mobile thật còn cần chạy trước merge readiness sign-off.

### PR B3: Redirect old public `/learn/[course-slug]`

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Redirect old public detail to `/courses/[course-slug]`.
  - Keep learning workspace route `/learn/[course-slug]/[topic-slug]`.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR B2.
- Notes:
  - Does not wait for memory check or completion hardening.
- Verification target:
  - Route tests/manual QA for redirect and workspace path.

## Wave C: Enrolled learning routes and workspace hardening

### PR C1: Enrolled course overview

- Trạng thái: Chưa bắt đầu.
- Planned:
  - `/learn/[course-slug]` shows course progress.
  - Shows completed/incomplete topics.
  - Shows next topic.
  - Main CTA `Tiếp tục học`.
  - No auto redirect.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ Wave B stable.
- Notes:
  - Public detail must already be canonical at `/courses/[course-slug]`.
- Verification target:
  - Enrolled/unenrolled/invalid/empty states.

### PR C2: Workspace route hardening

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Workspace uses actual topic slug from URL.
  - Sidebar syncs with URL.
  - Invalid/locked/unenrolled states are clear.
  - Prepare for memory check and server-side completion later.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR C1.
- Notes:
  - Do not implement memory check in C2 unless a separate approved contract exists.
- Verification target:
  - Direct topic URL opens correct topic.
  - Sidebar route/state sync.
  - Refresh/back behavior.

## Wave D: Later backlog

- Trạng thái: Deferred.
- Items:
  - Topic publish validation.
  - Preview topic contract.
  - Memory check design/implementation.
  - Future question-category analytics compatibility.
  - Topic completion server truth.
  - FSRS review route or deeper review UX.
  - Google OAuth or hide fake CTA.
  - Profile cleanup and polish.
  - Deeper payment history/dashboard if needed.
- Notes:
  - Each item needs its own implementation audit before coding.
  - Do not pull these into Wave A route migration.

## Quy tắc cập nhật

1. Chỉ cập nhật summary row và section của PR đang active.
2. Ghi exact commands và actual outcomes.
3. Ghi manual QA tách biệt với automated checks.
4. Ghi rủi ro dài vào [problems.md](./problems.md).
5. Không đổi finalized decisions nếu chưa có explicit amendment.
6. Sau khi merge, ghi PR reference hoặc merge commit nếu có.
7. Giữ timestamp dạng `YYYY-MM-DD`.
8. Không dùng tracker này thay cho commit history hoặc PR description.
