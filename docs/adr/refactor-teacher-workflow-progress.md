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
| PR1: Fix Course Authoring Trust Issues | Đã merge | Không có dependency | PR #24 / merge commit `06fbf21` từ `fix/course-authoring-trust-issues` | 2026-06-14 | Git history trên `main` xác nhận PR1 đã merge; metadata cũ trong tracker đã stale. |
| PR2: Establish Course Workspace Routes | Sẵn sàng code review | PR1 đã có trên `main` | `feat/course-workspace-routes` | 2026-06-14 | Implementation complete; final manual QA đã được user approve; automated verification pass; Part 5 insertion bug defer sang bugfix riêng; chưa merge. |
| PR3: Define Dashboard Readiness Contract | Chưa bắt đầu | Chờ PR2 | Chưa có | 2026-06-14 | Readiness semantics chưa được triển khai. |
| PR4: Refine Structure Workspace | Chưa bắt đầu | Chờ PR2; có thể merge trước PR3 | Chưa có | 2026-06-14 | Structure workspace refactor chưa được triển khai. |
| PR5: Build Task-First Course Dashboard | Chưa bắt đầu | Chờ PR3 và PR4 ổn định | Chưa có | 2026-06-14 | Dashboard UI chưa được triển khai. |
| PR6: Add Issue Deep Links and Local Return Feedback | Chưa bắt đầu | Chờ PR5 | Chưa có | 2026-06-14 | Issue deep links và return feedback chưa được triển khai. |
| PR7: Add Accessible Chapter and Topic Ordering | Chưa bắt đầu | Chờ PR4 | Chưa có | 2026-06-14 | MVP ordering work chưa được triển khai. |
| PR8: Add Secure Teacher Analytics Contract | Post-MVP | Chờ PR3 và explicit analytics approval | Chưa có | 2026-06-14 | Analytics contract được defer. |
| PR9: Render Conditional Learner Analytics | Post-MVP | Chờ PR8 | Chưa có | 2026-06-14 | Analytics UI được defer. |
| PR10: Harden Course Workspace QA | Chưa bắt đầu | Chờ PR1-PR7; nếu analytics ship cùng release thì chạy sau PR9 | Chưa có | 2026-06-14 | Release hardening đang chờ. |

## PR1: Fix Course Authoring Trust Issues

- Trạng thái: Đã merge
- Dependencies: không có
- Branch / PR: PR #24 / merge commit `06fbf21`; source branch `fix/course-authoring-trust-issues`
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

- Trạng thái: Sẵn sàng code review
- Dependencies: PR1 đã được xác minh trên `main`
- Branch / PR: `feat/course-workspace-routes`
- Cập nhật lần cuối: 2026-06-14

### Vấn đề

Course workspace routes chưa tách bạch trách nhiệm. `/courses/[id]` đang là nơi quản lý structure, trong khi target architecture cần `/courses/[id]` là overview/dashboard và `/courses/[id]/structure` là structure workspace. Overview route không được trở thành blank hoặc "coming soon".

Audit trước khi sửa xác nhận:

- `/courses/[id]` render client-side structure builder, gọi `verifyCourseAccess`, `getChaptersByCourseId`, `getCourseStats`, `createChapter`, và `deleteChapter`.
- Chapter/topic structure management nằm trong `/courses/[id]/page.tsx`, `ChapterList`, `TopicManagementSheet`, `ChapterFormModal`, và `DeleteChapterModal`.
- `/courses/[id]/topics` tồn tại nhưng blank với `return null`.
- Course list mở course qua `/courses/${course.id}`.
- Topic builder links dùng `getTopicBuilderPath(courseId, topic.id)` và settings/trash dùng `getTopicBuilderPath(courseId, topic.id, "settings")`.
- Topic builder ở `/courses/[id]/topics/[topicId]` dùng `TopicBuilderTabs`; PR1 `settings` tab còn nguyên.
- Access behavior hiện có dựa trên Supabase query/RLS và `verifyCourseAccess`; không có `notFound()` pattern cho các route này.

### Giải pháp dự kiến hoặc đã thực hiện

Đã thực hiện route contract:

- `/courses/[id]` render minimal useful overview với title, status, description, slug, price, role, order index, content summary đọc từ helper hiện có, link về `/courses`, và CTA rõ sang `/courses/[id]/structure`.
- `/courses/[id]/structure` nhận trách nhiệm chapter/topic structure bằng cách dùng `CourseStructureWorkspace`, tránh duy trì hai bản implementation structure độc lập.
- `/courses/[id]/topics` redirect có chủ đích sang `/courses/[id]/structure` vì route cũ là blank/dead.
- Topic builder tiếp tục ở `/courses/[id]/topics/[topicId]`; `BackButton` và delete success trong settings tab điều hướng về `/courses/[id]/structure` thay vì phụ thuộc browser history.
- Course list vẫn mở course ở `/courses/[id]`, nhưng label được đổi thành "Mở tổng quan khóa học" để mô tả đúng destination.
- Approved visual QA amendment đã làm overview dễ quét hơn bằng các summary cards có tone nhẹ, giữ primary CTA "Quản lý cấu trúc", và đổi link phụ "Mở structure workspace" thành Button composition rõ affordance.
- Approved visual QA amendment đã giảm excessive pill radius trong các bề mặt course/topic exercise authoring được chạm, ưu tiên `rounded-lg`/`rounded-xl` theo vai trò control/container; radio tròn và compact status badge dạng pill được giữ nguyên.

### Giải quyết được gì

Tạo nền route ổn định cho dashboard, structure workspace, deep links, và manual QA ở cấp route:

- `/courses/[id]` không còn là structure editor hoặc route trống.
- Structure management có destination ổn định ở `/courses/[id]/structure`.
- Topic authoring path và `settings` context của PR1 vẫn giữ nguyên.
- Intermediate route blank `/courses/[id]/topics` không còn render null.

### Phạm vi thực tế

Routes:

- `app/(teacher)/courses/[id]/page.tsx`
- `app/(teacher)/courses/[id]/structure/page.tsx`
- `app/(teacher)/courses/[id]/topics/page.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/page.tsx`

Components/helpers:

- `app/(teacher)/courses/[id]/_components/CourseOverview.tsx`
- `app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx`
- `app/(teacher)/courses/[id]/_components/topic-builder-path.ts`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/BackButton.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/AddExerciseDialog.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/QuestionGroupMediaField.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx`
- `app/(teacher)/courses/_components/CourseList.tsx`

Tests/docs:

- `__tests__/components/course-workspace-routes.test.tsx`
- `docs/adr/refactor-teacher-workflow-progress.md`

Không thay đổi migrations, RLS, RPCs, tables/columns, admin review/publish, collaborator persistence, readiness contract, analytics contract, ordering mutations, hoặc generated database types.

### Kiểm thử tự động

- `git status --short` trước branch: clean.
- `git fetch --all --prune` - passed sau khi chạy ngoài sandbox vì `.git/FETCH_HEAD` bị sandbox chặn.
- `git switch main` - passed sau khi chạy ngoài sandbox vì `.git/index.lock` bị sandbox chặn.
- `git pull --ff-only origin main` - passed sau khi chạy ngoài sandbox; already up to date.
- `git switch -c feat/course-workspace-routes` - passed sau khi chạy ngoài sandbox vì tạo branch cần ghi `.git/refs`.
- `npx.cmd tsc --noEmit` - passed.
- `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx` - passed; 1 file, 4 tests.
- `npm.cmd run test:run -- __tests__/components/course-authoring-trust.test.tsx` - passed; 1 file, 9 tests.
- `npm.cmd run lint -- "app/(teacher)/courses/[id]/page.tsx" "app/(teacher)/courses/[id]/structure/page.tsx" "app/(teacher)/courses/[id]/_components/CourseOverview.tsx" "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "app/(teacher)/courses/[id]/_components/topic-builder-path.ts" "app/(teacher)/courses/[id]/topics/page.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/page.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/BackButton.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx" "app/(teacher)/courses/_components/CourseList.tsx" "__tests__/components/course-workspace-routes.test.tsx"` - passed.
- `npm.cmd run lint -- "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "__tests__/components/course-workspace-routes.test.tsx"` - passed sau breadcrumb update.
- `npm.cmd run test:run` - passed; 15 files, 109 tests.
- `git diff --check` - passed; chỉ có warning line-ending `LF will be replaced by CRLF the next time Git touches it`.

Sau approved visual QA amendment:

- `npx.cmd tsc --noEmit` - passed.
- `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx` - passed; 1 file, 4 tests.
- `npm.cmd run test:run -- __tests__/components/course-authoring-trust.test.tsx` - passed; 1 file, 9 tests.
- `npm.cmd run test:run` - passed; 15 files, 109 tests.
- `npm.cmd run lint -- "app/(teacher)/courses/[id]/_components/CourseOverview.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/AddExerciseDialog.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/QuestionGroupMediaField.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx" "__tests__/components/course-workspace-routes.test.tsx"` - passed với 2 warning hiện có trong `AddExerciseDialog.tsx`: unused `handleFormSubmit` và React Compiler `react-hooks/incompatible-library` quanh `form.watch(...)`; không sửa vì nằm ngoài visual amendment và có thể chạm logic exercise.
- `git diff --check` - passed; chỉ có warning line-ending `LF will be replaced by CRLF the next time Git touches it`.

### Manual QA

Final manual QA đã được user hoàn tất và approve cho scope/implementation PR2 hiện tại. Checklist đã được user kiểm tra:

1. Mở `/courses`.
2. Mở một khóa học hiện có.
3. Xác nhận `/courses/[id]` hiển thị overview tối thiểu hữu ích.
4. Mở structure workspace.
5. Xác nhận URL là `/courses/[id]/structure`.
6. Xác nhận chapters và topics vẫn render.
7. Mở một topic builder.
8. Refresh overview route.
9. Refresh structure route.
10. Refresh topic builder route.
11. Dùng browser Back qua topic builder → structure → overview → course list.
12. Kiểm tra desktop và mobile widths.
13. Kiểm tra access/not-found behavior với course ID sai hoặc không có quyền.
14. Xác nhận PR1 delete dialogs và topic `settings` navigation vẫn hoạt động đúng.
15. Kiểm tra overview summary cards dễ quét hơn và không biến thành dashboard/readiness UI.
16. Xác nhận top primary CTA "Quản lý cấu trúc" vẫn nổi bật.
17. Xác nhận CTA phụ "Mở structure workspace" nhìn như hành động có thể bấm, không còn giống plain text.
18. Kiểm tra các controls trong exercise authoring giảm pill radius hợp lý, trong khi radio tròn và compact status badge dạng pill vẫn giữ đúng.

### Sai lệch và phát hiện mới

- Tracker metadata của PR1 đã stale: Git history trên `main` xác nhận `06fbf21 Merge pull request #24 from khangdz2005k/fix/course-authoring-trust-issues`, nên PR1 đã merge dù tracker cũ nói còn chờ push/review/merge.
- `/courses/[id]/topics` thật sự là blank route (`return null`) trước PR2; PR2 đổi thành redirect sang structure để không để lại dead route.
- Overview dùng metadata hiện có từ `getCoursesForTeacher` và content counts hiện có từ `getCourseStats`; không thêm contract readiness, analytics, hay dashboard PR5.
- Manual QA feedback sau PR2 implementation đầu tiên ghi nhận overview quá flat và một số controls trong course/topic exercise authoring quá pill-shaped; visual amendment chỉ xử lý affordance/scannability và radius, không thêm dashboard PR5 hoặc đổi exercise data flow.
- Manual QA ghi nhận bug riêng khi tạo exercise Part 5: repro là mở create-exercise form, chọn `Part 5: Incomplete Sentences (Reading)`, nhập title, question content, answer explanation, bốn answer options, chọn một đáp án đúng, rồi submit; actual là UI báo generic error `Vui lòng kiểm tra lại các trường chưa hợp lệ.` và exercise không được insert; expected là Part 5 hợp lệ được insert giống các part khác. Các part khác insert bình thường. Sau failed Part 5 attempt, chuyển type sang Part 1 làm lộ field-level message như `Vui lòng nhập nội dung câu hỏi`. Root cause chưa được điều tra; chưa kết luận lỗi thuộc frontend state, Zod, payload, action, hay database.
- Không chạy dev server, smoke test, route smoke test, page smoke test, E2E, Playwright, Cypress, hoặc browser automation theo đúng scope PR2.

### Blocker và follow-up

- Không có implementation blocker hiện tại.
- PR2 implementation complete, final manual QA đã đạt theo user approval, và branch sẵn sàng code review sau commit/push.
- Bug tạo exercise Part 5 được defer sang một scoped exercise-authoring bugfix riêng; PR2 không sửa schema/action/payload/mutation/database cho bug này.
- PR3 readiness contract, PR4 structure workspace refinement, PR5 dashboard visual/task-first work, PR6 deep links/return feedback, PR7 ordering, analytics PR8/PR9, và PR10 hardening vẫn ngoài phạm vi PR2.
- Chưa merge.

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

## Exercise authoring smoke E2E

- Trạng thái: Architectural cleanup complete; automated validation passed.
- Branch / reference: `test/exercise-authoring-smoke-e2e`.
- Cập nhật lần cuối: 2026-06-15.
- Phạm vi: giữ root `supabase/config.toml` khớp `origin/main`, tách isolated Supabase runtime vào `.e2e-runtime/supabase`, thêm generic `scripts/e2e/run-e2e.mjs`, chuyển fixture exercise sang `scripts/e2e/exercise-authoring-fixture.mjs`, và đặt spec tại `e2e/smoke/exercise-authoring.smoke.spec.ts`.
- Verification: `npm run test:e2e:smoke:exercise` passed twice; `npm run test:e2e:smoke` passed; `npx.cmd tsc --noEmit --incremental false` passed; changed-file ESLint passed; related exercise unit tests passed 6 files / 67 tests; related exercise integration tests passed 2 files / 29 tests; `git diff --check` passed.
- Ghi chú: runtime Supabase được copy từ root `supabase/`, chỉ patch runtime `config.toml` với `project_id = "voca_space_e2e"` và port `5544x`; E2E env lấy động bằng `supabase --workdir .e2e-runtime status -o env`.
