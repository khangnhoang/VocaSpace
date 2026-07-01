# Nhật ký vấn đề tái cấu trúc quy trình làm việc của giáo viên

## Mục đích

File này là nơi ghi chi tiết các vấn đề, rủi ro, follow-up và technical debt được phát hiện trong chuỗi tái cấu trúc teacher workflow. Progress tracker chỉ nên giữ trạng thái PR, nhánh/PR, checkpoint, verification summary và link về nhật ký này khi cần giải thích dài.

## Quy ước trạng thái

- `Đang mở`: cần xử lý trong PR đang active hoặc PR gần nhất.
- `Cần quyết định`: cần owner/product review trước khi implement.
- `Deferred`: đã biết nhưng nằm ngoài scope PR hiện tại.
- `Đã xử lý`: đã có commit/PR giải quyết, giữ lại để tra cứu lịch sử.
- `Theo dõi`: chưa phải bug xác nhận nhưng cần kiểm tra lại khi thay đổi cùng khu vực.

## Vấn đề đang mở

### PR7-ORDER-001: Chapter/topic ordering chưa có RPC atomic

- Trạng thái: Đã xử lý trong PR7.
- Phát hiện ở: PR4 structure workspace và PR7 Checkpoint 1/1B discovery.
- Mô tả: `createChapter` và `createTopic` hiện tính `order_index` kế tiếp trong Server Action bằng `max(order_index) + 1`. Cách này không chạy trong một RPC atomic, không khóa scope sắp xếp, và không tự bảo vệ khi nhiều teacher action đồng thời đọc cùng giá trị `max`.
- Tác động: Đây chưa nhất thiết là bug người dùng đang thấy, nhưng là khoảng hở an toàn dữ liệu. Nếu database không enforce active unique order, concurrent create/move có thể tạo duplicate active order trong cùng course/chapter.
- Hướng xử lý: PR7 đã thêm RPC một bước cho move up/down và harden create ordering. UI gửi `id + direction` cho move; database/RPC chọn neighbor từ trạng thái DB mới nhất, khóa phạm vi cần thiết, swap trong transaction và trả kết quả ổn định. Chi tiết create hardening ở `PR7-ORDER-004`.
- Verification: RPC integration tests, action/schema tests, component tests và smoke E2E đã cover create ordering, move thành công, first/last no-op, unauthorized actor, soft-deleted rows, duplicate/race-sensitive invariant và persisted order sau refresh/reopen.
- Ghi chú: Append-create race không còn defer ngoài PR7; đây là deliberate scope expansion đã được implement.

### PR7-ORDER-002: Chưa có active unique ordering constraint/index cho chapter/topic

- Trạng thái: Đã xử lý trong PR7 local/migration; production preflight vẫn là deploy gate.
- Phát hiện ở: PR7 Checkpoint 1/1B migration/schema audit và local DB read-only query.
- Mô tả: Không tìm thấy unique constraint/index active-only cho `chapters(course_id, order_index)` hoặc `topics(chapter_id, order_index)`. Local DB không có duplicate active order, nhưng fixture quá nhỏ nên không chứng minh được production an toàn.
- Tác động: Duplicate active order sẽ khiến ordering phụ thuộc tie-breaker phòng thủ. Các path không dùng cùng tie-breaker, nên behavior có thể khó đoán nếu dữ liệu bị lệch.
- Hướng xử lý: PR7 migration thêm partial unique indexes active-only cho `chapters(course_id, order_index)` và `topics(chapter_id, order_index)`, đồng thời fail loud nếu dữ liệu active duplicate đã tồn tại thay vì renumber legacy data trong PR7.
- Verification: local migration/RPC verification và integration tests đã chứng minh active unique invariant, soft-deleted rows không chặn active order, và move/create giữ invariant. Production vẫn cần read-only preflight ở `PR7-PROD-001` trước khi push/apply migration.
- Ghi chú: Topic order chỉ unique trong `chapter_id`; topic `order_index` trùng giữa các chapter là hợp lệ.

### PR7-ORDER-003: Batch full-list ordering không thuộc MVP PR7

- Trạng thái: Theo dõi; quyết định MVP đã chốt.
- Phát hiện ở: Trao đổi PR7 discovery khi user ban đầu nghĩ tới drag-and-drop reorder.
- Mô tả: Batch full-list ordering được cân nhắc vì owner ban đầu nhầm PR7 với future drag-and-drop reorder, nơi UI thường gửi toàn bộ danh sách đã sắp xếp. PR7 MVP không làm drag-and-drop, bulk reorder hoặc cross-chapter movement.
- Tác động: Nếu UI gửi cả list cho một thao tác move nhỏ, payload lớn hơn, dễ stale, và đẩy quá nhiều quyền quyết định ordering lên client.
- Hướng xử lý: PR7 dùng move up/down một bước. UI chỉ gửi `id + direction`; DB/RPC tự chọn neighbor từ latest DB state.
- Verification cần có: tests không phụ thuộc client gửi danh sách đầy đủ; Server Action reject/ignore payload ngoài contract nếu có schema boundary.
- Ghi chú: Batch full-list ordering để dành cho drag-and-drop hoặc bulk reorder tương lai.

### PR7-ORDER-004: Create chapter/topic cần RPC atomic và parent lock

- Trạng thái: Đã xử lý trong PR7.
- Phát hiện ở: PR7 Checkpoint 2C scope correction.
- Mô tả: `createChapter` và `createTopic` hiện tính next order trong Server Actions. Cách này không DB-atomic, không khóa parent row và có thể đọc cùng `max(order_index)` khi nhiều request tạo cùng lúc.
- Tác động: Nếu create tiếp tục nằm ngoài transaction/RPC an toàn, partial unique index active-only có thể fail loud khi concurrent create đụng order; nếu không có unique index thì có thể sinh duplicate active order trong cùng scope.
- Hướng xử lý: PR7 đã fix thay vì defer. Create chapter khóa parent row là course; create topic khóa parent row là chapter. RPC tính next order bằng `max(order_index) + 1`, tính theo tất cả row trong cùng scope gồm cả soft-deleted rows, rồi insert trong cùng transaction.
- Chính sách soft-delete: Không tái sử dụng slot của row đã soft-delete. Soft-deleted rows có thể giữ `order_index` cũ để future restore an toàn hơn; move chỉ xét active rows làm visible neighbors.
- Verification: local preflight/migration verification, RPC integration tests, action tests và smoke E2E đã cover create chapter/topic ordered path, permission/failure shapes, persisted order và không reuse soft-delete slots.
- Ghi chú: Đây là deliberate scope expansion của PR7 để ordering safety bao phủ cả create và move.

### PR7-ORDER-005: Move up/down bỏ qua row soft-delete nhưng giữ slot cũ

- Trạng thái: Đã xử lý trong PR7.
- Phát hiện ở: PR7 Checkpoint 2D edge-case clarification.
- Mô tả: Soft-deleted chapter/topic rows là thùng rác/archive rows để future restore an toàn hơn. Move up/down chỉ được chọn nearest active sibling, không chọn nearest row bất kể `removed_at`.
- Ví dụ topic:

```text
Active topic A: order_index = 1
Soft-deleted topic B: order_index = 2
Active topic C: order_index = 3
```

Visible UI chỉ hiện:

```text
A
C
```

Khi teacher move C up, B bị bỏ qua vì là soft-deleted row; active neighbor phía trên C là A. C swap với A, còn B giữ `order_index = 2`:

```text
C active: order_index = 1
B soft-deleted: order_index = 2
A active: order_index = 3
```

Visible UI trở thành:

```text
C
A
```

- Quy tắc chapter tương tự: active chapter 1, soft-deleted chapter 2, active chapter 3; khi move active chapter 3 up thì chapter 3 swap với active chapter 1, còn soft-deleted chapter 2 giữ slot cũ.
- Future restore implication: Nếu B hoặc chapter 2 được khôi phục trong 7 ngày từ `removed_at` và slot stored order vẫn safe, visible order có thể trở thành C, B, A. Đây là hành vi có chủ ý vì PR7 giữ soft-deleted rows như thùng rác restore-safe.
- Implementation implication: Move RPCs phải tìm nearest active sibling; không move hoặc mutate soft-deleted siblings; soft-deleted rows bị bỏ qua khi chọn visible neighbor nhưng vẫn ở table với `order_index` cũ. Create RPCs vẫn tính next order bằng `max(order_index) + 1` theo tất cả row trong cùng scope, nên không tái sử dụng hidden/deleted slots. Partial unique indexes chỉ áp dụng cho active rows.
- Unique-index swap concern: Nếu active unique index đã tồn tại, naive two-row swap có thể vi phạm uniqueness tạm thời. Ví dụ A active order 1 và C active order 3; nếu set C thành 1 khi A vẫn là 1, partial unique index active-only có thể reject. PR7 RPC phải dùng safe swap strategy trong cùng transaction, ví dụ temporary order value hoặc một chiến lược Postgres-safe swap/renumber đã được chứng minh.
- Verification: RPC integration tests cover move qua soft-deleted gap, leading/trailing soft-deleted rows, first/last no-op và active unique invariant cho chapter/topic; action tests cover safe error/result shape; smoke E2E cover persisted visible ordering.
- Ghi chú: PR7 RPC dùng safe swap trong transaction để tránh temporary conflict với partial unique indexes.

### PR7-PROD-001: Cần preflight production DB trước khi push migration/order constraint

- Trạng thái: Đang mở / deploy gate.
- Phát hiện ở: PR7 Checkpoint 1/1B discovery và yêu cầu Checkpoint 2A.
- Mô tả: Local migration tests và E2E server tests không đủ để chứng minh production data không có duplicate active order hoặc constraint/index khác kỳ vọng.
- Tác động: Production `db push` có thể fail giữa chừng hoặc khóa rollout nếu existing data vi phạm partial unique index. Tệ hơn, nếu bỏ constraint vì thiếu preflight thì race condition vẫn còn.
- Hướng xử lý: Trước mọi production `db push` hoặc production migration application:
  1. Chạy migration locally.
  2. Chạy relevant integration/E2E tests locally.
  3. Chạy read-only production preflight SQL.
  4. Xác nhận không có active duplicate order trong production.
  5. Xác nhận production constraints/indexes đúng kỳ vọng.
  6. Chỉ sau đó mới xin explicit approval để push DB changes lên production.
- Verification cần có: ghi lại kết quả SQL read-only và exact command đã chạy. Không chạy production write SQL hoặc migration nếu chưa có approval rõ.
- Ghi chú: Nếu môi trường hiện tại không có production DB access, dùng checklist SQL bên dưới làm handoff bắt buộc.

Read-only SQL bắt buộc trước production DB push:

```sql id="chapter_duplicate_order_check"
select course_id, order_index, count(*) as row_count
from chapters
where removed_at is null
group by course_id, order_index
having count(*) > 1
order by row_count desc, course_id, order_index;
```

```sql id="topic_duplicate_order_check"
select chapter_id, order_index, count(*) as row_count
from topics
where removed_at is null
group by chapter_id, order_index
having count(*) > 1
order by row_count desc, chapter_id, order_index;
```

```sql id="chapter_invalid_order_check"
select id, course_id, order_index
from chapters
where removed_at is null
  and (order_index is null or order_index < 0);
```

```sql id="topic_invalid_order_check"
select id, chapter_id, order_index
from topics
where removed_at is null
  and (order_index is null or order_index < 0);
```

```sql id="chapter_topic_index_inspection"
select schemaname, tablename, indexname, indexdef
from pg_indexes
where tablename in ('chapters', 'topics')
order by tablename, indexname;
```

```sql id="chapter_topic_constraint_inspection"
select conname,
       conrelid::regclass as table_name,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('chapters'::regclass, 'topics'::regclass)
order by table_name, conname;
```

Command mẫu read-only khi có connection string production đã được owner cung cấp:

```powershell
psql "<PRODUCTION_DATABASE_URL>" -v ON_ERROR_STOP=1 -c "<READ_ONLY_SQL>"
```

### PR7-E2E-001: E2E Supabase runtime có schema riêng với root local Supabase

- Trạng thái: Đã xử lý trong 4B; giữ làm quy tắc vận hành.
- Phát hiện ở: PR7 Checkpoint 4B E2E/browser QA hardening.
- Mô tả: Root local Supabase DB và E2E Supabase DB/workdir có thể khác nhau. Root local `supabase db reset` không đủ nếu Playwright/E2E chạy với `.e2e-runtime` hoặc `_e2e` containers riêng.
- Tác động: Sau khi thêm migration/RPC mới, E2E có thể báo PostgREST không tìm thấy RPC dù root local DB đã có function, vì runtime E2E đang stale.
- Hướng xử lý: Khi E2E dùng migration/RPC mới, reset/apply migrations cho E2E Supabase workdir, ví dụ `npx.cmd supabase --workdir .e2e-runtime db reset`, rồi xác nhận function tồn tại trong E2E DB trước khi chạy Playwright. Nếu function đã tồn tại nhưng PostgREST vẫn báo missing, restart E2E Supabase/PostgREST để refresh schema cache.
- Ghi chú: Quy tắc này chỉ áp dụng local/E2E. Không chạy reset, migration apply hoặc schema-cache workaround lên production khi chưa có explicit owner approval.

### PR4-SOFT-001: Hidden chapter không cascade soft-delete xuống topics

- Trạng thái: Theo dõi.
- Phát hiện ở: PR4 structure workspace.
- Mô tả: Khi chapter bị hidden, descendant topics không bị cascade `removed_at`. Topic builder guard vì vậy phải kiểm tra parent chapter active ở boundary authoring.
- Tác động: Nếu một path bỏ qua parent-active guard, topic thuộc hidden chapter có thể vẫn được mở trực tiếp.
- Hướng xử lý: Giữ explicit parent active check ở mọi authoring boundary. Nếu sản phẩm cần archive/restore cả descendant tree, thiết kế RPC/migration riêng.
- Verification cần có: tests cho direct topic builder URL khi parent chapter hidden; regression khi chạm authoring guard.
- Ghi chú: Không kéo cascade archive/restore vào PR7 nếu chỉ làm ordering.

### PR6-CONTENT-001: Chưa có repair UI trực tiếp cho orphan questions

- Trạng thái: Deferred.
- Phát hiện ở: PR6 deep links/return feedback.
- Mô tả: `exercise_has_orphan_questions` vẫn chưa có UI sửa trực tiếp để gắn question vào group hợp lệ.
- Tác động: Dashboard/readiness có thể báo issue nhưng teacher chưa có một thao tác sửa trực tiếp hoàn chỉnh cho case này.
- Hướng xử lý: Thiết kế repair flow riêng trong topic builder/exercise authoring khi có scope rõ.
- Verification cần có: component/action tests cho repair flow và readiness issue biến mất sau persisted fix.
- Ghi chú: PR6 cố ý không tạo fake success feedback cho case này.

### PROG-001: Tracker có một số note cũ cần reconcile dần

- Trạng thái: Theo dõi.
- Phát hiện ở: PR7 Checkpoint 2A documentation hygiene.
- Mô tả: Progress tracker có vài ghi chú lịch sử từng đúng tại thời điểm viết nhưng đã stale sau các PR sau đó. Ví dụ PR6 đã merge theo local Git history, và follow-up shared E2E infrastructure đã có PR riêng.
- Tác động: Người đọc có thể hiểu nhầm trạng thái hiện tại nếu chỉ đọc phần lịch sử dài.
- Hướng xử lý: Khi chạm section PR nào, chỉ cập nhật phần summary/status cần thiết và chuyển chi tiết vấn đề sang file này thay vì rewrite toàn bộ tracker.
- Verification cần có: dùng Git history hoặc PR reference rõ; không đoán trạng thái GitHub nếu local history không chứng minh.
- Ghi chú: Checkpoint 2A đã reconcile PR6 merge metadata vì local Git history có `8519fb4 Merge pull request #33`.

## Vấn đề đã xử lý

### PR5-CARD-001: Flashcard soft-delete từng fail do RLS visibility

- Trạng thái: Đã xử lý.
- Phát hiện ở: PR5 tracker note, xử lý trong PR6 bugfix.
- Mô tả: Soft deleting a flashcard từng fail với RLS error trên bảng `cards` vì row sau khi set `removed_at` không còn thỏa SELECT policy active-only.
- Tác động: Teacher không thể xóa mềm flashcard ổn định.
- Hướng xử lý đã làm: Commit `0994806 fix(flashcards): repair card soft delete authorization` thêm policy staff select deleted, action validation, returned-row verification và tests.
- Verification đã có: action test, RLS integration test và flashcard delete smoke E2E trong PR6.
- Ghi chú: Giữ lại để nhắc rằng soft-delete + returned row + RLS cần audit kỹ khi thêm mutations mới.

### PR6-RETURN-001: Dashboard return freshness từng bị stale issue params

- Trạng thái: Đã xử lý.
- Phát hiện ở: PR6 Checkpoint 4.
- Mô tả: Dashboard vốn đọc lại dữ liệu DB hiện tại; lỗi thật là URL vẫn giữ issue params cũ sau khi teacher đổi tab.
- Tác động: Return feedback/issue context có thể trông như issue chưa được xử lý đúng.
- Hướng xử lý đã làm: Commit `f29228e fix(course-authoring): clean dashboard issue params after return feedback` cleanup URL bằng current browser URL và giữ active `tab`.
- Verification đã có: E2E chứng minh issue đã resolve biến mất sau khi quay lại overview/refresh.
- Ghi chú: Không cần stored resolved status cho MVP.

### PR6-CTA-001: Generic dashboard CTA từng rơi vào topic builder/exercises

- Trạng thái: Đã xử lý.
- Phát hiện ở: PR6 generic CTA fix.
- Mô tả: Khi `primaryCta` không đến từ issue cụ thể, CTA generic từng mở first topic/topic builder và thường rơi vào `exercises`.
- Tác động: Teacher bị đưa tới surface quá cụ thể khi chỉ cần chọn nơi tiếp tục authoring.
- Hướng xử lý đã làm: Commit `623deba fix(course-dashboard): route generic authoring CTA to structure` đưa generic CTA về `/courses/[courseId]/structure`.
- Verification đã có: readiness expectation/test update trong PR6.
- Ghi chú: Issue-derived CTA vẫn giữ deep link cụ thể.

### PR6-TOAST-001: Shared toaster từng theo system dark theme ngoài ý muốn

- Trạng thái: Đã xử lý.
- Phát hiện ở: PR6 toast fix.
- Mô tả: Shared Sonner toaster theo `next-themes`, khiến user/teacher/admin toast có thể chuyển tối theo OS preference.
- Tác động: Toast có thể lệch visual expectation trên các route hiện dùng light UI.
- Hướng xử lý đã làm: Commit `e730689 fix(toasts): default shared toaster to light theme`.
- Verification đã có: component test và focused browser review trong PR6.
- Ghi chú: Không thêm theme-system mới trong PR6.

### PR6-TEST-001: Shared E2E test infrastructure

- Trạng thái: Đã xử lý.
- Phát hiện ở: PR6 deferred follow-up.
- Mô tả: PR6 ghi nhu cầu tách helper login, Supabase admin client, fixtures, cleanup và browser helpers để giảm lặp lại trong E2E.
- Tác động: Nếu không tách, smoke specs dễ dài và khó bảo trì.
- Hướng xử lý đã làm: Local Git history cho thấy PR #34 `refactor/e2e-test-support` đã merge tại `4e7e255`.
- Verification đã có: các commit PR #34 ghi nhận helper extraction và docs update.
- Ghi chú: Progress tracker chỉ cần nhắc ngắn khi section liên quan được chạm tiếp.

## Vấn đề deferred / ngoài scope

### FUTURE-ORDER-001: Drag-and-drop reorder và cross-chapter movement

- Trạng thái: Deferred.
- Phát hiện ở: plan PR7.
- Mô tả: Drag-and-drop, moving topics across chapters, bulk reorder UI và rich optimistic drag behavior không thuộc MVP PR7.
- Tác động: PR7 phải ưu tiên accessible move up/down, keyboard/mobile friendly.
- Hướng xử lý: Chỉ mở lại sau khi deterministic ordering và DB invariant đã ổn định.
- Verification cần có: future drag/drop phải có keyboard/mobile fallback hoặc tương đương accessible controls.
- Ghi chú: Không dùng batch full-list contract trong PR7 chỉ để chuẩn bị cho future drag-and-drop.

### FUTURE-TRASH-001: Thùng rác chapter/topic có thể khôi phục trong 7 ngày

- Trạng thái: Deferred/future feature.
- Phát hiện ở: PR7 Checkpoint 2C scope correction.
- Mô tả: Soft-delete có thể được xem như trạng thái thùng rác/archive cho chapter/topic. Future feature có thể cho khôi phục trong 7 ngày từ `removed_at`.
- Tác động: PR7 không implement restore UI và không implement purge/hard-delete cleanup, nhưng ordering trong PR7 không nên chặn policy tương lai này.
- Hướng xử lý: Soft-deleted rows có thể giữ `order_index` cũ. Create không tái sử dụng slot của row đã soft-delete vì next order được tính theo tất cả row trong cùng scope. Move bỏ qua soft-deleted rows và chỉ xét active rows.
- Restore policy tương lai: Nếu khôi phục trong 7 ngày từ `removed_at` và stored `order_index` vẫn safe thì có thể preserve stored order. Nếu gặp conflict từ legacy/manual data, restore phải fail safely hoặc có explicit conflict policy trước khi ship.
- Purge policy tương lai: Purge sau 7 ngày có thể hard-delete/cleanup ngoài scope PR7.
- Verification cần có: future restore/purge cần tests riêng cho conflict, active unique invariant và behavior sau purge.
- Ghi chú: Đây là future feature, ngoài scope PR7.

### FUTURE-STRUCTURE-001: Dedicated structure-list UX

- Trạng thái: Deferred.
- Phát hiện ở: PR6 Checkpoint 5.
- Mô tả: Cần cân nhắc chapter categories, optional search khi list dài, highlight chapter vừa tạo, nhãn “Chương vừa thêm”, và guidance “Thêm bài học ngay”.
- Tác động: Có thể cải thiện scanability của structure workspace nhưng không chặn PR6 deep links hoặc PR7 ordering MVP.
- Hướng xử lý: Thiết kế riêng sau khi có per-chapter topic summary/state và quyết định UX rộng hơn.
- Verification cần có: component tests cho filter/search/highlight và manual QA mobile/keyboard nếu implement.
- Ghi chú: Không kéo vào PR7 trừ khi move controls cần metadata tối thiểu đã có sẵn.

### FUTURE-ANALYTICS-001: Analytics vẫn cần secure aggregate contract

- Trạng thái: Deferred/Post-MVP.
- Phát hiện ở: plan PR8/PR9 và các progress notes PR5.
- Mô tả: Dashboard MVP không được trình bày learner analytics, enrollment count hoặc unsupported trend khi chưa có secure aggregate contract.
- Tác động: Tránh UI nói quá dữ liệu hoặc expose learner-owned data không đúng boundary.
- Hướng xử lý: Giữ analytics ở PR8/PR9 hoặc phase post-MVP có approval rõ.
- Verification cần có: RLS/RPC/action/schema tests cho aggregate contract nếu mở lại.
- Ghi chú: Không liên quan trực tiếp PR7.
