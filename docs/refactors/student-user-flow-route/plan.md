# Kế hoạch tái cấu trúc luồng student/user và route

## Trạng thái

Active implementation documentation. Wave A đã hoàn tất qua PR #42–#44; PR B1 đã
merge vào `main` qua PR #46 (`079ad46`); B2 đang triển khai trên branch
`feat/student-learn-dashboard`; xem [progress.md](./progress.md).

## Ngày ghi nhận

2026-07-05

## Chủ sở hữu và phạm vi

Chủ sở hữu: nhóm duy trì VocaSpace.

Phạm vi: route namespace cho teacher authoring, public course catalog, public course detail, student learning dashboard, enrolled course overview, learning workspace, profile/account separation, pending payment reminder, và các ranh giới backlog liên quan đến preview, topic publish, topic completion, memory check, FSRS review, Google OAuth.

Tài liệu theo dõi tiến độ: [progress.md](./progress.md).

Nhật ký vấn đề, rủi ro và follow-up: [problems.md](./problems.md).

ADR tóm tắt quyết định: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

## Bối cảnh

Baseline khi lập kế hoạch: teacher authoring dùng namespace `/courses` trong
`app/(teacher)/courses`. Wave A sau đó đã chuyển hard cut sang `/teacher/courses`, và
Wave B B1 đã dùng `/courses` cho public catalog/detail. Mô tả baseline này được giữ để
giải thích dependency order, không phải current route contract.

Tại thời điểm lập kế hoạch, student-facing flow cũng chồng trách nhiệm: homepage có danh
sách course public, public course detail tạm ở `/learn/[course-slug]`, `/learn` là
placeholder, còn `/profile` chứa learning-related surface. B1 đã chuyển public discovery
sang `/courses`; dashboard, redirect và workspace hardening vẫn thuộc các wave sau.

Refactor này là route/user-flow refactor, không phải feature rewrite toàn bộ learning engine. Các product rules lớn như preview 30%, memory check, completion server truth và future question analytics được ghi nhận để tránh thiết kế lệch hướng, nhưng không kéo vào các PR đầu.

## Vấn đề tại thời điểm lập kế hoạch

- [Đã xử lý trong Wave A] Teacher authoring giữ `/courses`, làm chặn public catalog.
- [Đã xử lý trong Wave A] `proxy.ts` guard `/teacher`, nhưng teacher authoring chưa nằm dưới `/teacher`.
- [Đã xử lý trong B1] Public course cards có thể trỏ nhầm sang `/learn/...` thay vì canonical public detail.
- `/learn` chưa phải student dashboard.
- `/learn/[course-slug]` hiện là public course detail tạm, trong khi target là enrolled course overview.
- `/learn/[course-slug]/[topic-slug]` cần dùng topic slug từ URL làm source of truth.
- `/profile` đang bị kéo sang learning dashboard surface thay vì chỉ account/profile.
- Pending payment có backend state nhưng chưa có dashboard reminder contract.
- Completion/progress hiện chưa đủ để đại diện cho memory check và all-exercise completion.

## Quyết định đã chốt

1. Teacher authoring hard cut từ `/courses` sang `/teacher/courses`.
2. Không giữ old teacher `/courses/*` bằng redirect.
3. Không duplicate teacher UI dưới cả `/courses` và `/teacher/courses`.
4. `/courses` trở thành public course catalog sau khi teacher namespace đã move.
5. `/courses/[course-slug]` trở thành public course detail.
6. Homepage `/` vẫn là public landing và chỉ hiển thị featured/highlighted courses.
7. Old public detail `/learn/[course-slug]` giữ tạm, rồi redirect sang `/courses/[course-slug]` sau khi `/learn` dashboard hoàn thành.
8. `/learn` là authenticated student dashboard, không phải course gallery.
9. `/learn/[course-slug]` là enrolled course overview, không auto redirect topic.
10. `/learn/[course-slug]/[topic-slug]` là actual learning workspace và phải mở đúng topic từ URL.
11. `/profile` là account/profile management; shortcut nhỏ sang learning/review được phép nhưng không là main learning UX.
12. Preview topic là later backlog: owner/co-owner chọn topic preview, cap 30% tổng topics, likely `topics.is_preview`.
13. Topic chỉ publish được khi có cả flashcards và exercises.
14. Topic complete chỉ khi hoàn thành flashcards, memory check bắt buộc, tất cả exercises, và toàn bộ required questions đúng.
15. Memory check bắt buộc, nằm giữa flashcards và exercises, reuse `exercises/questions/question_options` nếu phù hợp.
16. Không overload một `type` field để đồng thời mang question category, answer format và usage stage.
17. Pending payment reminder ở `/learn` dẫn về course detail, không mở modal trực tiếp.
18. Pending payment dismiss dùng `sessionStorage` keyed by `paymentId`.
19. Google OAuth hoặc hide fake Google buttons là later work.

## Route contract mục tiêu

| Route | Vai trò | Access | UI chính | CTA chính | Wave |
| --- | --- | --- | --- | --- | --- |
| `/` | Public homepage/landing | Public | Featured/highlighted courses | Đi tới `/courses` hoặc course detail | Wave B |
| `/teacher/courses` | Teacher course list | Auth teacher/admin, data protected by Server Actions/RLS | Course list của teacher | Tạo course | Wave A |
| `/teacher/courses/new` | Teacher create course | Auth teacher/admin | Course form | Lưu course | Wave A |
| `/teacher/courses/[id]` | Teacher course overview/dashboard | Auth collaborator with authoring access | Readiness/next action dashboard | Quản lý cấu trúc hoặc sửa issue | Wave A |
| `/teacher/courses/[id]/structure` | Teacher structure workspace | Auth collaborator with authoring access | Chapters/topics | Add/edit/soft-delete/reorder | Wave A |
| `/teacher/courses/[id]/topics/[topicId]` | Teacher topic builder | Auth collaborator with authoring access | Flashcards/exercises/settings | Lưu nội dung topic | Wave A |
| `/courses` | Public course catalog | Public | All published courses | Xem chi tiết | Wave B |
| `/courses/[course-slug]` | Public course detail | Public, auth optional | Course detail, syllabus, enroll/payment | Đăng ký hoặc tiếp tục thanh toán | Wave B |
| `/learn` | Student dashboard | Auth student | Enrolled courses, continue learning, progress, due flashcards, pending payment summary | Tiếp tục học | Wave B |
| `/learn/[course-slug]` | Enrolled course overview | Auth enrolled; preview later | Progress, completed/incomplete topics, next topic | Tiếp tục học | Wave C |
| `/learn/[course-slug]/[topic-slug]` | Learning workspace | Auth enrolled; preview later | Flashcards, memory check later, exercises | Complete topic/next topic | Wave C |
| `/profile` | Account/profile | Auth user | Profile and account settings | Edit profile, optional shortcut | Wave B/D |

## Target student flow

```text
Guest
-> /
-> /courses
-> /courses/[course-slug]
-> login/register when enrollment requires auth
-> free enroll or paid checkout
-> pending payment resumes from course detail
-> /learn
-> /learn/[course-slug]
-> /learn/[course-slug]/[topic-slug]
-> flashcards
-> memory check
-> all exercises/questions
-> topic complete
-> next topic or course overview
```

## Kế hoạch PR theo wave

### Wave A: Teacher route hard cut

Kết quả chính: chuyển teacher authoring từ `/courses` sang `/teacher/courses`, không legacy redirect, không duplicate UI, và để `/courses` trống cho public catalog tương lai.

Trạng thái hiện tại: Đã hoàn tất và merge vào `main` qua PR #42 (`d800d648`),
PR #43 (`59680afb`) và PR #44 (`6a639d5e`).

#### PR A1: Prepare route helpers and docs

- Trạng thái: Đã merge/hoàn tất qua PR #42 (`d800d648`), implementation `cce28c9`.

- Kết quả chính: chuẩn bị route helper/documentation để giảm hardcode trước khi move route vật lý.
- Phạm vi bao gồm:
  - Centralize remaining teacher route links quanh `lib/course-authoring/routes.ts`.
  - Ghi route contract mới trong docs.
  - Giữ behavior hiện tại nếu có thể.
- Ngoài phạm vi:
  - Không move physical route files.
  - Không tạo public catalog.
  - Không thêm old-route redirects.
- Acceptance criteria:
  - Teacher route helper có base path dễ đổi sang `/teacher/courses`.
  - Docs ghi rõ hard cut và no legacy redirect.
  - Existing teacher behavior không đổi.
- Verification:
  - Targeted route/helper tests nếu có thay đổi helper.
  - `git diff --check`.

#### PR A2: Move canonical teacher route to `/teacher/courses`

- Trạng thái: Đã merge/hoàn tất qua PR #43 (`59680afb`), implementation `701054b`.

- Kết quả chính: route teacher canonical chuyển sang `/teacher/courses`.
- Phạm vi bao gồm:
  - Move/rename route namespace.
  - Update helper base path.
  - Update header/navigation/breadcrumbs/back links.
  - Update revalidation paths.
  - Update imports bị ảnh hưởng bởi route path.
- Ngoài phạm vi:
  - Không public catalog.
  - Không legacy redirects cho old teacher `/courses`.
  - Không refactor business logic.
- Acceptance criteria:
  - Teacher authoring entry points hoạt động dưới `/teacher/courses`.
  - Không còn route UI teacher canonical dưới `/courses`.
  - Navigation teacher/admin không trỏ tới old `/courses`.
  - Revalidation path target đúng namespace mới.
- Verification:
  - TypeScript.
  - Targeted route/component/action tests.
  - `git diff --check`.
  - Manual QA: course list, create course, overview, structure, topic builder, refresh/back.

#### PR A3: Teacher route tests and proxy hardening

- Trạng thái: Đã merge/hoàn tất qua PR #44 (`6a639d5e`), implementation `fe032ba`;
  manual route QA evidence nằm trong `progress.md`/`f14eaf8`.

- Kết quả chính: test suite và proxy/session behavior phản ánh namespace mới.
- Phạm vi bao gồm:
  - Update tests assert `/teacher/courses`.
  - Verify unauthenticated `/teacher/*` redirect/login behavior qua `proxy.ts`.
  - Clean stale teacher `/courses` references.
- Ngoài phạm vi:
  - Không mở public `/courses`.
  - Không thay đổi RLS ngoài nhu cầu bugfix đã chứng minh.
- Acceptance criteria:
  - Tests không còn mô tả teacher authoring ở `/courses`.
  - `proxy.ts` + `utils/supabase/middleware.ts` guard `/teacher` rõ ràng.
  - Server Actions/RLS tiếp tục là data protection layer.
- Verification:
  - Focused tests quanh route/proxy nếu có.
  - TypeScript/lint nếu files đổi.

### Wave B: Public course catalog/detail and student dashboard

Kết quả chính: `/courses` trở thành public catalog, `/courses/[course-slug]` là public detail, và `/learn` trở thành student dashboard.

Trạng thái hiện tại: PR B1 đã merge vào `main` qua PR #46 (`079ad46`).
PR B2 đang triển khai trên branch `feat/student-learn-dashboard`.
PR B3 legacy redirect chưa bắt đầu.

#### PR B1: Public catalog and course detail

- Trạng thái: Đã merge/hoàn tất qua PR #46 (`079ad46`). Xem checkpoint/verification
  evidence tại [progress.md](./progress.md) và detailed plan liên kết bên dưới.

- Kế hoạch triển khai chi tiết: [pr-b1-public-catalog-detail-plan.md](./pr-b1-public-catalog-detail-plan.md).
- Kết quả chính: tạo public catalog/detail sau khi `/courses` đã được giải phóng khỏi teacher authoring.
- Phạm vi bao gồm:
  - Create public `/courses`.
  - Create public `/courses/[course-slug]`.
  - Homepage hiển thị tối đa bốn highlighted courses theo valid enrollment count,
    quota paid/free và deterministic tie-break; không thêm `is_featured`.
  - Guest đọc public syllabus metadata qua contract hẹp, không đọc protected content.
  - Giữ first-topic preview như compatibility metadata tạm thời; final preview
    management 30% vẫn deferred.
  - Payment cancel transition dùng server-resolved slug và canonical public detail.
  - Public course cards trỏ tới `/courses/[course-slug]`.
- Ngoài phạm vi:
  - Không đổi enrolled overview.
  - Không redirect old `/learn/[course-slug]`.
  - Không thêm enrollment-status rule hoặc broad cache/payment refactor.
  - Không memory check/completion hardening.
- Acceptance criteria:
  - Guest xem được catalog public published courses.
  - Guest xem được public course detail.
  - Homepage không còn đóng vai full catalog.
- Verification:
  - Component/action tests cho public course queries nếu có thay đổi.
  - Manual QA public navigation.

#### PR B2: Student `/learn` dashboard

- Trạng thái: Đang triển khai trên branch `feat/student-learn-dashboard`.
- Kế hoạch triển khai chi tiết: [plans/b2-student-learn-dashboard.md](./plans/b2-student-learn-dashboard.md).
- Kết quả chính: `/learn` thành dashboard học tập authenticated.
- Phạm vi bao gồm:
  - Enrolled courses.
  - Continue learning.
  - Next topic.
  - Course progress.
  - Due flashcards summary.
  - Pending payment reminder summary.
  - Move learning-dashboard responsibility away from `/profile`.
- Ngoài phạm vi:
  - Không open payment modal trực tiếp từ dashboard.
  - Không `/learn/review` dedicated route.
  - Không implement memory check.
- Acceptance criteria:
  - Authenticated student có dashboard hữu ích.
  - Pending payment reminder dẫn tới course detail.
  - `/profile` không còn là main learning dashboard.
- Verification:
  - Action/schema/component tests cho dashboard data states.
  - Manual QA empty/enrolled/pending-payment states.

#### PR B3: Redirect old public `/learn/[course-slug]`

- Kết quả chính: old public detail route chuyển sang public detail mới sau khi `/learn` dashboard sẵn sàng.
- Phạm vi bao gồm:
  - Redirect old public `/learn/[course-slug]` to `/courses/[course-slug]`.
  - Preserve `/learn/[course-slug]/[topic-slug]` workspace route for learning.
- Ngoài phạm vi:
  - Không đợi memory check hoặc completion hardening.
- Acceptance criteria:
  - Public detail canonical là `/courses/[course-slug]`.
  - `/learn` namespace không còn bị hiểu là public gallery.
- Verification:
  - Route tests/manual QA cho redirect và workspace route.

### Wave C: Enrolled learning routes and workspace hardening

Kết quả chính: learning namespace có overview và workspace đúng semantic.

#### PR C1: Enrolled course overview

- Kết quả chính: `/learn/[course-slug]` trở thành course learning overview cho enrolled student.
- Phạm vi bao gồm:
  - Course progress.
  - Completed/incomplete topic states.
  - Next topic.
  - CTA `Tiếp tục học`.
  - No auto redirect.
- Ngoài phạm vi:
  - Không public detail.
  - Không completion server truth đầy đủ.
- Acceptance criteria:
  - Enrolled student hiểu đang ở đâu trong course.
  - CTA đưa tới next actionable topic.
  - Unenrolled/invalid states rõ ràng.
- Verification:
  - Data/action tests nếu thêm contract.
  - Manual QA enrolled/unenrolled/empty course states.

#### PR C2: Workspace route hardening

- Kết quả chính: `/learn/[course-slug]/[topic-slug]` dùng URL topic làm source of truth.
- Phạm vi bao gồm:
  - Workspace mở đúng topic slug từ URL.
  - Sidebar sync với URL.
  - Invalid/locked/unenrolled states rõ ràng.
  - Prepare seams for memory check and server-side completion later.
- Ngoài phạm vi:
  - Không implement memory check nếu chưa có contract.
  - Không implement final completion truth nếu schema/action chưa sẵn sàng.
- Acceptance criteria:
  - Direct URL vào topic cụ thể mở đúng nội dung.
  - Switching topic updates route/state consistently.
  - Locked/invalid topic không rơi vào first topic silently.
- Verification:
  - Component tests cho initial topic selection.
  - Action/data tests cho access state nếu có.
  - Manual QA direct URL, sidebar click, refresh, locked/invalid.

### Wave D: Later backlog

Các mục này không được over-detail thành PR sớm. Mỗi mục cần audit lại khi mở implementation scope.

| Backlog | Vì sao để sau | Phụ thuộc | Rủi ro chính |
| --- | --- | --- | --- |
| Topic publish validation | Teacher route/dashboard cần ổn định trước | Teacher topic action/readiness audit | Publish topic thiếu flashcards hoặc exercises |
| Preview topic contract | Cần schema/RLS/content access decision | Teacher UI, server action, RLS, public detail, workspace | Guest/preview đọc quá quyền hoặc không đủ quyền |
| Memory check | Cần workspace route hardening trước | Exercise/question model, stage contract | Overload `type`, khóa future analytics |
| Future question-category analytics | Nice-to-have sau | Question schema/category design | Analytics sai nghĩa hoặc khó mở rộng |
| Topic completion server truth | Cần memory check và exercise attempt semantics | Progress schema/action/RPC | Client mark complete sai |
| FSRS review route/deeper UX | Dashboard/workspace cần ổn định trước | `/learn` dashboard, review data contract | Review bị kẹt trong `/profile` |
| Google OAuth hoặc hide fake CTA | Không chặn route refactor | Supabase OAuth setup | CTA giả gây hiểu nhầm |
| Profile cleanup/polish | Cần `/learn` dashboard trước | Profile/sidebar/review shortcut | Xóa shortcut học quá sớm |
| Deeper payment history/dashboard | Reminder version đầu đủ trước | Payment query contract | Scope creep thanh toán |

## Thứ tự merge khuyến nghị

1. PR A1: Prepare route helpers and docs.
2. PR A2: Move canonical teacher route to `/teacher/courses`.
3. PR A3: Teacher route tests and proxy hardening.
4. PR B1: Public catalog and course detail.
5. PR B2: Student `/learn` dashboard.
6. PR B3: Redirect old public `/learn/[course-slug]`.
7. PR C1: Enrolled course overview.
8. PR C2: Workspace route hardening.
9. Wave D items only after relevant contracts are stable.

## Đồ thị phụ thuộc

```text
Wave A
  PR A1
    -> PR A2
      -> PR A3
        -> Wave B
           PR B1
             -> PR B2
               -> PR B3
                 -> Wave C
                    PR C1
                      -> PR C2

Wave D depends on the specific stable contracts from Wave B/C.
```

## Testing strategy ở mức cao

- Route helper/navigation changes: focused component/route tests, TypeScript, lint.
- Revalidation path changes: action tests asserting `revalidatePath` targets.
- Proxy/session changes: focused tests or manual route checks for unauthenticated `/teacher/*`.
- Public catalog/detail: action/schema/component tests for published/removed/error/empty states.
- Student dashboard: action/data tests for enrolled courses, due flashcards, progress, pending payment states.
- Workspace hardening: tests for URL topic selection, invalid topic, locked topic, direct refresh, sidebar sync.
- DB/RLS-affecting backlog: use Supabase/RLS integration strategy only when those later PRs actually change DB/RLS/RPC.
- Manual QA remains required for route migration and student navigation because route semantics are user-visible.

## Rollback và risk notes

- Wave A hard cut has no legacy redirect, so rollback means reverting the route move as a coherent PR, not keeping two route namespaces.
- Do not create public `/courses` until teacher namespace is fully moved and stale references are cleaned.
- Keep old public `/learn/[course-slug]` temporary until `/learn` dashboard is ready; redirect too early would collide with enrolled overview work.
- Pending payment dismissal is session-local and should not be persisted until product needs cross-session dismissal.
- Memory check and completion truth should not be squeezed into route migration PRs; they need their own schema/action/progress audit.

## Ranh giới của documentation-planning branch ban đầu — historical

Các giới hạn dưới đây chỉ áp dụng cho branch lập kế hoạch ban đầu ngày 2026-07-05 và
không còn mô tả trạng thái triển khai hiện tại. Chúng được giữ để bảo toàn lịch sử
phạm vi của planning checkpoint.

- No application behavior change in this documentation branch.
- No route move in this documentation branch.
- No migrations.
- No RLS/RPC changes.
- No business logic refactor.
- No public catalog implementation yet.
- No Google OAuth implementation.
- No memory check implementation.
- No future analytics implementation.
- No push from this branch unless owner explicitly requests it.

## Quy tắc duy trì tài liệu

- Update progress tracker only for the active wave/PR.
- Record exact verification commands and outcomes.
- Put long risks or follow-ups in the problems document.
- Do not add an open-questions section; use implementation audit items instead.
- Do not rewrite finalized decisions unless an explicit amendment is approved.
