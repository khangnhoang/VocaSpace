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
- `Mục cần kiểm tra khi triển khai`: không phải câu hỏi mở; đây là nội dung phải inspect khi PR tương ứng bắt đầu.

## Danh mục vấn đề và kết quả xử lý

### ROUTE-001: Teacher authoring đang chiếm `/courses`

- Trạng thái: Đã xử lý.
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
- Resolution Wave A: PR #43 (`59680afb`, implementation `701054b`) đã move toàn bộ
  teacher authoring sang `app/(teacher)/teacher/courses`; old teacher tree
  `app/(teacher)/courses` không còn. Branch hiện tại dùng `app/(client)/courses` cho
  public catalog/detail.
- Verification hiện tại: `lib/course-authoring/routes.ts` có browser base
  `/teacher/courses`; route-tree audit chỉ thấy teacher pages dưới `/teacher/courses`
  và public pages dưới `/courses`.

### ROUTE-002: Tests and docs still encode teacher `/courses`

- Trạng thái: Đã xử lý.
- Problem: Existing tests/docs for teacher workflow were written when `/courses` was teacher authoring namespace.
- Impact: Route move can fail tests for the right reason, or worse, tests can keep asserting old routes and hide stale behavior.
- Mitigation: Update route helper tests, component tests, action revalidation expectations, and ADR references as part of Wave A.
- Wave/PR xử lý: PR A1 for docs/helper framing, PR A3 for cleanup/assertions.
- Implementation audit item:
  - What to inspect: `__tests__/components/course-workspace-routes.test.tsx`, `__tests__/components/course-authoring-trust.test.tsx`, `__tests__/actions/course-structure.test.ts`, `__tests__/utils/course-readiness.test.ts`, `docs/adr/refactor-teacher-workflow-*`.
  - Default assumption: teacher authoring expected paths should use `/teacher/courses`.
  - Risk: route helper and tests diverge.
  - Verify during: PR A3.
- Resolution Wave A: PR #42 (`d800d648`, implementation `cce28c9`) tập trung route
  helpers; PR #43 (`59680afb`) chuyển helper/tests sang `/teacher/courses`; PR #44
  (`6a639d5e`) hoàn tất proxy/route regression coverage.
- Verification hiện tại: active helper/component/action tests dùng `/teacher/courses`;
  các `/courses` reference còn lại trong refactor docs là historical baseline, public
  catalog contract hoặc explicit negative/legacy discussion.

### AUTH-001: `proxy.ts` guards `/teacher`, but current teacher routes are not under `/teacher`

- Trạng thái: Đã xử lý.
- Problem: `proxy.ts` calls `utils/supabase/middleware.ts`, and `updateSession` checks `pathname.startsWith('/teacher')`. Current teacher authoring under `/courses` does not match that guard.
- Impact: Route-level unauthenticated UX for teacher authoring is incomplete until the namespace moves. Server Actions and RLS still protect data, but route UX and namespace intent are misaligned.
- Mitigation: Move teacher routes under `/teacher/courses`, then verify unauthenticated `/teacher/*` behavior and keep Server Actions/RLS as data protection.
- Wave/PR xử lý: PR A2, PR A3.
- Implementation audit item:
  - What to inspect: `proxy.ts`, `utils/supabase/middleware.ts`, teacher route pages, auth redirects.
  - Default assumption: `proxy.ts` remains the framework-level guard for `/teacher/*`.
  - Risk: unauthenticated user sees an incomplete teacher page shell before data errors.
  - Verify during: PR A3.
- Resolution Wave A: PR #43 (`59680afb`) đưa teacher routes vào `/teacher/*`; PR #44
  (`6a639d5e`, implementation `fe032ba`) harden matcher thành exact `/teacher` hoặc
  `/teacher/...` và thêm proxy/session coverage.
- Verification hiện tại: `utils/supabase/middleware.ts` dùng segment-aware matcher;
  tests cover unauthenticated `/teacher/courses*` redirect và negative boundaries
  `/teacherish`, `/courses/*`. Đây không đóng `AUTH-003`: explanation/toast sau redirect
  vẫn là deferred UX follow-up.

### STUDENT-001: Trước B2, `/learn` chưa phải student dashboard

- Trạng thái: Đã xử lý qua PR B2; merge trong PR #48 (`00bdadab`) ngày 2026-07-13.
- Vấn đề trước B2: `/learn` cần trở thành authenticated student dashboard với enrolled courses, continue learning, progress, due flashcards summary và pending payment reminder.
- Ảnh hưởng trước B2: Student chưa có learning home canonical; `/profile` có thể tiếp tục mang nhầm trách nhiệm của learning dashboard.
- Hướng xử lý: Xây dựng dashboard `/learn` sau khi public catalog/detail route contract đã ổn định.
- Wave/PR xử lý: PR B2.
- Kết quả hiện tại: `/learn` đọc `getLearnDashboard()` và render `LearnDashboardClient`; `/profile` đã bỏ learner-dashboard responsibility. B2 plan, progress tracker và responsibility tests cùng ghi nhận behavior này đã hoàn tất.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `app/(client)/learn/page.tsx`, `app/actions/profile.ts`, `app/actions/review.ts`, các profile components hiện có và các query enrollment/progress/FSRS.
  - Giả định mặc định: `/learn` sở hữu learning dashboard; `/profile` sở hữu account management.
  - Rủi ro: Dashboard overfetch hoặc trộn pending payment, due review và progress mà không có DTO boundary rõ ràng.
  - Xác minh trong: PR B2.

### STUDENT-002: Public detail và enrolled overview dùng chung `/learn/[course-slug]` trong giai đoạn chuyển tiếp

- Trạng thái: Đã xử lý và merge qua PR #75 (`3cb7a9f`).
- Kết quả C1 (2026-08-18): Exact `/learn/[course-slug]` đã render enrolled overview thay B3 redirect. Authenticated unenrolled learner ở same route với public-safe identity, primary `/courses/[slug]`, secondary `/learn`; protected syllabus/progress không được query hoặc serialize trước enrollment.
- Ảnh hưởng sau xử lý: Learner có course-level progress/topic path/next action đúng B2 semantics; public discovery vẫn canonical tại `/courses/[slug]`.
- Hướng xử lý đã áp dụng: Course-specific action phân loại auth/not-found/unenrolled/success/error, reuse narrow B2 projection; page giữ nested workspace cho C2.
- Wave/PR xử lý: PR B1, PR B2, PR B3, PR C1.
- Mục cần kiểm tra khi triển khai:
  - Đã kiểm tra: action/access contract, B2 ordering/progress/next-topic regressions, B3 assertion removal, nested exact topic route và seeded privacy behavior.
  - Evidence: commits `bff4f9f`, `bb7fa36`, `f1234f2`; full Vitest `383/383`, C1 smoke `3/3`, public smoke `1/1`, build và responsive/manual QA đạt.
  - Còn lại: C2 workspace sync vẫn là issue riêng `WORKSPACE-001`; không còn action item merge C1.
- Nguồn triển khai B3: [implementation-plans/b3/plan.md](./implementation-plans/b3/plan.md); [owner-review brief](./implementation-plans/b3/owner-review-brief.md) chỉ là decision surface và không override plan.
- Nguồn planning C1: [implementation-plans/c1/plan.md](./implementation-plans/c1/plan.md); [owner-review brief](./implementation-plans/c1/owner-review-brief.md) chỉ là decision surface và không override plan.

### STUDENT-003: Visual composition của `/learn` vẫn là phương án tạm thời

- Trạng thái: Theo dõi (tạm chấp nhận trong Wave B2).
- Phát hiện ở: manual QA dashboard B2 ngày 2026-07-13.
- Vấn đề: Bố cục hiện tại đã đặt hành động ôn tập, lộ trình course và nhắc thanh toán vào đúng vùng trách nhiệm, nhưng chất lượng thị giác và cân bằng mật độ vẫn chưa đạt quality bar cuối cho một learning workspace dùng thường xuyên.
- Hướng xử lý hiện tại: Desktop giữ review và payment ở cột trái, lộ trình học ở cột phải; mobile ưu tiên `Nhịp ôn tập`, sau đó đến lộ trình course và payment. Course CTA, review action và payment interactions không đổi.
- Mức chấp nhận hiện tại: Có thể tạm chấp nhận cho B2 để không mở rộng thêm visual scope khi data contract và các luồng chính đã hoạt động. Đây không phải xác nhận thiết kế cuối.
- Công việc tiếp theo: Đánh giá lại hierarchy, density, chiều cao card và nhịp responsive trong một frontend polish task riêng sau manual QA; không gộp với C2 URL synchronization hoặc mở rộng payment history.

### STUDENT-004: Giao diện phiên ôn tập từ `/learn` chưa phải trải nghiệm đích

- Trạng thái: Theo dõi (tạm chấp nhận trong Wave B2).
- Phát hiện ở: manual QA review flow B2 ngày 2026-07-13.
- Vấn đề: Phiên ôn tập đã sửa các lỗi trực tiếp trên mobile như tiêu đề bị cắt, phiên âm tràn ngang, khoảng trống quá lớn và nhóm nút đánh giá không phù hợp viewport nhỏ; tuy nhiên composition hiện tại vẫn là biến thể hẹp của `FlashcardStage`, chưa qua một vòng thiết kế review UX hoàn chỉnh cho cả mobile và desktop.
- Hướng xử lý hiện tại: Dialog dùng toàn viewport trên mobile, nội dung thẻ co giãn an toàn, tiến độ hiển thị rõ và bốn mức đánh giá xếp 2x2 ở viewport 375px. Action, FSRS queue và dữ liệu review không thay đổi.
- Mức chấp nhận hiện tại: Đủ an toàn và sử dụng được cho CTA `Ôn tập ngay` trong B2, nhưng chưa phải quality bar cuối của trải nghiệm ôn tập.
- Công việc tiếp theo: Tạo một review-experience task riêng để đánh giá lại information density, card anatomy, feedback sau đánh giá và desktop composition; không mở rộng thành route mới, thay thuật toán FSRS hoặc thay đổi review actions khi chưa có scope riêng.

### STUDENT-005: Ứng dụng chưa có bề mặt 404/not-found rõ ràng cho người dùng

- Trạng thái: Theo dõi; non-blocking follow-up sau B3/C1.
- Phát hiện ở: manual QA B3 ngày 2026-08-17.
- Vấn đề: Ứng dụng hiện chưa có custom 404/not-found UI hướng tới người dùng. Framework `notFound()` vẫn xử lý route an toàn và đúng chức năng, nhưng bề mặt kết quả có thể chỉ còn header với vùng nội dung trống; metadata hoặc browser-tab title cũng có thể khác nhau theo route path, và invalid legacy slug có thể giữ lại title của tab trước đó.
- Ảnh hưởng: Người dùng có thể khó phân biệt trạng thái not-found hợp lệ với trang chưa tải xong hoặc lỗi hiển thị, dù không có redirect sai hoặc runtime crash.
- Đánh giá B3/C1: Đây không phải lỗi B3 hoặc C1. C1 seeded browser QA xác nhận invalid/nonexistent overview routes đi vào framework `404` an toàn, nhưng custom global not-found UX/metadata vẫn ngoài scope.
- Công việc tiếp theo: Tạo một UI/UX PR riêng để thiết kế user-facing 404/not-found surface và thống nhất metadata/title behavior; không mở rộng phạm vi C1/C2.

### NAVIGATION-001: Account menu trên mobile thiếu parity với desktop

- Trạng thái: Theo dõi; non-blocking follow-up sau C1.
- Phát hiện ở: manual QA C1 ngày 2026-08-18.
- Vấn đề: Account/avatar menu trên desktop có logout, profile, settings và các destination theo role; mobile menu hiện chỉ expose một phần navigation và không có logout. Guest mobile menu cũng không giữ đầy đủ login/register parity với desktop.
- Ảnh hưởng: Người dùng mobile không thể đăng xuất từ header và khó hoặc không thể khám phá các bề mặt tài khoản/role vốn có trên desktop. Đây là parity gap toàn cục của header/navigation, không phải behavior riêng của enrolled-course overview.
- Đánh giá C1: Không chặn C1 và không trực tiếp thuộc contract `/learn/[course-slug]`; không sửa `components/ui/header.tsx` trong correction này.
- Công việc tiếp theo: Tạo một task header/navigation riêng để lập ma trận guest/authenticated/role actions, bổ sung logout và các destination còn thiếu trên mobile, đồng thời kiểm tra close behavior, focus và accessibility của menu.

### STUDENT-006: Enrolled-course overview thiếu entry trực tiếp từ dashboard

- Trạng thái: Đã xử lý và merge qua PR #75 (`3cb7a9f`).
- Phát hiện ở: manual QA C1 ngày 2026-08-18.
- Vấn đề trước khi xử lý: `/learn` chỉ có fast-path CTA đi thẳng tới next/final topic. Overview `/learn/[course-slug]` hoạt động nhưng chủ yếu chỉ tới được qua URL hoặc history, nên learner khó khám phá bề mặt tiến độ mới trong luồng bình thường.
- Ảnh hưởng trước khi xử lý: Learner có thể tiếp tục học nhưng không có course-level action rõ ràng để xem tổng quan, tiến độ và ordered topic path.
- Hướng xử lý: Mỗi enrolled course card giữ nguyên primary fast-path CTA và thêm secondary `Xem tổng quan` tới `/learn/[course-slug]`; no-content card dùng overview làm course-level action duy nhất. Không đổi DTO, ordering, progress, next/final-topic semantics hoặc redesign dashboard.
- Evidence: component regression bảo vệ exact primary/overview href cho in-progress, not-started, completed và no-content; seeded Playwright bảo vệ mobile/desktop discoverability, không horizontal overflow và primary in-progress vẫn trỏ đúng next topic.

### PAYMENT-001: Pending payment cần hai UX surface khác nhau

- Trạng thái: Đã xử lý qua PR B1/B2; B2 merge trong PR #48 (`00bdadab`) ngày 2026-07-13.
- Vấn đề trước khi xử lý: Course detail phải sở hữu exact pending payment state và hành động `Tiếp tục thanh toán`, còn dashboard `/learn` chỉ hiển thị reminder.
- Ảnh hưởng trước khi xử lý: Dashboard modal có thể duplicate payment state hoặc bỏ qua course-detail payment flow.
- Hướng xử lý: Dùng shared query/helper nếu cần nhưng expose hai DTO riêng: detailed course payment state cho course detail và summary reminder cho dashboard.
- Wave/PR xử lý: PR B2, với hỗ trợ từ course detail trong PR B1 nếu cần.
- Kết quả hiện tại: Public course detail giữ payment flow chi tiết; dashboard dùng `PendingPaymentSummary`, chỉ đọc active pending payments và dismiss từng reminder bằng `paymentId` trong `sessionStorage` mà không mutate payment row.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `app/actions/payment.ts`, payment schemas, course detail action, dashboard data action, `payments.status`, `payments.id`, `expires_at`.
  - Giả định mặc định: `paymentId` là unique key an toàn để dismiss reminder trong `sessionStorage`.
  - Rủi ro: Stale dismissed IDs che một active pending payment mới hoặc tiếp tục hiển thị payment đã hết hạn.
  - Xác minh trong: PR B2.

### PAYMENT-002: Payment cancel route uses course ID under the legacy `/learn` namespace

- Trạng thái: Đã xử lý.
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
- Resolution B1.5 (2026-07-11): trusted course query yêu cầu `status = 'published'`,
  `removed_at IS NULL` và lấy stored `slug`; public route helper tạo canonical path,
  sau đó trusted application base URL tạo absolute PayOS `cancelUrl`. Checkout input
  vẫn chỉ nhận `courseId` và optional `couponCode`; success `returnUrl` không đổi.
- Automated evidence: focused payment action tests passed 10/10, gồm exact canonical
  absolute URL, server-resolved slug, malicious client slug/cancel URL không ảnh hưởng,
  published soft-deleted course bị reject và PayOS/payment insert/discount reserve không
  được gọi cho course không hợp lệ.
- Manual evidence: chưa chạy PayOS sandbox cancellation QA vì task không xác nhận sẵn
  credential/môi trường sandbox; không có kết quả manual được suy diễn.

### WORKSPACE-001: Learning workspace phải dùng `[topic-slug]` từ URL

- Trạng thái: Đã xử lý và đã merge qua PR #96 (`3a95c310`) từ `feat/workspace-route-hardening`; exact PR head `66e7f318`; CI và local automated/browser/build evidence đạt.
- Vấn đề đã xử lý: Workspace route phải mở exact topic từ URL; historical implementation từng âm thầm fallback hoặc để client state lệch route.
- Ảnh hưởng: Student có thể vào sai lesson, progress có thể được ghi cho sai topic và shared link trở nên không đáng tin cậy.
- Hướng xử lý đã áp dụng: URL là source of truth; dedicated server contract dùng parent-before-child auth/course/enrollment/topic precedence, exact active course-topic-parent chain và bounded protected reads; sidebar/previous-next dùng history-pushing canonical links; invalid/unavailable không fallback; affected progress/question/review writes verify trusted relation trước checked mutation.
- Historical B2 seam đã được C2 thay thế: không còn `initialTopicSlug`/first-topic fallback hoặc client content/history waterfall.
- Wave/PR xử lý: PR B2 cho minimal initial-topic; PR C2/#96 cho full synchronization.
- Detailed C2 plan: [implementation-plans/c2/plan.md](./implementation-plans/c2/plan.md); owner-review brief không override detailed plan.
- Evidence: route page, `LearningWorkspace`, `ChapterSidebar`, `QuizSidebar`, `ReviewSheet`, progress/question/review/profile actions và C1/B2 regressions đã được kiểm tra; old `getCourseSyllabus`/`getTopicContent`/topic-history paths đã retire.
- Xác minh đạt trong C2: action/schema/component/helper tests; seeded browser direct/sidebar/refresh/back-forward/previous; inaccessible matrix; C1 regression; full Vitest/build.

### LEARNING-INTEGRITY-001: Database chưa enforce learner-write relation integrity

- Trạng thái: Deferred; follow-up riêng sau C2 application-path hardening.
- Vấn đề: `user_topic_progress`, `user_question_answers` và `user_flashcards` dùng self-owner RLS. FK hiện chỉ bảo đảm từng referenced ID tồn tại; database không chứng minh progress topic còn active/accessible/enrolled, không buộc `selected_option_id` thuộc `question_id`, không derive `is_correct`, và không chứng minh denormalized course IDs khớp parent chain.
- Ảnh hưởng: C2 Server Actions có thể guard đúng application path, nhưng authenticated client vẫn có thể gọi Data API trực tiếp và tạo learner-write row không thỏa application relation nếu biết UUID hợp lệ. C2 không được claim database-wide security/integrity từ application guards.
- Hướng xử lý tương lai: Sau Q7 enrollment gate, thiết kế migration/RLS/RPC/constraint strategy riêng cho những invalid learner writes còn lại, gồm relation/correctness, content-status transitions và quyền admin/collaborator ngoài enrollment. Không thêm policy/constraint ad hoc trong C2 hoặc dùng Q7 để tuyên bố record này đã đóng.
- Ranh giới với Q7: Q7 sở hữu narrow collaborator boundary — previewer-only access không được đọc draft và course collaborator role không được thành persistent learning-write authorization. Q7 enforce `target topic/question/card -> course_id -> enrollments(user_id, course_id)` cho cả ba learner-write Server Actions **và** INSERT/UPDATE RLS/Data API của `user_topic_progress`, `user_question_answers`, `user_flashcards`. Record này giữ DB-wide relation/correctness integrity **ngoài enrollment gate đó**: option-question ownership, server-derived `is_correct`, toàn parent-chain/course consistency, active/content relation và các direct Data API write case còn lại. Không dùng Q7 enrollment tests để đóng record này.
- Tách khỏi `PROGRESS-001`: issue này sở hữu **relational authorization/integrity at write time**; `PROGRESS-001` sở hữu **completion business truth** (flashcard/memory/exercise/all-required-question semantics).
- Evidence 2026-08-19:
  - `user_topic_progress` policies chỉ `auth.uid() = user_id`; FK `topic_id -> topics.id`.
  - `user_question_answers.question_id` và `.selected_option_id` là hai FK độc lập; policies chỉ self-own.
  - `questions.course_id`, `exercises.course_id`, `topics.course_id` không có composite parent-course consistency constraint.
- C2 boundary: parse untrusted IDs, derive/verify active parent relation trong bounded reads, check every mutation error; không migration/RLS/RPC/schema/seed change.
- Stop condition: Nếu owner yêu cầu direct Data API cũng phải bị chặn trước khi C2 merge, C2 phải dừng/re-scope sang database work thay vì tiếp tục application-only.
- Xác minh trong: future DB-integrity PR với local reset, allowed/denied RLS/integration cases và existing-data compatibility; không gộp vào final completion PR nếu hai dependency chains vẫn độc lập.

### PROGRESS-001: Semantic của topic completion chưa phải bản cuối

- Trạng thái: Deferred.
- Vấn đề: Completion mục tiêu yêu cầu hoàn tất flashcards, memory check, toàn bộ exercises và trả lời đúng mọi required question. Progress model hiện chỉ có các flashcard/exercise/topic completion flags.
- Ảnh hưởng: Client-side stage flags có thể đánh dấu topic hoàn tất quá sớm, đặc biệt khi có nhiều exercises hoặc chưa có memory check.
- Hướng xử lý: Không đưa completion hardening vào các route PR đầu; định nghĩa server-side truth bằng field/helper/RPC trong giai đoạn sau nếu cần.
- Wave/PR xử lý: Wave D.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `user_topic_progress`, `user_question_answers`, `app/actions/progress.ts`, `QuizSidebar`, `LearningWorkspace`.
  - Giả định mặc định: Các flags hiện tại chưa đủ cho final target rule.
  - Rủi ro: Progress dashboard báo completion không chính xác.
  - Xác minh trong: PR riêng về topic completion server truth.

### PREVIEW-001: Preview topic contract ảnh hưởng schema, RLS, public detail và workspace

- Trạng thái: D2 C1–C6 đã đạt local integrated acceptance; chưa rollout. Trước rollout cần đối chiếu inventory creator và managed media trên môi trường đích.
- Vấn đề: Preview do owner/co-owner chọn, quota là `ceil(A * 20%)`; A gồm topic chưa removed thuộc chapter chưa removed và draft vẫn tính mẫu số. Draft có thể giữ marker nhưng chưa public; public preview chỉ mở cho course published/public và topic published + active + marker. Đây không chỉ là một UI badge.
- Ảnh hưởng: Nếu triển khai thiếu kiểm soát, public user có thể đọc locked content, preview vượt hard cap hoặc ghi persistent progress/answer/review từ preview-only flow.
- Hướng xử lý: Thực hiện theo thứ tự D1 → Q7 → D2. D1 sở hữu publish-readiness; Q7 sở hữu internal previewer read boundary và persistent learning-write authorization gap; D2 sở hữu public readonly preview với full content/media và transient correctness. Khi denominator giảm gây over-cap, Owner/co_owner chọn marker cần gỡ ngay trong cùng flow, không auto-unmark.
- Wave/PR xử lý: Q7 trước D2 trong Wave D.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `topics` schema/marker SSOT, course detail syllabus, content read access RLS, progress/answer/review actions and RLS, teacher topic settings, workspace access.
  - Giả định mặc định: Marker phải được persist ở topic-level; field/RPC shape cụ thể thuộc D2 implementation brief, không chốt bằng historical `likely` wording.
  - Rủi ro: Public content read access trở nên quá rộng hoặc preview-only interaction làm nhiễm learner state.
  - Xác minh: D2 local integration/browser acceptance đạt ngày 2026-09-24; inventory creator và managed media trên môi trường đích vẫn là rollout prerequisite.

### MEMORY-001: Memory check không được làm quá tải semantic của question analytics sau này

- Trạng thái: Deferred.
- Vấn đề: Memory check là usage/activity stage, không phải question analytics category. Analytics sau này có thể cần category/skill fields như grammar, vocabulary, detail hoặc inference.
- Ảnh hưởng: Một field `type` bị dùng cho quá nhiều nghĩa có thể làm analytics hoặc activity routing mơ hồ.
- Hướng xử lý: Tách riêng question category/skill type, answer format và usage stage/activity stage.
- Wave/PR xử lý: Wave D.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `exercises.part_type`, `questions`, `question_options`, exercise schemas và learning workspace flow.
  - Giả định mặc định: Tái sử dụng exercise/question model hiện có nếu phù hợp nhưng bổ sung hoặc derive stage semantic riêng.
  - Rủi ro: Memory check implementation cản trở question-category analytics theo hướng Study4.
  - Xác minh trong: Memory check design PR.

### PROFILE-001: `/profile` không nên tiếp tục làm learning dashboard

- Trạng thái: Đã xử lý qua PR B2; merge trong PR #48 (`00bdadab`) ngày 2026-07-13.
- Vấn đề trước B2: `/profile` chứa các learning-related surface trong khi mục tiêu của route này chỉ là account/profile management.
- Ảnh hưởng trước B2: Student learning UX bị chia giữa `/profile` và `/learn`.
- Hướng xử lý: Chuyển trách nhiệm chính của learning dashboard sang `/learn`; chỉ giữ shortcut nhỏ nếu hữu ích.
- Wave/PR xử lý: PR B2 và Wave D polish.
- Kết quả hiện tại: `/profile` chỉ render account/profile surface và không còn `CoursesPlaceholder`; authenticated navigation đã có entry `/learn`. Visual polish sau này là follow-up riêng, không làm issue trách nhiệm route này tiếp tục mở.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `app/(client)/profile/page.tsx`, profile sidebar, courses placeholder và review sheet.
  - Giả định mặc định: Account settings ở lại `/profile`; learning dashboard chuyển sang `/learn`.
  - Rủi ro: Xóa profile surfaces trước khi `/learn` replacement tồn tại sẽ làm navigation kém đi.
  - Xác minh trong: PR B2 và profile cleanup follow-up.

### AUTH-002: Google buttons không đồng nghĩa đã triển khai OAuth

- Trạng thái: Deferred.
- Vấn đề: Login/register UI có Google buttons nhưng OAuth vẫn là công việc ở giai đoạn sau.
- Ảnh hưởng: CTA giả có thể gây hiểu nhầm cho user.
- Hướng xử lý: Ẩn hoặc disable các nút chưa hoạt động, trừ khi Supabase Google OAuth có thể được triển khai gọn trong một PR riêng.
- Wave/PR xử lý: Wave D.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: Login/register pages, auth actions và Supabase OAuth provider config.
  - Giả định mặc định: Không đưa OAuth vào các route migration wave.
  - Rủi ro: Authentication UX hứa hẹn behavior chưa được hỗ trợ.
  - Xác minh trong: Auth polish PR ở giai đoạn sau.

### AUTH-003: Teacher auth redirect chưa có giải thích hiển thị cho user

- Trạng thái: Deferred.
- Phát hiện ở: Manual QA sau PR A3.
- Vấn đề: Request unauthenticated tới `/teacher/*` đã redirect đúng sang `/login`, nhưng login screen không hiển thị message hoặc toast giải thích lý do.
- Ảnh hưởng: User có thể bối rối khi bị chuyển từ teacher authoring route sang login dù proxy/session behavior đang đúng.
- Hướng xử lý: Tạo auth UX polish task riêng để bổ sung redirect reason rõ ràng mà không thay đổi authorization semantic của proxy/session.
- Wave/PR xử lý: Auth UX polish ở giai đoạn sau.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: Login redirect query handling, login/register UI messaging, `proxy.ts`, `utils/supabase/middleware.ts`.
  - Giả định mặc định: PR A3 vẫn hợp lệ vì route protection cho unauthenticated `/teacher/*` đang hoạt động.
  - Rủi ro: UX polish vô tình mở rộng auth behavior hoặc thay teacher route guard thay vì chỉ giải thích redirect.
  - Xác minh trong: Auth polish PR ở giai đoạn sau.

### QUALITY-001: Repository-wide lint baseline chưa xanh

- Trạng thái: Đang mở.
- Phát hiện ở: B1.7 final release gate ngày 2026-07-11.
- Evidence hiện tại (2026-09-15): `npm.cmd run lint` trả về 7 errors và 13 warnings trên toàn repository. Các errors còn lại nằm ở `__tests__/actions/admin-dashboard.test.ts`, `app/api/webhook/payos/route.ts` và `lib/discounts/discount-pricing.ts`; full-lint gate vẫn chưa xanh. D1 targeted lint đạt `0 errors` với 2 warnings pre-existing ở `AddExerciseDialog.tsx`.
- Vấn đề: Các errors hiện còn nằm trong test/action/webhook/discount files ngoài D1 diff; đây vẫn là repository-wide baseline issue.
- Ảnh hưởng: Full-lint command chưa thể dùng làm green repository-wide gate; D1 không tạo ra các lỗi được báo cáo.
- Hướng xử lý: Giữ targeted lint xanh cho các file của từng workstream; không sửa hoặc che lỗi baseline trong D1. Một follow-up PR riêng cần sửa các errors/warnings hiện có và khôi phục `npm.cmd run lint` thành green gate.
- Xác minh tiếp theo: Chạy full lint trên base đã cập nhật, xác nhận 0 errors và đối soát warning policy mà không làm yếu ESLint configuration.

## Rủi ro theo wave

| Rủi ro | Ảnh hưởng | Hướng xử lý | Wave/PR |
| --- | --- | --- | --- |
| Còn stale teacher route dưới `/courses` | Xung đột với public catalog | Centralize helper và dọn stale reference | A1-A3 |
| Route tests vẫn assert path cũ | Tạo false confidence hoặc failure nhiễu | Cập nhật tests theo contract mới | A3 |
| Proxy/session UX chưa hoàn chỉnh | Hiển thị unauthenticated teacher route shell hoặc redirect khó hiểu | Chuyển route dưới `/teacher` và verify `proxy.ts` | A2-A3 |
| Dashboard data overfetch | `/learn` chậm hoặc DTO khó duy trì | Định nghĩa dashboard DTO với phạm vi hẹp | B2 |
| Pending payment state bị duplicate | Payment modal/state không khớp | Course detail sở hữu exact state; dashboard chỉ hiển thị summary | B2 |
| Redirect public detail cũ bắt nhầm workspace | Learning route bị hỏng | Route matching tests và manual QA | B3 |
| Workspace bỏ qua topic trong URL | Mở sai lesson hoặc ghi sai progress | Topic trong URL là source of truth | C2 |
| Completion được ghi quá sớm | Progress không chính xác | Định nghĩa server-side completion truth ở giai đoạn sau | Wave D |
| Preview RLS quá rộng | Public user đọc được locked content | Audit schema/RLS trước khi triển khai preview | Wave D |
| Memory check dùng quá tải field `type` | Cản trở analytics | Tách category/format/stage | Wave D |

## Vấn đề deferred hoặc ngoài phạm vi những wave đầu

### FUTURE-OWNERSHIP-001: Course chưa được bảo đảm có đúng một active owner

- Trạng thái: Đã đóng phần singular-owner invariant trong D1; ownership transfer vẫn deferred.
- Mô tả: Trước D1 correction, canonical seed tạo hai `owner` cho `Local TOEIC Test Course` và schema chưa có DB guard cho nhiều active owner. D1 giữ đúng một owner do supported course-creation RPC tạo, cho phép `co_owner` là membership đặc quyền bổ sung, và thêm partial unique index tối đa một owner cho mỗi course.
- Phạm vi xử lý: Đã xử lý bounded trong D1 qua migration, canonical seed và regression boundary tests; không mở ownership-transfer feature.
- Xác minh: Migration preflight fail-closed nếu dữ liệu hiện hữu có duplicate owner; local reset áp migration/seed mới; course creation, authenticated Data API/RPC denial, service-boundary duplicate rejection và co_owner behavior đều có regression coverage.

### FUTURE-PUBLISH-001: Topic authoring, review và publication

- Trạng thái hiện hành (2026-09-23): D1 foundation, authorship amendment và v2/v4 corrections đã merge qua PR #98 (`861e7c7`, head `d93385a`). Canonical contract nằm ở [implementation-plans/d1/plan.md](./implementation-plans/d1/plan.md); v3 target-attached note creation UI vẫn deferred. Full M17–M28 manual matrix, deploy và remote DB mutation không được suy ra từ merge. Các đoạn discovery/checkpoint bên dưới là bằng chứng lịch sử theo thời điểm, không phải current implementation status.
- Cập nhật trạng thái (2026-09-18): amendment thứ hai đã implement xong P1–P5, nên code/migration/test không còn ở contract trước amendment của các checkpoint cũ. Escalation/rescue/review-budget đã bị gỡ (`topic_review_escalations`, `resolve_topic_review_escalation`, `TOPIC_REVIEW_ESCALATION_HOLD`, `TOPIC_REVIEW_CREATION_HOLD`, cột `rescue_escalation_id`); phản hồi reviewer chuyển sang bảng `review_notes` (migration `20260917120000_d1_review_notes.sql`). Điều này **supersede** câu "Owner đã chốt escalation sau reject thứ ba" ở mục `Ranh giới` bên dưới — bản ghi 2026-09-15 được giữ nguyên làm hồ sơ lịch sử, nhưng quyết định đó không còn hiệu lực. Tại checkpoint 2026-09-18, unit `62 files / 525 tests` và integration `16 files / 162 tests` đã đạt; manual QA còn `pending Owner` và candidate chưa có claim merge-ready. Đây không phải test hoặc delivery status hiện hành.
- Kế hoạch chi tiết: [implementation-plans/d1/plan.md](./implementation-plans/d1/plan.md); file này chỉ giữ risk/constraint, không thay thế implementation contract.
- Mô tả: Topic chỉ được publish như kết quả approve của review workflow khi có ít nhất một active flashcard và một active exercise; `pending` phải frozen và published edit tạm thời phải demote về `draft` một cách có xác nhận.
- Discovery đã xác nhận: `updateTopic` hiện cho phép chọn `published` mà chưa kiểm tra readiness; `createTopic` truyền status trực tiếp vào RPC `create_topic_ordered`; readiness hiện chỉ báo `topic_has_no_learning_content` khi thiếu đồng thời cả flashcards và exercises.
- Database/risk đã xác nhận: topic schema chỉ có enum status + `removed_at`, không có topic review/history/capability model hay cross-table readiness invariant; authenticated management caller có thể direct-update topic status/content qua RLS hiện tại; `is_admin()` còn được dùng như management bypass; nhiều child write/RPC path chưa khóa pending/published semantics; delete/restore và collaborator transitions chưa có atomic reviewer/lifecycle guard; chưa có moderation audit boundary để tách platform takedown khỏi topic review. Authority audit bổ sung xác nhận `create_course_with_owner`/course INSERT còn cho admin, management helper còn yêu cầu global teacher sau nhánh admin, và media upload còn gate global role.
- D1 boundary: phải audit và đóng các supported application, RPC/RLS và direct Data API bypass cần thiết cho global-teacher-only normal course creation, membership-derived authoring, lifecycle/readiness, pending freeze, reviewer permission, no-self-review, rejection reason/count và published-edit demotion; không được mặc định giữ application-only nếu còn invariant hole.
- Cần xác minh: bốn readiness cases (0/0, card-only, exercise-only, cả hai), create/status input, review transitions, no-mutation/rollback, effective reviewer matrix, last-reviewer protection, soft-delete/restore, published edit confirm/cancel, RLS/direct-write denial và concurrency/atomicity.
- Ranh giới: Không triển khai candidate/published revision system, preview/Q7, course publication, memory/completion/exercise-correctness semantics, admin create-on-behalf, ownership transfer/email expiry hoặc broad collaborator redesign. Minimal persisted invitation lifecycle nằm trong D1 vì sole-owner reviewer dead-end là gap đã xác nhận; đây không phải independent delegation entity. Future revision direction chỉ là compatibility constraint. Owner đã chốt escalation sau reject thứ ba, global admin review-vs-moderation authority, global-vs-course role separation, teacher-only normal course creation, cross-role collaborator authoring, boolean delegated capability, delete/restore semantics, invalid-published remediation contract và persisted `authoring` boundary trong D1 request ngày 2026-09-15; detailed plan đã reconcile các quyết định này. P0 implementation authority đã được cấp và checkpoint đã đạt; remote migration/production remediation vẫn không được cấp.
- Amendment 2026-09-16: Owner đã chốt topic-level authorship/responsibility, immutable creator, exactly-one responsible author, max-two contributors, responsible-only request/resubmit, initial-review exclusion, atomic responsibility transfer/self-leave, transfer feedback và authoritative create-result navigation. Contract này cần reopen `P0-A → P1-A → P2-A → P3-A → P4-A`; chưa cấp authority implement trong discovery/contract turn.
- P0-A result (2026-09-16): commit `4b7fdc8e268347ee237950aedf60fb2a08e92692` thêm immutable creator/responsible provenance, first-approval marker, contributor cap/history, fail-closed legacy preflight, topic authorship trigger và direct-write ACL hardening. Local reset/seed, focused P0 integration `4/4`, affected integration `102/102`, TypeScript và targeted lint đạt.
- P1-A result (2026-09-16): checkpoint commit thêm topic-group authoring/request boundary, responsible-only request/resubmit, initial-review exclusion, atomic transfer/remove/downgrade/self-leave validation, transfer feedback storage, reviewer-safety theo topic, pending freeze, direct collaborator DML denial và course→topic lock ordering. Focused integration `39/39`, affected integration `11 files / 120 tests`, focused action `10/10`, full unit `53 files / 456 tests`, TypeScript và targeted ESLint đạt. Self-review đã sửa reviewer-safety thiếu topic exclusion và lock-order deadlock risk; chưa claim P2 content bridge hoặc P3 UX.
- P2-A result (2026-09-16): checkpoint thêm topic-group authorization cho topic/card/exercise/question-group/question/option/restore/media paths, khóa các legacy RPC arity bypass bằng trusted wrappers, giữ pending freeze và published confirmation + atomic demotion, re-check topic-group sau course/topic lock cho direct Data API triggers, và áp dụng boundary cho `move_topic_order`. Focused P2 `18/18`, affected integration `12 files / 127 tests`, full unit `53 files / 456 tests`, TypeScript và targeted ESLint đạt; full lint còn 7 lỗi baseline ngoài P2. Self-review đã phát hiện và đóng TOCTOU giữa RLS và membership mutation; restart Kong local là cần thiết sau reset để Storage test ổn định.
- P3-A result (2026-09-16): checkpoint thêm trusted workflow read DTO/RPC cho authorship group và recipient-scoped transfer feedback; Builder hiển thị responsible/original/contributors, read-only ngoài group và pending freeze; course overview/empty dashboard là collaborator entry point với compact summary và responsibility-safe leave warnings; role/removal controls dùng trusted responsibility-safe actions; create→builder interaction regression chứng minh authoritative returned topic id với `0/1/multiple` existing drafts. Focused UI/action/schema `5 files / 63 tests`, full unit `55 files / 463 tests`, affected integration `12 files / 127 tests`, TypeScript và targeted ESLint đạt. Self-review đã xử lý SSR/static-render crash do `useRouter` trong leave dialog và summary state bug; sandbox telemetry `EPERM` được rerun ngoài sandbox thành công. P4-A còn sở hữu browser/manual/invariant closure.
- P4-A result (2026-09-16): focused current-route Playwright smoke/fixture mới chứng minh create→Builder với chapter có `0/1/multiple` existing drafts; smoke `1 passed (40.9s)` kiểm tra exact persisted topic id, chapter, `draft` state và `Topic Builder` route. Observed dev-runtime assertion timing khiến refresh/feedback cạnh tranh với navigation; create path đã được correction để push authoritative id rồi return trước side effects. Focused navigation `1 file / 4 tests`, full unit `55 files / 463 tests`, affected integration `12 files / 127 tests`, TypeScript, targeted ESLint và diff check đạt. Self-review theo `docs/agent-self-review.md` không có finding material mới; final local Supabase cleanup reset sẽ được thực hiện sau checkpoint commit và là bước cuối trước bàn giao.
- P0 result (2026-09-15): đã thêm migration foundation, review/escalation storage, membership-only authoring helper, draft-only topic creation, teacher-only normal course creation, readiness DTO/predicate và deterministic global-role × membership matrix. Local migration/seed reset, focused tests, integration/RPC/RLS tests, TypeScript và targeted lint đều đạt.
- P0 inventory finding: seeded DB hiện có 11 active `published` fixture topics thiếu active exercise hoặc card (tất cả thiếu active exercise). P0 không tự hạ status hoặc sửa dữ liệu; trước khi bật DB invariant cứng cho dữ liệu seed/legacy phải có migration/fixture remediation contract và exact preflight evidence cho các row này.
- P1 result (2026-09-15): đã đóng trusted request/approve/reject/escalation boundary, membership-only authoring/RLS, effective reviewer/no-self-review/last-reviewer safety, separate admin moderation audit và pending freeze cho topic/chapter/content/media. Topic lifecycle và child mutation dùng cùng `topic_id` advisory lock để đóng request/approve với last-content-delete race trong local transaction tests. P1 không bật database-wide readiness check cho `service_role`; local seed vẫn có 11 invalid published fixtures nêu trên và phải được xử lý riêng nếu muốn claim invariant bao phủ cả fixture/infrastructure writes.
- P2 result (2026-09-15): đã route các supported topic/card/exercise/question-group/question/question-option mutation từ Server Action qua trusted RPC; pending vẫn frozen; published mutation yêu cầu explicit confirmation và demote atomically về draft; published delete/restore và nested-content restore giữ parent-state checks; legacy draft RPC arity vẫn hoạt động nhưng direct published writes bị trigger từ chối. P2 self-review đã sửa overload ambiguity, thiếu parent restore guard và lock-order inconsistency; local reset, topic lifecycle `17/17`, affected integration `6 files / 73 tests` đạt.
- Correction result (2026-09-15, commits `143102e`, `c56f3aa`, `65ed00d`, `6180356`): đã đóng confirmed fresh-reader findings về authenticated profile role escalation, rescue A/B/C audit attribution, ordinary approval/rescue resolution, multiple open escalation safety, sole-owner no-reviewer dead-end, Builder parent refresh, minimal persisted invitation lifecycle, authenticated profile self-delete và role-capacity bypass.
- Correction result (2026-09-16, commits `2987794`, `301d0e1`, `e6c4d0e`, `d0d53df`): đã verify và đóng D1-SEC-001 bằng Auth identity resolver + invitee-only course identity RPC; D1-AUTH-002 bằng create/course-scoped thumbnail Storage policy, preflight và failed-mutation cleanup; D1-UX-003 bằng course title/slug DTO/UI và parent course-list refresh sau accept. Full Vitest `52 files / 452 tests`, full integration `12 files / 119 tests`, TypeScript, targeted ESLint và build đều đạt; build cần network escalation để tải Google Fonts.
- Correction result (2026-09-16, commit `0b27b85`): screenshot được tái xác minh từ canonical `supabase/seed.sql`, nơi cùng course từng được insert hai `owner`; đây là real seed defect kèm invariant gap vì DB chưa có singular-owner guard, không chỉ là integration residue. Thêm `20260916110000_d1_single_course_owner.sql` với duplicate preflight + partial unique index, đổi membership thứ hai thành `co_owner`, bổ sung owner/Data API/RPC/DB/invitation regression và dùng shared `Select` primitive cho collaborator role controls. Focused owner integration `9/9`, invitation integration `8/8`, unit `52 files / 453 tests`, action/UI unit `18/18`, TypeScript, targeted ESLint và build đều đạt.
- Correction result (2026-09-16, commit `98879ec`, fresh-reader finding `D1-MEDIA-DELETE-001`): ordinary question-group media DELETE trước đây chỉ dựa vào legacy `owner/admin` Storage policy và cleanup Action không resolve topic/lifecycle/group. Migration `20260916153007_d1_media_delete_lifecycle.sql` thay DELETE policies bằng exact active-`draft` + `d1_topic_group_member` + uploader ownership boundary, vẫn giữ admin moderation exception; Action dùng schema/path validation, `is_admin()` trusted check và authoritative topic resolution. Pending/published/removed/outside-group objects được real local Storage/RLS test giữ nguyên; admin delete vẫn hoạt động.
- Verification sau media-delete correction: action `15/15`, media Storage/RLS `17/17`, affected topic-group/authorship/review `41/41`, full unit `55 files / 470 tests`, full integration `15 files / 143 tests`, TypeScript, targeted ESLint và local migration reset đạt. Local Storage API có success/no-op khi RLS lọc DELETE, nên evidence denial là object persistence; đây là observed runtime behavior, không phải bỏ qua policy failure.
- Final local cleanup reset sau verification áp dụng migration head `20260916153007`; canonical seed load được, `D1 review` và media-test fixture residue đều `0`, duplicate active owner courses `0`, còn `11` canonical published topics thiếu active exercise theo residual đã biết và không được remediation.
- Correction result (2026-09-17, commit `6a6f577`): đã verify độc lập và confirm cả năm senior-review findings. Migration `20260917100000_d1_senior_review_corrections.sql` giữ topic-wide escalation hold và hủy pending submission khi close/abandon; giới hạn recipient transfer theo operation; bỏ direct topic `UPDATE` RLS và chiếu `canEdit` theo topic group; khóa Storage DELETE theo course/topic lock, lifecycle và persisted reference; DB-first question-group media replace/clear với cleanup sau commit. Server Actions, DTO/UI và regression coverage đã được cập nhật; không mở candidate revision, Q7 hoặc D2.
- Senior-review verification/self-review: focused action/UI unit `95/95`, focused affected integration `4 files / 62 tests`, media Storage/RLS `18/18`, full unit `55 files / 474 tests`, full integration `15 files / 147 tests`, TypeScript, targeted ESLint, static policy/ACL probe và real Storage/request overlap probe đều đạt. Không có finding material mới sau correction; direct topic `UPDATE` policy đã biến mất, ACL trusted RPC không còn `anon`, và không có active course nhiều owner trong probe hiện tại.
- Final cleanup reset (2026-09-17): `npx.cmd supabase db reset --local --yes` áp dụng tới migration head `20260917100000` và canonical seed; post-reset read-only sanity ghi nhận `course_count=14`, D1 fixture courses `0`, Storage objects `0`, duplicate active owner courses `0`, published thiếu active exercise `11` và thiếu active flashcard `8`. Không chạy lại residue-producing integration/E2E sau reset.
- Open after correction: D1 local implementation đã qua P0→P4 và các correction trước đó; senior-review correction và recipient-UI correction `6779f93` đã verify/self-review PASS, final cleanup reset local đã hoàn tất. Existing smoke suite còn `7 passed / 5 failed` vì dùng stale `/courses/...` routes và builder assumptions; không dùng làm product evidence và không modernize trong D1. Full cross-role/accessibility/responsive browser matrix chưa được claim vì fixture chưa đủ. Admin moderation surface hiện vẫn là mock nên không được claim là live UI evidence. Question-group media replace/clear hiện dùng trusted DB-first topic-locked RPC và cleanup sau commit; direct persisted-object DELETE bị chặn, nhưng cleanup failure vẫn có thể để lại orphan object và chưa có candidate revision. Service-role/seed writes vẫn là giới hạn database-wide guarantee đã ghi nhận; 11 invalid published seed fixtures chưa remediation vì không có production-data authority. Integration fixture suite còn để lại residue nếu chạy lại sau final reset; đây là cleanup debt ngoài scope, không sửa trong correction này. Đây là follow-up/implementation debt, không phải Owner-decision blocker.
- Visual/state closure (2026-09-17, commit `ed3f925`): browser visual sanity đã kiểm tra các positive/negative rendered states trên toàn bộ touched manual-QA surfaces theo state, user need, actionable controls, sentence/control relevance, internal-mechanics exposure, duplication và severity/color; không còn material UI finding. Hai bounded polish finding đã đóng: loading collaborator counts không còn giả `0`, và leave dialog không còn flash handoff mechanics khi chưa biết có affected topic. Playwright leave smoke `1 passed`; full unit `59 files / 491 tests`; full integration `15 files / 149 tests`; TypeScript và targeted lint đạt.
- Final reset evidence (2026-09-17): local Supabase reset thành công tới migration `20260917110000_d1_manual_qa_corrections.sql` + canonical seed; `14` courses, `0` D1 review/fixture-named courses, `0` Storage objects, `0` duplicate-owner courses. Canonical seed vẫn có `11` active published topics thiếu exercise và `8` thiếu flashcard; đây là residual của seed/service-role path, không được tự remediation trong D1 vì thiếu production-data authority. Không chạy lại residue-producing tests sau reset.

### D1-AUTHORSHIP-001: Topic-level authorship/responsibility

- Trạng thái hiện hành (2026-09-23): P0-A–P4-A và các correction liên quan đã triển khai, merge qua PR #98; không còn implementation checkpoint P4-A mở trong D1.
- Mô tả: Baseline trước amended checkpoints chỉ có course membership role và `can_review_topics`. P0-A thêm immutable topic creator/responsible, contributor group và pre-first-approval evidence; P1-A chuyển workflow/request/transfer/leave và reviewer exclusion qua trusted boundary; P2-A đóng topic-group content mutation; P3-A/P4-A hoàn tất read/UI, feedback và create-navigation evidence.
- Giới hạn evidence: Browser smoke đã kiểm chứng create→Builder với `0/1/multiple` draft, nhưng không suy rộng thành full manual M17–M28 matrix hoặc production deployment. Reviewer delegation boolean không thay thế authorship relation.

### D1-NAV-001: Create topic navigation theo nhiều draft chưa có evidence interaction

- Trạng thái vấn đề: Đã xử lý bằng bounded interaction/browser evidence và correction thứ tự side effect.
- Evidence: `create_topic_ordered` dùng `INSERT ... RETURNING *`; `createTopic` trả `result.topic`; smoke current-route chạy với `0/1/multiple` existing drafts và assert exact newly-created id, chapter, `draft` state và Builder URL. Không tìm thấy `topics[0]`, current-draft fallback hoặc selection từ reload.
- Root cause/evidence boundary: dev-runtime trace cho thấy refresh/feedback side effects có thể cạnh tranh với pending RSC/Builder navigation và làm assertion 5 giây thất bại; đây là timing/flakiness evidence của test/runtime, không phải bằng chứng topic bị chọn nhầm trong product. Production path hiện push authoritative id rồi return trước refresh/feedback.
- Hướng xử lý: Giữ current route contract, regression smoke/interaction coverage bounded và không mở rộng UI redesign; stale legacy-route smoke được tách thành follow-up.

### FUTURE-REVIEW-001: FSRS review route or deeper review UX

- Trạng thái: Deferred.
- Mô tả: FSRS review cần được discoverable từ `/learn`; dedicated route `/learn/review` có thể chờ đến khi dashboard/workspace ổn định.
- Hướng xử lý: Trước tiên hiển thị summary/card trong `/learn`; chỉ thêm dedicated route nếu product cần.
- Xác minh cần có: Dashboard data states và review card navigation.

### FUTURE-PAYMENT-001: Deeper payment dashboard/history

- Trạng thái: Deferred.
- Mô tả: Dashboard ban đầu chỉ cần pending payment reminder. Full payment history/dashboard thuộc scope riêng.
- Hướng xử lý: Giữ DTO ban đầu có phạm vi hẹp; chỉ thêm payment history sâu hơn khi product need đã rõ.
- Xác minh cần có: Behavior của các trạng thái pending/paid/cancelled/expired/failed.
