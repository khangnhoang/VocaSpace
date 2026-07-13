---
title: "B2 — Student /learn Dashboard"
wave: B2
status: Implementation hoàn tất; manual QA một phần
completed: 2026-07-13
branch: feat/student-learn-dashboard
base: "origin/main @ c70ed20 (post-PR #47)"
parent: ../plan.md
progress: ../progress.md
problems: ../problems.md
adr: ../../../adr/refactor-student-user-flow-route-adr.md
---

# B2 Implementation Plan — Student `/learn` Dashboard

## 1. Mục tiêu

Thay thế trang placeholder `/learn` bằng dashboard học tập dành cho authenticated learner.

Dashboard phải:

* Hiển thị các khóa học published mà user đã đăng ký.
* Hiển thị tiến độ học trên từng khóa học.
* Xác định topic tiếp theo mà user nên học.
* Cho phép tiếp tục học đúng topic thông qua URL.
* Hiển thị trạng thái hoàn thành khóa học.
* Hiển thị tổng quan flashcard cần ôn.
* Hiển thị các pending payment gần nhất.
* Di chuyển trách nhiệm dashboard học tập ra khỏi `/profile`.

B2 không triển khai toàn bộ learning workspace routing thuộc C2.

---

## 2. Phạm vi đã chốt

### Trong phạm vi B2

1. Xây dựng authenticated `/learn` dashboard.
2. Chỉ hiển thị enrolled courses đang published và chưa soft-delete.
3. Chỉ tính chapter chưa soft-delete và topic đang published chưa soft-delete.
4. Tính tiến độ học theo `user_topic_progress`.
5. Xác định topic tiếp theo theo thứ tự toàn khóa học.
6. Hỗ trợ CTA "Tiếp tục học".
7. Hỗ trợ trạng thái khóa học đã hoàn thành.
8. Sửa tối thiểu workspace để tôn trọng `[topic-slug]` lúc khởi tạo.
9. Hiển thị tổng quan flashcard cần ôn.
10. Hiển thị tối đa ba pending payment gần nhất và cho phép xem toàn bộ.
11. Dismiss payment reminder theo từng `paymentId`.
12. Loại bỏ learner-dashboard duplication khỏi `/profile`.
13. Cập nhật tài liệu Wave B để phản ánh B1 đã merge và B2 đang triển khai.

### Ngoài phạm vi B2

* Full URL ↔ workspace state synchronization.
* Browser back/forward synchronization khi chuyển topic.
* Cập nhật URL mỗi khi chọn lesson trong workspace.
* Dedicated `/learn/review` route.
* Memory check flow.
* Legacy route redirect thuộc B3.
* Full enrolled-course overview thuộc C1.
* Full workspace hardening thuộc C2.
* Final course-completion business semantics ngoài topic completion hiện tại.
* Preview percentage hoặc preview restriction mới.
* Lưu `lastAccessTopic`.
* Learning history table.
* Analytics lịch sử truy cập.
* Tab "Các khóa học chưa xuất bản".
* Teacher course-management workflow.
* Trash hoặc restore soft-deleted courses.
* Migration, RPC, view hoặc RLS change nếu không xuất hiện bằng chứng mới trong quá trình triển khai.

---

## 3. Quyết định nghiệp vụ

### 3.1 Khóa học được hiển thị

Một course chỉ xuất hiện trong learner dashboard khi:

* User có enrollment hợp lệ.
* Course có trạng thái `published`.
* Course chưa bị soft-delete.

Course `draft`, `pending` và soft-deleted không xuất hiện trên dashboard học tập.

Tab dành cho collaborator truy cập các khóa học chưa xuất bản được hoãn sang một scope riêng. Tab này, nếu được làm sau, sẽ nằm trong dashboard/access flow chứ không phải teacher management flow.

---

### 3.2 Nội dung được dùng để tính tiến độ

Chỉ xét:

* Chapter chưa soft-delete (`removed_at IS NULL`).
* Topic `published`.
* Topic chưa soft-delete (`removed_at IS NULL`).

> **Ghi chú triển khai:** Schema hiện tại của bảng `chapters` không có field `status`.
> "Chapter published" trong plan này có nghĩa là "chapter chưa bị soft-delete"
> (`removed_at IS NULL`). Chỉ `topics` mới có `status: ItemStatus`.

Topic được sắp xếp theo:

1. `chapter.order_index`
2. `topic.order_index`

Chapter không có topic published không tham gia vào progress denominator và không tạo điểm dừng trong thuật toán next-topic.

---

### 3.3 Progress

Progress của course:

```text
completedPublishedTopicCount / totalPublishedTopicCount
```

Một topic được tính hoàn thành khi user có bản ghi `user_topic_progress` tương ứng và `is_topic_completed = true`.

Các trạng thái đặc biệt:

* Course không có topic published: không hiển thị phần trăm tiến độ học thông thường.
* Chưa hoàn thành topic nào: tiến độ 0%.
* Hoàn thành toàn bộ topic published: tiến độ 100%.

Không suy diễn course completion từ chapter completion hoặc lesson access history trong B2.

---

### 3.4 Thuật toán "Topic tiếp theo"

Không sử dụng `lastAccessTopic`.

Sau khi lấy toàn bộ topic hợp lệ và sắp xếp theo course order:

1. Tìm topic published đầu tiên mà user chưa hoàn thành.
2. Topic đó là `nextTopic`.
3. Nếu không còn topic chưa hoàn thành, course được xem là hoàn thành theo phạm vi B2.

Hệ quả:

* Hoàn thành topic 2 của chapter 3 → topic tiếp theo là topic 3 của chapter 3.
* Hoàn thành topic cuối chapter 3 → tìm topic đầu tiên của chapter kế tiếp.
* Chapter kế tiếp không có topic → bỏ qua và tiếp tục tìm các chapter sau.
* Có nhiều chapter rỗng liên tiếp → bỏ qua tất cả.
* User học không theo thứ tự → quay về topic đầu tiên còn thiếu theo course order.
* Chưa có progress → topic đầu tiên của course là topic tiếp theo.

Không chỉ kiểm tra duy nhất chapter kế tiếp.

---

### 3.5 CTA theo trạng thái course

#### Course còn topic chưa hoàn thành

Hiển thị CTA:

```text
Tiếp tục học
```

Đích đến:

```text
/learn/[course-slug]/[next-topic-slug]
```

#### Course đã hoàn thành

Không tiếp tục dùng nhãn "Tiếp tục học".

Hiển thị:

* Trạng thái `Đã hoàn thành`.
* CTA phụ `Xem lại bài học cuối`.

CTA dẫn tới topic published cuối cùng theo course order.

#### Course không có topic published

Hiển thị trạng thái:

```text
Khóa học hiện chưa có nội dung học khả dụng.
```

Không hiển thị CTA tiếp tục học.

---

## 4. Minimal workspace route seam

Hiện tại route nhận `[topic-slug]` nhưng `LearningWorkspace` luôn chọn topic đầu tiên.

B2 phải sửa tối thiểu để CTA dashboard hoạt động đúng.

### Thay đổi bắt buộc

1. `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx`

   * Đọc `topic-slug`.
   * Truyền giá trị xuống workspace dưới dạng `initialTopicSlug`.

2. `LearningWorkspace`

   * Nhận prop `initialTopicSlug`.
   * Tìm topic tương ứng trong danh sách topic mà user được phép truy cập.
   * Dùng topic đó làm initial current lesson/topic.

3. Fallback

   * Nếu slug không tồn tại hoặc không khả dụng, fallback về topic hợp lệ đầu tiên.
   * Nếu course không có topic khả dụng, render empty state thích hợp.

### Không làm trong B2

* Không cập nhật URL khi user chuyển lesson trong sidebar.
* Không đồng bộ state khi browser back/forward.
* Không biến URL thành source of truth hoàn chỉnh.
* Không refactor toàn bộ workspace navigation.

Các phần đó vẫn thuộc C2.

---

## 5. Data contract cho dashboard

Tạo một dashboard-oriented read contract thay vì để UI tự ghép nhiều cấu trúc database.

DTO đề xuất:

```ts
type LearnDashboardData = {
  courses: LearnDashboardCourse[];
  reviewSummary: ReviewSummary;
  pendingPayments: PendingPaymentSummary[];
  pendingPaymentCount: number;
};

type LearnDashboardCourse = {
  enrollmentId: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseThumbnailUrl: string | null;

  totalTopicCount: number;
  completedTopicCount: number;
  progressPercentage: number | null;

  status:
    | "not-started"
    | "in-progress"
    | "completed"
    | "no-content";

  nextTopic: {
    slug: string;
    title: string;
    chapterTitle: string;
  } | null;

  lastTopic: {
    slug: string;
    title: string;
    chapterTitle: string;
  } | null;
};

type ReviewSummary = {
  totalCardCount: number;
  learningCardCount: number;
  dueCardCount: number;
};

type PendingPaymentSummary = {
  paymentId: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  status: "creating" | "pending";
  createdAt: string;
  expiresAt: string | null;
};
```

Tên field có thể được điều chỉnh theo convention hiện tại của repo, nhưng UI không nên nhận raw Supabase rows.

---

## 6. Server-side read flow

Tạo hoặc tách một action/query dành riêng cho learner dashboard.

Ví dụ trách nhiệm:

```text
getLearnDashboard()
```

### Query responsibilities

1. Xác thực user bằng `supabase.auth.getUser()`.
2. Lấy enrollment của user.
3. Join course metadata cần thiết.
4. Chỉ lấy course published và chưa soft-delete.
5. Lấy chapter/topic published, chưa soft-delete cho các course đó.
6. Lấy `user_topic_progress` của user cho các topic liên quan.
7. Tạo progress và next-topic DTO.
8. Lấy flashcard summary.
9. Lấy active pending payments.
10. Trả về validated dashboard DTO.

Không cho client component tự gọi riêng nhiều action để tự ráp dashboard nếu có thể tránh được.

---

## 7. Query và aggregation strategy

### Course và topic progress

Ưu tiên query theo tập course của user thay vì query từng course trong vòng lặp.

Tránh N+1:

* Không query chapter/topic riêng cho từng enrollment.
* Không query progress riêng cho từng course.
* Không query payment riêng cho từng course.

Có thể thực hiện một nhóm query hữu hạn:

1. Enrollments + course.
2. Chapters/topics thuộc các course.
3. Topic progress thuộc user và topic liên quan.
4. Flashcard summary.
5. Pending payments.

Sau đó aggregate trong server action nếu dataset hiện tại vẫn hợp lý.

Không thêm RPC hoặc view chỉ để tối ưu sớm khi chưa có bằng chứng cần thiết.

---

### Flashcard summary

Logic hiện tại trong `getUserDashboardOverview()` có thể được tái sử dụng hoặc tách ra, nhưng contract mới nên chỉ trả về summary cần thiết:

* total;
* learning;
* due.

Không đưa toàn bộ `user_flashcards` raw data xuống client.

Nếu query hiện tại đọc toàn bộ flashcard rows rồi tính trong JavaScript, có thể giữ trong B2 nếu quy mô vẫn phù hợp và không mở rộng scope. Ghi lại performance follow-up nếu cần.

---

### Pending payments

Chỉ lấy active statuses phù hợp với payment contract hiện tại:

* `creating`
* `pending`

Sắp xếp mới nhất trước.

Dashboard mặc định hiển thị ba payment đầu tiên nhưng server contract nên trả:

* danh sách active pending payment cần thiết cho "xem tất cả";
* hoặc ba item cùng tổng count, tùy UI implementation.

Không cập nhật payment status trong dashboard.

---

## 8. Pending-payment presentation

### Mặc định

Hiển thị tối đa ba pending payment mới nhất.

Nếu có nhiều hơn ba, hiển thị CTA:

```text
Xem tất cả thanh toán đang chờ (N)
```

CTA có thể mở:

* expandable section;
* sheet;
* hoặc dialog hiện có phù hợp với component system.

Không tạo dedicated payment route trong B2 trừ khi repo đã có route rõ ràng để tái sử dụng.

### Mỗi reminder

Hiển thị tối thiểu:

* tên course;
* trạng thái thanh toán;
* thời gian tạo hoặc hết hạn nếu có;
* CTA quay lại course detail/payment flow;
* nút dismiss.

CTA payment dẫn về canonical public course detail:

```text
/courses/[course-slug]
```

Payment flow chính xác vẫn thuộc course-detail/payment action hiện tại.

### Dismissal

* Dismiss theo `paymentId`.
* Chỉ ẩn reminder ở client.
* Không mutate database.
* Có thể dùng `sessionStorage` theo quyết định tài liệu hiện tại.
* Không ẩn các payment khác của cùng course nếu `paymentId` khác.
* Payment không còn active sẽ tự biến mất sau lần tải dữ liệu tiếp theo.

---

## 9. Dashboard UI structure

Trang `/learn` nên giữ learner dashboard làm trọng tâm.

Cấu trúc đề xuất:

### Header

* Tiêu đề dashboard.
* Lời chào hoặc mô tả ngắn nếu phù hợp với design system hiện tại.
* Không thêm decoration hoặc analytics không cần thiết.

### Review summary

* Số flashcard đến hạn.
* CTA mở review flow hiện có.
* Reuse `ReviewSheet`, `FlashcardStage` và actions hiện tại nếu có thể.
* Không tạo `/learn/review`.

### Pending-payment reminders

* Hiển thị khi có active payment.
* Tối đa ba item mặc định.
* Có "Xem tất cả" nếu cần.

### Enrolled courses

Mỗi card hiển thị:

* thumbnail;
* title;
* progress;
* completed/total topic;
* next topic hoặc completion state;
* CTA phù hợp.

### Empty state

Nếu user không có enrolled published course:

* Hiển thị empty state learner-focused.
* Có CTA quay về public catalog/course discovery.
* Không đề cập draft/pending collaborator courses trong B2.

---

## 10. Profile responsibility cleanup

`/profile` hiện đang chứa learner-dashboard responsibility thông qua `CoursesPlaceholder`.

B2 phải:

1. Gỡ phần enrolled-course dashboard khỏi `/profile`.
2. Gỡ hoặc relocate review entry nếu nó thuộc learning dashboard.
3. Giữ `/profile` tập trung vào thông tin tài khoản/cá nhân.
4. Không xóa component/action cũ cho đến khi các dependency đã được di chuyển hoàn chỉnh.
5. Xóa code chết sau khi xác nhận không còn import.

Nếu sidebar profile có item điều hướng learner dashboard, cập nhật nó trỏ tới `/learn`.

Không broad-refactor toàn bộ profile UI.

---

## 11. Header/navigation discoverability

Kiểm tra navigation hiện tại.

Nếu chưa có learner entry rõ ràng, bổ sung link `/learn` ở vị trí phù hợp cho authenticated learner.

Phạm vi chỉ gồm:

* link hoặc menu item cần thiết;
* active-state nếu convention hiện tại hỗ trợ.

Không refactor toàn bộ desktop/mobile header.

---

## 12. Zod và action boundary

Theo skill hiện tại của repo:

* Validate input action bằng Zod nếu action nhận input.
* Validate hoặc parse cấu trúc output tại server boundary khi phù hợp.
* Không expose raw Supabase error object cho client.
* Trả result contract thống nhất với codebase.
* Authentication failure và query failure phải có trạng thái rõ ràng.

Dashboard read action không có input phức tạp ngoài authenticated user nên không cần tạo schema giả tạo. Tuy nhiên DTO output phải ổn định và typed.

---

## 13. Database policy

B2 không mặc định tạo migration.

Dữ liệu hiện có đủ để triển khai:

* `enrollments`
* `courses`
* `chapters`
* `topics`
* `user_topic_progress`
* `user_flashcards`
* `payments`

Chỉ đề xuất index/migration khi trong quá trình triển khai có bằng chứng cụ thể từ:

* query plan;
* realistic data volume;
* timeout;
* hoặc missing constraint thực sự.

Không tự sửa schema drift `idx_enrollments_course_id` trong B2. Ghi riêng nếu connected environment vẫn thiếu migration đã được tài liệu B1 nhắc tới.

Không đọc production user rows ngoài phạm vi cần thiết để manual QA với tài khoản kiểm thử được cho phép.

---

## 14. Implementation checkpoints

### Checkpoint 1 — Dashboard data contract

* Tạo types/DTO.
* Tạo hoặc refactor dashboard read action.
* Implement filtering published/non-deleted.
* Implement course-topic ordering.
* Implement progress aggregation.
* Implement next-topic and last-topic resolution.
* Implement review summary.
* Implement pending-payment summary.

Kết quả cần đạt:

* Server trả dữ liệu hoàn chỉnh, không phụ thuộc UI.
* Không N+1.
* Không migration.

---

### Checkpoint 2 — Unit/action tests

Viết test cho:

* unauthenticated user;
* không có enrollment;
* enrollment course published;
* draft/pending course bị loại;
* soft-deleted course bị loại;
* soft-deleted chapter bị loại, unpublished topic bị loại;
* chapter rỗng bị bỏ qua;
* chưa học topic nào;
* một phần course đã hoàn thành;
* topic cuối chapter chuyển sang chapter sau;
* nhiều chapter rỗng liên tiếp;
* học không theo thứ tự;
* toàn bộ topic hoàn thành;
* course không có topic published;
* pending payments được sort mới nhất;
* flashcard due summary đúng.

Mock boundary theo pattern hiện có của repo.

---

### Checkpoint 3 — Minimal workspace route support

* Truyền `topic-slug` xuống workspace.
* Resolve initial topic.
* Fallback an toàn.
* Không làm full synchronization.

Test:

* URL topic hợp lệ mở đúng topic.
* URL topic không tồn tại fallback hợp lệ.
* Course không có topic render empty state.
* Initial topic không bị reset về topic đầu tiên sau render.

---

### Checkpoint 4 — `/learn` UI

* Thay placeholder.
* Render review summary.
* Render pending-payment reminders.
* Render course cards.
* Render loading/error/empty states.
* Render đúng CTA theo course status.
* Bảo đảm responsive theo design system hiện có.

Không thêm tab chưa xuất bản trong checkpoint này.

---

### Checkpoint 5 — Payment reminder interaction

* Chỉ hiện ba item mặc định.
* Implement "Xem tất cả".
* Implement dismiss theo paymentId.
* Persist dismiss trong session storage.
* Link payment CTA về public course detail.

Test dismissal không ảnh hưởng payment khác.

---

### Checkpoint 6 — Profile cleanup and navigation

* Gỡ dashboard learner khỏi `/profile`.
* Relocate/reuse review components.
* Cập nhật navigation tới `/learn`.
* Xóa imports/components chết nếu không còn dùng.

---

### Checkpoint 7 — Documentation reconciliation

Cập nhật:

* `docs/refactors/student-user-flow-route/plan.md`
* `docs/refactors/student-user-flow-route/progress.md`
* `docs/refactors/student-user-flow-route/problems.md`
* ADR nếu route responsibility statement cần phản ánh trạng thái mới.

Nội dung cần ghi:

* B1 đã merge qua PR #46.
* B2 được triển khai sau B1.
* `/learn` trở thành learner dashboard.
* `/profile` không còn sở hữu learner dashboard.
* Minimal initial-topic route seam được làm trong B2.
* Full synchronization vẫn deferred C2.
* Collaborator unpublished-course tab deferred.
* Không có DB migration trong B2.
* Schema drift của `idx_enrollments_course_id` vẫn là follow-up nếu chưa được xác minh.

---

## 15. Test strategy

### Targeted unit tests

* Dashboard action/query tests.
* Next-topic algorithm tests.
* Payment reminder presentation tests.
* Workspace initial topic tests.
* Profile cleanup/navigation tests nếu có behavior thay đổi.

### Integration tests

Kiểm tra server action với Supabase mock/boundary hiện có:

* auth;
* RLS-compatible query flow;
* output DTO;
* empty/error states.

### E2E hoặc route-level test

Tối thiểu kiểm tra:

1. Authenticated learner mở `/learn`.
2. Thấy published enrolled course.
3. Không thấy draft/pending/soft-deleted course.
4. Bấm "Tiếp tục học".
5. URL chứa đúng next-topic slug.
6. Workspace mở đúng topic tương ứng.
7. Completed course hiển thị "Xem lại bài học cuối".
8. Pending payment CTA về đúng public course page.
9. `/profile` không còn duplicate course dashboard.

### Manual QA matrix

* User chưa có enrollment.
* User có một course chưa bắt đầu.
* User có course đang học.
* User đã hoàn thành một chapter.
* Chapter tiếp theo rỗng.
* Nhiều chapter liên tiếp rỗng.
* Course hoàn thành.
* Course không có topic.
* User có flashcard đến hạn.
* User có 0, 1, 3 và hơn 3 pending payments.
* Dismiss một payment reminder.
* Refresh trong cùng session.
* Desktop và mobile layout.

---

## 16. Verification commands

Chạy theo thứ tự phù hợp:

```text
npm run test:run
npm run test:integration
npx tsc --noEmit --incremental false
npm run build
```

Chạy targeted lint trên các file thay đổi.

Không dùng repository-wide lint làm blocking gate cho B2 vì baseline hiện có lỗi ngoài scope. Báo rõ:

* targeted lint result;
* repository lint baseline;
* các lỗi ngoài diff nếu có.

Chạy `git diff --check` trước commit.

---

## 17. Commit strategy

Một PR B2, chia commit theo checkpoint logic:

1. `feat(learn): add dashboard data contract`
2. `test(learn): cover dashboard progress resolution`
3. `fix(learn): honor initial topic route slug`
4. `feat(learn): build student learning dashboard`
5. `refactor(profile): move learning dashboard responsibility`
6. `docs(route-refactor): record student dashboard implementation`

Có thể gộp commit nếu diff nhỏ, nhưng không trộn docs discovery, schema changes hoặc unrelated cleanup.

---

## 18. Stop conditions

Dừng và báo owner nếu phát hiện:

* Course publication model khác với assumption đã xác minh.
* Collaborator preview đang dùng chung enrollment/progress theo cách làm thay đổi B2.
* Workspace không thể nhận initial topic nếu không refactor sâu toàn bộ C2.
* Pending payment canonical flow không thể tiếp tục từ public course page.
* RLS không cho authenticated learner đọc dữ liệu cần thiết.
* Cần migration hoặc policy change.
* Connected Supabase environment không khớp repository migration state.
* B2 buộc phải sửa ngoài learner/profile/workspace seam đã duyệt.

Không tự mở rộng scope để giải quyết các vấn đề trên.

---

## 19. Definition of Done

B2 hoàn tất khi:

* `/learn` không còn là placeholder.
* User chỉ thấy enrolled published courses chưa soft-delete.
* Progress chỉ tính published active topics.
* Next-topic algorithm xử lý đúng toàn bộ course order.
* CTA mở đúng topic trên workspace.
* Completed course cho phép xem lại topic cuối.
* Course rỗng có empty state đúng.
* Review summary hoạt động.
* Pending payment reminders hoạt động và dismiss độc lập.
* `/profile` không còn duplicate learner dashboard.
* Không có migration ngoài kế hoạch.
* Targeted tests, TypeScript và build pass.
* Manual QA chính đã hoàn thành.
* Docs Wave B được cập nhật đúng trạng thái.
* Full C2 synchronization và unpublished collaborator tab vẫn được ghi rõ là deferred.

---

## 20. Implementation outcome — 2026-07-13

### Checkpoint commits

* `05e2355 feat(learn): add student dashboard data contract`
* `f3ca302 fix(learn): honor initial topic route slug`
* `5155c55 feat(learn): build student learning dashboard`
* `951c030 refactor(profile): move learning dashboard responsibility`
* `86d1035 test(header): accept authenticated mobile identity`

### Delivered

* Added a strict dashboard DTO and authenticated grouped read flow without N+1 queries.
* Implemented enrolled-course visibility, eligible-topic filtering, ordered progress,
  first-incomplete next-topic resolution, final-topic review and no-content handling.
* Added review summary and active payment reminders with newest-first ordering, three-item
  default view, view-all, session dismissal by `paymentId` and canonical public detail links.
* Honored a valid route topic slug as the workspace initial topic with safe invalid/empty
  fallback, without introducing full C2 synchronization.
* Replaced the `/learn` placeholder, moved learner dashboard responsibility out of `/profile`
  and exposed `/learn` in authenticated desktop/mobile navigation.
* Added focused action, pure-logic, component, responsibility and route-seam tests.

The database column present in repository migrations and generated types is
`user_topic_progress.is_topic_completed`. The implementation therefore uses
`is_topic_completed = true`; it does not introduce the nonexistent shorthand column
`topic_completed`. Chapter visibility uses only `removed_at IS NULL` and never invents a
`chapter.status` field.

### Verification result

* Focused tests for dashboard, workspace, profile and header: passed.
* `npm run test:run`: passed, 36 files / 342 tests.
* `npm run test:integration`: passed outside the filesystem sandbox, 9 files / 65 tests.
  The initial sandbox run was blocked only by Supabase CLI telemetry write permissions.
* `npx tsc --noEmit --incremental false`: passed.
* Targeted ESLint for changed TypeScript/TSX files: passed.
* `npm run build`: passed outside the network sandbox. The initial sandbox run could not
  fetch the repository's existing Google Fonts dependency.
* `git diff --check`: passed before implementation checkpoints and is rerun for the final
  documentation checkpoint.

### Manual QA and remaining gaps

Authenticated local browser smoke QA passed for the `/learn` no-course state, `/profile`
responsibility cleanup, authenticated `/learn` navigation, unauthenticated redirect and a
clean browser console. The seeded learner had no enrollments or active payments, and the
browser viewport override did not produce a true 375 px viewport. Data-rich course/payment
states and a real mobile visual pass therefore remain pending before merge-readiness sign-off;
their observable behavior is covered by automated action/component tests.

No migration, RLS/policy, RPC, function, trigger, view, service-role bypass or production data
change was made. Full C2 URL synchronization, unpublished collaborator preview, B3 legacy
detail redirect and deeper review/payment UX remain deferred as planned.
