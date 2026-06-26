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
| PR3: Define Dashboard Readiness Contract | Sẵn sàng code review | PR2 và PR4 đã có trên `main` | `wip/dashboard-readiness-contract-pre-pr4` | 2026-06-20 | Checkpoint gốc 1-5 đã hoàn tất; Checkpoint 4 là Supabase-backed integration coverage trong `72108ce`; final verification đã pass; dashboard UI vẫn thuộc PR5. |
| PR4: Refine Structure Workspace | Đã merge | PR2 đã có trên `main`; PR3 không bắt buộc | PR #30 / merge commit `2113b1c` từ `feat/course-structure-workspace` | 2026-06-17 | Code review findings và manual QA follow-up đã fix; targeted tests, typecheck, lint, full fast suite và focused smoke E2E đã pass; PR4 đã merge vào `main`. |
| PR5: Build Task-First Course Dashboard | Đã merge | PR3 và PR4 đã có trên `main` trước PR5 | PR #32 / merge commit `938f1ae` từ `feat/task-first-course-dashboard` | 2026-06-22 | `/courses/[id]` đã thành dashboard task-first dùng readiness (mức độ sẵn sàng của khóa học) từ PR3, hiển thị việc cần xử lý, CTA chính, trạng thái empty/no-issue/error; PR6 hiện đã xử lý deep links và return feedback trên branch riêng. |
| PR6: Add Issue Deep Links and Local Return Feedback | Sẵn sàng code review | PR5 đã merge, dependency đã thỏa | Branch `feat/course-issue-deep-links`; chưa có PR | 2026-06-26 | Checkpoints 1-5 đã hoàn tất; focused verification và Manual QA đã pass; branch sẵn sàng code review nhưng chưa push và chưa merge. |
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

Trong session PR1 cũ từng có các file support chưa track:

- `__tests__/actions/course.test.ts`
- `__tests__/components/course-authoring-trust.test.tsx`
- `__tests__/schemas/course.test.ts`
- `app/(teacher)/courses/[id]/_components/topic-builder-path.ts`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/topic-builder-tab.ts`

Sau PR3 Checkpoint 1, hai helper route topic-builder cũ đã được thay bằng nguồn chung `lib/course-authoring/routes.ts`.

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
- `lib/course-authoring/routes.ts` sau PR3 Checkpoint 1; trước đó PR2 dùng helper route cục bộ `topic-builder-path.ts`
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

## PR3: Define Dashboard Readiness Contract

- Trạng thái: Sẵn sàng code review; original Checkpoints 1-5 đã hoàn tất.
- Dependencies: PR2 và PR4 đã merge trên `main`; route overview `/courses/[id]`, structure workspace `/courses/[id]/structure`, và topic builder route đã tồn tại trên baseline hiện tại.
- Branch / PR: `wip/dashboard-readiness-contract-pre-pr4`
- Cập nhật lần cuối: 2026-06-20
- Baseline `main`: `2113b1cfc3d65749b93010f11475223bf16c286e`
- Reviewability amendment commits: `42111e4 docs(readiness): clarify readiness dataflow`, `245f696 chore(skills): improve code reviewability guidance`, `57bb991 docs(readiness): simplify review comments`, `e7edb64 chore(skills): reduce excessive code comments`
- Original Checkpoint 4: Supabase-backed integration coverage, đã hoàn tất trong `72108ce test(readiness): cover dashboard access integration`.
- Original Checkpoint 5: final cleanup/documentation/final verification, đã hoàn tất sau khi Checkpoint 4 integration coverage pass.

### Vấn đề

Dashboard cần readiness semantics rõ ràng trước khi render UI: issue identity, severity, destination, primary CTA, và missing/partial data handling không nên được suy luận rời rạc trong component.

### Giải pháp dự kiến hoặc đã thực hiện

Đã thực hiện theo checkpoint gốc:

- Checkpoint 1: dùng chung `lib/course-authoring/routes.ts` làm nguồn path authoring ổn định, thay thế các helper route rải rác trong UI.
- Checkpoint 2: thêm `getCourseDashboardReadiness` để kiểm tra UUID, đăng nhập, role collaborator `owner`/`co_owner`/`editor`, rồi mới đọc dữ liệu course readiness; `previewer`, non-collaborator và unauthenticated user bị chặn trước khi đọc content graph.
- Checkpoint 3: thêm contract schema và hàm tính readiness cho course, chapters, topics, flashcards, exercises, question groups, questions, answer options, issue codes, counts, destinations và primary CTA.
- Checkpoint 4: thêm integration coverage dùng Supabase local thật, session đăng nhập thật và fixture course thật trong `72108ce`.

Reviewability amendment đã hoàn tất trước Checkpoint 4:

- `42111e4` bổ sung comment tiếng Việt quanh luồng dữ liệu readiness.
- `245f696` cập nhật skill comment để reviewer dễ đọc code do agent sinh.
- `57bb991` đơn giản hóa comment/test-plan/progress docs theo skill mới và không thay đổi behavior.
- `e7edb64` commit riêng cho skill comment; đây không phải checkpoint gốc của PR3.

Đã hoàn tất:

- Original Checkpoint 5: final cleanup, documentation reconciliation và final verification.

Contract hiện chỉ trả dữ liệu vận hành cho authoring dashboard: course identity, role, counts, readiness issues, destinations ổn định và primary CTA. Contract không trả revenue, payment/transaction data, learner analytics, collaborator management, dashboard UI, PR5 behavior hoặc PR6 deep-link/return-feedback behavior.

### Giải quyết được gì

PR3 cho PR5 một backend readiness contract đáng tin để dashboard sau này không tự suy luận trạng thái authoring trong component. Contract trả lời bốn câu hỏi chính: course hiện có nội dung gì, còn thiếu cấu trúc/nội dung gì, issue nào nên sửa trước, và teacher nên đi đâu để sửa.

### Phạm vi thực tế

Các file chính của PR3 hiện tại:

- `.agents/skills/code-commenting-and-maintainability/SKILL.md`
- `lib/schemas/exercise.ts`
- `lib/course-authoring/routes.ts`
- `lib/schemas/course-readiness.ts`
- `app/actions/course-readiness.ts`
- `lib/course-readiness.ts`
- `__tests__/actions/course-readiness.test.ts`
- `__tests__/schemas/course-readiness.test.ts`
- `__tests__/utils/course-readiness.test.ts`
- `__tests__/integration/course-readiness.test.ts`
- `__tests__/components/course-authoring-trust.test.tsx`
- `__tests__/components/course-workspace-routes.test.tsx`
- `app/(teacher)/courses/[id]/_components/CourseOverview.tsx`
- `app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/BackButton.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx`
- `app/(teacher)/courses/[id]/topics/[topicId]/page.tsx`
- `app/(teacher)/courses/[id]/topics/page.tsx`
- `docs/adr/refactor-teacher-workflow-progress.md`

Checkpoint 5 hiện chỉ reconciliate tài liệu trực tiếp liên quan đến PR3. Không đổi runtime behavior.

### Repository và data-model audit

- Content graph PR3 đọc course identity từ `course_collaborators` join `courses`, rồi đọc chapters, topics, cards, exercises, question groups, questions và answer options theo từng tầng ID đã được xác nhận.
- Access/query convention hiện dùng `createClient()` trong Server Action, `auth.getUser()`, `course_collaborators` join `courses!inner`, `courses.removed_at IS NULL`, và danh sách role readiness riêng `owner`/`co_owner`/`editor`.
- Soft-delete semantics: dữ liệu `removed_at` không được tính vào counts hoặc quan hệ hợp lệ; question dưới exercise active vẫn được giữ nếu `group_id` hỏng để có thể báo issue mồ côi.
- Schema/type strategy: PR3 thêm runtime schemas hẹp trong `lib/schemas/course-readiness.ts`; không làm repository-wide generated database type alignment.
- TOEIC rule source: `TOEIC_PART_RULES` trong `lib/schemas/exercise.ts` là nguồn chung cho authoring validation và readiness.
- Issue code cũ `exercise_has_no_questions` không còn trong contract; contract hiện có 11 issue code hẹp hơn và test chặn code cũ quay lại.
- Checkpoint 4 integration coverage dùng `__tests__/integration/course-readiness.test.ts` để kiểm tra `owner`, `co_owner`, `editor`, `previewer`, non-collaborator, unauthenticated, dữ liệu course thật, removed rows và cleanup residue.
- Lệnh integration chuẩn `npm.cmd run test:integration -- __tests__/integration/course-readiness.test.ts` pass với Supabase local ở port cấu hình của repository.
- Integration cleanup fail loud khi query/delete lỗi, giữ `createdCourseIds` cho tới khi cleanup course thành công để `afterAll` có thể retry.

### Kiểm thử tự động cho Checkpoint 4 và Checkpoint 5

- `npm.cmd run test:integration -- __tests__/integration/course-readiness.test.ts` - passed trong Checkpoint 4; 1 file, 6 tests.
- `npm.cmd run test:run -- __tests__/actions/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts __tests__/utils/course-readiness.test.ts` - passed; 3 files, 41 tests.
- `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx` - passed; 2 files, 14 tests.
- `npx.cmd tsc --noEmit --incremental false` - passed.
- Checkpoint 5 final verification đã xác nhận lại integration, PR3 regression tests, shared-route regression tests, typecheck, cleanup residue count `0` và `git diff --check` trước khi review.

### Manual QA

Manual QA: Không.

PR3 hiện chưa có UI consumer cho readiness contract. Dashboard UI thuộc PR5, nên Manual QA không áp dụng cho Checkpoint 5.

### Sai lệch và phát hiện mới

- Handoff cũ vẫn nhắc branch `feat/dashboard-readiness-contract`, nhưng repository hiện đang ở `wip/dashboard-readiness-contract-pre-pr4`.
- PR3 ban đầu được tạo trước PR4 trên baseline `ce2928e`; nhánh hiện tại đã đặt trên `main` baseline `2113b1c` sau khi PR4 merge.
- Tracker cũ mô tả PR3 như chưa thay đổi production/test contract; Git history hiện đã có các checkpoint PR3 và focused tests.
- `245f696` giới thiệu reviewability guidance cho comment do agent sinh.
- `e7edb64` là amendment mới nhất của skill, giảm comment quá dày và giữ code dễ đọc hơn.
- Comment work trong `42111e4` và `245f696` là reviewability amendment, không thay thế original Checkpoint 4.
- Tracker cũ nói Supabase-backed integration coverage chưa bắt đầu; điều này đã stale sau `72108ce`.
- Checkpoint 4 không thêm dashboard UI, analytics, revenue, collaborator management, migrations, PR5 hoặc PR6 behavior.

### Blocker và follow-up

- Không có blocker từ trạng thái Git hoặc scope sau khi kiểm tra ban đầu.
- Original Checkpoint 4, Supabase-backed integration coverage, đã hoàn tất trong `72108ce`.
- Original Checkpoint 5 final verification đã pass.
- PR3 sẵn sàng code review sau documentation commit này.
- PR5 dashboard UI là implementation tiếp theo sau khi PR3 được review và merge.
- PR6 deep links/return feedback chưa được bắt đầu và vẫn phụ thuộc PR5.

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

- Trạng thái: Đã merge
- Dependencies: PR3 đã merge vào `main` bằng PR #31 trước PR5; PR4 đã merge vào `main` bằng PR #30 trước PR5
- Branch / PR: PR #32 / merge commit `938f1ae`; source branch `feat/task-first-course-dashboard`
- Cập nhật lần cuối: 2026-06-22

### Merge metadata và ranh giới audit Git

- PR number: PR #32.
- Merge commit: `938f1ae25bc3d5a76c3602dc2d17981b86197019`.
- Source branch: `feat/task-first-course-dashboard`, theo merge subject `Merge pull request #32 from khangnhoang/feat/task-first-course-dashboard`.
- Previous-main commit: `394940cd9da804c261baeb640747d9c5e6817459`, là first parent của merge commit.
- PR5 branch tip: `34d90fe81300558ddc21951de203cc4401474c8e`, là second parent của merge commit.
- PR5 result commit: `938f1ae25bc3d5a76c3602dc2d17981b86197019`.
- Commit range đã audit: `394940c..34d90fe` cho commit branch PR5, và `394940c..938f1ae` cho kết quả tích lũy.
- Merge strategy: merge commit bình thường, không phải squash merge hoặc rebase merge. `git rev-list --parents -n 1 938f1ae` trả về 2 parent: `394940c` và `34d90fe`.
- Current `main`: không có commit sau PR5 tại thời điểm audit; `git log --oneline 938f1ae..main` không trả dòng nào.

### Vấn đề

Trước PR5, route `/courses/[id]` đã được PR2 biến thành overview tối thiểu. Trang này có title, trạng thái, metadata và link sang `/courses/[id]/structure`, nhưng vẫn chưa trả lời câu hỏi chính của giáo viên: khóa học còn thiếu gì và nên sửa việc nào trước.

PR3 đã tạo readiness contract (hợp đồng dữ liệu và hành vi giữa Server Action và dashboard về mức độ sẵn sàng của khóa học), còn PR4 đã làm `/courses/[id]/structure` đủ ổn để nhận link từ dashboard. PR5 cần dùng hai phần đó để biến overview thành dashboard task-first: giáo viên mở khóa học, thấy việc tiếp theo, thấy các vấn đề đang chặn, và bấm vào nơi có thể xử lý.

### Giải pháp dự kiến hoặc đã thực hiện

PR5 đã thay `/courses/[id]` từ page client-side tự gọi `getCoursesForTeacher` và `getCourseStats` sang Server Component gọi `getCourseDashboardReadiness(resolvedParams.id)`.

Dữ liệu đi theo đường:

1. Route param `id` từ `/courses/[id]`.
2. `app/actions/course-readiness.ts` kiểm tra UUID, đăng nhập, role `owner`/`co_owner`/`editor`, rồi đọc Supabase theo cây course -> chapters -> topics -> cards/exercises -> question groups/questions/options.
3. `courseReadinessGraphSchema` trong `lib/schemas/course-readiness.ts` kiểm tra cấu trúc dữ liệu đọc được.
4. `deriveCourseDashboardReadiness` trong `lib/course-readiness.ts` lọc bản ghi còn hoạt động, tính counts, tạo issue list đã sắp thứ tự, và chọn `primaryCta`.
5. `app/(teacher)/courses/[id]/page.tsx` đưa `readiness.data` vào `CourseOverview`, hoặc đưa safe error code vào `CourseOverviewError`.

Code PR5 đã thực hiện cụ thể:

- `app/(teacher)/courses/[id]/page.tsx`: bỏ `useEffect`, `useState`, `toast`, `getCoursesForTeacher`, `getCourseStats`; page giờ chờ Server Action readiness (mức độ sẵn sàng của khóa học) và render success/error rõ ràng.
- `app/(teacher)/courses/[id]/_components/CourseOverview.tsx`: nhận `CourseDashboardReadiness`, hiển thị course identity, role, status, mô tả, phần "Việc tiếp theo", CTA chính từ `primaryCta.destination.href`, summary cards, trạng thái issue/no-issue, và thông tin cơ bản.
- `app/(teacher)/courses/[id]/_components/EmptyCourseDashboard.tsx`: tách màn hình khóa học chưa có chương, dùng CTA từ contract (hợp đồng dữ liệu và hành vi giữa các phần) thay vì tự tạo route.
- `app/(teacher)/courses/[id]/_components/CourseReadinessIssueList.tsx`: tách danh sách việc cần xử lý, giữ nguyên thứ tự issue từ contract (hợp đồng dữ liệu và hành vi giữa các phần), hiển thị context (ngữ cảnh mô tả vấn đề), action label và href từng issue.
- `app/(teacher)/courses/[id]/_components/CourseOverviewError.tsx`: tách error UI; `AUTH_REQUIRED` đi `/login`, invalid/forbidden đi `/courses`, query/data lỗi có "Thử tải lại" bằng overview href hiện tại và link phụ về `/courses`.
- `app/(teacher)/courses/[id]/_components/ChapterList.tsx`: review/manual-QA follow-up cho accessibility/responsive của structure list: loading có `role="status"` và `sr-only`, icon được `aria-hidden`, tiêu đề dài và nút dài không làm vỡ layout.
- `__tests__/components/course-workspace-routes.test.tsx`: mở rộng test static render/source contract (hợp đồng kiểm tra giữa test và code nguồn) để kiểm tra dashboard đọc readiness (mức độ sẵn sàng của khóa học), không tự query course list/stats cũ, issue giữ thứ tự/action/href, trạng thái empty, trạng thái error, nội dung dài, accessible names, và route contract (hợp đồng dữ liệu và hành vi của route) PR2/PR4 vẫn còn.

### Giải quyết được gì

Sau PR5, giáo viên mở `/courses/[id]` sẽ thấy:

- tên khóa học, status, role, mô tả hoặc câu "Khóa học chưa có mô tả.";
- khu "Việc tiếp theo" cho biết còn bao nhiêu việc cần xử lý hoặc hiện chưa có việc nào trong phần kiểm tra;
- nút hành động chính lấy từ `primaryCta`, ví dụ "Thêm chương", "Thêm bài học", "Thêm nội dung", hoặc "Tiếp tục soạn bài học";
- tóm tắt nội dung gồm `Chương`, `Bài học`, `Flashcards`, `Bài tập`, `Câu hỏi`; PR5 cố ý không hiển thị `questionGroups` và `answerOptions` trên dashboard;
- danh sách "Các việc cần xử lý" theo thứ tự do PR3 tính sẵn; mỗi item có câu mô tả và nút đến `issue.destination.href`;
- màn hình riêng cho course chưa có chapter;
- màn hình "Chưa có việc cần xử lý" khi readiness (mức độ sẵn sàng của khóa học) không trả issue;
- màn hình lỗi an toàn khi ID sai, hết đăng nhập, không có quyền, query fail, hoặc dữ liệu readiness không đúng schema.

Dashboard không tự phát minh analytics, không thêm enrollment count, không thêm mascot dependency, không thêm mascot placeholder, và không chạm database schema/RLS.

### Phạm vi thực tế

Cumulative diff `394940c..938f1ae`:

```text
8 files changed, 807 insertions(+), 269 deletions(-)
```

Changed files:

- `__tests__/components/course-workspace-routes.test.tsx` modified.
- `app/(teacher)/courses/[id]/_components/ChapterList.tsx` modified.
- `app/(teacher)/courses/[id]/_components/CourseOverview.tsx` modified.
- `app/(teacher)/courses/[id]/_components/CourseOverviewError.tsx` added.
- `app/(teacher)/courses/[id]/_components/CourseReadinessIssueList.tsx` added.
- `app/(teacher)/courses/[id]/_components/EmptyCourseDashboard.tsx` added.
- `app/(teacher)/courses/[id]/page.tsx` modified.
- `docs/adr/refactor-teacher-workflow-progress.md` modified during PR5 to record two follow-ups.

Đối chiếu với phạm vi PR5 đã được chấp nhận:

- Completed: dashboard overview UI for `/courses/[id]`.
- Completed: course identity/status/role presentation.
- Completed: dynamic primary CTA from PR3 `primaryCta`.
- Completed: no numeric completion score.
- Completed: issue list với context (ngữ cảnh mô tả vấn đề), action và destination (đích điều hướng).
- Completed: trạng thái empty course.
- Completed: trạng thái no-issue.
- Completed: trạng thái error.
- Completed: link tới structure và topic builder qua destinations (các đích điều hướng) từ PR3.
- Completed: responsive/keyboard/accessibility polish supported by markup tests and class changes.
- Completed: component boundaries (ranh giới trách nhiệm giữa các component) cho overview, empty dashboard, issue list và error UI.
- Partially completed: "grouped issue list" trong plan. Code giữ một danh sách có thứ tự thay vì nhóm bằng category/severity trên UI. Việc này có vẻ cố ý vì tests kiểm tra thứ tự issue từ contract (hợp đồng dữ liệu và hành vi giữa các phần), đồng thời kiểm tra các nhãn như "Gợi ý" hoặc "Nghiêm trọng" không được render.
- Intentionally deferred: exact authoring context (ngữ cảnh soạn nội dung cụ thể) deep links, search-param handling cho target context (ngữ cảnh đích), local success feedback, optional return-to-overview action, and dashboard refresh after a fix. These remain PR6.
- Intentionally deferred: accessible chapter/topic ordering remains PR7.
- Intentionally deferred: analytics contract (hợp đồng dữ liệu và hành vi cho analytics)/UI vẫn thuộc PR8/PR9; PR5 không thêm analytics.
- Out of scope: database migrations, RLS changes, admin review/publish, collaborator persistence, mascot/illustration system.
- Deviated from original plan: PR5 touched `ChapterList.tsx` for responsive/accessibility follow-up even though it is structure workspace code. The change is narrow and covered by the PR5 component test, but it is adjacent to PR4 rather than dashboard-only scope (phạm vi chỉ thuộc dashboard).

Lịch sử commit / checkpoints:

| Commit | Mục đích | File quan trọng | Hành vi giáo viên thấy | Tests/docs | Rủi ro/follow-up |
| --- | --- | --- | --- | --- | --- |
| `099da33` `feat(course-dashboard): consume readiness contract` | Nhận readiness contract (hợp đồng dữ liệu và hành vi về mức độ sẵn sàng của khóa học) và đổi cách load dữ liệu | `app/(teacher)/courses/[id]/page.tsx`, `CourseOverview.tsx`, `course-workspace-routes.test.tsx` | `/courses/[id]` load một kết quả readiness (mức độ sẵn sàng của khóa học) từ Server Action thay vì client-side course list/stats; CTA href đến từ `primaryCta.destination.href`. | Test fixture chuyển từ `TeacherCourse` + stats sang `CourseDashboardReadiness`; source assertions kiểm tra query cũ đã biến mất. | Error UI ban đầu còn nằm trong page và được tách ở commit sau. |
| `ff713c2` `feat(course-dashboard): render task-first overview` | Render dashboard UI | `CourseOverview.tsx`, `course-workspace-routes.test.tsx` | Dashboard có "Việc tiếp theo", 5 summary cards, copy no-issue, và bố cục task-first rõ hơn. | Test kiểm tra task-first overview, 5 count cards, và không có card `Nhóm câu hỏi`/`Đáp án`. | Chi tiết issue chưa được tách/render thành danh sách cuối cùng. |
| `cc2d2e4` `feat(course-dashboard): add readiness issue states` | Tách component và thêm trạng thái issue/empty/error | `CourseOverview.tsx`, `CourseOverviewError.tsx`, `CourseReadinessIssueList.tsx`, `EmptyCourseDashboard.tsx`, `page.tsx`, tests | Empty course có màn hình riêng; issue list render item theo thứ tự với action; query/data errors có thể retry; auth/forbidden/invalid ID đi tới nơi an toàn. | Tests cover issue order, trạng thái empty, error actions. | Danh sách issue là một list có thứ tự, không phải grouped display. |
| `34d90fe` `fix(course-dashboard): polish readiness dashboard accessibility` | Accessibility/responsive work, review/manual-QA follow-up, ghi chú docs | `CourseOverview.tsx`, `CourseOverviewError.tsx`, `CourseReadinessIssueList.tsx`, `EmptyCourseDashboard.tsx`, `ChapterList.tsx`, tests, tracker | Title/description/action dài vẫn xuất hiện; issue actions có accessible names; loading state (trạng thái đang tải) trong `ChapterList` được thông báo; nút có thể xuống dòng trên màn hình nhỏ. | Tests cover `aria-labelledby`, issue `aria-label`, long dashboard text, long chapter title/actions. Tracker ghi một follow-up và một card delete bug. | Chạm `ChapterList.tsx`, nằm sát structure workspace scope (phạm vi structure workspace). |

Audit repository và luồng dữ liệu:

- `CourseOverview` không còn `"use client"`, nên component render từ dữ liệu server đưa xuống và không tự quản lý trạng thái loading.
- Hành vi loading chuyển khỏi spinner client cũ: vì `/courses/[id]/page.tsx` là async, server rendering chờ `getCourseDashboardReadiness`. PR5 không thêm route `loading.tsx` riêng.
- Hành vi thành công dùng `CourseDashboardReadiness` từ `lib/schemas/course-readiness.ts`.
- Khóa học empty được nhận diện bằng `counts.chapters === 0` và render `EmptyCourseDashboard`.
- Trạng thái no-issue được nhận diện bằng `issues.length === 0` khi course có ít nhất một chapter.
- Hành vi lỗi dùng `CourseReadinessErrorCode`: `INVALID_COURSE_ID`, `AUTH_REQUIRED`, `COURSE_NOT_FOUND_OR_FORBIDDEN`, `QUERY_FAILED`, `INVALID_READINESS_DATA`.
- Đích điều hướng của issue là link authoring bình thường từ PR3: `course_structure` -> `/courses/[id]/structure`; `topic_builder` -> `/courses/[id]/topics/[topicId]`. Đây chưa phải deep links vào tabs, forms, exact exercise/question groups, hoặc return feedback.
- Responsive/accessibility behavior (hành vi responsive và khả năng truy cập) thể hiện trong code qua `wrap-break-word`, `min-w-0`, `whitespace-normal`, focus rings, `aria-labelledby`, issue action `aria-label`, icon `aria-hidden`, và `role="status"` cho loading trong `ChapterList`.

### Kiểm thử tự động

Bằng chứng lịch sử trong PR5:

- Test-plan header trong `__tests__/components/course-workspace-routes.test.tsx` ghi verification gần nhất đã passed bằng `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx`.
- Cumulative diff của PR5 có tests cho dashboard readiness (mức độ sẵn sàng của khóa học) render, issue order/action/href, trạng thái empty course, mọi readiness error code, nội dung/action label dài trên dashboard, title/action dài của chapter, và route/source contract checks (kiểm tra hợp đồng giữa route/source và test).

Verification rerun trong checkpoint tái dựng tài liệu ngày 2026-06-22:

- `git diff --check 394940c..938f1ae` - passed with no output.

Không chạy lại broad production test suite trong checkpoint tài liệu này vì checkpoint này không đổi production code hoặc test code.

### Manual QA

Manual QA: Không tìm thấy bằng chứng đủ tin cậy trong Git history hoặc repository documentation.

### Sai lệch và phát hiện mới

- PR5 không implement visual grouping theo category/severity dù plan nói "grouped issue list". Tests cuối cùng kiểm tra rõ rằng không có nhãn "Gợi ý" hoặc "Nghiêm trọng", nên implementation đã merge là danh sách việc cần làm theo thứ tự.
- PR5 không cung cấp deep links vào exact authoring context (ngữ cảnh soạn nội dung cụ thể). Nó dùng destinations (các đích điều hướng) bình thường từ readiness (mức độ sẵn sàng của khóa học), nên PR6 vẫn sở hữu tabs/search params/return feedback/refresh-after-fix.
- Commit `34d90fe` chạm `ChapterList.tsx` để polish accessibility/responsive. Thay đổi này hữu ích nhưng nằm sát PR4 structure workspace, không phải dashboard-only scope (phạm vi chỉ thuộc dashboard).
- Tracker trong PR5 ghi note: `Follow-up: Add non-blocking readiness suggestion for topics that have flashcards but no exercises, so teachers can either ignore it or continue adding exercises.`
- Tracker trong PR5 ghi note: `Bug: Soft deleting a flashcard fails with RLS error on table cards. Audit indicates the failing path is app/(teacher)/courses/[id]/topics/[topicId]/_components/FlashcardTab.tsx handleConfirmDelete -> app/actions/card.ts deleteCard, likely because the updated row sets removed_at and no longer satisfies the only cards SELECT policy, while no staff SELECT policy covers removed rows. Needs backend/RLS or mutation fix outside PR5.`
- Analytics vẫn ngoài PR5. PR5 diff không có learner analytics panel, enrollment count, chart, hoặc secure aggregate analytics contract (hợp đồng dữ liệu và hành vi cho analytics aggregate an toàn).
- Không có mascot dependency. PR5 changed files không thêm mascot component, mascot state (trạng thái mascot), mascot API, reserved mascot area, hoặc mascot copy.

### Blocker và follow-up

Không có PR5 implementation blocker sau merge.

Follow-up vẫn thuộc các PR sau:

- PR6: deep links vào exact authoring context (ngữ cảnh soạn nội dung cụ thể), route/search-param handling cho target context (ngữ cảnh đích), local success feedback sau khi sửa xong, optional return-to-overview action, và dashboard refresh để issue đã giải quyết biến mất tự nhiên.
- PR7: accessible ordering cho chapters/topics.
- PR8: secure teacher analytics contract (hợp đồng dữ liệu và hành vi cho analytics giáo viên an toàn).
- PR9: conditional learner analytics UI.
- PR10: release hardening và QA rộng hơn sau PR1-PR7.

## PR6: Add Issue Deep Links and Local Return Feedback

- Trạng thái: Sẵn sàng code review; Checkpoints 1-5 đã hoàn tất
- Dependencies: PR5 đã merge; dependency đã thỏa
- Branch / PR: branch `feat/course-issue-deep-links`; chưa có PR
- Cập nhật lần cuối: 2026-06-26

### Vấn đề

Sau PR5, dashboard đã nói rõ khóa học thiếu gì, nhưng issue actions vẫn cần đưa giáo viên tới đúng nơi sửa trong structure hoặc topic builder. Sau khi sửa xong, giáo viên cần thấy lời nhắc cục bộ để quay lại tổng quan, còn dashboard phải đọc lại dữ liệu thật thay vì lưu trạng thái “đã xử lý” giả.

### Giải pháp dự kiến hoặc đã thực hiện

Đã thực hiện theo các checkpoint local:

| Checkpoint / fix | Commit | Nội dung |
| --- | --- | --- |
| Checkpoint 1 | `6c95855 feat(course-dashboard): add issue destination params` | Thêm route/search-param contract cho dashboard issue destinations. Issue structure có `from=dashboard`, `issue`, `targetType`, `target`; topic-builder issue giữ `tab=exercises` và target đúng entity. |
| Checkpoint 2 | `eaa94da feat(course-authoring): handle dashboard issue context` | Structure workspace và topic builder đọc context từ URL, mở đúng tab, hiển thị guidance banner, highlight target khi có thể, xử lý target stale bằng redirect an toàn về structure. |
| Checkpoint 3 | `cf23771 feat(course-authoring): show dashboard return feedback` | Sau mutation thành công có liên quan tới issue gốc, hiển thị feedback cục bộ với `Quay lại tổng quan`, xóa issue params khỏi URL, không auto-redirect và không báo thành công cho action fail/unrelated. |
| Bugfix độc lập | `0994806 fix(flashcards): repair card soft delete authorization` | Sửa flashcard soft-delete blocker. Nguyên nhân xác nhận là RLS thiếu visibility cho deleted cards; migration forward-only thêm policy `Cards - Staff Select Deleted`. `deleteCard` validate input, chỉ update active card, verify returned row, và không lộ raw database error. |
| Checkpoint 4 | `f29228e fix(course-authoring): clean dashboard issue params after return feedback` | Sửa cleanup URL sau return feedback dùng current browser URL, giữ active `tab`, và E2E chứng minh issue đã resolve biến mất sau khi quay lại overview/refresh. Dashboard readiness vốn đọc dữ liệu database hiện tại; defect thật là stale issue params còn nằm trong URL khi đổi tab. |
| Toast fix | `e730689 fix(toasts): default shared toaster to light theme` | Shared Sonner toaster default light. User, teacher, và admin hiện đều dùng light toast; operating-system dark preference không còn làm toast chuyển tối. Không thêm future theme-system vào PR6. |
| Generic CTA fix | `623deba fix(course-dashboard): route generic authoring CTA to structure` | Khi `primaryCta` không đến từ issue cụ thể, CTA generic mở `/courses/[courseId]/structure`. Issue-derived CTA destinations vẫn giữ nguyên deep links. |

Checkpoint status:

- Checkpoint 1: completed.
- Checkpoint 2: completed.
- Checkpoint 3: completed.
- Checkpoint 4: completed.
- Checkpoint 5: completed; đã hoàn tất focused regression verification, accessibility/mobile review, Manual QA reconciliation và progress tracker update.

### Giải quyết được gì

- Dashboard issue action đi thẳng tới đúng structure hoặc topic-builder destination thay vì chỉ mở trang rộng.
- Topic builder mở đúng tab `exercises` cho content/exercise/question issues.
- Structure và topic builder hiển thị guidance ngắn để giáo viên nhớ vì sao họ đi từ dashboard tới đây.
- Target stale hoặc URL không hợp lệ rơi về nơi an toàn và có cảnh báo ngắn.
- Sau successful mutation liên quan tới issue gốc, giáo viên thấy feedback cục bộ có `Quay lại tổng quan`, nhưng vẫn có thể tiếp tục authoring.
- Dashboard return freshness được kiểm chứng bằng E2E: resolved issue biến mất vì readiness đọc lại dữ liệu hiện tại.
- Flashcard soft-delete blocker đã được giải quyết và không còn là blocker mở.
- Generic CTA khi không có issue cụ thể nay về structure để giáo viên chọn chapter/topic cần làm, không tự nhảy vào topic builder/exercises.

### Phạm vi thực tế

Production/test scope đã thay đổi trong các commit PR6 và bugfix liên quan:

- Route helpers và issue context: `lib/course-authoring/routes.ts`, `lib/course-authoring/issue-context.ts`, `lib/course-authoring/issue-guidance.ts`, `lib/course-authoring/issue-success.ts`.
- Readiness destination và generic CTA: `lib/course-readiness.ts`, `__tests__/utils/course-readiness.test.ts`.
- Destination surfaces: `CourseStructureWorkspace`, `ChapterList`, `DashboardIssueNotice`, `DashboardReturnFeedback`, `TopicManagementSheet`, `TopicBuilderTabs`, `ExerciseTab`, `FlashcardTab`, topic-builder page và structure page.
- Flashcard delete action/schema/RLS coverage: `app/actions/card.ts`, `lib/schemas/card.ts`, `supabase/migrations/...cards_staff_select_deleted...sql`, `__tests__/actions/card.test.ts`, `__tests__/integration/card-rls.test.ts`, `e2e/smoke/flashcard-delete.smoke.spec.ts`.
- Toast fix: `components/ui/sonner.tsx`, `__tests__/components/sonner-toaster.test.tsx`.
- Browser smoke coverage: `e2e/smoke/issue-deep-links.smoke.spec.ts`, `e2e/smoke/dashboard-return-freshness.smoke.spec.ts`, `scripts/e2e/dashboard-return-freshness-fixture.mjs`, flashcard delete fixture/spec.

Không thực hiện trong PR6:

- Không thêm persistent issue history, permanent dismissal, global event bus, workflow engine, hoặc resolved status trong database.
- Không thêm chapter/topic ordering; phần đó vẫn là PR7.
- Không thêm analytics, learner charts, mascot, hoặc dark/light application theme system.
- Không thêm UI repair mới cho orphan question; hiện vẫn là limitation vì chưa có action trực tiếp để gắn orphan question vào group hợp lệ.

### Kiểm thử tự động

Verification cho Checkpoint 5 ngày 2026-06-26:

- `npm.cmd run test:run -- __tests__/utils/course-readiness.test.ts` - passed; 1 file, 21 tests.
- `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx` - passed; 1 file, 38 tests.
- `npm.cmd run test:run -- __tests__/actions/card.test.ts` - passed; 1 file, 6 tests.
- `npm.cmd run test:run -- __tests__/components/sonner-toaster.test.tsx` - passed; 1 file, 3 tests.
- `npm.cmd run test:integration -- __tests__/integration/card-rls.test.ts` - passed; 1 file, 1 test.
- `npm.cmd run test:e2e -- e2e/smoke/issue-deep-links.smoke.spec.ts` - passed; 1 test. Lần đầu bị chặn vì một `next dev` cũ đang chạy ở port 3000; sau khi dừng PID `24328`, rerun passed. Sau khi test pass có log `ECONNRESET` lúc webServer teardown, command vẫn exit 0.
- `npm.cmd run test:e2e -- e2e/smoke/dashboard-return-freshness.smoke.spec.ts` - passed; 1 test.
- `npm.cmd run test:e2e -- e2e/smoke/flashcard-delete.smoke.spec.ts` - passed; 1 test.
- `npx.cmd tsc --noEmit --incremental false` - passed.
- `git diff --check` - passed.
- Scoped lint cho toàn bộ TypeScript/TSX files changed trong PR6 và bugfix commits - passed với 2 warning cũ trong `AddExerciseDialog.tsx`: unused `handleFormSubmit` và React Compiler warning quanh `form.watch(...)`. Không sửa vì ngoài scope Checkpoint 5 và đã tồn tại trong authoring surface.

Focused browser review tạm ngày 2026-06-26:

- Chạy bằng temp spec `e2e/smoke/pr6-final-mobile-review.tmp.spec.ts`, sau đó xóa file.
- Kết quả: passed; kiểm tra mobile viewport `390x760`, dashboard issue link, topic guidance banner, tab navigation, flashcard dialog description, return feedback, close button `Đóng thông báo`, `Quay lại tổng quan`, toast light readability, và không có horizontal overflow rõ ràng trong các bước được kiểm tra.

### Manual QA

Manual QA đã được user approve cho:

- Checkpoint 2 destination handling.
- Checkpoint 3 local success/return feedback flows.
- Flashcard soft-delete bugfix.
- Checkpoint 4 dashboard return freshness.
- Generic dashboard CTA fix.

Full PR6 checklist được bao phủ bởi Manual QA đã approve và E2E smoke:

- Dashboard issue -> issue-specific deep link -> correct destination/tab/target.
- Relevant mutation succeeds -> local return feedback appears.
- Duplicate success toast avoided for dashboard-origin relevant success.
- Dashboard issue params removed.
- `Quay lại tổng quan` returns to `/courses/[id]`.
- Readiness recalculates from current database data; resolved issue disappears and refresh does not restore it.
- Stale target falls back safely; invalid tab normalizes safely.
- Unrelated success does not resolve targeted issue.
- Create content then delete content makes truthful readiness issue return where covered by flashcard delete/freshness flows.
- Generic CTA with no source issue opens `/courses/[id]/structure`.
- Issue-specific CTAs keep exact deep links.
- Flashcard deletion works and remains deleted after reload.
- Shared toast remains light on user, teacher, and admin routes; focused browser check confirmed the behavior before this tracker update.

### Sai lệch và phát hiện mới

- Flashcard delete blocker ghi từ PR5 không còn mở. Nguyên nhân đã xác nhận là RLS thiếu policy cho staff đọc card đã có `removed_at`; commit `0994806` đã sửa bằng migration forward-only và action/test coverage.
- Dashboard return freshness không cần optimistic removal hay stored resolved status. Dashboard đã đọc dữ liệu database hiện tại; lỗi thực tế là URL vẫn giữ issue params cũ sau khi giáo viên đổi tab. Commit `f29228e` sửa cleanup dùng current browser URL.
- Generic fallback CTA từng trỏ vào first topic/topic builder và thường rơi vào `exercises`. Commit `623deba` sửa ở readiness/business contract để fallback không có source issue đi về structure.
- Shared toast trước đó theo system theme qua `next-themes`, khiến user/teacher/admin toast có thể tối ngoài ý muốn. Commit `e730689` đổi default shared toaster sang light; không thêm route-specific theme hoặc theme-system plan.
- `exercise_has_orphan_questions` vẫn chưa có repair UI trực tiếp để gắn question vào group hợp lệ; PR6 không tạo fake success feedback cho case này.

### Blocker và follow-up

Không còn blocker mở cho PR6.

Deferred follow-up: dedicated structure-list UX

- Scope dự kiến: chapter categories `Tất cả`, `Chưa có bài học`, `Đã có bài học`; optional search khi list dài; transient newly-created chapter highlight; nhãn `Chương vừa thêm`; guidance `Thêm bài học ngay`.
- Lý do defer: cần per-chapter topic summary/state và quyết định UX rộng hơn cho structure list. Đây là cải thiện structure UX riêng, không phải điều kiện để PR6 deep links/return feedback đúng.
- Không implement trong Checkpoint 5.

Deferred follow-up: shared E2E test infrastructure

- Scope dự kiến: teacher login helper, shared Supabase admin client, reusable course/chapter/topic base fixtures, cleanup theo created IDs/run ID, browser console warning helper, và helper UI nhỏ cho authoring flows.
- Suggested future branch: `refactor/e2e-test-support`.
- Action tests, RLS integration tests, và E2E specs vẫn nên tách theo mục đích; chỉ phần hạ tầng lặp lại mới nên gom.
- Không tạo hoặc switch sang branch này trong Checkpoint 5.

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
