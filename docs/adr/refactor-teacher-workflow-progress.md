# Theo dõi tiến độ tái cấu trúc quy trình làm việc của giáo viên

## Tài liệu liên quan

Nguồn plan chính thức: [refactor-teacher-workflow-plan.md](./refactor-teacher-workflow-plan.md).

## Chú giải trạng thái

- Chưa bắt đầu
- Đang thực hiện
- Implementation complete
- Manual QA đã đạt
- Sẵn sàng code review
- Đã merge
- Bị chặn
- Deferred
- Post-MVP

## Tổng quan tiến độ

| PR | Trạng thái | Trạng thái phụ thuộc | Branch / PR reference | Cập nhật lần cuối | Ghi chú ngắn |
| --- | --- | --- | --- | --- | --- |
| PR1: Fix Course Authoring Trust Issues | Đã commit - đang chờ push/code review/merge | Không có dependency | `fix/course-authoring-trust-issues` | 2026-06-14 | Implementation đã được commit trong branch hiện tại; user đã báo functional QA và visual QA cuối cho delete dialog đều đạt; chưa push, review, hoặc merge trong Git state hiện tại. |
| PR2: Establish Course Workspace Routes | Chưa bắt đầu | Chờ PR1 merge hoặc được chấp nhận làm baseline | Chưa có | 2026-06-14 | Route architecture work chưa bắt đầu. |
| PR3: Define Dashboard Readiness Contract | Chưa bắt đầu | Chờ PR2 | Chưa có | 2026-06-14 | Readiness semantics chưa được triển khai. |
| PR4: Refine Structure Workspace | Chưa bắt đầu | Chờ PR2; có thể merge trước PR3 | Chưa có | 2026-06-14 | Structure workspace refactor chưa được triển khai. |
| PR5: Build Task-First Course Dashboard | Chưa bắt đầu | Chờ PR3 và PR4 ổn định | Chưa có | 2026-06-14 | Dashboard UI chưa được triển khai. |
| PR6: Add Issue Deep Links and Local Return Feedback | Chưa bắt đầu | Chờ PR5 | Chưa có | 2026-06-14 | Issue deep links và return feedback chưa được triển khai. |
| PR7: Add Accessible Chapter and Topic Ordering | Chưa bắt đầu | Chờ PR4 | Chưa có | 2026-06-14 | MVP ordering work chưa được triển khai. |
| PR8: Add Secure Teacher Analytics Contract | Post-MVP | Chờ PR3 và explicit analytics approval | Chưa có | 2026-06-14 | Analytics contract được defer. |
| PR9: Render Conditional Learner Analytics | Post-MVP | Chờ PR8 | Chưa có | 2026-06-14 | Analytics UI được defer. |
| PR10: Harden Course Workspace QA | Chưa bắt đầu | Chờ PR1-PR7; nếu analytics ship cùng release thì chạy sau PR9 | Chưa có | 2026-06-14 | Release hardening đang chờ. |

## PR1: Fix Course Authoring Trust Issues

- Trạng thái: Đã commit - đang chờ push/code review/merge
- Dependencies: không có
- Branch / PR: `fix/course-authoring-trust-issues`; implementation đã commit trên branch hiện tại; chưa thấy push/PR/merge trong Git state hiện tại
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Course authoring có nhiều trust defects độc lập trước khi đổi route workspace:

- `/courses/new` từng là blank route.
- CTA tạo khóa học và route tạo khóa học chưa có entry point rõ ràng.
- Teacher course query thiếu `reject_message` trong khi UI/type boundary cần hiển thị lý do reject.
- Delete dialogs dùng hoặc từng dùng wording gây hiểu nhầm về hard delete trong khi hành vi thật là soft-delete.
- Collaborator flow có nguy cơ báo thành công dù không persist collaborator.
- First-submit validation có thể focus/outline field lỗi nhưng chưa render error text ngay.
- Delete confirmation thiếu identity rõ cho item đang bị thao tác.
- Topic trash affordance có thể đưa user vào ngữ cảnh edit content thay vì deletion settings.

### Giải pháp dự kiến hoặc đã thực hiện

Đã thực hiện trong working tree hiện tại:

- `/courses/new` dùng lại `CourseForm`, `courseSchema`, và `createCourse`.
- Course-list create CTA trỏ tới `/courses/new`.
- Trang `/courses` chỉ dùng inline form cho edit course hiện có.
- `getCoursesForTeacher` query lấy `reject_message` và `reviewed_at`.
- Runtime schemas trong `lib/schemas/course.ts` parse row/course shape an toàn hơn.
- Rejected-course UI chỉ hiển thị khi course là draft, có `reviewed_at`, và `reject_message` có nội dung sau `trim`.
- Course/chapter/topic delete copy dùng soft-delete/hide/trash wording thay vì "Xóa vĩnh viễn".
- Collaborator controls bị disabled với unavailable explanation; `addCollaborator` validate input rồi trả explicit unavailable error.
- Shared `FormMessage` subscribe field-scoped state bằng `useFormState`, giúp first-submit errors render ổn định.
- Deprecated PR1-related Zod format APIs được cập nhật trong course schema, ví dụ `z.uuid()` và `z.email()`.
- Meaningless `app/(teacher)/courses/_components/types.ts` re-export đã bị xóa; imports dùng trực tiếp `TeacherCourse` từ `lib/schemas/course`.
- Course/chapter/topic confirmations nhận diện item đang thao tác.
- `ConfirmDialog` có generic `details?: ReactNode` slot thay vì course-specific `imageUrl` API.
- Dialog sizing, spacing, preview hierarchy, và button shape đã được refine.
- Topic trash affordance điều hướng tới `settings` context qua `getTopicBuilderPath(courseId, topic.id, "settings")`.

### Giải quyết được gì

PR1 loại bỏ các tín hiệu sai lệch trước khi thay route architecture: không còn blank create route, không còn fake collaborator success, lý do reject có boundary rõ, delete copy không hứa hard delete, validation feedback đáng tin hơn, và destructive confirmations cho biết item nào bị ảnh hưởng.

### Phạm vi thực tế

Files tracked đang thay đổi theo `git diff --name-only`:

- `app/(teacher)/courses/[id]/_components/ChapterList.tsx`
- `app/(teacher)/courses/[id]/_components/DeleteChapterModal.tsx`
- `app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx`
- `app/(teacher)/courses/[id]/page.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx`
- `app/(teacher)/courses/_components/CourseForm.tsx`
- `app/(teacher)/courses/_components/CourseList.tsx`
- `app/(teacher)/courses/_components/DeleteCourseModal.tsx`
- `app/(teacher)/courses/_components/types.ts` deleted
- `app/(teacher)/courses/new/page.tsx`
- `app/(teacher)/courses/page.tsx`
- `app/actions/chapter.ts`
- `app/actions/course.ts`
- `app/actions/topic.ts`
- `components/ui/confirm-dialog.tsx`
- `components/ui/form.tsx`
- `lib/schemas/course.ts`

Untracked PR1 support files visible trong `git status` hiện tại:

- `__tests__/actions/course.test.ts`
- `__tests__/components/course-authoring-trust.test.tsx`
- `__tests__/schemas/course.test.ts`
- `app/(teacher)/courses/[id]/_components/topic-builder-path.ts`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/topic-builder-tab.ts`

### Kiểm thử tự động

Các lệnh đã chạy trong PR1 session hiện tại:

- `npm.cmd run test:run -- __tests__/components/course-authoring-trust.test.tsx` - passed; 1 file, 9 tests sau final dialog refinement.
- `npx.cmd tsc --noEmit` - passed.
- `npm.cmd run lint -- 'components/ui/confirm-dialog.tsx' 'app/(teacher)/courses/_components/DeleteCourseModal.tsx' 'app/(teacher)/courses/[id]/_components/DeleteChapterModal.tsx' 'app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx' '__tests__/components/course-authoring-trust.test.tsx'` - passed.
- `npm.cmd run test:run` - passed; 14 files, 105 tests.
- `git diff --check` - passed; chỉ có line-ending warnings.

### Manual QA

Manual QA evidence trong session hiện tại:

- User báo functional PR1 manual QA đã đạt.
- User báo visual QA cuối cho shared delete confirmation dialog đã đạt.

Tracker này không đánh dấu PR1 là reviewed, merged, hoặc đã có GitHub PR.

### Sai lệch và phát hiện mới

- `ConfirmDialog` cần generic composition slot để hiển thị course thumbnail/fallback mà không thêm domain-specific `imageUrl`.
- Visual fix chạm shared dialog layout nên đã rerun focused tests và full fast test suite.
- Final diff có untracked tests/helpers; `git diff --name-only` không liệt kê untracked files nhưng `git status` có.

### Blocker và follow-up

- Không có implementation blocker được ghi nhận.
- Còn cần commit, push, code review, và merge theo workflow Git.

## PR2: Establish Course Workspace Routes

- Trạng thái: Chưa bắt đầu
- Dependencies: PR1
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Course workspace routes chưa tách bạch trách nhiệm. `/courses/[id]` đang là nơi quản lý structure, trong khi target architecture cần `/courses/[id]` là overview/dashboard và `/courses/[id]/structure` là structure workspace. Overview route không được trở thành blank hoặc "coming soon".

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến tạo route contract:

- `/courses/[id]` render minimal useful overview.
- `/courses/[id]/structure` nhận trách nhiệm chapter/topic structure.
- Topic builder tiếp tục ở `/courses/[id]/topics/[topicId]`.

### Giải quyết được gì

Tạo nền route ổn định cho dashboard, structure workspace, deep links, và manual QA ở cấp route.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Chờ PR1 được commit/review/merge hoặc được chấp nhận làm baseline.

## PR3: Define Dashboard Readiness Contract

- Trạng thái: Chưa bắt đầu
- Dependencies: PR2
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Dashboard cần readiness semantics rõ ràng trước khi render UI: issue identity, severity, destination, primary CTA, và missing/partial data handling không nên được suy luận rời rạc trong component.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến xây dựng contract query/runtime schema cho content graph và derived issue list, kèm deterministic primary CTA selection.

### Giải quyết được gì

Cho PR5 một data contract đáng tin, giảm rủi ro dashboard hiển thị sai trạng thái authoring.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Chờ PR2 route architecture.

## PR4: Refine Structure Workspace

- Trạng thái: Chưa bắt đầu
- Dependencies: PR2
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Dashboard issue links cần dẫn tới structure workspace đáng tin. Structure UI hiện tại cần tách khỏi overview route và cần loại bỏ dead affordances trước khi dashboard phụ thuộc vào nó.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến xây dựng `/courses/[id]/structure` thành workspace quản lý chapter/topic với create/edit/delete rõ ràng, mobile/keyboard usable, và truthful soft-delete behavior.

### Giải quyết được gì

Biến structure management thành destination an toàn cho PR5/PR6.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Chờ PR2. PR4 có thể merge trước PR3.

## PR5: Build Task-First Course Dashboard

- Trạng thái: Chưa bắt đầu
- Dependencies: PR3 và PR4 ổn định
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Teachers cần overview cho biết trạng thái authoring và next action, nhưng dashboard không được render trước khi readiness contract và destinations ổn định.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến render task-first dashboard với primary CTA, readiness checklist, grouped issue list, và route actions.

### Giải quyết được gì

Biến `/courses/[id]` thành Course Dashboard / Overview thực sự.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Không bắt đầu trước khi PR3 và PR4 ổn định.

## PR6: Add Issue Deep Links and Local Return Feedback

- Trạng thái: Chưa bắt đầu
- Dependencies: PR5
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Dashboard issues cần đưa teacher tới đúng nơi sửa lỗi và hỗ trợ quay lại overview mà không biến thành hệ thống tracking issue toàn cục.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến thêm issue deep links và lightweight local return feedback sau successful mutation.

### Giải quyết được gì

Tăng hiệu quả dashboard issue list mà vẫn giữ teacher trong authoring flow.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Chờ PR5.

## PR7: Add Accessible Chapter and Topic Ordering

- Trạng thái: Chưa bắt đầu
- Dependencies: PR4
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

MVP authoring cần khả năng reorder chapter/topic bằng accessible controls, không phụ thuộc drag-and-drop hoặc nhập số thủ công.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến thêm move up/down cho chapter và topic trong cùng chapter, xử lý soft-deleted rows và failure state.

### Giải quyết được gì

Teacher có thể sắp xếp course structure deterministically trước release MVP.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Chờ PR4. Drag-and-drop và cross-chapter movement vẫn future-only.

## PR8: Add Secure Teacher Analytics Contract

- Trạng thái: Post-MVP
- Dependencies: PR3 và explicit analytics approval
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Learner analytics cần secure aggregate contract. Dashboard MVP không được đọc hoặc suy diễn từ raw learner-owned data khi chưa có boundary rõ.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến audit learner analytics và FSRS metadata trong phạm vi hẹp, rồi tạo aggregate contract với data-state vocabulary đã duyệt.

### Giải quyết được gì

Cho phép analytics UI sau này hiển thị insight có điều kiện mà không nói quá dữ liệu.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Post-MVP; cần explicit approval trước khi bắt đầu.

## PR9: Render Conditional Learner Analytics

- Trạng thái: Post-MVP
- Dependencies: PR8
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Analytics UI chỉ an toàn nếu render theo contract và state được hỗ trợ, không dựng chart trang trí hoặc unsupported claims.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến render analytics panels theo các state `No data`, `No learner activity`, `Insufficient interaction count`, `Insight available`, `Partial data`, và `Query failure`.

### Giải quyết được gì

Teacher có thể xem learner insights khi thật sự có dữ liệu đủ tin cậy.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Post-MVP; chờ PR8.

## PR10: Harden Course Workspace QA

- Trạng thái: Chưa bắt đầu
- Dependencies: PR1-PR7, hoặc PR1-PR9 nếu analytics ship cùng release
- Branch / PR: Chưa có
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Workspace refactor thay đổi route, dashboard, structure management, deep links, và ordering. Cần hardening trước release để tránh route blank, dead actions, misleading state, hoặc mobile/accessibility regressions.

### Giải pháp dự kiến hoặc đã thực hiện

Chưa thực hiện. Dự kiến chạy regression QA, bổ sung tests/docs cần thiết, và ghi rõ known risks.

### Giải quyết được gì

Tạo release confidence cho MVP workspace.

### Phạm vi thực tế

Chưa thực hiện.

### Kiểm thử tự động

Chưa thực hiện.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

Chưa có.

### Blocker và follow-up

Chờ PR1-PR7. Nếu PR8/PR9 được đưa vào cùng release, PR10 phải chạy sau PR9.

## Quy tắc cập nhật

Các session Codex sau này nên cập nhật tracker theo quy tắc sau:

1. Chỉ cập nhật summary row và section của PR đang active.
2. Ghi exact commands và actual outcomes.
3. Ghi manual QA tách biệt với automated verification.
4. Ghi phát hiện bất ngờ vào `Sai lệch và phát hiện mới`.
5. Không đổi scope của future PR nếu chưa thêm amendment vào plan document.
6. Sau khi merge, ghi merge commit hoặc PR reference nếu có.
7. Giữ timestamp dạng `YYYY-MM-DD`.
8. Không dùng tracker này thay cho commit history hoặc PR descriptions.
