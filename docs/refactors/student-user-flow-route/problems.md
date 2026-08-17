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

- Trạng thái: Đang mở.
- Trạng thái chuyển tiếp (2026-08-17): B1 và B2 đã merge; planning package B3 đã được reconcile và tự review trên baseline `effb557`, nhưng application implementation chưa bắt đầu. Giữ issue mở sau B3 vì semantic mục tiêu chỉ hoàn tất khi C1 reclaim route cho enrolled overview.
- Vấn đề: Public course detail hiện có thể tạm thời nằm tại `/learn/[course-slug]`, trong khi mục tiêu của route này là enrolled course overview.
- Ảnh hưởng: Route semantics xung đột nếu thời điểm redirect không được kiểm soát.
- Hướng xử lý: Tạo `/courses/[course-slug]` trước; sau khi dashboard `/learn` hoạt động, redirect public detail cũ từ `/learn/[course-slug]` sang `/courses/[course-slug]`.
- Wave/PR xử lý: PR B1, PR B2, PR B3, PR C1.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: Shared `PublicCourseDetailRoute`/`PublicCourseDetailView`, `PublicCourseEnrollmentCard`, `getPublicCourseDetail`, legacy detail delegator và route matching cho `/learn/[course-slug]/[topic-slug]`.
  - Giả định mặc định: B3 redirect trước khi C1 reclaim `/learn/[course-slug]`.
  - Rủi ro: Redirect bắt nhầm learning overview hoặc workspace route.
  - Xác minh trong: PR B3 và PR C1.
- Nguồn triển khai B3: [implementation-plans/b3/plan.md](./implementation-plans/b3/plan.md); [owner-review brief](./implementation-plans/b3/owner-review-brief.md) chỉ là decision surface và không override plan.

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

- Trạng thái: Đang mở (B2 đã partial fix; C2 chịu trách nhiệm full fix).
- Vấn đề: Workspace route mục tiêu phải mở topic từ URL. Implementation hiện tại cần hardening để direct link không âm thầm mở topic đầu tiên.
- Ảnh hưởng: Student có thể vào sai lesson, progress có thể được ghi cho sai topic và shared link trở nên không đáng tin cậy.
- Hướng xử lý: Truyền topic slug vào workspace state, validate theo syllabus/content access và đồng bộ sidebar với URL.
- Partial fix trong B2: Truyền `initialTopicSlug` vào `LearningWorkspace`, resolve initial topic từ URL và fallback an toàn. Chưa làm full URL ↔ state synchronization.
- Wave/PR xử lý: PR B2 cho minimal initial-topic; PR C2 cho full synchronization.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx`, `LearningWorkspace`, `ChapterSidebar`, `getCourseSyllabus`, `getTopicContent`.
  - Giả định mặc định: Topic slug trong URL là source of truth khi render lần đầu.
  - Rủi ro: Stale local state ghi đè route state.
  - Xác minh trong: PR B2 cho initial behavior và PR C2 cho full behavior.

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

- Trạng thái: Deferred.
- Vấn đề: Preview do owner/co-owner chọn, giới hạn tối đa 30% số topic và nhiều khả năng được cấu hình ở topic level. Đây không chỉ là một UI badge.
- Ảnh hưởng: Nếu triển khai thiếu kiểm soát, public user có thể đọc locked content hoặc số preview topic vượt giới hạn.
- Hướng xử lý: Xem preview là teacher/content feature ở giai đoạn sau và audit đầy đủ schema/action/RLS/public/workspace.
- Wave/PR xử lý: Wave D.
- Mục cần kiểm tra khi triển khai:
  - Cần kiểm tra: `topics` schema, course detail syllabus, content read access RLS, teacher topic settings, workspace access.
  - Giả định mặc định: Model sau này cần topic-level marker như `topics.is_preview`.
  - Rủi ro: Public content read access trở nên quá rộng.
  - Xác minh trong: Preview contract PR.

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
- Evidence hiện tại (2026-07-14): `npm.cmd run lint` trả về 13 errors và 8 warnings trên toàn repository. B1.7 ban đầu ghi 13 errors và 12 warnings; warning count đã giảm nhưng full-lint gate vẫn chưa xanh.
- Vấn đề: Các errors hiện còn nằm trong test/action/webhook/discount files ngoài docs-only diff hiện tại; đây vẫn là repository-wide baseline issue, không phải lỗi do B3 plan.
- Ảnh hưởng: Full-lint command chưa thể dùng làm green repository-wide gate dù PR B1 không tạo ra các lỗi được báo cáo.
- Hướng xử lý: Giữ targeted lint xanh cho mọi file B1 thay đổi; không sửa hoặc che lỗi baseline trong B1. Một follow-up PR riêng cần sửa các errors/warnings hiện có và khôi phục `npm.cmd run lint` thành green gate.
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

- Trạng thái: Deferred.
- Mô tả: Schema hiện chưa bảo đảm mọi course luôn có ít nhất và đúng một active collaborator mang role `owner`; một course vẫn được phép có nhiều `co_owner`.
- Phạm vi xử lý: Không thuộc B1. Cần một task tập trung sau khi audit và làm sạch legacy data để tránh áp constraint lên dữ liệu chưa rõ tính hợp lệ.
- Hạng mục cần audit: Course creation paths, collaborator role mutations, profile/user soft deletion, course publication validation và lựa chọn giữa partial unique index, constraint, trigger hoặc transactional RPC để enforce invariant an toàn nhất.
- Xác minh cần có: Chứng minh không thể tạo course thiếu owner, không thể có hai active owner, vẫn cho phép nhiều co-owner và các luồng soft-delete/role mutation giữ invariant trong transaction.

### FUTURE-PUBLISH-001: Topic publish validation

- Trạng thái: Deferred.
- Mô tả: Topic chỉ được publish khi có cả flashcards và exercises.
- Hướng xử lý: Audit topic update/publish action và readiness checks trong một teacher/content PR riêng.
- Xác minh cần có: Action/schema tests cho các trường hợp chỉ có flashcard, chỉ có exercise, có cả hai và topic rỗng.

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
