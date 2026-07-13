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

- Trạng thái: Deferred.
- Mô tả: URL phản ánh chính xác topic đang mở trong workspace; browser back/forward chuyển đúng topic; URL cập nhật khi chọn lesson trong sidebar.
- Lý do hoãn: B2 chỉ sửa tối thiểu initial topic route. Full synchronization thuộc C2.
- Wave/phạm vi dự kiến: C2 — Workspace route hardening.
- Liên kết: [B2 plan §4](./plans/b2-student-learn-dashboard.md#4-minimal-workspace-route-seam), [WORKSPACE-001](./problems.md#workspace-001-learning-workspace-phải-dùng-topic-slug-từ-url).

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
- Liên kết: [FUTURE-PAYMENT-001](./problems.md#future-payment-001-deeper-payment-dashboardhistory), [B2 plan §8](./plans/b2-student-learn-dashboard.md#8-pending-payment-presentation).
