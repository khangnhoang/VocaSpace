# Kế hoạch triển khai Wave B — PR B1: Public catalog and course detail

## Trạng thái kế hoạch

- Nhánh triển khai: `feat/public-course-catalog-detail`.
- Base: `main@f536b578879ea11b131a0b6d66bb032868fcb150`.
- Trạng thái: kế hoạch hoàn tất; chưa triển khai production code, migration, test hoặc UI.
- Plan tổng: [plan.md](./plan.md).
- Theo dõi tiến độ: [progress.md](./progress.md).
- Nhật ký vấn đề: [problems.md](./problems.md).
- ADR: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

## 1. Mục tiêu và ranh giới thành công

B1 tạo public catalog chuẩn tại `/courses`, public course detail chuẩn tại
`/courses/[course-slug]`, thu gọn homepage còn tối đa bốn khóa học nổi bật, và
đưa các payment cancel transition về đúng public detail. Guest được đọc syllabus
metadata cần cho detail page nhưng không được đọc nội dung học bị bảo vệ.

B1 hoàn tất khi:

- `/courses` hiển thị toàn bộ course `published` và chưa bị soft-delete;
- homepage hiển thị tối đa bốn course theo thuật toán đã chốt ở mục 6;
- `/courses/[course-slug]` xử lý đúng found, unpublished, removed và unknown slug;
- guest đọc được chapter/topic metadata công khai nhưng không đọc được card,
  exercise, question, answer hoặc nội dung topic/lesson;
- first topic theo thứ tự công khai được đánh dấu là preview tạm thời, không mở
  thêm quyền đọc content;
- payment cancel URL dùng slug do server lấy từ database và trỏ về
  `/courses/[course-slug]`;
- old public `/learn/[course-slug]` vẫn hoạt động trong thời gian chuyển tiếp,
  chưa redirect;
- tài liệu Wave A được đối soát ở checkpoint docs riêng;
- automated checks và manual QA có bằng chứng, không ghi nhận kết quả chưa chạy.

## 2. Current-state findings

| Khu vực | Hiện trạng đã kiểm tra | Ảnh hưởng đến B1 |
| --- | --- | --- |
| Git/base | `main` và `origin/main` cùng ở `f536b578`; base chứa A1 `d800d648`, A2 `59680afb`, A3 `6a639d5e` và semantic branch workflow `f178d7db` qua merge `f536b578`. | B1 có base rõ ràng, không cần stacked branch. |
| Route | Teacher authoring đã ở `/teacher/courses`; không còn route tree teacher dưới `/courses`. | Có thể tạo public `/courses` mà không collision. |
| Homepage | `PublicCourseList` gọi `getPublishedCourses`, hiển thị tất cả course và link sai tới `/learn/{slug}/overview`. Query lỗi bị đổi thành empty array. | Cần tách public read model, trạng thái error/empty, shared card và canonical link. |
| Public detail cũ | `app/(client)/learn/[course-slug]` đang chứa detail UI; toàn bộ `/learn` bị `noindex`. | Tạo route indexable ở `/courses`; dùng chung view để không duplicate và giữ legacy route tới B3. |
| Detail action | `getCourseDetail` query trực tiếp chapters/topics/cards/exercises, đếm enrollment bằng user client, và nhận raw slug chưa validate. | Guest hiện không nhận syllabus/count đúng; DTO đang trộn public metadata với protected-content counts. |
| Course RLS | `can_view_course_basic` cho anon đọc course `published` và chưa removed. | Basic course row có thể public, nhưng output vẫn phải whitelist. |
| Syllabus RLS | `chapters` và `topics` dùng `has_course_content_read_access`; anon bị từ chối. Cards/exercises/questions cũng bị khóa. | Không mở rộng policy bảng; cần public read contract hẹp. |
| Enrollment | `enrollments` chỉ có `id`, `user_id`, `course_id`, `enrolled_at`, unique `(user_id, course_id)`; không có status. Row được tạo khi free enrollment thành công hoặc payment success RPC thành công. | Mỗi enrollment row hiện có là một enrollment hợp lệ; không thêm status rule mới. |
| Enrollment index | Có index `(user_id, course_id)`, chưa có index bắt đầu bằng `course_id`. | Aggregate theo course cần index `course_id` trong migration B1. |
| Preview | Detail action hiện đánh dấu topic đầu của chapter có `order_index = 1`; UI chỉ hiện badge, RLS vẫn khóa content. | Chuẩn hóa thành first topic của toàn syllabus đã sort; chỉ là compatibility metadata, không phải preview feature cuối. |
| Payment | `createCheckoutSession` dùng service-role để lấy course nhưng không lấy slug; PayOS `cancelUrl` đang là `/learn/${courseId}`. | Lấy thêm slug trong cùng trusted query và tạo URL bằng public route helper; không nhận slug từ client. |
| Test | Có action test cũ cho detail và DB integration harness; chưa có catalog UI/selection test hoặc unit test cho payment cancel URL. | B1 cần thay coverage theo public contract và thêm integration test cho RPC/RLS. |
| Docs | Code A1–A3 đã merge nhưng tracker/problem statuses còn cũ. | Đối soát trong checkpoint docs độc lập; không chặn implementation. |

## 3. Phạm vi chính xác

### Trong phạm vi

- Public routes `/courses` và `/courses/[course-slug]`.
- Shared public course card/grid/detail presentation dùng cho route mới và legacy
  detail tạm thời.
- Public route helpers cho catalog/detail.
- Public list/detail DTOs và discriminated action results.
- Public-safe database read contracts cho enrollment aggregate và syllabus
  metadata.
- Homepage top-four selection đã chốt.
- Public loading, empty, recoverable error và not-found/unpublished states.
- Payment cancel/resume transition về canonical detail bằng server-resolved slug.
- Test unit/schema/action/component/route/integration/payment và manual QA tương ứng.
- Wave A documentation reconciliation và status của payment-route problem.

### Ngoài phạm vi

- Không thêm `is_featured` hoặc schema field tương đương.
- Không thêm enrollment status hoặc business rule enrollment mới.
- Không làm final preview-management; không thêm `topics.is_preview` trong B1.
- Không cho guest đọc lesson/topic content, cards, exercises, questions hoặc answers.
- Không làm Redis, cache redesign, rate limiting hoặc pagination không được yêu cầu.
- Không làm `/learn` dashboard (B2).
- Không redirect old `/learn/[course-slug]` (B3).
- Không reclaim `/learn/[course-slug]` làm enrolled overview (C1).
- Không refactor rộng payment/discount/webhook.
- Không sửa profile learning placeholders hoặc các route/auth/database debt không
  liên quan trực tiếp.

## 4. Route, component và ownership

### Route contract

| Route | Trách nhiệm B1 | Trạng thái |
| --- | --- | --- |
| `/` | Landing page; chỉ render tối đa bốn highlighted courses. | Public/indexable. |
| `/courses` | Toàn bộ published, non-removed courses; stable catalog order. | Public/indexable. |
| `/courses/[course-slug]` | Public detail, syllabus metadata, enroll/payment entry. | Public/indexable; canonical. |
| `/learn/[course-slug]` | Render cùng public detail view trong giai đoạn chuyển tiếp. | Giữ nguyên URL; noindex bởi learn layout; không redirect trong B1. |
| `/learn/[course-slug]/[topic-slug]` | Learning workspace hiện có. | Không đổi. |

### Cấu trúc dự kiến

- `lib/public-courses/routes.ts`: `PUBLIC_COURSE_CATALOG_PATH`,
  `getPublicCourseDetailPath(slug)` và URL/path composition dùng chung.
- `lib/public-courses/select-highlighted-courses.ts`: thuật toán thuần, không I/O.
- `lib/schemas/public-course.ts`: raw RPC schemas, public list/detail DTO schemas,
  action result schemas/types.
- `app/actions/public-course.ts`: public catalog/detail reads; không đặt public
  aggregate logic vào `app/actions/course.ts` vốn đang sở hữu teacher authoring.
- `app/(client)/courses/page.tsx` và route state files cần thiết.
- `app/(client)/courses/[course-slug]/page.tsx` và route state files cần thiết.
- `app/(client)/courses/_components/*`: card, grid, detail view, stats, syllabus,
  instructor/payment presentation dùng chung.
- `app/(client)/_components/PublicCourseList.tsx`: trở thành homepage-highlight
  container hoặc được thay bằng tên rõ nghĩa.
- `app/(client)/learn/[course-slug]/page.tsx`: delegate sang shared detail view;
  không giữ một bản UI thứ hai.
- Sau khi tất cả caller chuyển sang action mới, xóa `getPublishedCourses` cũ khỏi
  `app/actions/course.ts` và thay/di chuyển test detail cũ.

Route mới phải có metadata phù hợp cho public discovery. Detail canonical metadata
trỏ tới `/courses/[course-slug]`; legacy route tiếp tục chịu `noindex` và không tự
phát sinh canonical URL khác.

## 5. Data contract và DTO boundaries

### Public catalog read model

Tạo read-only RPC `get_public_course_catalog()` trả đúng các field:

- `id`, `title`, `slug`, `thumbnail_url`, `price`, `created_at`;
- `enrollment_count` là số row `enrollments` theo `course_id`.

RPC tự lọc `courses.status = 'published'` và `removed_at is null`, trả stable order
`created_at DESC, id ASC`. Vì `courses.price` hiện nullable dù có default `0`, RPC
chuẩn hóa `COALESCE(price, 0)` theo behavior hiện hữu; không tạo price rule mới.
Không trả description, collaborator, payment hoặc content field nếu card/catalog
không dùng. Catalog dùng toàn bộ rows; homepage chạy selector thuần trên cùng read
model.

### Public detail read model

Tạo read-only RPC `get_public_course_detail(p_course_slug text)` trả một JSON object
được xây dựng bằng field whitelist:

- course: `id`, `title`, `slug`, `description`, `thumbnail_url`, `price`,
  `created_at`, `enrollment_count`;
- public instructor presentation: trả `owner` riêng và một mảng `collaborators`
  chỉ gồm các co-owner/collaborator đủ điều kiện hiển thị công khai. Mảng dùng thứ
  tự ổn định `course_collaborators.created_at ASC, course_collaborators.id ASC`;
  mỗi entry chỉ có các field presentation đã duyệt `id`, `full_name`, `avatar_url`,
  `bio`, `experience_years`, `certifications`;
- không trả email, phone, account/auth metadata hoặc raw internal role. Chỉ khi UI
  thực sự cần phân biệt vai trò mới trả một normalized public label thuộc tập giá
  trị dành cho presentation; mapping role nội bộ diễn ra phía server và raw role
  không đi qua public DTO;
- syllabus chapters: `id`, `title`, `order_index`;
- syllabus topics: `id`, `title`, `slug`, `order_index`.

RPC chỉ nhận slug hợp lệ, chỉ tìm course published/non-removed, chỉ lấy chapter
non-removed và topic `published`/non-removed thuộc đúng course/chapter. Aggregate
JSON phải giữ chapter rỗng nếu chapter hợp lệ chưa có published topic, và order
theo `chapter.order_index ASC, chapter.id ASC`, rồi `topic.order_index ASC,
topic.id ASC`.

Không đưa `cards`, `exercises`, `questions`, `question_options`, answer data,
topic description hoặc lesson payload vào RPC. Vì vậy public stats B1 chỉ gồm số
chapter, topic và enrollment; bỏ card/exercise counts khỏi public DTO/UI thay vì
bypass RLS để giữ các con số cũ.

### Security properties

- Functions là `STABLE SECURITY DEFINER`, có configured `search_path`, dùng tên
  object được qualify và không dùng dynamic SQL.
- `REVOKE ALL ... FROM PUBLIC`; chỉ `GRANT EXECUTE` cho `anon`, `authenticated`
  và `service_role` (service role chỉ dành cho test/ops, không dùng trong action
  public).
- Server Action gọi RPC bằng Supabase server client thông thường. Không import
  privileged admin client.
- Raw RPC response được `safeParse` bằng Zod ngay sau I/O; frontend chỉ nhận DTO
  đã parse, không nhận raw row/interface cast.
- Slug param được validate/normalize bằng schema chung trước RPC. Validation lỗi
  trở thành not-found hoặc safe invalid-input result; DB/Zod details chỉ log phía
  server, không phản chiếu ra guest.
- `is_enrolled` là auth-optional state riêng: sau `auth.getUser`, query đúng row
  của user qua RLS hiện có. Nó không nằm trong public RPC.

## 6. Homepage top-four selection

### Enrollment-count semantics

Schema hiện tại không có enrollment lifecycle/status. Một row chỉ được tạo sau
free enrollment thành công hoặc `handle_payment_success`; unique constraint ngăn
duplicate user/course. Vì vậy B1 đếm mọi row hiện có, không join hoặc suy diễn từ
`payments.status`, không loại row theo rule mới.

### Thuật toán

1. Nhận danh sách đã được RPC giới hạn ở published/non-removed courses.
2. Chuẩn hóa numeric `price` và `enrollment_count` tại raw schema boundary; giá âm
   hoặc count âm bị xem là contract error, không silently sửa.
3. Chia thành `paid` khi `price > 0`, `free` khi `price === 0`.
4. Sort từng nhóm bằng comparator duy nhất:
   `enrollment_count DESC`, `created_at DESC`, `id ASC`.
5. Chọn tối đa hai paid và tối đa hai free.
6. Nếu còn slot, gộp phần chưa chọn của cả hai nhóm, sort lại bằng cùng comparator,
   rồi lấy đến khi đủ bốn.
7. Nếu tổng course dưới bốn, trả tất cả; nếu không có course, render homepage empty
   state; nếu RPC lỗi, render error state, không giả thành empty.

Comparator và selector là pure functions để unit test đầy đủ: 2+2, thiếu paid,
thiếu free, chỉ một nhóm, tổng dưới bốn, tie count, tie timestamp, final `id ASC`,
và input không bị mutate.

Catalog không dùng top-four selector. Nó hiển thị mọi row theo stable catalog order
`created_at DESC, id ASC`.

## 7. Guest syllabus và RLS design

Chọn scoped RPC thay vì thêm `SELECT` policy public cho `chapters/topics`. Policy
trực tiếp trên bảng sẽ cho client query bất kỳ selectable column nào, rộng hơn
contract detail. RPC JSON whitelist chỉ công khai đúng metadata cần render và vẫn
giữ direct table reads của guest bị từ chối.

Migration B1 đồng thời thêm index `enrollments(course_id)` bằng
`CREATE INDEX IF NOT EXISTS` để hỗ trợ aggregate theo course. Không thay đổi table
shape, enrollment semantics hoặc content RLS policies.

Integration test phải chứng minh cả hai mặt:

- anon/authenticated gọi được RPC và chỉ thấy published/non-removed data;
- draft/removed course, removed chapter, draft/pending/removed topic không xuất hiện;
- empty chapter được giữ và order ổn định;
- enrollment count đúng, không lộ row/user identity;
- RPC JSON không có protected fields;
- direct anon read `chapters/topics/cards/exercises/questions` vẫn bị RLS chặn.

## 8. First-topic preview compatibility

Sau khi syllabus đã sort ổn định, topic đầu tiên của chapter đầu tiên có topic được
gắn `is_temporary_preview = true`; mọi topic khác là `false`. Không phụ thuộc
`order_index === 1`, vì active ordering có thể hợp lệ nhưng bắt đầu ở số khác.

Flag được derive ở application mapping, không lưu database. UI ghi chú/badge đây là
preview tạm thời. B1 không cấp quyền đọc content và không biến badge thành đường vào
learning workspace cho guest. Future preview feature mới cho owner/co-owner chọn
topics và enforce tối đa 30% tổng topics; B1 không thiết kế schema/action/UI đó.

## 9. Payment cancel/resume slug transition

Trong `createCheckoutSession`:

1. Giữ input client là `courseId` và optional coupon; không nhận/trust slug từ UI.
2. Trusted service-role course query hiện có phải select thêm `slug`, đồng thời áp
   dụng trực tiếp cả hai điều kiện `status = 'published'` và `removed_at IS NULL`
   trước khi chấp nhận course để tạo payment request.
3. Dùng `getPublicCourseDetailPath(course.slug)` để tạo path và ghép với
   `NEXT_PUBLIC_APP_URL` bằng URL composition an toàn.
4. PayOS `cancelUrl` trở thành absolute `/courses/[course-slug]`; return success URL
   giữ nguyên.
5. Pending payment reuse vẫn trả checkout URL của gateway; không refactor state
   machine/payment history trong B1.

Action test phải mock course row và PayOS boundary, assert query lấy `slug`, bắt buộc
`status = 'published'` và `removed_at IS NULL`, exact cancel URL dùng slug chứ không
dùng ID, và giữ free/enrolled/pending/error behavior liên quan. Một course vẫn mang
status `published` nhưng có `removed_at` phải bị từ chối trước khi gọi PayOS tạo
payment request. `PAYMENT-002` trong `problems.md` chỉ chuyển `Đã xử lý` sau automated
verification và manual/sandbox evidence nếu môi trường cho phép.

## 10. UI states và behavior

| State | `/courses` | `/courses/[slug]` |
| --- | --- | --- |
| Loading | Route skeleton giữ layout/card geometry. | Hero/detail/syllabus skeleton, không flash error. |
| Empty | Thông báo chưa có khóa học, CTA quay về homepage; không phải error. | Syllabus rỗng là valid empty section. |
| Recoverable data error | Safe error panel với retry thực hiện refresh/refetch Server Component data; control có pending/disabled state để chặn click lặp và không hiển thị DB/Zod details. | Safe error panel hoặc route error boundary; không map thành 404. |
| Unknown slug | Không áp dụng. | `notFound()`. |
| Draft/pending/removed course | Không có trong list. | Cùng public 404 behavior, không tiết lộ trạng thái nội bộ. |
| Empty chapter | Không áp dụng. | Render chapter với empty-topic copy. |
| Unauthenticated enroll | Auth flow hiện có; giữ data protection. | Sau auth quay lại canonical detail theo behavior hiện có được test. |

Card dùng semantic link tới canonical detail; button không lồng interactive control
không hợp lệ. Image chỉ dùng `priority` có chọn lọc cho above-the-fold, giữ responsive
sizes và accessible alt. Responsive/mobile, keyboard accordion và focus states là
acceptance behavior, không phải polish tùy chọn.

Shared course card phải nhận heading level theo ngữ cảnh: homepage highlight dùng
`h3` dưới section `h2`, còn `/courses` dùng `h2` trực tiếp dưới page `h1`. Empty
state tiếp tục dùng navigation link; recoverable error phải dùng retry button gọi
refresh/refetch route hiện tại thay vì link về chính URL đang xem.

## 11. Test và verification strategy

### Automated

- Schema tests: raw RPC numeric/date/null normalization; UUID/slug/order/count
  constraints; protected fields không thuộc DTO.
- Selector unit tests: toàn bộ allocation/fill/tie cases ở mục 6.
- Action/data-query tests: public list/detail success, invalid slug, not-found,
  RPC error, Zod contract drift, anonymous/authenticated enrollment state.
- Component tests: catalog all rows, homepage tối đa bốn, contextual card heading,
  empty/error/loading-facing views, retry refresh với pending/disabled state,
  canonical links, detail syllabus/empty chapter/preview badge/locked topics.
- Route behavior tests: new pages render shared view; legacy detail không redirect;
  unknown/unpublished/removed gọi not-found; workspace route không bị bắt nhầm.
- RLS/integration: matrix ở mục 7 trên local Supabase gated environment.
- Payment tests: exact cancel URL, trusted slug resolution, error behavior; giữ các
  payment integration tests hiện có.
- Smoke E2E nếu fixture local ổn định: guest homepage -> catalog -> detail, syllabus
  visible, protected content không mở; unknown slug 404.
- Final gates: targeted tests trước; sau đó `npm.cmd run test:run`,
  `npm.cmd run lint`, `npm.cmd run build`; `npm.cmd run test:integration` chỉ với
  local Supabase và `ALLOW_DB_INTEGRATION_TESTS=true`.

### Manual QA

- Guest desktop/mobile: `/`, `/courses`, canonical detail, breadcrumb/back links,
  loading/empty/error/not-found/unpublished fixtures.
- Verify homepage allocation bằng fixture paid/free và tied counts.
- Verify syllabus metadata, empty chapter, first-topic compatibility badge; thử mở
  direct protected tables/workspace không làm lộ content.
- Signed-in unenrolled/enrolled: CTA/payment entry và continue-learning behavior
  không regress.
- PayOS sandbox, nếu credentials khả dụng: cancel đưa về exact canonical slug URL;
  nếu không khả dụng, ghi rõ “chưa chạy” và dựa vào action-boundary test, không bịa QA.
- Wave A QA chỉ bổ sung khi có log hiện hữu hoặc vừa thực sự chạy lại.

## 12. Documentation updates

Checkpoint docs riêng phải:

- đánh dấu A1–A3 merged/completed và ghi merge/PR/commit evidence;
- cập nhật Wave A stable và B1 implementation status trong `progress.md`;
- chuyển `ROUTE-001`, `ROUTE-002`, `AUTH-001` sang `Đã xử lý` với evidence;
- giữ `AUTH-003` là UX follow-up không chặn B1;
- ghi `PAYMENT-002` là B1 follow-on và chỉ đóng sau verification;
- giải thích first-topic preview chỉ là compatibility logic, future 30% feature vẫn
  deferred;
- không sửa historical docs để giả như route cũ chưa từng tồn tại; chỉ thêm
  supersession note khi cần;
- không ghi manual-QA result nếu không có bằng chứng.

## 13. Ordered implementation checkpoints

### Checkpoint B1.1 — Public read model và RLS boundary

- Files/areas: migration mới dưới `supabase/migrations/`, public RPC definitions,
  `__tests__/integration/public-course-read-model.test.ts`.
- Behavior: catalog/detail RPC field whitelist, published filters, deterministic
  ordering, enrollment aggregate, syllabus metadata, `course_id` index.
- Tests: local DB reset/migration apply; anon/auth/RLS matrix; protected-field and
  direct-table-denial assertions.
- Completion evidence: migration applies from clean local database; integration
  suite passes; reviewed function grants/search path/output.
- Non-goals: UI, action mapping, preview management, content-access policy changes.

### Checkpoint B1.2 — Schemas, actions, route helper và selector

- Files/areas: `lib/schemas/public-course.ts`, `lib/public-courses/*`,
  `app/actions/public-course.ts`, relevant action/schema/utility tests.
- Behavior: parsed public DTOs, result-state distinction, canonical helpers,
  top-four algorithm, authenticated `is_enrolled` overlay.
- Tests: schema edge cases, selector matrix, action success/error/not-found and
  contract-drift tests.
- Completion evidence: focused tests pass; no raw RPC payload reaches UI; old public
  action has no remaining caller before removal.
- Non-goals: rendering routes/components, payment mutation, cache redesign.

### Checkpoint B1.3 — Catalog và homepage UI

- Files/areas: `/courses` route/state files, shared card/grid components, homepage
  highlighted-course container, public course component/route tests.
- Behavior: full catalog, top-four homepage, canonical links, contextual `h2`/`h3`
  card hierarchy, responsive loading/empty/error states và retry thực hiện route
  refresh với pending/disabled state.
- Tests: component and route behavior, heading hierarchy, retry/pending behavior,
  empty-state navigation, keyboard/link semantics và allocation fixtures.
- Completion evidence: focused tests plus guest desktop/mobile QA for homepage and
  catalog.
- Non-goals: detail syllabus, payment fix, `/learn` dashboard.

### Checkpoint B1.4 — Canonical public detail và legacy compatibility

- Files/areas: `/courses/[course-slug]`, shared detail components, legacy
  `/learn/[course-slug]` delegator, detail action/component/route tests.
- Behavior: canonical/indexable detail, safe public stats, syllabus metadata,
  empty/error/not-found states, temporary first-topic flag, legacy detail preserved.
- Tests: guest/auth detail action, DTO leakage guards, component states,
  not-found/unpublished/removed behavior, legacy no-redirect assertion.
- Completion evidence: focused automated tests and manual guest/signed-in QA pass.
- Non-goals: redirect legacy route, guest content access, final preview feature,
  enrolled overview.

### Checkpoint B1.5 — Payment canonical transition

- Files/areas: `app/actions/payment.ts`, public route helper caller,
  `__tests__/actions/payment.test.ts`, `problems.md` status evidence when verified.
- Behavior: server resolves slug từ course `published`/non-removed và PayOS cancel
  URL returns to canonical detail.
- Tests: exact URL và trusted-query unit tests, gồm case course `published` nhưng đã
  soft-delete bị reject trước PayOS call; relevant payment regression suite; sandbox
  manual QA only when available.
- Completion evidence: test proves no `/learn/${courseId}` destination remains in
  payment flow; problem status updated with evidence.
- Non-goals: payment state-machine, dashboard reminder, webhook/discount redesign.

### Checkpoint B1.6 — Wave A documentation reconciliation

- Files/areas: `plan.md`, `progress.md`, `problems.md`, linked ADR/workflow docs only
  where a supersession note is needed.
- Behavior: trackers match merged A1–A3 reality and B1 verified progress.
- Tests: link/path/commit evidence inspection and `git diff --check`.
- Completion evidence: every changed status cites verifiable commit/test/QA evidence;
  fabricated QA count is zero.
- Non-goals: production code, unrelated historical rewrite, closing `AUTH-003`.

### Checkpoint B1.7 — Final B1 release gate

- Files/areas: no new feature scope; only bounded corrections caused by B1 and final
  progress/problem evidence.
- Behavior: end-to-end public discovery and payment-cancel story is coherent.
- Tests: full unit/lint/build, gated local integration, public smoke/manual QA matrix.
- Completion evidence: command results, CI status, manual QA results and remaining
  gaps are recorded before merge recommendation.
- Non-goals: pulling B2/B3/future-preview work forward to make the gate pass.

## 14. Risks, cautions và rollback boundaries

| Risk | Mitigation | Rollback boundary |
| --- | --- | --- |
| `SECURITY DEFINER` lộ dữ liệu | Whitelist JSON, explicit filters/grants, Zod, anon integration tests và direct-table denial. | Revert consumers trước; sửa/thu hồi function bằng migration mới, không sửa migration đã apply. |
| Homepage aggregate chậm khi dữ liệu lớn | `enrollments(course_id)` index; selector thuần; đo query trước khi nghĩ tới cache. | RPC/index checkpoint độc lập với UI. |
| Hai detail routes drift | Một action và shared detail view; legacy page chỉ delegate. | Có thể revert canonical route mà không đổi workspace. |
| Error bị hiểu là empty/404 | Discriminated results; not-found chỉ cho absent/unpublished/removed. | Action/UI state checkpoint tách khỏi DB. |
| Preview badge bị hiểu là content access | Tên flag “temporary”, docs/copy rõ, không đổi content RLS hoặc link guest vào workspace. | Mapping/UI flag thuần, không có schema rollback. |
| Client giả slug payment | Slug chỉ lấy từ trusted course row; helper có unit test. | Payment checkpoint độc lập, revert được mà không ảnh hưởng catalog/detail reads. |
| Public instructor privacy | Chỉ field presentation hiện dùng; integration test cấm email/phone/account metadata. | Bỏ instructor block khỏi public RPC/UI mà không ảnh hưởng syllabus. |
| Docs bị trộn với feature diff | Checkpoint/commit docs riêng và evidence-only. | Revert docs độc lập với product checkpoints. |

Không mở rộng sang Redis/rate limiting trong B1. Việc homepage hiện đọc public catalog
rows để chọn bốn course là tradeoff đơn giản có chủ đích; nếu volume thực tế chứng
minh có vấn đề, tối ưu query là follow-up có đo lường, không phải speculation B1.

## 15. Acceptance criteria

- [ ] Guest truy cập `/courses` và thấy đúng mọi published/non-removed course.
- [ ] Homepage có tối đa bốn course và đúng quota/fill/tie algorithm.
- [ ] Mọi public card/breadcrumb dùng route helper và canonical detail URL.
- [ ] Guest truy cập canonical detail và thấy course + public syllabus metadata.
- [ ] Draft/pending/removed/unknown course trả public 404, không lộ internal status.
- [ ] Guest không đọc được protected content qua RPC hoặc direct table query.
- [ ] Public DTO không chứa protected content fields; stats chỉ dựa trên public-safe
  metadata/enrollment aggregate.
- [ ] First topic theo stable syllabus order có temporary preview flag; không có
  schema field hoặc preview-management UI mới.
- [ ] Enrollment count đếm mọi enrollment row hiện có, không có status rule mới.
- [ ] PayOS cancel URL dùng server-resolved slug và `/courses/[course-slug]`; chỉ
  course `published`/non-removed mới đi tới bước tạo PayOS request.
- [ ] Old `/learn/[course-slug]` vẫn render detail, chưa redirect; workspace không đổi.
- [ ] Loading/empty/error/not-found states accessible và không conflated.
- [ ] Automated, integration, build và manual QA evidence được ghi trung thực.
- [ ] Wave A docs/status và B1 problem status khớp repository state khi B1 kết thúc.

## 16. Deferred intentionally

### B2

- Authenticated `/learn` dashboard.
- Enrolled courses, next topic, progress, due review và pending-payment reminder.
- Profile learning-placeholder cleanup thuộc dashboard transition.

### B3

- Redirect old public `/learn/[course-slug]` sang canonical detail.

### Wave C

- Reclaim `/learn/[course-slug]` làm enrolled course overview.
- Workspace URL-topic hardening và locked/invalid topic behavior sâu hơn.

### Future preview feature

- Owner/co-owner chọn preview topics.
- Enforce tối đa 30% tổng topics.
- Schema/action/UI/RLS cho actual preview content access.

### Các backlog khác

- Redis/cache/rate limiting, memory check, completion server truth, Google OAuth,
  deeper payment dashboard/history và unrelated route/auth/database cleanup.
