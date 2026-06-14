# Kế hoạch tái cấu trúc quy trình làm việc của giáo viên

## Trạng thái

Accepted

## Ngày ghi nhận

2026-06-14

## Chủ sở hữu và phạm vi

Chủ sở hữu: nhóm duy trì VocaSpace.

Phạm vi: danh sách khóa học của giáo viên, route workspace của khóa học, dashboard khóa học, quản lý cấu trúc chương/bài học, điều hướng vào topic authoring, readiness semantics, ordering trong phạm vi MVP, và hợp đồng analytics sau MVP.

Tài liệu theo dõi tiến độ: [refactor-teacher-workflow-progress.md](./refactor-teacher-workflow-progress.md).

## Bối cảnh

Course authoring của giáo viên đang trộn nhiều trách nhiệm trong cùng một nhóm route. Route chi tiết khóa học hiện đang gánh phần quản lý chapter/topic, trong khi kiến trúc đích cần tách rõ course overview, structure workspace, và topic builder. Trước khi đổi route architecture, hệ thống cũng có các trust defects độc lập: route tạo khóa học có thể blank, UI có thể báo thành công sai, delete copy không khớp soft-delete, dữ liệu lý do reject thiếu ở query, và một số affordance dễ tạo kỳ vọng sai.

Hướng đã được duyệt là biến course workspace thành một authoring system theo kiểu task-first. Dashboard phải giúp giáo viên hiểu trạng thái authoring đáng tin cậy, vấn đề nào đang chặn tiến độ, và hành động tiếp theo nên là gì. Dashboard MVP không phải analytics showroom.

Learner analytics chỉ được thêm sau khi có secure aggregate contract. Mascot hoặc brand-character không thuộc sequence hiện tại. Workspace phải hoàn chỉnh nếu không bao giờ có mascot; không được có state, component, API, layout placeholder, hoặc copy phụ thuộc mascot.

## Quyết định

Áp dụng chuỗi PR nhỏ, reviewable và deployable:

1. Sửa các trust defects độc lập.
2. Thiết lập route architecture ổn định.
3. Định nghĩa readiness contract.
4. Làm structure workspace đáng tin trước khi dashboard trỏ link vào đó.
5. Xây dashboard task-first.
6. Thêm deep links và return feedback cục bộ.
7. Thêm ordering accessible cho MVP.
8. Đẩy analytics sang post-MVP.
9. Hardening trước release.

Sequence này cố ý không mở rộng sang migrations, RLS, real collaborator persistence, admin review/publish workflow, drag-and-drop reorder, hoặc analytics UI khi chưa có contract được duyệt.

## Kiến trúc route mục tiêu

```text
/courses
-> Course list

/courses/[id]
-> Course Dashboard / Overview

/courses/[id]/structure
-> Chapter and topic structure management

/courses/[id]/topics/[topicId]
-> Flashcard and exercise authoring
```

Trách nhiệm của từng route:

- `/courses`: danh sách khóa học của giáo viên, entry point tạo khóa học, và entry point chỉnh sửa thông tin khóa học hiện có.
- `/courses/[id]`: course overview/dashboard theo hướng task-first; trước khi full dashboard hoàn tất vẫn phải là overview hữu ích, không phải blank hoặc "coming soon".
- `/courses/[id]/structure`: quản lý chapter/topic, bao gồm tạo, sửa, ẩn/xóa mềm, và sau này ordering accessible.
- `/courses/[id]/topics/[topicId]`: authoring nội dung tập trung cho flashcards, exercises, và topic settings.

## Nguyên tắc thiết kế

- Teacher authoring UI phải rõ ràng, dễ quét, an toàn, và giúp giáo viên hoàn thành khóa học.
- Mỗi dashboard issue cần có lý do, severity/category, context, destination, và action label.
- Dashboard MVP ưu tiên readiness issues và next actions; không thêm chart trang trí.
- Dynamic primary CTA phải có thứ tự chọn deterministic và giải thích được vì sao được chọn.
- Structure destination phải đáng tin trước khi dashboard issue links trỏ tới.
- Ordering MVP phải dùng controls keyboard/mobile friendly trước; drag-and-drop là future-only.
- Soft-delete UI phải nói đúng hành vi hidden/unavailable/restorable, không nói hard delete.
- Analytics không được trình bày unsupported concepts như facts.
- Mascot/illustration chỉ có thể là bổ sung cục bộ trong tương lai; không phải dependency kiến trúc.

## Kế hoạch PR

### PR1: Fix Course Authoring Trust Issues

- Kết quả chính: loại bỏ các trust defects độc lập trước khi đổi route architecture.
- Lý do tồn tại: giáo viên có thể gặp blank create route, thiếu rejection reason, delete copy gây hiểu nhầm, collaborator fake success, first-submit validation không hiện message ngay, và delete confirmation thiếu identity.
- Phạm vi bao gồm: `/courses/new` create route, CTA tạo khóa học trỏ tới route đó, `reject_message` query/runtime parsing, rejected-course display an toàn, soft-delete wording, collaborator unavailable behavior, form message rendering lần submit đầu, delete confirmation identity, topic trash navigation vào settings, và schema/type cleanup hẹp phục vụ các trust defects này.
- Ngoài phạm vi: `/courses/[id]` dashboard, `/courses/[id]/structure`, route IA mới, real collaborator persistence, admin review/publish workflow, analytics, migrations, RLS, broad schema alignment, mascot work.
- Khu vực repo chính: teacher course list/create/edit components, course actions, course schemas, shared form/dialog primitives, chapter/topic delete confirmations, tests tập trung.
- Tác động data/backend: query-only cộng với Server Action honesty và runtime schema/type boundary; không migration, không RLS.
- Hành vi người dùng thấy: create route dùng được, rejection reason chỉ hiện khi meaningful, delete copy đúng soft-delete, collaborator không còn báo thành công giả, validation messages hiện ngay, confirmation cho biết item nào bị ảnh hưởng.
- Phụ thuộc: không có.
- Bề mặt regression: Narrow đến moderate vì có chạm shared form/dialog primitives nhưng chỉ để phục vụ authoring flows hiện có.
- Tiêu chí chấp nhận: `/courses/new` usable; CTA tạo course đi tới `/courses/new`; rejection reason safe; soft-delete wording đúng; collaborator flow không thể fake success; first-submit validation messages hiện ngay; course/chapter/topic confirmations identify item.
- Kiểm thử tự động: focused component/schema/action tests, TypeScript, scoped lint, fast test suite, `git diff --check`.
- Manual QA: course list, `/courses/new`, tạo course thành công/thất bại, rejected-course display, course/chapter/topic delete dialogs, collaborator unavailable behavior, desktop/mobile.
- Rollback: revert độc lập được vì route architecture mới chưa phụ thuộc vào PR1; nếu rollback một phần, không để UI kỳ vọng `reject_message` khi query không lấy field đó.
- Follow-up được mở: PR2 có thể đổi route architecture trên baseline đáng tin hơn.
- Mascot-optional verification: không áp dụng; PR này không liên quan mascot.

### PR2: Establish Course Workspace Routes

- Kết quả chính: thiết lập route contract cho course workspace mà không tạo overview route chết.
- Lý do tồn tại: `/courses/[id]` đang quản lý structure, còn `/courses/[id]/topics` từng được xác định là route blank/dead; dashboard và structure work cần destinations ổn định.
- Phạm vi bao gồm: chuyển chapter/topic structure management sang `/courses/[id]/structure`; làm `/courses/[id]` thành overview tối thiểu hữu ích với course title, status, metadata cơ bản, link tới structure, và link về course list; giữ topic builder ở `/courses/[id]/topics/[topicId]`; cập nhật navigation labels và links.
- Ngoài phạm vi: full dashboard, readiness contract, issue deep links, reordering, analytics, dashboard redesign, admin review/publish, collaborator persistence.
- Khu vực repo chính: Next.js teacher routes trong `app/(teacher)/courses`, navigation links, course access checks, route smoke tests.
- Tác động data/backend: query-only nếu overview cần metadata hiện có; không migration, không RLS.
- Hành vi người dùng thấy: `/courses/[id]` hữu ích thay vì blank; `/courses/[id]/structure` là structure destination đáng tin; topic builder vẫn truy cập được.
- Phụ thuộc: PR1.
- Bề mặt regression: Moderate vì đổi route ownership và navigation.
- Tiêu chí chấp nhận: mọi target route render useful content hoặc redirect hợp lệ; không có blank workspace route; topic authoring links hiện có vẫn hoạt động; refresh/back navigation dễ hiểu.
- Kiểm thử tự động: route/page smoke tests nếu phù hợp, TypeScript, lint, navigation tests tập trung.
- Manual QA: mở course từ `/courses`, đi overview -> structure -> topic builder, refresh từng route, browser back, kiểm tra mobile layout.
- Rollback: route changes nên revert theo cụm để tránh navigation trỏ tới route thiếu.
- Follow-up được mở: PR3 readiness contract và PR4 structure workspace.
- Mascot-optional verification: overview hoàn chỉnh bằng text/navigation, không có mascot slot hoặc placeholder.

### PR3: Define Dashboard Readiness Contract

- Kết quả chính: định nghĩa typed runtime-validated readiness contract cho course dashboard.
- Lý do tồn tại: dashboard UI không nên tự suy luận readiness từ component state rời rạc; issue severity, destination, và CTA logic cần contract ổn định trước.
- Phạm vi bao gồm: query/audit content graph cho course, chapters, topics, flashcards, exercises, question groups, questions, options; issue identity; severity/category; action label; navigation destination; blocking vs suggestion; deterministic ordering/tie-break rules; primary CTA selection.
- Ngoài phạm vi: dashboard visual implementation, structure UI refactor, ordering mutations, learner analytics, enrollment count nếu chưa có secure contract, migrations trừ khi gap hẹp được duyệt.
- Khu vực repo chính: dashboard query helpers/actions, schemas/DTOs, readiness utilities, unit/schema/action tests.
- Tác động data/backend: query-only và runtime schema/type boundary; không broad generated-type alignment.
- Hành vi người dùng thấy: chủ yếu nội bộ cho tới PR5; nếu data shape lỗi thì fail loud với safe error.
- Phụ thuộc: PR2.
- Bề mặt regression: Moderate vì đọc nhiều tầng content và định nghĩa behavior cho dashboard.
- Tiêu chí chấp nhận: contract trả course identity, content counts, readiness issues, issue destinations, và primary CTA candidate cho empty/populated courses.
- Kiểm thử tự động: unit tests cho issue derivation/CTA selection, schema tests cho nullable/missing data, action/query tests cho safe error shapes.
- Manual QA: kiểm tra thủ công representative empty/partial courses nếu không có debug route.
- Rollback: revertible nếu PR5 chưa consume contract; sau PR5 cần dashboard fallback.
- Follow-up được mở: PR5 có thể render dashboard mà không tự phát minh semantics.
- Mascot-optional verification: không áp dụng.

### PR4: Refine Structure Workspace

- Kết quả chính: làm `/courses/[id]/structure` thành nơi quản lý chapter/topic đáng tin trước khi dashboard issue links phụ thuộc vào nó.
- Lý do tồn tại: dashboard CTA không nên dẫn vào structure experience tạm bợ hoặc mơ hồ; dead edit/delete affordances và sheet-based flows cần được làm rõ.
- Phạm vi bao gồm: structure management surface cho chapter/topic; create/edit/delete affordances đáng tin; soft-delete behavior trung thực; empty/loading/error states ổn định; navigation rõ sang topic builder; layout usable trên mobile và keyboard.
- Ngoài phạm vi: full dashboard UI, issue deep-link feedback, ordering controls, drag-and-drop, cross-chapter movement, analytics, admin review/publish.
- Khu vực repo chính: `/courses/[id]/structure` route, structure components, chapter/topic actions hiện có, structure tests.
- Tác động data/backend: dùng Server Actions và runtime validation khi cần; không migration trừ khi mutation hiện có không thể hỗ trợ an toàn.
- Hành vi người dùng thấy: giáo viên quản lý course structure trong workspace riêng, không còn dead promises.
- Phụ thuộc: PR2. PR4 có thể merge trước PR3 vì chủ yếu cần route IA, không cần dashboard readiness semantics.
- Bề mặt regression: Moderate vì chạm active chapter/topic authoring workflows.
- Tiêu chí chấp nhận: giáo viên có thể create/edit/soft-delete chapters/topics từ structure; topic builder navigation đúng; không còn edit/delete icon chết.
- Kiểm thử tự động: component/action tests cho structure states và mutation results, TypeScript, lint.
- Manual QA: empty course, nhiều chapters/topics, create/edit/delete chapter, create/edit/delete topic, failed mutation, refresh, mobile width, keyboard-only controls.
- Rollback: có thể revert về structure management cũ nếu xem xét cùng PR2 routing.
- Follow-up được mở: PR5 dashboard issue actions có destination đáng tin.
- Mascot-optional verification: structure workspace là tool surface hoàn chỉnh; không phụ thuộc mascot.

### PR5: Build Task-First Course Dashboard

- Kết quả chính: render MVP course dashboard như teacher action dashboard.
- Lý do tồn tại: sau khi route architecture, readiness semantics, và structure destinations ổn định, giáo viên cần overview cho biết việc tiếp theo nên làm.
- Phạm vi bao gồm: dashboard overview UI; course identity/status; dynamic primary CTA; readiness checklist không dùng numeric completion score; grouped issue list; next-action hierarchy; no-data/empty/error states; links tới structure và topic builder; responsive/accessibility.
- Ngoài phạm vi: learner analytics, enrollment count nếu chưa được PR8/PR9 hỗ trợ an toàn, issue-resolution feedback vượt quá navigation thông thường, ordering mutations, mascot/illustration system.
- Khu vực repo chính: `/courses/[id]` page/components, readiness contract consumer, dashboard component tests, route/navigation tests.
- Tác động data/backend: consume PR3 query/runtime contract; không thêm DB contract mới trừ khi PR3 đã expose.
- Hành vi người dùng thấy: giáo viên landing vào actionable overview thay vì structure editor hoặc blank page.
- Phụ thuộc: PR3 và PR4 phải ổn định. PR5 không bắt đầu trước khi cả hai sẵn sàng.
- Bề mặt regression: Broad cho teacher workspace UX vì route này trở thành course overview chính.
- Tiêu chí chấp nhận: empty course và partially complete course hiển thị next actions rõ; không có unsupported analytics; mọi issue action có destination hợp lệ; dashboard usable trên mobile.
- Kiểm thử tự động: component tests cho issue states/CTA rendering, route smoke tests, TypeScript, lint.
- Manual QA: empty course, course có chapter nhưng không có topics, topic thiếu content, exercise thiếu questions, không có blocking issues, refresh/back, mobile, keyboard navigation.
- Rollback: có thể revert dashboard UI và giữ PR2 routes/PR3 contract, fallback về minimal overview.
- Follow-up được mở: PR6 issue deep links và local return feedback.
- Mascot-optional verification: dashboard lấp đầy không gian bằng text, lists, và actions; không reserved mascot area hoặc character copy.

### PR6: Add Issue Deep Links and Local Return Feedback

- Kết quả chính: nối dashboard issues tới đúng authoring context và thêm return feedback nhẹ.
- Lý do tồn tại: dashboard chỉ có giá trị nếu giáo viên đi thẳng tới nơi sửa issue, nhưng mặc định vẫn ở trong authoring flow.
- Phạm vi bao gồm: issue links tới structure hoặc topic builder tab/context; route/search-param handling cho target context; một dismissible message hoặc toast sau successful mutation để quay về overview; dashboard refetch để resolved issue biến mất tự nhiên.
- Ngoài phạm vi: persistent issue history, global issue event bus, cross-session tracking, workflow engine, permanent dismissal storage, analytics.
- Khu vực repo chính: dashboard issue links, structure/topic builder route parsing, mutation success feedback gần actions hiện có, tests cho link destinations.
- Tác động data/backend: none hoặc query-only; có thể chạm ordinary mutation success hooks nhưng không thêm persistence.
- Hành vi người dùng thấy: giáo viên nhảy từ dashboard issue tới đúng surface và có tùy chọn quay lại sau khi sửa.
- Phụ thuộc: PR5.
- Bề mặt regression: Moderate vì ảnh hưởng navigation và success feedback trong authoring flows.
- Tiêu chí chấp nhận: mỗi actionable issue đến đúng context; successful fixes không ép user rời authoring; return affordance dismissible; không tạo persistent tracking.
- Kiểm thử tự động: unit tests cho issue destination builders, component tests cho feedback rendering, TypeScript, lint.
- Manual QA: deep link tới structure, deep link tới topic settings/content tab, successful fix, failed mutation, browser back, refresh target URL, mobile.
- Rollback: deep links có thể revert về dashboard-level navigation trong khi giữ PR5 dashboard.
- Follow-up được mở: PR7 ordering có thể thêm issue/action destinations nếu cần.
- Mascot-optional verification: feedback dựa trên text/action; không phụ thuộc mascot.

### PR7: Add Accessible Chapter and Topic Ordering

- Kết quả chính: thêm deterministic accessible ordering cho chapter/topic trong MVP.
- Lý do tồn tại: authoring workspace hữu ích cần cho giáo viên sắp xếp chapters/topics mà không phụ thuộc drag-and-drop hoặc nhập số thủ công.
- Phạm vi bao gồm: move chapter up/down; move topic up/down trong cùng chapter; deterministic active ordering; xử lý soft-deleted rows; controls tương thích keyboard/mobile; safe failure handling và rollback/refetch.
- Ngoài phạm vi: drag-and-drop, moving topics across chapters, bulk reorder UI, rich optimistic drag behavior, analytics.
- Khu vực repo chính: structure workspace controls, chapter/topic ordering actions hoặc RPC nếu cần, runtime validation, tests cho ordering rules.
- Tác động data/backend: Server Action và có thể RPC/migration nếu ordering hiện tại không thể atomic an toàn; audit chỉ giới hạn ở ordering và soft-delete.
- Hành vi người dùng thấy: giáo viên reorder course structure bằng explicit controls.
- Phụ thuộc: PR4. Nên land trước MVP release.
- Bề mặt regression: Moderate đến broad tùy backend ordering strategy.
- Tiêu chí chấp nhận: first/last item controls an toàn; order persist sau refresh; soft-deleted rows không ảnh hưởng; failed reorder giữ UI trung thực; controls keyboard/mobile usable.
- Kiểm thử tự động: unit/action/integration tests cho ordering, soft-delete interactions, TypeScript, lint.
- Manual QA: nhiều chapters, nhiều topics trong một chapter, first/last item controls, failed mutation, refresh, mobile, keyboard-only.
- Rollback: nếu có DB contract changes, rollback phải giữ `order_index` semantics hiện có.
- Follow-up được mở: PR10 release hardening; future drag-and-drop có nền deterministic ordering.
- Mascot-optional verification: chỉ là functional structure controls; không phụ thuộc mascot.

### PR8: Add Secure Teacher Analytics Contract

- Kết quả chính: định nghĩa secure aggregate learner analytics contract sau khi MVP authoring flow ổn định.
- Lý do tồn tại: analytics cần data semantics rõ và aggregate access an toàn qua RLS; dashboard MVP không được phụ thuộc raw learner-owned data.
- Phạm vi bao gồm: bounded learner analytics và FSRS metadata audit; aggregate query/RPC design nếu cần; supported data-state vocabulary; safe error/partial states; minimum sample rules; không unsupported claims.
- Ngoài phạm vi: render analytics UI, leaderboards, active learner trends nếu không có event history, review-event trends nếu không có event history, admin review/publish, MVP dashboard readiness.
- Khu vực repo chính: analytics query/RPC/action layer, schemas/DTOs, FSRS-related metadata reads, tests cho aggregate access và states.
- Tác động data/backend: query-only, RPC, migration, và/hoặc RLS có thể cần tùy secure contract cuối cùng; phạm vi chỉ analytics.
- Hành vi người dùng thấy: không có hoặc rất ít cho tới PR9; contract cấp states đáng tin cho UI.
- Phụ thuộc: PR3. Post-MVP trừ khi có explicit approval.
- Bề mặt regression: Broad nếu cần RLS/RPC changes.
- Tiêu chí chấp nhận: analytics contract chỉ trả supported aggregate states; không expose unauthorized/raw learner access; không biểu diễn unsupported concept như fact.
- Kiểm thử tự động: schema tests, action/RPC/integration tests, RLS tests khi áp dụng, TypeScript.
- Manual QA: kiểm tra no-data, no-activity, insufficient sample, partial data, query failure bằng controlled data nếu có.
- Rollback: revert contract và migrations/RPCs cùng nhau; PR9 không được phụ thuộc contract đã revert.
- Follow-up được mở: PR9 conditional learner analytics UI.
- Mascot-optional verification: không áp dụng.

### PR9: Render Conditional Learner Analytics

- Kết quả chính: render learner analytics chỉ khi PR8 cung cấp trustworthy states.
- Lý do tồn tại: analytics chỉ hữu ích nếu UI phân biệt rõ no data, insufficient data, partial data, và insights thật.
- Phạm vi bao gồm: conditional analytics panels; messaging theo supported data states; không decorative charts; không claim vượt quá PR8 contract; responsive/error/partial states.
- Ngoài phạm vi: tạo analytics contract, leaderboards, unsupported trends, dashboard MVP readiness, mascot work.
- Khu vực repo chính: dashboard analytics components, PR8 contract consumer, component tests, manual QA data states.
- Tác động data/backend: consume PR8; không thêm DB work trừ khi PR8 cần follow-up nhỏ.
- Hành vi người dùng thấy: giáo viên thấy learner analytics khi được hỗ trợ và được qualified rõ.
- Phụ thuộc: PR8. Post-MVP.
- Bề mặt regression: Moderate vì ảnh hưởng dashboard presentation nhưng không đổi authoring flow.
- Tiêu chí chấp nhận: mọi approved data state render đúng; unsupported analytics vắng mặt; query failure safe và non-blocking.
- Kiểm thử tự động: component tests cho từng analytics state, TypeScript, lint.
- Manual QA: `No data`, `No learner activity`, `Insufficient interaction count`, `Insight available`, `Partial data`, `Query failure`, mobile.
- Rollback: có thể ẩn analytics UI trong khi giữ dashboard authoring actions.
- Follow-up được mở: future analytics mở rộng sau khi có event/history data.
- Mascot-optional verification: analytics cards hoàn chỉnh không cần mascot hoặc illustration.

### PR10: Harden Course Workspace QA

- Kết quả chính: harden course workspace trước release.
- Lý do tồn tại: PR1-PR7 đổi route architecture, dashboard behavior, structure management, và ordering; release cần verify toàn bộ teacher workflow.
- Phạm vi bao gồm: targeted regression tests, smoke/manual QA checklist, accessibility/responsive audit, docs updates khi cần, verification cho route/navigation/soft-delete/order/readiness behavior.
- Ngoài phạm vi: feature mới, analytics trừ khi PR8/PR9 ship cùng release, mascot, broad refactors.
- Khu vực repo chính: tests và docs quanh course workspace; production code chỉ đổi nếu phát hiện bug scoped.
- Tác động data/backend: none mặc định; test-only fixtures chỉ thêm nếu isolated và justified.
- Hành vi người dùng thấy: không chủ đích đổi feature, trừ bug fixes phát hiện trong hardening.
- Phụ thuộc: PR1-PR7 cho MVP. Nếu analytics ship cùng release, PR10 chạy sau PR9.
- Bề mặt regression: Narrow nếu chỉ test/docs; broad hơn nếu có bug fixes.
- Tiêu chí chấp nhận: critical teacher course workspace paths pass automated/manual QA; known risks được ghi nhận; không có merged route blank/dead.
- Kiểm thử tự động: relevant full test suite, typecheck, lint, route/component/action tests, integration tests nếu ordering hoặc analytics có DB-backed changes.
- Manual QA: course list, create/edit course, overview, structure, topic builder, issue links, ordering, delete dialogs, refresh/back, mobile, keyboard.
- Rollback: test/docs changes revert độc lập; bug fixes nên tách hoặc scope rõ.
- Follow-up được mở: release readiness và post-MVP analytics nếu chưa ship.
- Mascot-optional verification: xác nhận không có mascot dependency.

## Đồ thị phụ thuộc

```text
PR1
└─ PR2
   ├─ PR3 ─┐
   └─ PR4 ─┼─ PR5 ─ PR6
            └─ PR7

PR3 ─ PR8 ─ PR9   [post-MVP analytics]

PR1-PR7 ─ PR10
```

Quy tắc phụ thuộc bổ sung:

- PR4 có thể merge trước PR3.
- PR5 không được bắt đầu cho tới khi PR3 và PR4 ổn định.
- PR8 và PR9 nên giữ ở post-MVP trừ khi được phê duyệt rõ.
- Nếu analytics ship trong cùng release, PR10 chạy sau PR9.

## Thứ tự merge khuyến nghị

1. PR1: Fix Course Authoring Trust Issues.
2. PR2: Establish Course Workspace Routes.
3. PR4: Refine Structure Workspace, vì reliable destinations giảm rủi ro cho dashboard.
4. PR3: Define Dashboard Readiness Contract.
5. PR5: Build Task-First Course Dashboard.
6. PR6: Add Issue Deep Links and Local Return Feedback.
7. PR7: Add Accessible Chapter and Topic Ordering.
8. PR10: Harden Course Workspace QA trước MVP release.
9. PR8 và PR9 chỉ sau MVP, hoặc trước release khi có explicit approval và PR10 chạy lại sau PR9.

## Các mốc cần người dùng phê duyệt

- Sau PR2: phê duyệt route IA và minimal overview behavior.
- Sau PR3: phê duyệt readiness issue semantics, severity labels, và primary CTA selection.
- Sau PR4: phê duyệt structure workspace trước khi dashboard links phụ thuộc vào nó.
- Sau PR5: phê duyệt dashboard visual hierarchy và task-first behavior.
- Sau PR7: phê duyệt MVP ordering behavior và accessibility.
- Trước PR8: phê duyệt analytics scope, secure aggregate contract, và quyết định analytics có vào cùng release không.
- Trước release: chạy PR10 hardening và review known risks.

## Ranh giới MVP

### Bắt buộc cho MVP

- PR1
- PR2
- PR3
- PR4
- PR5
- PR6
- PR7

### Khuyến nghị trước release

- PR10

### Sau MVP

- PR8
- PR9

### Chỉ dành cho tương lai

- Review-event history trends.
- Active learner trends.
- Leaderboard.
- Drag-and-drop reorder.
- Cross-chapter topic movement.
- Full collaboration persistence.
- Admin review/publish workflow.
- Mascot hoặc brand-character system.

## Ranh giới analytics

Dashboard MVP là teacher action dashboard, không phải analytics showroom.

Bộ nhãn trạng thái dữ liệu đã được duyệt:

```text
No data
No learner activity
Insufficient interaction count
Insight available
Partial data
Query failure
```

Các khái niệm chưa được hỗ trợ không được trình bày như facts:

- Active learner trends khi không có event history.
- Review trends khi không có review-event history.
- Exact completion trends khi chưa định nghĩa semantics.
- Absolute "hardest flashcard" claims.
- Leaderboards.
- Decorative analytics charts.

Enrollment count và learner analytics bị loại khỏi MVP trừ khi secure aggregate contract được duyệt sớm. Analytics thuộc PR8 và PR9.

## Ranh giới schema và type

Chiến lược audit có giới hạn:

- PR1: query/type work hẹp cho trust defects như `reject_message`.
- PR3: content-graph audit hẹp cho dashboard readiness.
- PR7: ordering và soft-delete audit hẹp.
- PR8: learner analytics và FSRS metadata audit hẹp.
- Không làm repository-wide generated-type alignment trong MVP sequence.
- Mismatch không liên quan được ghi thành technical debt thay vì kéo vào PR đang active.

Một PR riêng cho schema/type alignment không thuộc sequence này trừ khi một PR bounded chứng minh nó thật sự cần thiết.

## Danh sách rủi ro

| Rủi ro | Tác động | Cách giảm thiểu |
| --- | --- | --- |
| Route bị gãy | Giáo viên mất đường vào authoring surfaces. | PR2 phải để mọi target route hữu ích và được manual verified. |
| Parent-child context không nhất quán | Topic builder actions có thể mất course/chapter context. | PR2 và PR6 phải verify route params, breadcrumbs, refresh, và browser back. |
| Query quá nặng | Readiness contract có thể overfetch content graph. | PR3 chỉ fetch fields cần cho dashboard và test dữ liệu representative. |
| RLS visibility | Giáo viên có thể không đọc được learner-owned data an toàn. | Giữ analytics post-MVP và yêu cầu PR8 secure aggregate contract. |
| Soft-delete semantics | Hidden rows có thể ảnh hưởng ordering hoặc readiness. | PR1 sửa copy; PR3/PR7 audit active row filters trong phạm vi hẹp. |
| Type/schema mismatch | Runtime data shape có thể lệch handwritten types. | Dùng runtime schemas ở boundaries và giữ audit theo từng PR. |
| Dynamic CTA thiếu ổn định | Dashboard có thể nhảy action khó đoán. | PR3 định nghĩa severity và order tie-breaks trước PR5 UI. |
| Analytics gây hiểu nhầm | UI có thể ngụ ý trend hoặc confidence mà dữ liệu không hỗ trợ. | Dùng approved data-state vocabulary và defer analytics sang PR8/PR9. |
| Drag-and-drop accessibility | Reorder UI giàu tương tác có thể loại trừ keyboard/mobile users. | PR7 triển khai move up/down trước; drag-and-drop future-only. |
| Scope creep sang publish/review/collaboration | Sequence quá rộng và khó review. | Giữ admin review/publish và real collaborator persistence ngoài sequence. |
| Mascot infrastructure quá sớm | Optional brand work làm méo layout/code. | Không thêm mascot state, component, API, reserved area, hoặc mascot PR. |

## Ngoài phạm vi và công việc tương lai

Ngoài phạm vi của sequence này:

- Sửa admin review/publish workflow.
- Real collaborator persistence, invitations, role management, new tables, hoặc RLS policies.
- Repository-wide generated database type alignment.
- Learner analytics trước khi có secure aggregate contract.
- Mascot, character, illustration system, animation dependencies, hoặc mascot-ready infrastructure.
- Drag-and-drop reorder và cross-chapter movement.

Roadmap tương lai:

- Restore/trash management.
- Full collaboration workflow.
- Full review/publish workflow.
- Richer analytics sau khi có event/history data.
- Optional local illustration hoặc mascot exploration sau khi core workspace hoàn tất.
- Future motion design cho dashboard state changes.

## Quy tắc duy trì tài liệu

- File này ghi lại architectural plan và scope boundaries đã được duyệt.
- Không rewrite scope của PR đã xong chỉ để khớp implementation history.
- Material changes phải thêm amendment có ngày, giải thích quyết định và tác động.
- Tiến độ hằng ngày thuộc tài liệu progress tracker đi kèm.

## Amendments

Chưa có amendment nào sau khi plan được accepted.
