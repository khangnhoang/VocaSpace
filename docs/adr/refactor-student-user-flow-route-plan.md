# Kế hoạch tái cấu trúc luồng student/user và route

## Trạng thái

Accepted

## Ngày ghi nhận

2026-07-05

## Chủ sở hữu và phạm vi

Chủ sở hữu: nhóm duy trì VocaSpace.

Phạm vi: route namespace cho teacher authoring, public course catalog, public course detail, student learning dashboard, enrolled course overview, learning workspace, profile/account separation, pending payment reminder, và các ranh giới backlog liên quan đến preview, topic publish, topic completion, memory check, FSRS review, Google OAuth.

Tài liệu theo dõi tiến độ: [refactor-student-user-flow-route-progress.md](./refactor-student-user-flow-route-progress.md).

Nhật ký vấn đề, rủi ro và follow-up: [refactor-student-user-flow-route-problems.md](./refactor-student-user-flow-route-problems.md).

ADR tóm tắt quyết định: [refactor-student-user-flow-route-adr.md](./refactor-student-user-flow-route-adr.md).

## Bối cảnh

Teacher authoring hiện đang dùng namespace `/courses` trong `app/(teacher)/courses`. Product direction mới cần dành `/courses` cho public course catalog, nên teacher authoring phải chuyển sang `/teacher/courses`.

Student-facing flow hiện cũng đang chồng trách nhiệm: homepage có danh sách course public, public course detail đang tạm ở `/learn/[course-slug]`, `/learn` vẫn là placeholder, còn `/profile` đang chứa learning-related surface. Route `/learn/[course-slug]/[topic-slug]` là learning workspace nhưng cần được harden để mở đúng topic từ URL và xử lý rõ invalid/locked/unenrolled states.

Refactor này là route/user-flow refactor, không phải feature rewrite toàn bộ learning engine. Các product rules lớn như preview 30%, memory check, completion server truth và future question analytics được ghi nhận để tránh thiết kế lệch hướng, nhưng không kéo vào các PR đầu.

## Vấn đề hiện tại

- Teacher authoring đang giữ `/courses`, làm chặn public catalog tương lai.
- `proxy.ts` đang guard `/teacher`, nhưng teacher authoring chưa nằm dưới `/teacher`.
- Public course cards có thể trỏ nhầm sang `/learn/...` thay vì public catalog/detail contract tương lai.
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

#### PR A1: Prepare route helpers and docs

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

#### PR B1: Public catalog and course detail

- Kết quả chính: tạo public catalog/detail sau khi `/courses` đã được giải phóng khỏi teacher authoring.
- Phạm vi bao gồm:
  - Create public `/courses`.
  - Create public `/courses/[course-slug]`.
  - Homepage chỉ hiển thị featured/highlighted courses.
  - Public course cards trỏ tới `/courses/[course-slug]`.
- Ngoài phạm vi:
  - Không đổi enrolled overview.
  - Không memory check/completion hardening.
- Acceptance criteria:
  - Guest xem được catalog public published courses.
  - Guest xem được public course detail.
  - Homepage không còn đóng vai full catalog.
- Verification:
  - Component/action tests cho public course queries nếu có thay đổi.
  - Manual QA public navigation.

#### PR B2: Student `/learn` dashboard

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

## Ngoài phạm vi

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
