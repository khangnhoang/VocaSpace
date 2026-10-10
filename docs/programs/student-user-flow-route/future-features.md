# Các tính năng được hoãn ngoài phạm vi những wave đầu

## Mục đích

File này ghi lại các tính năng sản phẩm không phải defect đã được xác định nhưng chủ động hoãn khỏi B2 và không thuộc wave đang active. Đây không phải problem/bug tracker; các vấn đề kỹ thuật được theo dõi trong [problems.md](./problems.md).

Khi một feature liên kết tới `problems.md`, file này sở hữu product outcome mong muốn, còn `problems.md` sở hữu risk hoặc technical constraint cần audit; không xem hai entry là hai implementation scope độc lập.

## Tài liệu liên quan

- Kế hoạch chính: [plan.md](./plan.md)
- Tiến độ: [progress.md](./progress.md)
- Vấn đề kỹ thuật: [problems.md](./problems.md)
- ADR: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md)
- Kế hoạch B2: [plans/b2-student-learn-dashboard.md](./plans/b2-student-learn-dashboard.md)

## Quy ước trạng thái

- `Deferred`: đã xác định nhưng chưa lên lịch.
- `Planned`: đã có wave/PR dự kiến.
- `In progress`: đang triển khai.
- `Completed`: đã hoàn tất.

---

## FEAT-001: Tab khóa học chưa xuất bản dành cho collaborator

- Trạng thái: Deferred.
- Mô tả: Dashboard có tab hiển thị các course `draft`/`pending` mà user được truy cập với vai trò `owner`, `co_owner`, `editor` hoặc `previewer` trong `course_collaborators`.
- Lý do hoãn: B2 chỉ tập trung vào enrolled published courses. Tab này cần audit role model của collaborator và access boundary giữa enrollment với collaboration.
- Wave/phạm vi dự kiến: Scope riêng sau B2, thuộc dashboard/access flow thay vì teacher management flow.
- Liên kết: [B2 plan §3.1](./plans/b2-student-learn-dashboard.md#31-khóa-học-được-hiển-thị).

---

## FEAT-002: Theo dõi vị trí học gần nhất bằng `lastAccessTopic`

- Trạng thái: Deferred.
- Mô tả: Lưu topic user truy cập gần nhất để `Tiếp tục học` mở đúng vị trí đó thay vì topic đầu tiên chưa hoàn thành.
- Lý do hoãn: B2 dùng thuật toán next-topic dựa trên `user_topic_progress` và không lưu access history. `lastAccessTopic` cần schema change hoặc cơ chế client-side persistence mới.
- Wave/phạm vi dự kiến: Có thể gắn với C2 workspace hardening hoặc tách thành scope riêng.
- Liên kết: [B2 plan §3.4](./plans/b2-student-learn-dashboard.md#34-thuật-toán-topic-tiếp-theo).

---

## FEAT-003: Lưu learning history và hoạt động học gần đây

- Trạng thái: Deferred.
- Mô tả: Thêm bảng hoặc cơ chế lưu lịch sử học tập như thời gian truy cập topic, thời lượng học và streak để hỗ trợ dashboard analytics và gamification.
- Lý do hoãn: B2 chỉ dùng `user_topic_progress` hiện có. Learning history cần schema mới và product design cho analytics dashboard.
- Wave/phạm vi dự kiến: Wave D hoặc scope riêng sau khi dashboard/workspace ổn định.
- Liên kết: [B2 plan §2](./plans/b2-student-learn-dashboard.md#ngoài-phạm-vi-b2).

---

## FEAT-004: Đồng bộ đầy đủ URL và state của workspace

- Trạng thái: Completed.
- Mô tả: URL phản ánh chính xác topic đang mở trong workspace; browser back/forward chuyển đúng topic; URL cập nhật khi chọn lesson trong sidebar.
- Kết quả: C2 đã triển khai full synchronization trên workspace route; không còn phụ thuộc vào initial-topic seam của B2.
- Wave xử lý: C2 — Workspace route hardening.
- Liên kết: [B2 plan §4](./plans/b2-student-learn-dashboard.md#4-minimal-workspace-route-seam), WORKSPACE-001 (resolved, see [problems.md](./problems.md#resolved)).

---

## FEAT-005: Route riêng `/learn/review`

- Trạng thái: Deferred.
- Mô tả: Tạo route riêng cho FSRS review session thay vì đặt trong dashboard sheet/modal.
- Lý do hoãn: B2 dùng `ReviewSheet` modal hiện có; dedicated route chờ đến khi dashboard/workspace ổn định và có product need rõ ràng.
- Wave/phạm vi dự kiến: Wave D hoặc scope riêng.
- Liên kết: [FUTURE-REVIEW-001](./problems.md#future-review-001-fsrs-review-route-or-deeper-review-ux).

---

## FEAT-006: Dashboard và lịch sử thanh toán đầy đủ hơn

- Trạng thái: Deferred.
- Mô tả: Bổ sung dashboard thanh toán đầy đủ với lịch sử `paid`/`cancelled`/`expired`/`failed` thay vì chỉ hiển thị pending payment reminder.
- Lý do hoãn: B2 chỉ cần pending payment reminder với phạm vi hẹp. Full history cần product design và có thể cần route riêng.
- Wave/phạm vi dự kiến: Wave D.
- Liên kết: [FUTURE-PAYMENT-001](./problems.md#future-payment-001-deeper-payment-dashboard-and-history), [B2 plan §8](./plans/b2-student-learn-dashboard.md#8-pending-payment-presentation).

---

## FEAT-007: Candidate revision cho published topic

- Trạng thái: Deferred.
- Mô tả: Published content về sau được giữ bất biến đối với learner; author chỉnh candidate revision riêng, candidate submit → pending/frozen, reject → editable, approve → publish candidate và retire/archive/soft-delete revision published cũ.
- Lý do hoãn: D1 chỉ cần workflow authoring → review → publication cơ bản và interim published-edit demotion về `draft`; candidate revision là hướng kiến trúc tương lai, chưa có data model hoặc migration được chốt.
- Định tuyến: Chưa gán phase, workstream, schedule hoặc merge order. D1 chỉ phải giữ compatibility constraint và không triển khai revision system.
- Liên kết: [FUTURE-PUBLISH-001](./problems.md#future-publish-001-topic-authoring-review-and-publication-follow-ups), [Master plan](./plan.md#wave-d-decisions-steered-by-the-owner-2026-09-15).

## FEAT-008: Tối ưu UI/UX trang học và Preview sau D3

- Trạng thái: Deferred.
- Mô tả: Owner review UI D3 (2026-10-02) chấp nhận chức năng nhưng ghi nhận hai điểm polish: (1) animation chuyển stage/câu trong trang học `/learn/[course-slug]/[topic-slug]` chưa mượt; (2) UI Preview công khai `/courses/[course-slug]/preview/[topic-slug]` chưa đồng nhất với trang học, phối màu feedback lạ (nút xanh đậm trong box xanh lá nhạt).
- Lý do hoãn: Ngoài phạm vi D3 (memory check); Owner chọn tối ưu sau.
- Định tuyến: D8-LUI xử lý (2026-10-09): Owner đã chấp nhận UI trang học và Preview trên bản chạy local; mục này đóng khi D8-LUI được merge.
- Liên kết: [D3 detail plan](./implementation-plans/d3/plan.md).

---

## FEAT-009: Chuỗi giai đoạn trong trang học bấm được để nhảy tới giai đoạn đã mở khóa

- Trạng thái: Deferred.
- Mô tả: Trong workspace `/learn/[course-slug]/[topic-slug]`, chuỗi giai đoạn (Từ vựng / Memory check / Bài tập) cho phép bấm để nhảy thẳng tới một giai đoạn đã mở khóa, thay vì bấm lặp lại các nút bước. Giai đoạn đang khóa vẫn không bấm được và hiện lý do khóa; cổng memory check và `exercisesLocked` vẫn là nơi sở hữu quyền truy cập. Bàn phím và focus phải được xử lý (thứ tự Tab, kích hoạt bằng Enter/Space, focus đặt vào nội dung giai đoạn sau khi nhảy, trạng thái hiện tại và trạng thái khóa đọc được bằng trình đọc màn hình).
- Lý do hoãn: Owner đề xuất khi QA thủ công LF1 (2026-10-10); ngoài phạm vi LF1 (luật hoàn thành flashcard và giải thích khi trả lời đúng).
- Wave/phạm vi dự kiến: Kế hoạch nhỏ riêng và PR riêng, theo `frontend-design` và `frontend-workflow`.
- Liên kết: [LF1 plan](./implementation-plans/learning-followup/plan.md).
