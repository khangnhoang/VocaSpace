# ADR: Refactor exercise authoring flow

## Status

Accepted.

Tài liệu này ghi lại trạng thái hiện tại của PR/refactor cho luồng authoring bài tập trong VocaSpace.

## Context / Problem

Luồng tạo bài tập trước đây được orchestration trong Server Actions bằng nhiều lời gọi Supabase client riêng lẻ. Một lần tạo bài tập có thể ghi qua nhiều tầng dữ liệu:

- `exercises`
- `question_groups`
- `questions`
- `question_options`

Cách làm này khiến multi-table writes dễ rơi vào trạng thái dở dang nếu một bước giữa chừng thất bại. Nó cũng làm luồng mutation dễ va vào RLS, vì từng update/insert riêng lẻ phải đi qua policy của từng bảng.

Các vấn đề chính trước refactor:

- Exercise creation nằm trong `app/actions/exercise.ts` với nhiều Supabase client calls tách rời.
- Multi-table writes fragile dưới RLS, đặc biệt khi thao tác với `question_options`.
- Dynamic question options chưa được xử lý sạch; UI và payload từng bị giả định cứng A-D.
- `question_options.order_index` chưa có trước PR1, nên thứ tự option thiếu nguồn dữ liệu rõ ràng.
- Khi edit question, xóa option trong UI chỉ xóa local state nhưng DB row vẫn active.
- Xóa parent entities có thể để lại active child rows.
- Raw DB/RLS errors có thể leak ra UI.
- Manual QA gặp lỗi `new row violates row-level security policy for table "question_options"` khi xóa exercise/group paths.
- Course/topic authoring cũng lộ các vấn đề liên quan: `courses` SELECT RLS cần temporary admin visibility fix, và topic creation cần truyền/derive đúng `course_id`.

## Decision

Thiết kế được chọn là chuyển các multi-table mutations phức tạp vào PostgreSQL RPCs transaction-safe, còn Server Actions giữ vai trò mỏng hơn:

- kiểm tra auth/session;
- validate và normalize payload;
- gọi RPC;
- map DB/RPC error codes sang thông báo tiếng Việt thân thiện.

Các quyết định cụ thể:

- Dùng `create_exercise_with_content` cho transactional exercise creation.
- Dùng `sync_question_with_options` cho full-list question/options sync khi edit question.
- Dùng `soft_delete_exercise_cascade` cho explicit exercise soft-delete cascade.
- Soft-delete cascade được thực hiện rõ ràng thay vì dựa vào side effect hoặc giả định RLS.
- Submitted option arrays được xem là final desired state.
- Chỉ active `question_options` tham gia ordering. Sau mỗi full-list sync, active rows được reindex riêng thành dãy liên tục zero-based: 0, 1, 2, 3...
- Labels của options được derive theo final order: A, B, C, D...
- Soft-deleted option không tham gia active ordering và không giữ một reserved slot. Row đó giữ `order_index` tại thời điểm bị xóa như recovery/audit hint; giá trị này có thể trùng với một active row vì uniqueness chỉ áp dụng cho active rows.
- Restore option là một mutation riêng có transactional reconciliation: chọn vị trí chèn, xử lý active-order conflict, reindex active rows và derive lại labels. Không restore bằng cách chỉ đặt `removed_at = NULL`.
- Group/question `order_index` giữ theo convention hiện tại, chưa đổi trong PR này.
- Group-level delete UI được ẩn cho tới khi luồng group creation/replacement hoàn chỉnh hơn.
- Thêm local seed data trong `supabase/seed.sql` để manual QA deterministic sau `npx supabase db reset`.
- Thêm unit tests cho Server Action behavior và integration tests cho RPC-backed flows.

## Main changes

Các vùng thay đổi quan trọng:

- `create_exercise_with_content`
- `sync_question_with_options`
- `soft_delete_exercise_cascade`
- temporary course SELECT RLS migration cho `"Select courses dynamic filter"`
- `app/actions/exercise.ts`
- teacher exercise UI dynamic options trong `AddExerciseDialog.tsx` và edit modal trong `ExerciseTab.tsx`
- learner option ordering trong learner-side display/action code
- `supabase/seed.sql`
- unit tests và integration tests cho authoring/RPC behavior

## Invariants

Các rule cần giữ sau refactor:

- Soft-delete `exercise` phải soft-delete active `question_groups`, `questions`, và `question_options` bên dưới.
- Soft-delete `question_group` phải soft-delete active `questions` và `question_options` bên dưới.
- Soft-delete `question` phải soft-delete active `question_options` bên dưới.
- Removing một option trong edit question chỉ soft-delete đúng option đó khi save.
- Một question phải có ít nhất 2 valid options sau khi trim và skip empty rows.
- Một question phải có ít nhất 1 correct option trong các valid options còn lại.
- Một group không được trở thành empty.
- Một exercise không được trở thành empty.
- Active `question_options.order_index` là dãy liên tục zero-based ở write path và display/sort path; soft-deleted rows bị loại khỏi dãy này và giữ index cũ làm recovery/audit hint.
- Backfill hoặc constraint hardening phải xử lý active và soft-deleted rows riêng. Soft-deleted rows không được làm dịch hoặc tạo gap trong active order; existing non-null index của soft-deleted rows không được rewrite chỉ để compact active order.
- Không expose raw DB/RLS errors cho user-facing UI.

## Trade-offs

Refactor này tăng độ phức tạp ở SQL/RPC layer. Các function PL/pgSQL dài và khó đọc hơn simple Server Action CRUD. Nó cũng tạo thêm migrations và yêu cầu integration tests thật với local Supabase.

Đổi lại, hệ thống có consistency tốt hơn cho multi-table writes. RPC function call chạy trong một PostgreSQL transaction, nên failure trong function rollback các mutation trước đó. Permission cũng được kiểm tra gần dữ liệu hơn, giúp giảm rủi ro RLS mismatch trong authoring workflows.

Thiết kế này kém linh hoạt hơn direct client updates từ Server Actions, nhưng an toàn hơn cho các workflow cần ghi nhiều bảng cùng lúc và cần soft-delete cascade rõ ràng.

## Alternatives considered

### Keep all logic in Server Actions

Không chọn vì multi-table writes vẫn là nhiều request riêng lẻ, dễ partial write và dễ lỗi RLS giữa chừng. Cách này cũng khiến Server Action phình to và khó test rollback thật.

### Patch RLS policies only

Không chọn vì policy fix không giải quyết atomicity. Ngay cả khi RLS cho phép từng update, failure ở bước sau vẫn có thể để DB ở trạng thái không nhất quán.

### Add frontend-only fixes

Không chọn vì UI local state không phải source of truth. Ví dụ xóa option trong modal có thể biến mất khỏi UI nhưng DB row vẫn active nếu backend không full-sync.

### Hard delete children

Không chọn vì project đang dùng soft-delete conventions. Hard delete sẽ phá auditability, khó khôi phục dữ liệu, và không khớp với các `removed_at` paths hiện có.

## Testing / Verification

Manual QA đã pass từ UI tới API behavior và database state. Cụ thể, xóa exercise làm exercise biến mất khỏi teacher UI và `removed_at` được set cho exercise cùng descendants.

Các lệnh/nhóm kiểm tra đã chạy trong PR:

- `npx supabase db reset`
- `npx tsc --noEmit`
- unit tests cho Server Actions
- integration tests cho RPC-backed flows

Rollback/atomicity được kiểm tra bằng failure cases thật trong RPC, ví dụ invalid payload, permission failure, và option sync error. Test không giả định hoặc tuyên bố mô phỏng được network loss sau khi RPC đã được gửi; phạm vi xác minh là khi RPC raise exception thì database không bị bỏ lại ở trạng thái half-mutated.

## Risks / TODO

- Temporary course SELECT RLS fix nên được revisit khi refactor rộng hơn course visibility policy.
- Group-level delete hiện được ẩn có chủ ý; cần redesign sau khi group creation/replacement flow rõ ràng hơn.
- UI tests cho React Hook Form dynamic options chưa được cover.
- Media upload vẫn nằm ngoài scope.
- Permission helpers có thể được cleanup sau để giảm duplication giữa Server Actions và RPCs.
- Restore `question_options` chưa được implement. Nếu bổ sung, phải dùng RPC/mutation riêng để reconcile stored recovery hint với active zero-based order và partial unique invariant.
