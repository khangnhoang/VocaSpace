# Tính năng deferred ngoài scope early waves

## Mục đích

File này ghi lại các tính năng sản phẩm (non-defect) đã xác định nhưng được hoãn lại
có chủ đích, không thuộc phạm vi B2 hoặc các wave đang triển khai. Đây không phải
problem/bug tracker — các vấn đề kỹ thuật nằm trong [problems.md](./problems.md).

## Tài liệu liên quan

- Kế hoạch chính: [plan.md](./plan.md)
- Tiến độ: [progress.md](./progress.md)
- Vấn đề kỹ thuật: [problems.md](./problems.md)
- ADR: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md)
- Kế hoạch B2: [plans/b2-student-learn-dashboard.md](./plans/b2-student-learn-dashboard.md)

## Quy ước trạng thái

- `Deferred`: đã xác định, chưa lên lịch.
- `Planned`: có wave/PR dự kiến.
- `In progress`: đang triển khai.
- `Completed`: đã hoàn tất.

---

## FEAT-001: Tab khóa học chưa xuất bản cho collaborator

- Trạng thái: Deferred.
- Mô tả: Dashboard tab hiển thị các khóa học `draft`/`pending` mà user có quyền truy
  cập qua vai trò `owner`, `co_owner`, `editor`, hoặc `previewer` trong
  `course_collaborators`.
- Lý do hoãn: B2 chỉ tập trung vào enrolled published courses. Tab này cần audit
  collaborator role model và enrollment vs. collaboration access boundary.
- Wave/owner dự kiến: Scope riêng sau B2; nằm trong dashboard/access flow, không phải
  teacher management flow.
- Liên kết: [B2 plan §3.1](./plans/b2-student-learn-dashboard.md#31-khóa-học-được-hiển-thị).

---

## FEAT-002: lastAccessTopic — resume-position tracking

- Trạng thái: Deferred.
- Mô tả: Lưu topic cuối cùng mà user truy cập để "Tiếp tục học" mở đúng vị trí gần
  nhất thay vì topic đầu tiên chưa hoàn thành.
- Lý do hoãn: B2 dùng thuật toán next-topic dựa trên `user_topic_progress`, không lưu
  access history. `lastAccessTopic` cần schema change hoặc client-side persistence mới.
- Wave/owner dự kiến: Có thể gắn với C2 workspace hardening hoặc scope riêng.
- Liên kết: [B2 plan §3.4](./plans/b2-student-learn-dashboard.md#34-thuật-toán-topic-tiếp-theo).

---

## FEAT-003: Learning history / recent-learning-activity storage

- Trạng thái: Deferred.
- Mô tả: Bảng hoặc cơ chế lưu trữ lịch sử học tập (thời gian truy cập topic, thời
  lượng học, chuỗi streak) để hỗ trợ dashboard analytics và gamification.
- Lý do hoãn: B2 chỉ dùng `user_topic_progress` sẵn có. Learning history cần schema
  mới và product design cho analytics dashboard.
- Wave/owner dự kiến: Wave D hoặc scope riêng sau khi dashboard/workspace ổn định.
- Liên kết: [B2 plan §2](./plans/b2-student-learn-dashboard.md#ngoài-phạm-vi-b2).

---

## FEAT-004: Full workspace URL ↔ state synchronization

- Trạng thái: Deferred.
- Mô tả: URL phản ánh chính xác topic đang mở trong workspace; browser back/forward
  chuyển đúng topic; URL cập nhật khi chọn lesson trong sidebar.
- Lý do hoãn: B2 chỉ sửa tối thiểu initial topic route. Full synchronization thuộc C2.
- Wave/owner dự kiến: C2 — Workspace route hardening.
- Liên kết: [B2 plan §4](./plans/b2-student-learn-dashboard.md#4-minimal-workspace-route-seam),
  [WORKSPACE-001](./problems.md#workspace-001-learning-workspace-must-use-topic-slug-from-url).

---

## FEAT-005: Dedicated `/learn/review` route

- Trạng thái: Deferred.
- Mô tả: Route riêng cho FSRS review session, tách khỏi dashboard sheet/modal.
- Lý do hoãn: B2 dùng `ReviewSheet` modal hiện có; dedicated route chờ đến khi
  dashboard/workspace ổn định và có product need rõ ràng.
- Wave/owner dự kiến: Wave D hoặc scope riêng.
- Liên kết: [FUTURE-REVIEW-001](./problems.md#future-review-001-fsrs-review-route-or-deeper-review-ux).

---

## FEAT-006: Deeper payment dashboard/history

- Trạng thái: Deferred.
- Mô tả: Dashboard thanh toán đầy đủ với lịch sử paid/cancelled/expired/failed, thay
  vì chỉ pending payment reminder.
- Lý do hoãn: B2 chỉ cần pending payment reminder hẹp. Full history cần product design
  và có thể cần route riêng.
- Wave/owner dự kiến: Wave D.
- Liên kết: [FUTURE-PAYMENT-001](./problems.md#future-payment-001-deeper-payment-dashboardhistory),
  [B2 plan §8](./plans/b2-student-learn-dashboard.md#8-pending-payment-presentation).
