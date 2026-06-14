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
| PR2: Establish Course Workspace Routes | Đã merge | PR1 đã có trên `main` | PR #25 / merge commit `ce2928e` từ `feat/course-workspace-routes` | 2026-06-14 | Implementation complete; final manual QA đã được approve; automated verification pass; Part 5 insertion bug defer sang bugfix riêng. |
| PR3: Define Dashboard Readiness Contract | Đang tái căn chỉnh sau PR4 | PR2 và PR4 đã có trên `main` | `wip/dashboard-readiness-contract-pre-pr4` | 2026-06-17 | Đã có WIP cho readiness runtime validation, bounded content-graph query, deterministic issues và primary CTA; đang rebase và audit lại theo structure workspace sau PR4; chưa triển khai dashboard UI. |
| PR4: Refine Structure Workspace | Đã merge | PR2 đã có trên `main`; PR3 không bắt buộc | PR #30 / merge commit `2113b1c` từ `feat/course-structure-workspace` | 2026-06-17 | Code review findings và manual QA follow-up đã fix; targeted tests, typecheck, lint, full fast suite và focused smoke E2E đã pass; PR4 đã merge vào `main`. |
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

- Trạng thái: Đã merge
- Dependencies: PR1 đã được xác minh trên `main`
- Branch / PR: PR #25 / merge commit `ce2928e`; source branch `feat/course-workspace-routes`
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
- PR2 đã merge trên `main` theo Git history: `ce2928e Merge pull request #25 from khangdz2005k/feat/course-workspace-routes`.
- Bug tạo exercise Part 5 được defer sang một scoped exercise-authoring bugfix riêng; PR2 không sửa schema/action/payload/mutation/database cho bug này.
- PR3 readiness contract, PR4 structure workspace refinement, PR5 dashboard visual/task-first work, PR6 deep links/return feedback, PR7 ordering, analytics PR8/PR9, và PR10 hardening vẫn ngoài phạm vi PR2.
- Chưa merge.

## PR3: Define Dashboard Readiness Contract

- Trạng thái: Đang thực hiện
- Dependencies: PR2 đã merge trên `main`; route overview `/courses/[id]`, structure workspace `/courses/[id]/structure`, và topic builder route đã tồn tại trên baseline.
- Branch / PR: `feat/dashboard-readiness-contract`
- Cập nhật lần cuối: 2026-06-14
- Baseline `main`: `ce2928e1a4e1722163439886f7d91bab08dc8f0f`

### Vấn đề

Dashboard cần readiness semantics rõ ràng trước khi render UI: issue identity, severity, destination, primary CTA, và missing/partial data handling không nên được suy luận rời rạc trong component.

### Giải pháp dự kiến hoặc đã thực hiện

Đang thực hiện. Phạm vi ban đầu: audit content graph hiện có, tạo contract query/runtime schema cho course/chapter/topic/flashcard/exercise/question-group/question/option trong phạm vi cần thiết, derive issue list deterministic và chọn primary CTA an toàn cho PR5.

### Giải quyết được gì

Cho PR5 một data contract đáng tin, giảm rủi ro dashboard hiển thị sai trạng thái authoring.

### Phạm vi thực tế

Đã tạo branch `feat/dashboard-readiness-contract` từ `main` baseline `ce2928e1a4e1722163439886f7d91bab08dc8f0f`. Chưa thay đổi production/test contract ở checkpoint này.

### Repository và data-model audit

- Existing content graph PR3 có thể đọc an toàn: course identity từ `course_collaborators`/`courses`; active chapters; active topics; active cards; active exercises; active question groups; active questions; active answer options.
- Existing access/query conventions: teacher workspace dùng `createClient()` trong Server Actions, lấy `auth.getUser()`, kiểm tra quyền course bằng `course_collaborators` join `courses!inner`, và chặn course đã xóa mềm bằng `courses.removed_at IS NULL`.
- Active versus soft-deleted semantics: các bảng content dùng `removed_at IS NULL`; chapter/topic order hiện dựa trên `order_index`, một số query thêm `created_at` làm tie-break; nested exercise graph hiện filter soft-deleted rows sau query trong action.
- Schema/type boundary: repo có handwritten `types/database.ts` và các schema domain trong `lib/schemas`; PR3 không làm generated database type alignment, mà thêm runtime schema hẹp cho readiness query.
- Query convention cần tránh reuse trực tiếp: `getCourseStats` đang count `exercises` theo `topic_id` nhưng không filter `exercises.removed_at`, nên readiness contract cần query riêng để giữ active semantics đúng.
- Exercise authoring rules đang có trong `TOEIC_PART_RULES`: grouped parts yêu cầu group/context theo part; `part5` dùng standalone questions; question hợp lệ cần ít nhất 2 active options và ít nhất 1 active correct option.

### Kiểm thử tự động

- `git status --short` trước baseline - passed; working tree sạch.
- `git fetch --all --prune` - passed sau khi chạy ngoài sandbox vì `.git/FETCH_HEAD` bị sandbox chặn.
- `git switch main` - passed sau khi chạy ngoài sandbox vì `.git/index.lock` bị sandbox chặn.
- `git pull --ff-only origin main` - passed sau khi chạy ngoài sandbox; already up to date.
- `git rev-parse HEAD` - returned `ce2928e1a4e1722163439886f7d91bab08dc8f0f`.
- Kiểm tra PR2 route files - passed; `app/(teacher)/courses/[id]/page.tsx`, `app/(teacher)/courses/[id]/structure/page.tsx`, và `app/(teacher)/courses/[id]/_components/CourseOverview.tsx` tồn tại trên `main`.
- `git switch -c feat/dashboard-readiness-contract` - passed sau khi chạy ngoài sandbox vì tạo branch cần ghi `.git/refs`.

### Manual QA

Chưa thực hiện.

### Sai lệch và phát hiện mới

- Tracker metadata của PR2 đã stale: Git history trên `main` xác nhận `ce2928e Merge pull request #25 from khangdz2005k/feat/course-workspace-routes`, nên PR2 đã merge dù tracker cũ còn ghi sẵn sàng code review/chưa merge.
- `getCourseStats` không đủ chặt cho readiness vì thiếu filter `removed_at` ở exercises; PR3 sẽ không dùng helper này làm nguồn sự thật cho contract.
- `types/database.ts` là handwritten type layer, trong khi DB migrations đã bổ sung/siết một số trường như `question_options.order_index`; PR3 giới hạn mismatch bằng runtime schema riêng thay vì align repo-wide.

### Blocker và follow-up

PR2 route architecture đã có trên `main`; PR3 tiếp tục với audit content graph và contract runtime validation. Chưa có blocker tại checkpoint khởi động.

## PR4: Refine Structure Workspace

- Trạng thái: Manual QA passed; ready for code review
- Dependencies: PR2 đã có trên `main`; PR4 có thể merge trước PR3
- Branch / PR: `feat/course-structure-workspace`
- Cập nhật lần cuối: 2026-06-17

### Vấn đề

Dashboard issue links cần dẫn tới structure workspace đáng tin. Discovery PR4 đã xác minh các trust defects trong structure workspace hiện tại:

- Chapter edit icon hiển thị nhưng không thực hiện edit.
- Topic edit icon trong structure sheet hiển thị nhưng không có handler.
- Chapter row dùng clickable `div` và hover-only actions, không đủ tốt cho keyboard/mobile.
- `createChapter` chỉ validate ở client, chưa validate server-side.
- Create chapter/topic đang để client hoặc form gửi `order_index`; PR4 đã chốt Server Action là source of truth cho append.
- `getCourseStats` đếm removed exercises.
- Topic thuộc chapter đã hidden cần bị chặn khỏi direct topic builder URL.

### Giải pháp dự kiến hoặc đã thực hiện

Đã thực hiện trong checkpoint 1:

- Thêm schema boundary cho chapter/topic create/update/delete metadata.
- Chuyển chapter/topic actions sang object payload và server-side Zod validation.
- Create chapter/topic tự tính `order_index = max(order_index) + 1` trên server, tính cả soft-deleted rows để tránh đụng dữ liệu cũ; không normalize/gap-fill.
- Thêm `updateChapter`, cập nhật `updateTopic`/`deleteTopic` theo object payload.
- Fix `getCourseStats` để chỉ đếm active exercises.
- Loại bỏ user-editable `order_index` khỏi chapter/topic forms.
- Structure workspace có chapter edit thật, topic quick metadata edit thật, topic hide thật, visible action buttons và retry state cho topic list.

Đã thực hiện trong checkpoint 3:

- Thêm `verifyTopicAuthoringContext` để topic builder chỉ mở khi topic active, thuộc đúng course, parent chapter active, và parent chapter thuộc đúng course.
- Direct URL `/courses/[id]/topics/[topicId]` redirect về `/courses/[id]/structure?topic_unavailable=1` khi authoring context không hợp lệ.
- Structure workspace hiển thị toast lỗi rõ ràng khi redirect từ topic builder guard.
- Bổ sung unit/route tests cho hidden-parent authoring guard.

Đã thực hiện trong checkpoint 4:

- Thêm fixture Node-only cho smoke E2E course structure, seed teacher/course/collaborator bằng service role và cleanup dữ liệu test theo prefix.
- Thêm Playwright smoke đi qua login, structure route, create chapter, create topic, edit topic metadata, hide topic, hide chapter, direct topic builder redirect khi parent chapter hidden, và DB persistence assertions.
- Fix existing E2E runner dùng relative `.e2e-runtime` cho Supabase `--workdir` để Windows workspace path có khoảng trắng không làm vỡ CLI invocation.
- Cài Playwright Chromium local để chạy smoke E2E.

Đã thực hiện trong final review/Manual QA follow-up:

- Thêm explicit course-management authorization vào `verifyTopicAuthoringContext`.
- Đổi `getCourseStats` để query failures fail loud thay vì trả false zero counts.
- Đổi `getTopicsByChapterId` để phân biệt real empty data với DB/RLS/query failures.
- Phân loại topic authoring guard theo `forbidden`, `unavailable`, và `error`; expected unavailable context redirect về structure với feedback, còn unexpected DB/RLS/query failures vẫn observable.
- Hiển thị feedback `topic_unavailable=1` ngay trên `/courses/[id]/structure`, consume param bằng `router.replace`, giữ unrelated params, và không replay toast khi refresh/history.
- Sửa copy trong `SettingsTab` để đúng non-cascading topic soft-delete semantics và không hiển thị thuật ngữ kỹ thuật `soft-delete`.
- Sửa local Radix `DialogDescription` warning cho topic hide confirmation.
- Bổ sung focused regression coverage cho authorization, false zero/empty failure paths, unavailable direct-topic redirects, consumed feedback params, copy, và dialog accessibility contract.

Đang còn lại:

- Push branch và code review/merge follow-up; chưa merge.

### Giải quyết được gì

Checkpoint 1 đã loại bỏ các dead edit affordances chính trong structure workspace, đưa create/edit/hide chapter/topic về Server Action contract có validate, và loại bỏ split behavior `client calculates order_index -> server validates differently`.

Checkpoint 3 đã chặn fail-open path khi một topic vẫn còn active nhưng parent chapter đã hidden, giữ đúng quyết định không cascade `removed_at` xuống descendants.

Checkpoint 4 đã có browser smoke kiểm tra workflow structure thật và assertion DB xác nhận hidden chapter không cascade `removed_at` xuống active descendant topic, trong khi direct topic builder URL bị redirect về structure.

Final review/Manual QA follow-up đã chốt authoring guard không fail-open cho non-manager, không báo stats/topic list giả khi DB/RLS/query lỗi, không replay route feedback sau khi param đã consume, và không còn warning Radix dialog trong local flow đã kiểm tra.

### Phạm vi thực tế

Files đã thay đổi trong checkpoint 1:

- `lib/schemas/chapter.ts`
- `lib/schemas/topic.ts`
- `app/actions/chapter.ts`
- `app/actions/topic.ts`
- `app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx`
- `app/(teacher)/courses/[id]/_components/ChapterList.tsx`
- `app/(teacher)/courses/[id]/_components/ChapterFormModal.tsx`
- `app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx`
- `__tests__/schemas/course-structure.test.ts`
- `__tests__/actions/course-structure.test.ts`

Files đã thay đổi trong checkpoint 3:

- `app/(teacher)/courses/[id]/structure/page.tsx`
- `app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/page.tsx`
- `__tests__/actions/course-structure.test.ts`
- `__tests__/components/course-workspace-routes.test.tsx`

Files đã thay đổi trong checkpoint 4:

- `e2e/smoke/course-structure.smoke.spec.ts`
- `scripts/e2e/course-structure-fixture.mjs`
- `scripts/e2e/prepare-supabase-workdir.mjs`

Không thay đổi migrations, RLS, RPC, dashboard, analytics, ordering controls, drag-and-drop, cross-chapter movement, hoặc topic content authoring.

### Kiểm thử tự động

- `npm.cmd run test:run -- __tests__/schemas/course-structure.test.ts __tests__/actions/course-structure.test.ts` - passed; 2 files, 10 tests.
- `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx` - passed; 2 files, 13 tests.
- `npm.cmd run lint -- "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "app/(teacher)/courses/[id]/_components/ChapterList.tsx" "app/(teacher)/courses/[id]/_components/ChapterFormModal.tsx" "app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx" "app/actions/chapter.ts" "app/actions/topic.ts" "lib/schemas/chapter.ts" "lib/schemas/topic.ts" "__tests__/schemas/course-structure.test.ts" "__tests__/actions/course-structure.test.ts"` - passed.
- `npx.cmd tsc --noEmit` - failed before dependency sync because `node_modules` thiếu `@playwright/test` dù `package-lock.json` đã có.
- `npm.cmd install` - failed trong sandbox với `EACCES` khi fetch `playwright-core`.
- `npm.cmd install` ngoài sandbox sau approval - passed; added 3 packages, changed 2 packages; không thay đổi `package.json` hoặc `package-lock.json`.
- `npx.cmd tsc --noEmit` - passed sau khi local dependencies được đồng bộ.
- `git diff --check` - passed; chỉ có warning line-ending `LF will be replaced by CRLF`.
- `npm.cmd run test:run -- __tests__/actions/course-structure.test.ts __tests__/components/course-workspace-routes.test.tsx` - passed; 2 files, 11 tests.
- `npx.cmd tsc --noEmit` - passed.
- `npm.cmd run lint -- "app/(teacher)/courses/[id]/structure/page.tsx" "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/page.tsx" "app/actions/topic.ts" "__tests__/actions/course-structure.test.ts" "__tests__/components/course-workspace-routes.test.tsx"` - passed.
- `npm.cmd run test:run -- __tests__/schemas/course-structure.test.ts __tests__/actions/course-structure.test.ts __tests__/components/course-workspace-routes.test.tsx` - passed; 3 files, 15 tests.
- `npm.cmd run lint -- "e2e/smoke/course-structure.smoke.spec.ts" "scripts/e2e/course-structure-fixture.mjs" "scripts/e2e/prepare-supabase-workdir.mjs" "scripts/e2e/run-e2e.mjs"` - passed.
- `npx.cmd tsc --noEmit` - passed.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` - failed in sandbox because Docker config/API access was blocked.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` ngoài sandbox - failed first because Playwright Chromium was not installed.
- `npx.cmd playwright install chromium` ngoài sandbox - passed; installed Chromium/headless shell/FFmpeg/Winldd to local Playwright cache.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` ngoài sandbox - failed once because existing E2E runner passed absolute `--workdir` with spaces to Supabase CLI.
- `cmd.exe /d /s /c npx.cmd supabase --workdir "C:\Project VocaSpace\VocaSpace\.e2e-runtime" start` ngoài sandbox - passed; local Supabase runtime started and migrations/seed applied.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` ngoài sandbox sau relative workdir fix - failed once because generic dialog helper clicked the Radix close button instead of the submit button.
- `npm.cmd run lint -- "e2e/smoke/course-structure.smoke.spec.ts"` - passed after selector fix.
- `npx.cmd tsc --noEmit` - passed after selector fix.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` ngoài sandbox - passed; 1 test, 1 passed, 49.5s.
- `npm.cmd run test:run -- __tests__/actions/course-structure.test.ts __tests__/components/course-workspace-routes.test.tsx` - passed; 2 files, 18 tests.
- `npx.cmd tsc --noEmit` - passed.
- `npm.cmd run lint -- "app/actions/topic.ts" "app/(teacher)/courses/[id]/topics/[topicId]/page.tsx" "app/(teacher)/courses/[id]/structure/page.tsx" "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "app/(teacher)/courses/[id]/_components/CourseStructureRouteFeedback.tsx" "app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx" "__tests__/actions/course-structure.test.ts" "__tests__/components/course-workspace-routes.test.tsx"` - passed.
- `npm.cmd run test:run` - passed; 17 files, 127 tests.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` - failed in sandbox because Docker API access was blocked.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` ngoài sandbox - failed once because an existing Next dev server held the repo lock at PID `18580`; stopped that stale test server, then reran.
- `npm.cmd run test:e2e -- e2e/smoke/course-structure.smoke.spec.ts` ngoài sandbox - passed; 1 test, 1 passed, 42.4s.
- `git diff --check` - passed; chỉ có warning line-ending `LF will be replaced by CRLF`.

### Manual QA

Manual QA đã đạt trong session hiện tại:

- Manager topic-builder access passed.
- Learner/non-manager direct topic-builder access redirect passed.
- Wrong-course và hidden-parent redirects hiển thị feedback ngay trên structure route.
- Consumed feedback params không replay khi refresh/history.
- Topic hide không còn tạo Next.js dev overlay.
- Topic-hide copy không còn thuật ngữ kỹ thuật `soft-delete` và không hứa cascade delete.
- Normal stats và topic-list paths passed.
- Radix dialog accessibility warning không còn xuất hiện trong local topic hide flow.

### Sai lệch và phát hiện mới

- Database hiện không có unique constraint cho `chapters.order_index` theo `course_id` hoặc `topics.order_index` theo `chapter_id`; chỉ `topics.slug` unique.
- Vì không có order unique constraint, concurrent create không gây DB collision, nhưng vẫn có thể tạo cùng `order_index` nếu hai request đọc cùng max. PR4 giữ tie-break ordering ổn định; atomic ordering/reorder thuộc PR7.
- Local `node_modules` thiếu `@playwright/test` dù lockfile có dependency; đã chạy `npm install` để khôi phục typecheck/E2E readiness.
- Hidden chapter không cascade soft-delete xuống topics; topic builder guard vì vậy phải kiểm tra parent chapter active ở authoring boundary.
- Existing E2E runner không chịu được absolute Supabase `--workdir` khi repo path có khoảng trắng; checkpoint 4 đổi sang relative `.e2e-runtime` vì runner luôn chạy với `cwd` là repo root.
- Smoke E2E phát hiện submit helper theo "last button" không ổn với Radix dialogs; spec chuyển sang submit theo accessible button name regex.
- Final review fix đã thêm local `DialogDescription` cho topic hide confirmation; Radix accessibility warning không còn xuất hiện trong manual QA flow.
- Expected direct topic builder redirect với inactive/missing context không còn log `[TOPIC CONTEXT ERROR]` cho `PGRST116`; unexpected DB/RLS/query failures vẫn fail loud.

### Blocker và follow-up

- Không có implementation blocker sau manual QA.
- Branch sẵn sàng code review/merge sau khi push thành công; chưa merge.
- Future follow-up: thiết kế transactional cascade archive/restore bằng RPC/migration riêng nếu sản phẩm cần archive cả descendant tree.

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
