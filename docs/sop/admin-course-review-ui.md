# STANDARD OPERATING PROCEDURE (SOP): GEMINI WEB FE DEVELOPMENT FOR ADMIN COURSE REVIEW UI

## MỤC TIÊU TASK

Xây dựng phần **Admin Course Review UI + Zod Validation** cho workflow duyệt khóa học.

Workflow nghiệp vụ hiện tại:

```txt
Teacher tạo course
=> status = draft

Teacher gửi yêu cầu xuất bản
=> status = pending

Admin accept
=> status = published

Admin reject
=> status = draft
=> lưu reject_message
```

Task này chỉ làm **Frontend UI + Zod validation + wiring UI theo action/API contract có sẵn hoặc placeholder rõ ràng**.

Task này KHÔNG làm:

* Database migration
* Supabase local reset
* Supabase db diff
* RLS policy
* API/server action business logic thật nếu chưa có
* Public client course loading
* Course status enum
* Thêm status `rejected`

---

# PHẦN 0: BẮT BUỘC ĐỌC TRƯỚC KHI CODE

## 0.1. Quy tắc làm việc với Gemini Web

Gemini Web không được code một mạch toàn bộ khi chưa đủ context.

Trước khi viết code, Gemini bắt buộc phải kiểm tra đã nhận đủ context chưa.

Nếu thiếu file, Gemini phải phản hồi:

```txt
CONTEXT INCOMPLETE

Mình cần bạn gửi thêm các file sau trước khi viết code:
1. ...
2. ...
3. ...
```

Không được tự đoán path, không được tự bịa component, không được tự bịa API.

---

## 0.2. Các file/context Gemini bắt buộc phải yêu cầu nếu chưa có

Người dùng cần cung cấp các nhóm file sau.

### A. Database types

Bắt buộc cần:

```txt
types/database.ts
```

Gemini phải xác nhận trong `Course` có đủ các field:

```ts
reject_message: string | null;
submitted_at: string | null;
reviewed_by: string | null;
reviewed_at: string | null;
```

Nếu thiếu 4 field này thì DỪNG, không code tiếp.

---

### B. Admin route/layout hiện tại

Cần file tree hoặc các file liên quan tới admin:

```txt
app/admin
app/(admin)
src/app/admin
```

Tùy project đang đặt route thế nào.

Cần biết:

* Admin page hiện tại nằm ở đâu.
* Admin layout/sidebar/breadcrumb nằm ở đâu.
* Có route `/admin/courses` chưa.
* Có page quản lý course cũ chưa.

Nếu chưa có route admin course, Gemini phải đề xuất path theo convention repo, không tự tạo bừa.

---

### C. Course admin/teacher files hiện có

Nếu có, cần gửi:

```txt
course list/admin course page hiện tại
teacher course list page
teacher course edit/detail page
course status badge/helper nếu có
course format price/date helper nếu có
```

Nếu không có sẵn, Gemini có thể tạo component mới nhưng phải hỏi/confirm path trước.

---

### D. shadcn/ui component paths

Cần gửi file tree hoặc import examples của shadcn/ui:

```txt
components/ui/button.tsx
components/ui/card.tsx
components/ui/badge.tsx
components/ui/input.tsx
components/ui/textarea.tsx
components/ui/dialog.tsx
components/ui/alert-dialog.tsx
components/ui/table.tsx
components/ui/tabs.tsx
components/ui/select.tsx
components/ui/dropdown-menu.tsx
components/ui/alert.tsx
components/ui/skeleton.tsx
```

Gemini phải ưu tiên dùng shadcn/ui có sẵn.

Không được tự thêm shadcn component bằng CLI.

Không được tự import component chưa chắc tồn tại.

Nếu thiếu component nào, Gemini phải:

* hỏi user gửi file/path,
* hoặc dùng component có sẵn khác,
* hoặc viết fallback tối thiểu theo convention hiện có.

---

### E. Toast/notification convention

Cần biết project dùng gì:

```txt
sonner
useToast
react-hot-toast
custom toast
không có toast
```

Nếu chưa rõ, Gemini phải hỏi.

Không tự cài thêm thư viện toast mới.

---

### F. Zod schema convention

Cần gửi file tree hoặc ví dụ schema hiện có:

```txt
lib/schemas
src/lib/schemas
features/*/schemas
```

Gemini cần biết:

* project đặt Zod schemas ở đâu,
* naming convention thế nào,
* đang dùng `zod` version nào nếu có liên quan.

Nếu không có convention rõ, dùng path đề xuất:

```txt
lib/schemas/admin-course-review.ts
```

nhưng phải nói rõ đây là đề xuất.

---

### G. API/action contract hiện có

Nếu đã có action/API course, gửi các file liên quan:

```txt
admin course actions
teacher course actions
course query functions
server actions liên quan tới courses
API route liên quan tới courses
```

Nếu chưa có API accept/reject thật:

* Gemini KHÔNG được tự implement DB update.
* Gemini chỉ tạo UI gọi function placeholder rõ ràng hoặc nhận props callback từ parent.
* Gemini phải ghi TODO rõ ràng ở nơi wiring.

---

# PHẦN 1: KHỞI TẠO NHÁNH / WORKFLOW

Nếu người dùng có môi trường local/git, tạo branch:

```bash
git fetch --all
git checkout main
git pull origin main
git checkout -b feat/client/admin-course-review-ui
```

Nếu người dùng đang làm bằng Gemini Web không có terminal:

* Không yêu cầu chạy lệnh.
* Người dùng có thể tự tạo branch qua VS Code/GitHub Desktop/GitHub UI.
* Gemini chỉ cần output code theo từng file để người dùng paste vào branch đó.

Tên branch gợi ý:

```txt
feat/client/admin-course-review-ui
```

---

# PHẦN 2: PHÂN TÍCH TRƯỚC KHI CODE

Sau khi nhận đủ context, Gemini phải phản hồi phần phân tích ngắn theo format:

```txt
## Context Check

Đã nhận đủ:
- types/database.ts: có/không
- Course review fields: có/không
- Admin route/layout: path ...
- shadcn/ui components available: ...
- Toast convention: ...
- Zod schema path: ...
- Course API/actions available: có/không

## Implementation Plan

Mình sẽ làm theo các bước:
1. Tạo Zod schema ...
2. Tạo/điều chỉnh admin course page ...
3. Tạo components ...
4. Thêm reject dialog ...
5. Thêm accept dialog ...
6. Thêm teacher reject message alert nếu có file teacher UI ...
```

Chỉ sau khi phân tích xong mới được viết code.

---

# PHẦN 3: SCOPE UI CẦN LÀM

## 3.1. Admin Course Management Page

Page cần có:

```txt
Header:
- Title: Course Management
- Description: Manage, review, publish, and archive courses

Stats cards:
- Total courses
- Draft courses
- Pending review courses
- Published courses
- Total enrollments

Toolbar:
- Search input
- Status filter/tabs

Course table/list:
- Thumbnail
- Title
- Slug
- Price
- Status badge
- Enrollments count nếu data có
- Submitted at
- Reviewed at
- Actions
```

Nếu API/data hiện tại chưa có `enrollments_count`:

* Không tự viết query DB.
* Hiển thị `-` hoặc nhận prop optional.
* Không hardcode số giả.

---

## 3.2. Status filter

Filter cần có:

```txt
All
Draft
Pending
Published
```

Internal value:

```ts
type AdminCourseStatusFilter = "all" | "draft" | "pending" | "published";
```

Không thêm status `rejected`.

---

## 3.3. Search

Search theo:

```txt
title
slug
```

Yêu cầu:

* Trim input.
* Max length theo Zod là 100.
* Không thêm thư viện debounce nếu project chưa có.
* Nếu data client-side thì filter local.
* Nếu data server-side/search params thì follow convention hiện có.

---

## 3.4. Course table columns

Bảng nên có:

```txt
Course:
- thumbnail
- title
- slug

Price:
- formatted VND

Status:
- badge

Enrollments:
- count hoặc "-"

Submitted:
- submitted_at hoặc "-"

Reviewed:
- reviewed_at hoặc "-"

Actions:
- Preview/View
- Accept nếu pending
- Reject nếu pending
```

Nếu màn hình nhỏ bị tràn:

* Bọc table bằng `overflow-x-auto`.
* Không để layout vỡ.

---

# PHẦN 4: SHADCN/UI USAGE RULES

Gemini phải ưu tiên dùng shadcn/ui có sẵn.

Các component nên dùng nếu tồn tại:

```txt
Button
Card
CardHeader
CardTitle
CardDescription
CardContent
Badge
Input
Textarea
Dialog
DialogContent
DialogHeader
DialogTitle
DialogDescription
DialogFooter
AlertDialog
AlertDialogContent
AlertDialogHeader
AlertDialogTitle
AlertDialogDescription
AlertDialogFooter
AlertDialogCancel
AlertDialogAction
Tabs
TabsList
TabsTrigger
Table
TableHeader
TableBody
TableRow
TableHead
TableCell
Alert
AlertTitle
AlertDescription
Skeleton
DropdownMenu
```

Không được:

* Tự import `@/components/ui/...` khi chưa chắc path đúng.
* Tự chạy `npx shadcn add ...`.
* Tự cài package mới.
* Tự viết modal custom nếu Dialog/AlertDialog đã có.
* Tự viết Button/Card/Table mới nếu shadcn đã có.

Nếu component shadcn thiếu:

* Báo thiếu component.
* Dùng component thay thế có sẵn.
* Hoặc output rõ file cần add nếu người dùng cho phép.

---

# PHẦN 5: ZOD VALIDATION

## 5.1. File schema

Gemini phải đặt theo convention repo.

Path gợi ý nếu chưa có convention khác:

```txt
lib/schemas/admin-course-review.ts
```

## 5.2. Các schema cần tạo

Tạo các schema sau:

```ts
adminCourseFilterSchema
acceptCourseSchema
rejectCourseSchema
submitCourseReviewSchema
```

## 5.3. adminCourseFilterSchema

Rules:

```txt
status:
- optional
- enum: all, draft, pending, published

q:
- optional
- string
- trim
- max 100

page:
- optional
- coerce number
- int
- min 1

pageSize:
- optional
- coerce number
- int
- min 1
- max 100

sort:
- optional
- enum: newest, oldest, submitted_desc, submitted_asc
```

Nếu UI chưa dùng `page`, `pageSize`, `sort`, vẫn có thể export schema để dùng sau, nhưng không ép implement pagination nếu chưa có data source phù hợp.

## 5.4. acceptCourseSchema

Rules:

```txt
courseId:
- required
- uuid
```

## 5.5. rejectCourseSchema

Rules:

```txt
courseId:
- required
- uuid

rejectMessage:
- required
- trim
- min 10
- max 1000
```

Error message gợi ý:

```txt
Course ID is invalid.
Rejection reason is required.
Rejection reason must be at least 10 characters.
Rejection reason must be at most 1000 characters.
```

Khi đọc lỗi Zod, bắt buộc dùng:

```ts
validation.error.issues[0].message
```

Không dùng:

```ts
validation.error.errors
```

## 5.6. submitCourseReviewSchema

Rules:

```txt
courseId:
- required
- uuid
```

Schema này có thể dùng cho teacher submit review UI nếu cần.

## 5.7. Server-owned fields

Không tạo input form cho:

```txt
submitted_at
reviewed_by
reviewed_at
```

`reject_message` chỉ được nhập trong Admin Reject Dialog.

---

# PHẦN 6: ACCEPT COURSE UI

## 6.1. Điều kiện hiển thị

Chỉ hiển thị Accept button khi:

```ts
course.status === "pending"
```

## 6.2. Button

Nếu project đã dùng `lucide-react`, dùng icon:

```txt
Check
```

Nếu chưa rõ có `lucide-react` hay không:

* Không tự cài.
* Có thể dùng text button trước.

Button label:

```txt
Accept
```

hoặc:

```txt
Publish
```

## 6.3. Confirm dialog

Bấm Accept phải mở confirm dialog.

Không accept ngay khi bấm icon.

Dialog content:

```txt
Title: Publish this course?
Description: This will make the course visible to students if it meets the public listing rules.
Cancel: Cancel
Confirm: Publish course
```

## 6.4. Loading state

Khi submit:

* Disable confirm button.
* Không cho double submit.
* Text: `Publishing...`

## 6.5. Success/fail

Success:

* Toast: `Course published successfully.`
* Refresh/revalidate/update local state theo convention.

Fail:

* Toast error.
* Không đổi UI sang published nếu server fail.

---

# PHẦN 7: REJECT COURSE UI

## 7.1. Điều kiện hiển thị

Chỉ hiển thị Reject button khi:

```ts
course.status === "pending"
```

## 7.2. Button

Nếu project đã dùng `lucide-react`, dùng icon:

```txt
X
```

hoặc:

```txt
XCircle
```

Nếu chưa rõ, dùng text button.

Button label:

```txt
Reject
```

Variant:

* `destructive`
* hoặc outline destructive theo convention project.

## 7.3. Reject dialog

Bấm Reject phải mở dialog có textarea.

Không reject ngay khi bấm icon.

Dialog content:

```txt
Title: Reject course
Description: Provide a clear reason so the teacher knows what to fix before submitting again.

Textarea label: Rejection reason
Placeholder: Example: Please add a thumbnail and complete at least one exercise before submitting again.

Cancel: Cancel
Confirm: Reject course
```

## 7.4. Validation

Trước khi gọi action/API:

```ts
const validation = rejectCourseSchema.safeParse({
  courseId: course.id,
  rejectMessage,
});

if (!validation.success) {
  setError(validation.error.issues[0].message);
  return;
}
```

Không dùng `.errors`.

## 7.5. Loading state

Khi submit:

* Disable textarea.
* Disable confirm button.
* Text: `Rejecting...`
* Không double submit.

## 7.6. Sau khi reject success

Expected:

* Course chuyển về `draft`.
* Nếu đang filter pending thì course không còn trong list.
* Toast: `Course rejected successfully.`
* Clear local textarea/error/selected course.

Nếu fail:

* Toast error.
* Không đổi UI sang draft nếu server fail.

---

# PHẦN 8: TEACHER SIDE REJECT MESSAGE DISPLAY

Nếu người dùng đã cung cấp teacher course edit/list page, Gemini thêm alert hiển thị reject message.

## 8.1. Điều kiện hiển thị

Chỉ hiển thị khi:

```ts
course.status === "draft" && course.reject_message
```

Không hiển thị ở public client course page.

Không hiển thị khi course `published`.

## 8.2. UI

Ưu tiên dùng shadcn:

```txt
Alert
AlertTitle
AlertDescription
```

Nội dung:

```txt
Title: Course needs revision
Description: {course.reject_message}
```

Helper text optional:

```txt
Please update the course content and submit it for review again.
```

## 8.3. Không clear reject_message ở FE

FE không tự set:

```ts
reject_message = null
```

Việc clear `reject_message` khi submit review lại là business logic của server action/BE.

---

# PHẦN 9: COMPONENT STRUCTURE GỢI Ý

Gemini phải follow structure repo. Nếu chưa có convention rõ, có thể đề xuất:

```txt
app/admin/courses/page.tsx
components/admin/courses/admin-course-stats.tsx
components/admin/courses/admin-course-toolbar.tsx
components/admin/courses/admin-course-table.tsx
components/admin/courses/admin-course-status-badge.tsx
components/admin/courses/accept-course-dialog.tsx
components/admin/courses/reject-course-dialog.tsx
lib/schemas/admin-course-review.ts
```

Không bắt buộc tạo đúng path trên nếu repo khác.

## 9.1. admin-course-stats

Input:

```ts
{
  totalCourses: number;
  draftCourses: number;
  pendingCourses: number;
  publishedCourses: number;
  totalEnrollments?: number;
}
```

Render:

* Card grid.
* Responsive.
* Không hardcode số giả nếu có data thật.

## 9.2. admin-course-toolbar

Input:

```ts
{
  status: "all" | "draft" | "pending" | "published";
  query: string;
  onStatusChange: (...args) => void;
  onQueryChange: (...args) => void;
}
```

Render:

* Search Input.
* Tabs hoặc Select.

## 9.3. admin-course-table

Input:

```ts
{
  courses: AdminCourse[];
  onAccept: (course: AdminCourse) => void;
  onReject: (course: AdminCourse) => void;
  onPreview?: (course: AdminCourse) => void;
}
```

Render:

* Table.
* Empty state.
* Responsive scroll.

## 9.4. admin-course-status-badge

Input:

```ts
{
  status: ItemStatus | string | null;
}
```

Render:

* Draft/Pending/Published badge.
* Fallback unknown.

## 9.5. accept-course-dialog

Input:

```ts
{
  open: boolean;
  course: AdminCourse | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}
```

Không chứa DB logic nếu parent/action convention chưa rõ.

## 9.6. reject-course-dialog

Input:

```ts
{
  open: boolean;
  course: AdminCourse | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { courseId: string; rejectMessage: string }) => Promise<void> | void;
}
```

State local:

* `rejectMessage`
* `validationError`

Behavior:

* Validate bằng Zod.
* Clear state khi close/success.
* Disable khi submitting.

---

# PHẦN 10: DATA TYPE GỢI Ý

Nếu cần tạo type local cho admin UI:

```ts
import type { Course } from "@/types/database";

export type AdminCourse = Course & {
  enrollments_count?: number | null;
};
```

Nếu import alias khác, follow repo.

Không tự copy lại toàn bộ Course interface nếu đã có `types/database.ts`.

Các field nullable phải xử lý:

```txt
thumbnail_url null -> placeholder
submitted_at null -> "-"
reviewed_at null -> "-"
reviewed_by null -> không hiển thị
reject_message null -> không alert
enrollments_count undefined/null -> "-"
```

---

# PHẦN 11: FORMAT PRICE / DATE

## 11.1. Price

Nếu project có helper format price, dùng helper đó.

Nếu chưa có, có thể dùng local helper nhỏ:

```ts
function formatVnd(value: number | null | undefined) {
  if (typeof value !== "number") return "-";

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}
```

Không thêm thư viện mới.

## 11.2. Date

Nếu project có helper format date, dùng helper đó.

Nếu chưa có, có thể dùng local helper:

```ts
function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
```

Phải tránh crash nếu date null/undefined.

---

# PHẦN 12: ACTION/API WIRING

## 12.1. Nếu action/API đã có

Nếu repo đã có function như:

```ts
acceptCourse(...)
rejectCourse(...)
submitCourseForReview(...)
```

Gemini có thể wire UI vào function đó.

Nhưng phải đọc signature thật trước.

Không được tự đoán param.

## 12.2. Nếu action/API chưa có

Không tự implement DB update.

Dùng một trong hai cách:

### Cách A: Component nhận callback từ parent

```ts
onAccept(course)
onReject({ courseId, rejectMessage })
```

### Cách B: Placeholder rõ ràng

```ts
// TODO: Wire this to the real server action when backend review workflow is implemented.
async function handleAcceptCourse(courseId: string) {
  throw new Error("acceptCourse action is not implemented yet");
}
```

Không được fake success trong production UI.

Không được làm code khiến người dùng tưởng accept/reject đã hoạt động thật nếu BE chưa có.

---

# PHẦN 13: MANUAL CHECK / INPUT TEST

Gemini không cần chạy terminal/local DB.

Nhưng phải đưa checklist manual test để người dùng tự check.

## 13.1. UI manual checks

Người dùng sẽ kiểm tra:

```txt
1. Admin course page render không lỗi.
2. Stats cards hiển thị đúng layout.
3. Search input không làm vỡ UI.
4. Filter All/Draft/Pending/Published hoạt động.
5. Pending course có Accept và Reject.
6. Non-pending course không hiện Accept/Reject.
7. Accept mở confirm dialog.
8. Cancel trong accept dialog đóng dialog.
9. Confirm accept có loading state.
10. Reject mở textarea dialog.
11. Reject message rỗng bị chặn.
12. Reject message dưới 10 ký tự bị chặn.
13. Reject message trên 1000 ký tự bị chặn.
14. Reject message hợp lệ gọi đúng callback/action.
15. Loading state disable button/input.
16. Dialog đóng xong không giữ error cũ.
17. Course thiếu thumbnail không broken image.
18. submitted_at null hiển thị "-".
19. reviewed_at null hiển thị "-".
20. enrollments_count thiếu hiển thị "-".
21. Teacher draft course có reject_message thì hiện alert.
22. Public/client course page không bị đụng.
```

## 13.2. Zod input tests

Gemini phải liệt kê test cases:

```ts
rejectCourseSchema.safeParse({
  courseId: "invalid",
  rejectMessage: "Valid message here",
});
// fail

rejectCourseSchema.safeParse({
  courseId: "valid-uuid",
  rejectMessage: "",
});
// fail

rejectCourseSchema.safeParse({
  courseId: "valid-uuid",
  rejectMessage: "short",
});
// fail

rejectCourseSchema.safeParse({
  courseId: "valid-uuid",
  rejectMessage: "A".repeat(1001),
});
// fail

rejectCourseSchema.safeParse({
  courseId: "valid-uuid",
  rejectMessage: "Please add a thumbnail before submitting again.",
});
// success
```

Nếu dùng UUID giả trong ví dụ, phải dùng UUID đúng format:

```txt
550e8400-e29b-41d4-a716-446655440000
```

---

# PHẦN 14: OUTPUT FORMAT BẮT BUỘC CỦA GEMINI

Gemini phải output code theo từng file, không trộn lẫn.

Format:

````txt
## File 1: path/to/file.ts

```ts
// full content or patch
````

## File 2: path/to/file.tsx

```tsx
// full content or patch
```

## Manual checks

* ...

````

Nếu sửa file có sẵn:
- Nói rõ “replace whole file” hoặc “replace this block”.
- Nếu chỉ đưa patch, phải ghi rõ vị trí cần thay.
- Không đưa code mơ hồ kiểu “add this somewhere”.

Nếu cần thêm context:
- Không output code.
- Chỉ output danh sách file cần gửi thêm.

---

# PHẦN 15: COMMIT / PR

Nếu người dùng tự có local git thì commit:

```bash
git add .
git commit -m "feat(admin): implement course review management UI"
git push origin feat/client/admin-course-review-ui
````

Nếu đang làm qua Gemini Web:

* Gemini không cần chạy lệnh.
* Người dùng sẽ tự paste code, manual check, commit/push.

PR title gợi ý:

```txt
feat(admin): implement course review management UI
```

PR description gợi ý:

```md
## Summary

- Add Admin Course Review UI for managing draft, pending, and published courses.
- Add status filter/search UI.
- Add pending course accept/reject dialogs.
- Add Zod validation for course review actions.
- Add teacher-side reject message display when applicable.

## Scope

No database migration.
No RLS changes.
No public course loading changes.
No course status enum changes.
No backend business logic implemented unless existing actions were already available.

## Manual checks

- Admin course page renders.
- Status filter works.
- Search works.
- Accept dialog opens and handles loading state.
- Reject dialog validates rejection reason.
- Teacher reject message alert renders for draft rejected courses.
```

---

# PHẦN 16: NHỮNG ĐIỀU TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM

Gemini không được:

1. Không tự sửa database migration.
2. Không tự chạy hoặc yêu cầu chạy Supabase local DB.
3. Không tự sửa `types/database.ts` nếu không được yêu cầu.
4. Không tự thêm status `rejected`.
5. Không tự đổi `ItemStatus`.
6. Không tự sửa RLS.
7. Không tự implement server action update DB nếu task chưa yêu cầu.
8. Không tự fake accept/reject success trong production UI.
9. Không tự cài package mới.
10. Không tự chạy shadcn CLI.
11. Không tự import shadcn component chưa chắc tồn tại.
12. Không tự đổi public course loading API.
13. Không refactor lan man admin layout.
14. Không rewrite toàn bộ course module.
15. Không dùng `validation.error.errors`; phải dùng `validation.error.issues`.
16. Không hardcode production mock data nếu chưa được yêu cầu.
17. Không để button submit bị double click.
18. Không để reject dialog submit khi message invalid.
19. Không crash khi field nullable.
20. Không output code khi context chưa đủ.

---

# 12-RULE BEHAVIOR CONTRACT

AI bắt buộc tuân thủ 12 quy tắc này trong suốt task.

1. Think Before Coding
   Đọc context, hiểu convention, xác nhận đủ file rồi mới code.

2. Simplicity First
   Làm đúng scope UI/Zod. Không thêm tính năng tương lai.

3. Surgical Changes
   Chỉ sửa file cần thiết. Không refactor lan man.

4. Goal-Driven Execution
   Mục tiêu là admin course review UI + Zod validation + teacher reject message display nếu có context.

5. Use Model Only for Judgment Calls
   Không đoán bừa path/component/API. Thiếu gì thì hỏi.

6. Token Budgets are Not Advisory
   Không viết lan man. Chia code theo từng file, từng step.

7. Surface Conflicts, Don't Average Them
   Nếu SOP mâu thuẫn với codebase thật, báo rõ conflict.

8. Read Before I Write
   Phải nhận và đọc đủ context trước khi output code.

9. Tests Verify Intent, Not Behavior
   Manual check phải kiểm tra đúng intent: filter, reject validation, dialog loading, nullable fields.

10. Checkpoint After Every Step
    Sau mỗi phase, tóm tắt đã làm và cần file gì tiếp theo nếu thiếu.

11. Match Conventions, Even If I Disagree
    Follow repo convention về folder, import alias, shadcn path, toast, Zod.

12. Fail Loud
    Thiếu API, thiếu shadcn component, thiếu database field, thiếu teacher page thì phải nói rõ. Không im lặng bịa code.
