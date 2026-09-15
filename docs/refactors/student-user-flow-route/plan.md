# Kế hoạch tái cấu trúc luồng student/user và route

## Trạng thái

Đây là tài liệu triển khai đang hoạt động; file này sở hữu program intent, high-level architecture, dependency order và acceptance criteria ở mức wave/PR. Trạng thái và delivery evidence hiện tại do [progress.md](./progress.md) sở hữu.

## Mốc thời gian

- Ngày lập kế hoạch ban đầu: 2026-07-05.
- Lần rà soát program/dependency và ownership gần nhất: 2026-09-14.

## Cách đọc và nguồn sự thật

- Trạng thái repository cùng commit/merge history là căn cứ chính thức để xác định những gì đã thực sự được triển khai và merge.
- [progress.md](./progress.md) là nguồn trạng thái workflow hiện được ghi nhận trong tài liệu; trước khi dùng trạng thái đó để plan hoặc triển khai, phải đối chiếu với repository evidence.
- File `plan.md` này sở hữu target scope, dependency order và acceptance criteria ở mức wave; không dùng mô tả baseline lịch sử của nó để phủ định trạng thái mới hơn trong `progress.md`.
- [implementation-plans/README.md](./implementation-plans/README.md) định tuyến tới planning artifact đang active và mô tả ownership giữa các tài liệu.
- Per-PR plan sở hữu implementation contract của PR tương ứng; owner-review brief chỉ tóm tắt decision surface và không được override detailed plan.
- [problems.md](./problems.md) sở hữu defect, risk và technical constraint; [future-features.md](./future-features.md) sở hữu product feature đã hoãn; ADR sở hữu quyết định bền vững, không phải current status.
- Nếu các nguồn mâu thuẫn, dừng triển khai và reconcile theo repository evidence thay vì tự chọn tài liệu thuận tiện hơn.

## Chủ sở hữu và phạm vi

Chủ sở hữu: nhóm duy trì VocaSpace.

Phạm vi: route namespace cho teacher authoring, public course catalog, public course detail, student learning dashboard, enrolled course overview, learning workspace, profile/account separation, pending payment reminder, và các ranh giới backlog liên quan đến preview, topic publish, topic completion, memory check, FSRS review, Google OAuth.

Tài liệu theo dõi tiến độ: [progress.md](./progress.md).

Nhật ký vấn đề, rủi ro và follow-up: [problems.md](./problems.md).

ADR tóm tắt quyết định: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

## Bối cảnh

Baseline khi lập kế hoạch: teacher authoring dùng namespace `/courses` trong `app/(teacher)/courses`. Wave A sau đó đã chuyển hard cut sang `/teacher/courses`, và Wave B B1 đã dùng `/courses` cho public catalog/detail. Mô tả baseline này được giữ để giải thích dependency order, không phải current route contract.

Tại thời điểm lập kế hoạch, student-facing flow cũng chồng trách nhiệm: homepage có danh sách course public, public course detail tạm ở `/learn/[course-slug]`, `/learn` là placeholder, còn `/profile` chứa learning-related surface. B1 đã chuyển public discovery sang `/courses`; B2 đã triển khai dashboard và tách trách nhiệm khỏi `/profile`; B3 đã merge temporary redirect qua PR #74; C1 đã reclaim exact overview route; C2 đã harden nested workspace trên implementation branch.

Refactor này là route/user-flow refactor, không phải feature rewrite toàn bộ learning engine. Các product rules lớn như preview quota 20%, memory check, completion server truth và future question analytics được ghi nhận để tránh thiết kế lệch hướng, nhưng không kéo vào các PR đầu.

## Vấn đề tại thời điểm lập kế hoạch

- [Đã xử lý trong Wave A] Teacher authoring giữ `/courses`, làm chặn public catalog.
- [Đã xử lý trong Wave A] `proxy.ts` guard `/teacher`, nhưng teacher authoring chưa nằm dưới `/teacher`.
- [Đã xử lý trong B1] Public course cards có thể trỏ nhầm sang `/learn/...` thay vì canonical public detail.
- [Đã xử lý trong B2] `/learn` chưa phải student dashboard.
- [Đã xử lý trong B3/C1] `/learn/[course-slug]` là enrolled course overview; public detail canonical ở `/courses/[course-slug]`.
- [Đã xử lý trong C2] `/learn/[course-slug]/[topic-slug]` dùng exact course/topic URL làm source of truth đầy đủ.
- [Đã xử lý trong B2] `/profile` bị kéo sang learning dashboard surface thay vì chỉ account/profile.
- [Đã xử lý trong B2] Pending payment có backend state nhưng chưa có dashboard reminder contract.
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
12. Preview topic là later backlog: owner/co-owner chọn topic preview; quota hiện tại là `ceil(active_topic_count * 20%)`, trong đó active nghĩa là `removed_at IS NULL` và draft vẫn tính vào denominator; draft có marker nhưng chưa public. Public preview chỉ mở cho course published/public và topic published + active + preview marker.
13. Topic mới đi theo persisted lifecycle `draft → pending → published`; `authoring` là Builder/workflow phase trên `draft`, chỉ request review khi có ít nhất một active flashcard và ít nhất một active exercise, `pending` là trạng thái review bị đóng băng, và chỉ reviewer hợp lệ mới được approve để chuyển sang `published`.
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
| `/teacher/courses` | Course authoring list | Authenticated active collaborator; global teacher có thêm normal-create affordance | Các course user là collaborator | Tạo course chỉ dành cho global teacher | Wave A |
| `/teacher/courses/new` | Normal teacher course creation | Auth global `teacher` | Course form | Tạo `draft` course + owner membership | Wave A |
| `/teacher/courses/[id]` | Course overview/dashboard | Auth active collaborator; owner/co_owner/editor author, previewer read-only/internal preview | Readiness/next action dashboard | Quản lý cấu trúc hoặc sửa issue theo local role | Wave A |
| `/teacher/courses/[id]/structure` | Course structure workspace | Auth active collaborator; owner/co_owner/editor author, previewer read-only/internal preview | Chapters/topics | Add/edit/soft-delete/reorder theo local role | Wave A |
| `/teacher/courses/[id]/topics/[topicId]` | Topic builder | Auth active collaborator; owner/co_owner/editor author, previewer read-only/internal preview | Flashcards/exercises/settings | Lưu nội dung topic theo local role | Wave A |
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

Trạng thái hiện tại: PR B1 đã merge vào `main` qua PR #46 (`079ad46`), PR B2 qua PR #48 (`00bdadab`) và B3 qua PR #74 (`59d0810`). Wave B đã hoàn tất; C1 đã merge qua PR #75 (`3cb7a9f`).

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
    management với quota 20% vẫn deferred.
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

- Trạng thái: Đã merge/hoàn tất qua PR #48 (`00bdadab`) ngày 2026-07-13.
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

#### PR B3: Redirect public detail cũ tại `/learn/[course-slug]`

- Trạng thái: Đã merge qua PR #74 tại `59d0810`; dependency B2 đã thỏa mãn và B3 đã unblock C1.
- Kế hoạch triển khai chi tiết: [implementation-plans/b3/plan.md](./implementation-plans/b3/plan.md).
- Bản tóm tắt quyết định và delivery evidence: [implementation-plans/b3/owner-review-brief.md](./implementation-plans/b3/owner-review-brief.md).
- Kết quả chính: Redirect public detail cũ sang route canonical sau khi dashboard `/learn` đã sẵn sàng.
- Phạm vi bao gồm:
  - Redirect public detail cũ từ `/learn/[course-slug]` sang `/courses/[course-slug]`.
  - Giữ `/learn/[course-slug]/[topic-slug]` làm learning workspace route.
- Ngoài phạm vi:
  - Không chờ memory check hoặc completion hardening.
- Tiêu chí chấp nhận:
  - Public detail canonical là `/courses/[course-slug]`.
  - Namespace `/learn` không còn bị hiểu là public gallery.
- Xác minh:
  - Route tests và manual QA cho redirect cùng workspace route.

### Wave C: Enrolled learning routes và workspace hardening

Kết quả chính: Namespace learning có overview và workspace đúng semantic.

#### PR C1: Enrolled course overview

- Trạng thái: Đã merge/hoàn tất qua PR #75 (`3cb7a9f`); implementation branch head `44ee6b9` đã nằm trong `main`.
- Kế hoạch triển khai chi tiết: [implementation-plans/c1/plan.md](./implementation-plans/c1/plan.md).
- Bản tóm tắt quyết định: [implementation-plans/c1/owner-review-brief.md](./implementation-plans/c1/owner-review-brief.md).
- Kết quả chính: `/learn/[course-slug]` trở thành course learning overview cho enrolled student.
- Phạm vi bao gồm:
  - Tiến độ course.
  - Trạng thái topic đã hoàn thành/chưa hoàn thành.
  - Topic tiếp theo.
  - CTA `Tiếp tục học`.
  - Không tự động redirect sang topic.
  - Authenticated unenrolled learner ở lại same route, không thấy protected syllabus/progress và có primary CTA tới `/courses/[slug]`.
- Ngoài phạm vi:
  - Không hiển thị public detail.
  - Không triển khai đầy đủ completion truth phía server.
- Tiêu chí chấp nhận:
  - Enrolled student hiểu được vị trí hiện tại trong course.
  - CTA dẫn tới topic tiếp theo có thể thực hiện.
  - Trạng thái unenrolled/invalid được hiển thị rõ ràng.
- Xác minh:
  - Data/action tests nếu bổ sung contract.
  - Manual QA cho các trạng thái enrolled/unenrolled/course rỗng.

#### PR C2: Workspace route hardening

- Trạng thái: Đã merge/hoàn tất qua PR #96 tại `3a95c310`; PR head exact `66e7f318`; focused/full automated, isolated seeded browser, production build và CI gates đều đạt. Không claim production deployment.
- Kế hoạch triển khai chi tiết: [implementation-plans/c2/plan.md](./implementation-plans/c2/plan.md).
- Bản tóm tắt quyết định: [implementation-plans/c2/owner-review-brief.md](./implementation-plans/c2/owner-review-brief.md).
- Kết quả chính: `/learn/[course-slug]/[topic-slug]` dùng topic trong URL làm source of truth.
- Phạm vi bao gồm:
  - Workspace mở đúng topic slug từ URL.
  - Sidebar đồng bộ với URL.
  - Trạng thái invalid/locked/unenrolled được hiển thị rõ ràng.
  - Parent-before-child access precedence không inspect protected topic cho unenrolled user.
  - Progress/question/review writes dùng bounded trusted relation reads; current application-path guarantee không được claim là DB-wide invariant.
  - Correctness hardening không thêm obvious query waterfall; query/request evidence được record ở checkpoint gates.
  - Chuẩn bị seam cho memory check và server-side completion ở giai đoạn sau.
- Ngoài phạm vi:
  - Không triển khai memory check nếu chưa có contract.
  - Không triển khai final completion truth nếu schema/action chưa sẵn sàng.
- Tiêu chí chấp nhận:
  - Direct URL tới một topic cụ thể mở đúng nội dung.
  - Việc chuyển topic cập nhật route/state nhất quán.
  - Topic locked/invalid không âm thầm fallback về topic đầu tiên.
- Xác minh:
  - Action/schema/component tests cho exact access/read/write và route-local state.
  - Isolated seeded browser QA cho direct URL, sidebar, previous/next, refresh, back/forward và inaccessible matrix.
  - Full Vitest, TypeScript, targeted lint và production build.

#### PR D1: Topic authoring → review → publication (`FUTURE-PUBLISH-001`)

- Dependency: C2 đã merge qua PR #96 và các route/dashboard/workspace contract liên quan đã ổn định theo evidence hiện tại.
- Owner contract đã chốt ở mức program: topic mới luôn bắt đầu ở `draft`; create flow đi thẳng vào authoring workspace; readiness chỉ cho phép request review khi có ít nhất một active flashcard và một active exercise; readiness không tự publish.
- Global role và course collaborator role là hai lớp authority độc lập. Normal course creation chỉ thuộc global `teacher`, tạo course `draft` và owner membership; global `admin`/`student` không dùng normal teacher flow để tạo course. Admin create-on-behalf là operation tương lai ngoài D1.
- Course-local authoring derive từ active membership: `owner`/`co_owner`/`editor` author, `previewer` read-only/internal preview. `student` và `admin` vẫn có thể giữ collaborator membership và nhận đúng local authority; global role không suppress local authoring.
- Lifecycle sở hữu bởi D1: persisted `draft → pending → published`, trong đó `authoring` chỉ là Builder/workflow phase trên `draft`; submit chuyển sang `pending` và đóng băng topic/content; reviewer hợp lệ approve → `published`; reject bắt buộc reason → `draft`; submitter không được tự review.
- Reviewer là course-scoped capability: `owner`/`co_owner` có implicit permission; `editor`/`previewer` chỉ review khi `course_collaborators.can_review_topics = true`; mutation phải kiểm tra effective permission hiện tại và không được làm pending submission mất reviewer hợp lệ cuối cùng. Global role `admin|teacher|student` alone không cấp review authority.
- Global `admin` vẫn giữ platform moderation/maintenance authority tách biệt với authoring/review: trusted demotion/takedown hoặc pending-review invalidation có mandatory moderation audit, không tăng rejection counter và không được direct-publish/bypass readiness. Admin không membership không có normal authoring; admin có membership tuân local role.
- Scope đã mở rộng có chủ đích để bảo đảm invariant: global-teacher-only normal course creation; membership-derived collaborator authoring và create→builder flow; Builder readiness/review state/next action; flashcard authoring UX; exercise polish giới hạn; review/rejection state; collaborator capability boundary tối thiểu; DB/RPC/RLS/atomicity cho các write surfaces và direct bypass.
- Published topic chưa có revision system: edit content phải cảnh báo và xác nhận, thực hiện mutation cùng demotion về `draft` trong một atomic boundary; cancel không đổi state và không silent demotion.
- Ngoài phạm vi: candidate/published revision implementation, preview/Q7 access rollout, course publication, memory/completion/exercise-correctness semantics, broad collaborator/invite/ownership redesign và các Wave D khác. Future revision direction chỉ là compatibility constraint, không gán phase/workstream/timing/merge order.
- Đây là program contract; detailed implementation plan và authority cho code/DB migration vẫn tách riêng. Các Owner decisions hiện đã được đóng trong D1 request; exact schema/RPC/trigger/locking và moderation action shape thuộc P0 implementation design review, không tự suy diễn thành authority.

### Wave D: Later backlog — audit 2026-09-14, Owner decision reconciliation 2026-09-15

Audit này đối chiếu master plan, `progress.md`, `problems.md`, `future-features.md` với actions, schemas, migrations/RLS/RPC, UI và tests hiện tại. Các dòng dưới đây là **agent proposal**, trừ các business rule đã ghi là Owner decision; current delivery status vẫn chỉ thuộc `progress.md`.

#### Owner-steered Wave D decisions recorded 2026-09-15

Các quyết định dưới đây đã chốt ở mức program contract. Chúng không tự cấp implementation, commit, push, PR, merge hoặc database authority; từng unit vẫn cần detailed implementation brief và Owner acceptance trước khi code.

- **Collaborator role boundary:** hierarchy là `owner > co_owner > editor > previewer`. `owner` được tác động mọi role thấp hơn nhưng không tự thay đổi owner row; `co_owner` chỉ được tác động `editor`, `previewer` và user chưa có role, không được đụng `owner` hoặc co_owner khác; `editor`/`previewer` không quản lý collaborator. Chuyển ownership chưa nằm trong scope hiện tại. Chỉ `owner` cấp/revoke `co_owner`.
- **Global/course authority separation:** global roles là `student|teacher|admin`; course roles là `owner|co_owner|editor|previewer`. Local authoring/review derives from valid membership, không bị global role suppress; global role chỉ giữ các boundary riêng như normal course creation của teacher và moderation của admin.
- **Normal course creation:** chỉ global `teacher` được tạo course qua normal teacher flow; course mới là `draft` và creator là `owner`. Admin/student không được dùng flow này; admin create-on-behalf chưa thuộc D1.
- **Cross-role collaborators:** global `student` hoặc `admin` có thể là `co_owner`/`editor`/`previewer` và nhận exact local authority; admin không membership không có teacher authoring/review nhưng vẫn có moderation. Ownership transfer không mở trong D1.
- **Collaborator caps:** active member và pending invite cùng tính vào cap hiện tại: `owner=1`, `co_owner=2`, `editor=5`, `previewer=10`. Đây là policy source có thể điều chỉnh sau theo thực tế, không phải lý do để kéo toàn bộ invite implementation vào D2.
- **Q7 internal previewer:** course active có thể ở `draft`, `pending` hoặc `published`; topic bắt buộc `published` và active. Previewer-only access không được trở thành persistent learning-write authorization.
- **D2 public preview:** course active và `published/public`; topic active, `published` và có preview marker. Learner chưa enroll được xem toàn bộ content của topic, gồm media; có thể trả lời và nhận đúng/sai tức thời, nhưng không lưu progress, answer, review hoặc learning state nào.
- **D2 quota lifecycle:** active topic là topic chưa bị xóa; draft tính vào denominator nhưng marker trên draft chưa public. Giữ hard cap sau mutation. Nếu denominator giảm làm over-cap, Owner/co_owner được chọn các marker cần gỡ ngay trong cùng flow xác nhận thao tác; không tự động gỡ marker và không bắt đi qua màn hình khác.
- **D1 topic authoring/review/publication:** normal course creation vẫn teacher-only; topic authoring sau đó derive từ collaborator membership across global roles, topic mới luôn `draft`, create đi thẳng vào builder, request review cần cả hai loại active learning content, `pending` đóng băng, approve của reviewer hợp lệ mới publish, reject cần reason và quay về `draft`, self-review bị cấm, và các mutation collaborator/content phải giữ được effective-reviewer và lifecycle invariant. Admin moderation orthogonal với review/authoring.
- **Published revision direction (future architecture only):** published content sẽ không tiếp tục bị sửa trực tiếp rồi lộ ngay; edit của published topic về sau dùng candidate revision riêng, learner tiếp tục thấy revision published cuối cùng, candidate submit → pending/frozen, reject → editable, approve → publish candidate và retire/archive/soft-delete revision cũ. Exact data model, migration và rollout chưa quyết định; không gán direction này vào phase, workstream, schedule hoặc merge order, và D1 không triển khai nó.

| Candidate | Repository reality đã xác nhận | Dependency và boundary | Phân loại đề xuất |
| --- | --- | --- | --- |
| D1 — Topic authoring → review → publication | **Outcome state:** Chưa triển khai; lifecycle/readiness gap đã xác nhận. `app/actions/topic.ts` và `create_topic_ordered` còn cho caller truyền status; các content writes chưa khóa pending/published semantics; chưa có topic review history, delegated review capability hoặc database invariant cho readiness. | D1 sở hữu basic new-topic authoring→review→publication workflow, readiness hai loại active content, pending freeze, reviewer/effective permission, no-self-review, rejection và interim published-edit demotion. Cần kiểm tra cả application path, RPC/RLS/direct Data API, soft-delete/restore và concurrency. | Standalone cross-layer D1 implementation plan/PR; DB/RPC/RLS/atomicity là một phần boundary nếu cần để đóng bypass/invariant hole, không còn bị loại trước bằng giả định application-only. Future candidate revisions chỉ là compatibility constraint. |
| Q7 — Internal previewer access correction | **Outcome state:** Chưa triển khai; `has_course_content_read_access` hiện cho collaborator đọc content quá rộng, chưa lọc topic `published`; các progress/answer/review write path cũng chưa yêu cầu enrollment. | Phải chốt boundary `course active + status draft/pending/published` nhưng `topic active + published`; previewer-only access không được ghi persistent learning state. Đây là prerequisite authorization cho D2, nhưng không phải full invite/ownership rollout. | Bounded collaborator/access correction candidate, đặt sau D1 và trước D2. Tách khỏi public learner preview; cần action/RLS regression matrix cho direct calls và role/enrollment combinations. |
| D2 — Preview topic contract | **Outcome state:** Chưa triển khai; chỉ có DTO compatibility flag. **Owner/implementation:** Owner Decision 12 và `PREVIEW-001`; `topics` chưa có `is_preview`, public read model chỉ trả syllabus metadata cho published active topics, `addTemporaryPreviewFlag` không cấp content access. | D2 phụ thuộc D1 publish-readiness và Q7 access correction. Contract là course active/published + topic active/published/preview marker; full topic content gồm media, transient answer correctness, không persistent learning state. Quota là `ceil(active_topic_count * 20%)`, draft tính denominator; over-cap sau denominator reduction được giải quyết inline bằng gỡ marker trong cùng mutation flow. Dùng public preview read boundary và stateless answer-evaluation boundary riêng, không mở rộng collaborator read helper. | Standalone cross-boundary PR sau D1 và Q7; không gộp toàn bộ collaborator invite/ownership. Cần RLS/action/read-model matrix và migration-safe plan cho marker/quota. |
| D3 — Memory check | **Outcome state:** Chưa triển khai. **Owner/implementation:** Owner Decision 15/16 và `MEMORY-001`; không có memory action/route/field, learning stage chỉ có `flashcard`/`exercise`, còn `exercises.part_type` là TOEIC part. | Cần chốt stage/activity contract và schema/type SSOT trước; không dùng lại `type`/`part_type` cho nghĩa mới. Cần action, workspace UI, failure/retry state và tests. | Standalone learning-stage PR, đặt sau D2 theo working execution order; là prerequisite của D4 và là soft prerequisite của D5. |
| D4 — Topic completion server truth | **Outcome state:** Partial; chỉ có completion hai stage. **Owner/implementation:** Owner Decision 14, `PROGRESS-001`, `app/actions/progress.ts` và `user_topic_progress`; `updateStageProgress` derive completion từ hai flag, `submitQuestionAnswer` chưa tham gia completion. | Phụ thuộc D3 memory semantics và quyết định exercise-attempt/required-question semantics. Tách khỏi `LEARNING-INTEGRITY-001`, vốn sở hữu DB-wide learner-write relation integrity. | Standalone progress/completion PR; có thể cần schema/RPC/migration và DB-backed verification sau khi contract được chốt. |
| D5 — Question-category analytics | **Outcome state:** Chưa triển khai; chưa có model/query. **Owner/implementation:** `MEMORY-001` chỉ giữ semantic boundary; hiện không có category/skill field hoặc analytics query, và `part_type` không đủ làm category. | Cần category/stage/answer-format SSOT và metric ownership trước. Không được kéo analytics vào memory implementation chỉ vì cùng dùng question model. | Standalone analytics contract/data PR, đặt sau D4 theo working execution order; không kéo vào D4. |
| D6 — FSRS review route/deeper UX | **Outcome state:** Partial; `ReviewSheet` hiện có, dedicated route chưa có. **Owner/implementation:** `FUTURE-REVIEW-001`, `FEAT-005` và dashboard review flow hiện tại. | Product phải quyết định dedicated route có thật sự cần hay chỉ polish discoverability/summary. Route và polish có acceptance/rollback khác nhau. | Tách thành review UX polish hoặc dedicated-route PR; không gộp thành một scope mơ hồ. |
| D7 — Google OAuth hoặc hide fake CTA | **Outcome state:** Chưa triển khai; fake CTA còn tồn tại. **Owner/implementation:** `AUTH-002`, `app/(client)/login/page.tsx`, `app/(client)/register/page.tsx` và `app/actions/auth.ts`; chưa có `signInWithOAuth`/callback flow. | Owner phải chọn hide/disable CTA hoặc triển khai OAuth đầy đủ với provider config, callback và redirect safety. | Standalone auth PR; không kéo auth vào learning Wave D. |
| D8 — Profile/dashboard polish | **Outcome state:** Ownership migration đã xử lý; polish chưa triển khai. **Owner/implementation:** `PROFILE-001`, `/profile` account surface và `/learn` dashboard; các visual/dashboard/review follow-up là scope riêng. | Cần acceptance theo từng screen và user goal; giữ riêng các follow-up như `STUDENT-003`/`STUDENT-004`, không mở một PR cleanup tổng hợp. | Deferred UI follow-ups, mở riêng khi có product acceptance; không coi là blocker của D1–D5. |
| D9 — Deeper payment history/dashboard | **Outcome state:** Partial; chỉ có pending-payment reminder. **Owner/implementation:** `FUTURE-PAYMENT-001` và dashboard payment summary; payment history chưa có contract/query riêng. | Cần payment data ownership, state/query contract và idempotency boundary riêng. | Standalone payment PR sau khi product need rõ; không gộp với learning progress/auth. |

Các record liên quan nhưng không kéo vào nhóm PR trên: `LEARNING-INTEGRITY-001` (DB-wide learner writes), `FUTURE-OWNERSHIP-001` (course owner invariant và ownership transfer), `AUTH-003` (giải thích teacher redirect), `QUALITY-001` (repository-wide lint baseline), `FEAT-001`/`FEAT-002`/`FEAT-003` (collaborator tab, last-access state, learning history), cùng các UI follow-up `STUDENT-005` và `NAVIGATION-001`. Chúng giữ owner/status hiện tại trong nguồn tương ứng.

Không hạng mục Wave D nào bị drop. Working execution order là D1 → Q7 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9. D4 chờ D3; D5 chờ SSOT riêng và được xử lý sau D4 theo order này; D6 phải tách route khỏi polish; D6–D9 tiếp tục giữ deferred/open về detailed acceptance.

## Thứ tự merge khuyến nghị

1. PR A1: Prepare route helpers and docs — đã merge.
2. PR A2: Move canonical teacher route to `/teacher/courses` — đã merge.
3. PR A3: Teacher route tests and proxy hardening — đã merge.
4. PR B1: Public catalog and course detail — đã merge.
5. PR B2: Student `/learn` dashboard — đã merge.
6. PR B3: Redirect public detail cũ tại `/learn/[course-slug]` — đã merge qua PR #74.
7. PR C1: Enrolled course overview — đã merge/hoàn tất qua PR #75 (`3cb7a9f`); dependency B3 đã thỏa mãn.
8. PR C2: Workspace route hardening — đã merge/hoàn tất qua PR #96 (`3a95c310`); dependency C1 đã thỏa mãn.
9. PR D1: Topic authoring → review → publication — candidate tiếp theo sau C2; implementation chưa bắt đầu.
10. Q7: Internal previewer access correction — bounded authorization candidate sau D1 và trước D2; formal PR title/brief sẽ chốt trong unit riêng.
11. D2: Preview topic — public readonly preview sau D1 và Q7; implementation chưa bắt đầu.
12. D3 Memory check — triển khai sau D2 theo working execution order; semantic contract vẫn cần chốt riêng.
13. D4 Topic completion server truth — sau D3 và sau khi chốt exercise-attempt/required-question semantics.
14. D5 Question-category analytics — triển khai sau D4 theo working execution order, sau khi category/stage/answer-format SSOT ổn định.
15. D6 review UX, D7 auth, D8 UI polish và D9 payment history — giữ deferred/open; chỉ mở khi acceptance riêng rõ, không cần quyết định ngay.

Working execution order `D1 → Q7 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9` được ghi nhận ngày 2026-09-15 để triển khai tuần tự và dễ đọc. D6–D9 vẫn deferred/open về detailed acceptance. Đây chưa phải implementation approval cho từng PR; mỗi unit vẫn cần brief, acceptance, verification và authority riêng.

## Wave D working execution order

```text
Wave A
  PR A1 (merged)
    -> PR A2 (merged)
      -> PR A3 (merged)
        -> Wave B
           PR B1 (merged)
             -> PR B2 (merged)
               -> PR B3 (merged)
                 -> Wave C
                      PR C1 (merged through PR #75)
                      -> PR C2 (merged through PR #96)
                      -> Wave D (specific contracts below)
```

Các mũi tên dưới đây thể hiện working execution order đã chốt, không biến mọi bước thành hard dependency về mặt kỹ thuật:

```text
C2 stable route/workspace contracts
D1 topic authoring → review → publication
  -> Q7 internal previewer access correction
    -> D2 preview topic contract
      -> D3 memory check
        -> D4 topic completion server truth
          -> D5 question-category analytics SSOT
            -> D6 FSRS review UX/route
              -> D7 Google OAuth or hide fake CTA
                -> D8 profile/dashboard polish
                  -> D9 payment history/dashboard

D4 remains separate from LEARNING-INTEGRITY-001.
```

Every Wave D candidate requires its own implementation brief and Owner acceptance before code. D1, Q7 và D2 hiện đã có goal/order-level direction; D1 detailed plan hiện nằm tại [implementation-plans/d1/plan.md](./implementation-plans/d1/plan.md), còn D6 trở đi giữ deferred/open cho đến khi làm tới và có acceptance tương ứng. Owner request hiện tại là source cho D1 decision surface; không tạo owner-review brief trùng lặp.

## Wave D gates ở mức program

- D1 chỉ đạt khi normal course creation là teacher-only và tạo owner membership; valid admin/student collaborator author được theo local role, previewer read-only, admin/student không membership không normal-author; new topic không nhận user-selected `pending`/`published`, create đi thẳng vào builder ở `draft`, request review bị từ chối ở cả ba trạng thái thiếu content (rỗng, chỉ card, chỉ exercise), được phép khi có cả hai loại active content nhưng chưa publish, pending freeze được bảo vệ qua mọi normal content/status write surface, reviewer approve/reject obeys effective permission + no-self-review + reject reason, role/boolean-capability mutation không bỏ reviewer hợp lệ cuối cùng, global `admin` role alone không review/publish nhưng vẫn có moderation/takedown/maintenance boundary riêng với mandatory audit, và published edit có confirm + atomic demotion về draft. Acceptance phải có action/schema/component, DB/RPC/RLS/direct-write, moderation-separation và concurrency evidence tương ứng.
- Q7 chỉ đạt khi internal previewer đọc được course active ở draft/pending/published nhưng chỉ đọc topic published + active; previewer-only access không ghi được persistent progress/answer/review. Acceptance phải bao phủ Server Action direct calls, enrollment distinction và RLS paths.
- D2 chỉ mở sau D1 và Q7. Acceptance phải bao phủ course/topic public gates, persisted marker, quota `ceil(active_topic_count * 20%)` với draft trong denominator, full readonly topic content/media, transient answer correctness, không persistent learning state, teacher configuration và inline over-cap resolution trong cùng mutation flow.
- D3 chỉ đạt sau khi stage/activity semantic và schema/type SSOT được chốt, có server enforcement, loading/empty/error/retry states, action/schema/component tests và manual QA cho learner flow.
- D4 chỉ đạt khi completion được derive từ server-owned truth gồm memory, flashcards, exercises và required questions theo semantics đã duyệt; cần coverage cho nhiều exercise, incorrect/retry answer và persisted result. Không dùng `LEARNING-INTEGRITY-001` làm evidence thay thế.
- D5 chỉ mở khi category/skill, answer format, activity stage và metric ownership tách biệt; cần fixture-backed query/metric verification, không suy diễn từ `part_type`.
- D6–D9 mỗi track cần acceptance riêng cho user goal, permission/state/error behavior và rollback; UI track cần manual responsive/keyboard QA khi user-visible, auth cần redirect/provider safety, payment cần data/query boundary và idempotency nếu có mutation.

## Testing strategy ở mức cao

- Route helper/navigation changes: focused component/route tests, TypeScript, lint.
- Revalidation path changes: action tests asserting `revalidatePath` targets.
- Proxy/session changes: focused tests or manual route checks for unauthenticated `/teacher/*`.
- Public catalog/detail: action/schema/component tests for published/removed/error/empty states.
- Student dashboard: action/data tests for enrolled courses, due flashcards, progress, pending payment states.
- Workspace hardening: tests for URL topic selection, invalid topic, locked topic, direct refresh, sidebar sync.
- DB/RLS-affecting backlog: use Supabase/RLS integration strategy only when those later PRs actually change DB/RLS/RPC.
- Manual QA remains required for route migration and student navigation because route semantics are user-visible.

## Rollback và risk notes hiện tại

- Wave A hard cut has no legacy redirect, so rollback means reverting the route move as a coherent PR, not keeping two route namespaces.
- Điều kiện tạo public `/courses` đã được thỏa mãn trong Wave A/B1; đây không còn là blocker hiện tại.
- Dashboard `/learn` đã sẵn sàng sau B2, vì vậy B3 đã dùng temporary page redirect thay public detail cũ; không dùng permanent hoặc broad redirect, nhờ đó C1 đã reclaim exact route mà không để redirect rule tồn dư.
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

- Chỉ cập nhật progress tracker cho wave/PR đang active và cập nhật merge banner của PR vừa hoàn tất.
- Ghi exact verification commands và outcomes thực tế.
- Ghi risk hoặc follow-up dài trong problems document.
- Không thêm open-questions section; dùng implementation audit items.
- Không rewrite finalized decisions nếu chưa có explicit amendment được duyệt.
