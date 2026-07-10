# Nhật ký vấn đề tái cấu trúc luồng student/user và route

## Mục đích

File này ghi lại rủi ro, follow-up và technical debt cho chuỗi refactor route/student user flow. Progress tracker chỉ nên giữ trạng thái ngắn; các vấn đề cần giải thích dài hoặc cần audit khi implement nằm trong file này.

## Tài liệu liên quan

Nguồn plan chính thức: [plan.md](./plan.md).

Tài liệu theo dõi tiến độ: [progress.md](./progress.md).

ADR quyết định: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

## Quy ước trạng thái

- `Đang mở`: cần xử lý trong wave/PR gần.
- `Theo dõi`: cần kiểm tra lại khi thay đổi cùng khu vực.
- `Deferred`: đã biết nhưng không thuộc early waves.
- `Đã xử lý`: đã có PR/commit xử lý.
- `Implementation audit item`: không phải câu hỏi mở; là mục cần inspect khi PR tương ứng bắt đầu.

## Vấn đề đang mở

### ROUTE-001: Teacher authoring đang chiếm `/courses`

- Trạng thái: Đang mở.
- Phát hiện ở: route audit trước refactor.
- Problem: Teacher authoring hiện nằm dưới `app/(teacher)/courses`, tạo URL `/courses`, `/courses/new`, `/courses/[id]`, `/courses/[id]/structure`, `/courses/[id]/topics/[topicId]`.
- Impact: Không thể dùng `/courses` làm public catalog nếu không move teacher namespace. Người dùng cũng khó phân biệt public course routes và teacher authoring routes.
- Mitigation: Wave A hard cut sang `/teacher/courses`; không duplicate UI; không old-route redirects.
- Wave/PR xử lý: PR A1, PR A2, PR A3.
- Implementation audit item:
  - What to inspect: `app/(teacher)/courses`, `lib/course-authoring/routes.ts`, header/navigation, breadcrumbs, action revalidation, tests, docs.
  - Default assumption: all teacher authoring links should become `/teacher/courses...`.
  - Risk: stale `/courses` teacher link remains and collides with public catalog.
  - Verify during: PR A2 and PR A3.

### ROUTE-002: Tests and docs still encode teacher `/courses`

- Trạng thái: Đang mở.
- Problem: Existing tests/docs for teacher workflow were written when `/courses` was teacher authoring namespace.
- Impact: Route move can fail tests for the right reason, or worse, tests can keep asserting old routes and hide stale behavior.
- Mitigation: Update route helper tests, component tests, action revalidation expectations, and ADR references as part of Wave A.
- Wave/PR xử lý: PR A1 for docs/helper framing, PR A3 for cleanup/assertions.
- Implementation audit item:
  - What to inspect: `__tests__/components/course-workspace-routes.test.tsx`, `__tests__/components/course-authoring-trust.test.tsx`, `__tests__/actions/course-structure.test.ts`, `__tests__/utils/course-readiness.test.ts`, `docs/adr/refactor-teacher-workflow-*`.
  - Default assumption: teacher authoring expected paths should use `/teacher/courses`.
  - Risk: route helper and tests diverge.
  - Verify during: PR A3.

### AUTH-001: `proxy.ts` guards `/teacher`, but current teacher routes are not under `/teacher`

- Trạng thái: Đang mở.
- Problem: `proxy.ts` calls `utils/supabase/middleware.ts`, and `updateSession` checks `pathname.startsWith('/teacher')`. Current teacher authoring under `/courses` does not match that guard.
- Impact: Route-level unauthenticated UX for teacher authoring is incomplete until the namespace moves. Server Actions and RLS still protect data, but route UX and namespace intent are misaligned.
- Mitigation: Move teacher routes under `/teacher/courses`, then verify unauthenticated `/teacher/*` behavior and keep Server Actions/RLS as data protection.
- Wave/PR xử lý: PR A2, PR A3.
- Implementation audit item:
  - What to inspect: `proxy.ts`, `utils/supabase/middleware.ts`, teacher route pages, auth redirects.
  - Default assumption: `proxy.ts` remains the framework-level guard for `/teacher/*`.
  - Risk: unauthenticated user sees an incomplete teacher page shell before data errors.
  - Verify during: PR A3.

### STUDENT-001: `/learn` is not yet a student dashboard

- Trạng thái: Đang mở.
- Problem: `/learn` currently needs to become authenticated student dashboard with enrolled courses, continue learning, progress, due flashcards summary and pending payment reminder.
- Impact: Student has no canonical learning home; `/profile` can keep carrying learning responsibilities by accident.
- Mitigation: Build `/learn` dashboard after public catalog/detail route contract is in place.
- Wave/PR xử lý: PR B2.
- Implementation audit item:
  - What to inspect: `app/(client)/learn/page.tsx`, `app/actions/profile.ts`, `app/actions/review.ts`, existing profile components, enrollments/progress/FSRS queries.
  - Default assumption: `/learn` owns learning dashboard; `/profile` owns account management.
  - Risk: dashboard overfetches or mixes pending payment, due review, and progress without clear DTO boundaries.
  - Verify during: PR B2.

### STUDENT-002: Public detail and enrolled overview share `/learn/[course-slug]` during transition

- Trạng thái: Đang mở.
- Problem: Current public course detail may remain temporarily at `/learn/[course-slug]`, but target `/learn/[course-slug]` is enrolled course overview.
- Impact: Route semantics collide unless redirect timing is controlled.
- Mitigation: Create `/courses/[course-slug]` first, then after `/learn` dashboard works, redirect old public detail from `/learn/[course-slug]` to `/courses/[course-slug]`.
- Wave/PR xử lý: PR B1, PR B2, PR B3, PR C1.
- Implementation audit item:
  - What to inspect: public detail page, course cards, `StickyEnrollCard`, `getCourseDetail`, route matching for `/learn/[course-slug]/[topic-slug]`.
  - Default assumption: B3 redirect happens before C1 reclaims `/learn/[course-slug]`.
  - Risk: redirect catches learning overview or workspace route by mistake.
  - Verify during: PR B3 and PR C1.

### PAYMENT-001: Pending payment needs two different UX surfaces

- Trạng thái: Đang mở.
- Problem: Course detail must own exact pending payment state and `Tiếp tục thanh toán`, while `/learn` dashboard only shows a reminder.
- Impact: A dashboard modal could duplicate payment state or bypass the course-detail payment flow.
- Mitigation: Use a shared query/helper if needed, but expose separate DTOs: detailed course payment state for course detail, summary reminder for dashboard.
- Wave/PR xử lý: PR B2, with course detail support in PR B1 if needed.
- Implementation audit item:
  - What to inspect: `app/actions/payment.ts`, payment schemas, course detail action, dashboard data action, `payments.status`, `payments.id`, `expires_at`.
  - Default assumption: `paymentId` is unique and safe as sessionStorage dismissal key.
  - Risk: stale dismissed IDs hide a new active pending payment or continue showing expired payment.
  - Verify during: PR B2.

### PAYMENT-002: Payment cancel route uses course ID under the legacy `/learn` namespace

- Trạng thái: Đang mở.
- Phát hiện ở: B1 planning audit ngày 2026-07-10.
- Problem: `app/actions/payment.ts` tạo PayOS `cancelUrl` bằng
  `/learn/${courseId}`. Destination vừa dùng database ID thay vì public slug, vừa
  trỏ vào namespace learning thay vì canonical public course detail.
- Impact: Người dùng hủy hoặc quay lại payment có thể rơi vào URL không tồn tại và
  không trở về đúng course detail để tiếp tục luồng.
- Mitigation: Trong PR B1, lấy thêm `slug` từ trusted course query hiện có và tạo
  destination bằng public route helper `/courses/[course-slug]`. Không nhận slug từ
  client và không refactor rộng payment domain.
- Wave/PR xử lý: PR B1 checkpoint payment transition.
- Implementation audit item:
  - What to inspect: `app/actions/payment.ts`, public route helper, PayOS boundary,
    payment action tests và mọi internal cancel/resume destination.
  - Default assumption: success `returnUrl` giữ nguyên; pending gateway checkout URL
    không phải internal route cần đổi.
  - Risk: client-provided/stale slug tạo open redirect hoặc sai destination.
  - Status transition: chỉ chuyển `Đã xử lý` sau khi action test xác nhận exact
    server-resolved slug URL và manual sandbox QA được ghi nếu môi trường cho phép.
  - Verify during: PR B1.

### WORKSPACE-001: Learning workspace must use `[topic-slug]` from URL

- Trạng thái: Đang mở.
- Problem: The target workspace route must open the topic from URL. Current implementation needs hardening so direct links do not silently open the first topic.
- Impact: Student may land on the wrong lesson, progress can be written to the wrong topic, and shared links become unreliable.
- Mitigation: Pass topic slug into workspace state, validate it against syllabus/content access, and sync sidebar with URL.
- Wave/PR xử lý: PR C2.
- Implementation audit item:
  - What to inspect: `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx`, `LearningWorkspace`, `ChapterSidebar`, `getCourseSyllabus`, `getTopicContent`.
  - Default assumption: URL topic slug is source of truth on initial render.
  - Risk: stale local state overrides route state.
  - Verify during: PR C2.

### PROGRESS-001: Topic completion semantics are not final

- Trạng thái: Deferred.
- Problem: Target completion requires flashcards, memory check, all exercises, and all required questions answered correctly. Current progress model only has flashcard/exercise/topic completion flags.
- Impact: Client-side stage flags can mark a topic complete too early, especially with multiple exercises or missing memory check.
- Mitigation: Keep completion hardening out of early route PRs; later define server-side truth with fields/helper/RPC as needed.
- Wave/PR xử lý: Wave D.
- Implementation audit item:
  - What to inspect: `user_topic_progress`, `user_question_answers`, `app/actions/progress.ts`, `QuizSidebar`, `LearningWorkspace`.
  - Default assumption: current flags are insufficient for final target rule.
  - Risk: progress dashboard reports incorrect completion.
  - Verify during: later topic completion server truth PR.

### PREVIEW-001: Preview topic contract affects schema, RLS, public detail and workspace

- Trạng thái: Deferred.
- Problem: Preview is owner/co-owner selected, capped at 30% of topics, likely topic-level. This is not just a UI badge.
- Impact: If implemented casually, public users might read locked content or preview topic count can exceed the cap.
- Mitigation: Treat preview as a later teacher/content feature with schema/action/RLS/public/workspace audit.
- Wave/PR xử lý: Wave D.
- Implementation audit item:
  - What to inspect: `topics` schema, course detail syllabus, content read access RLS, teacher topic settings, workspace access.
  - Default assumption: future model will need topic-level marker such as `topics.is_preview`.
  - Risk: public content read access becomes too broad.
  - Verify during: preview contract PR.

### MEMORY-001: Memory check must not overload future question analytics

- Trạng thái: Deferred.
- Problem: Memory check is a usage/activity stage, not a question analytics category. Future analytics may need category/skill fields like grammar, vocabulary, detail, inference.
- Impact: A single overloaded `type` field can make later analytics or activity routing ambiguous.
- Mitigation: Keep concepts separate: question category/skill type, answer format, usage stage/activity stage.
- Wave/PR xử lý: Wave D.
- Implementation audit item:
  - What to inspect: `exercises.part_type`, `questions`, `question_options`, exercise schemas, learning workspace flow.
  - Default assumption: reuse existing exercise/question model if possible, but add/derive stage semantics separately.
  - Risk: memory check implementation blocks Study4-like question-category analytics.
  - Verify during: memory check design PR.

### PROFILE-001: `/profile` should not remain learning dashboard

- Trạng thái: Đang mở.
- Problem: `/profile` currently contains learning-related surfaces; target is account/profile management only.
- Impact: Student learning UX becomes split between `/profile` and `/learn`.
- Mitigation: Move main learning dashboard responsibilities to `/learn`; keep only small shortcut if useful.
- Wave/PR xử lý: PR B2 and Wave D polish.
- Implementation audit item:
  - What to inspect: `app/(client)/profile/page.tsx`, profile sidebar, courses placeholder, review sheet.
  - Default assumption: account settings remain in `/profile`; learning dashboard moves to `/learn`.
  - Risk: removing profile surfaces before `/learn` replacement exists harms navigation.
  - Verify during: PR B2 and profile cleanup follow-up.

### AUTH-002: Google buttons are not OAuth implementation

- Trạng thái: Deferred.
- Problem: Login/register UI has Google buttons, but OAuth implementation is later work.
- Impact: Fake CTA can mislead users.
- Mitigation: Hide or disable fake buttons unless Supabase Google OAuth can be implemented cleanly in a small later PR.
- Wave/PR xử lý: Wave D.
- Implementation audit item:
  - What to inspect: login/register pages, auth actions, Supabase OAuth provider config.
  - Default assumption: do not include OAuth in route migration waves.
  - Risk: authentication UX promises unsupported behavior.
  - Verify during: later auth polish PR.

### AUTH-003: Teacher auth redirect has no visible explanation

- Trạng thái: Deferred.
- Phát hiện ở: Manual QA sau PR A3.
- Problem: Unauthenticated `/teacher/*` requests correctly redirect to `/login`, but the login screen does not show a visible explanation or toast for why the user was redirected.
- Impact: Users may be confused after being moved from teacher authoring routes to login, even though proxy/session behavior is correct.
- Mitigation: Handle in a later auth UX polish task by adding a clear redirect reason message without changing proxy/session authorization semantics.
- Wave/PR xử lý: Later auth UX polish.
- Implementation audit item:
  - What to inspect: login redirect query handling, login/register UI messaging, `proxy.ts`, `utils/supabase/middleware.ts`.
  - Default assumption: PR A3 remains valid because unauthenticated `/teacher/*` route protection works.
  - Risk: UX polish accidentally broadens auth behavior or changes the teacher route guard instead of only explaining the redirect.
  - Verify during: later auth polish PR.

## Rủi ro theo wave

| Risk | Impact | Mitigation | Wave/PR |
| --- | --- | --- | --- |
| Stale teacher `/courses` route remains | Public catalog collision | Helper centralization and stale-reference cleanup | A1-A3 |
| Route tests assert old paths | False confidence or noisy failures | Update tests to new contract | A3 |
| Proxy/session UX incomplete | Unauth teacher route shell or confusing redirect | Move under `/teacher` and verify `proxy.ts` | A2-A3 |
| Dashboard data overfetch | Slow `/learn` or brittle DTOs | Define narrow dashboard DTOs | B2 |
| Pending payment state duplicated | Payment modal/state mismatch | Course detail owns exact state; dashboard summary only | B2 |
| Old public detail redirect catches workspace | Learning route breakage | Route matching tests/manual QA | B3 |
| Workspace ignores URL topic | Wrong lesson/progress | URL topic is source of truth | C2 |
| Completion too early | Incorrect progress | Server-side completion truth later | Wave D |
| Preview RLS too broad | Public reads locked content | Schema/RLS audit before preview | Wave D |
| Memory check overloads `type` | Analytics blocked | Separate category/format/stage | Wave D |

## Vấn đề deferred / ngoài scope early waves

### FUTURE-PUBLISH-001: Topic publish validation

- Trạng thái: Deferred.
- Mô tả: Topic publish must require both flashcards and exercises.
- Hướng xử lý: Audit topic update/publish action and readiness checks in a dedicated teacher/content PR.
- Verification cần có: action/schema tests for flashcard-only, exercise-only, both, and empty topics.

### FUTURE-REVIEW-001: FSRS review route or deeper review UX

- Trạng thái: Deferred.
- Mô tả: FSRS review should be discoverable from `/learn`; dedicated `/learn/review` can wait until dashboard/workspace are stable.
- Hướng xử lý: First show summary/card in `/learn`; later add dedicated route if product needs it.
- Verification cần có: dashboard data states and review card navigation.

### FUTURE-PAYMENT-001: Deeper payment dashboard/history

- Trạng thái: Deferred.
- Mô tả: Initial dashboard only needs pending payment reminder. Full payment history/dashboard is separate scope.
- Hướng xử lý: Keep initial DTO narrow; add deeper history only after product need is clear.
- Verification cần có: pending/paid/cancelled/expired/failed state behavior.
