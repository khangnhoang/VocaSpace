# Chỉ mục implementation plan — Student/User Flow & Route Refactor

Thư mục này chứa planning artifact đang active cho từng PR/checkpoint của chương trình. Nó định tuyến người đọc tới đúng nguồn; không sở hữu roadmap hay trạng thái delivery.

## Nguồn sự thật và ownership

| Tài liệu | Sở hữu | Không sở hữu |
| --- | --- | --- |
| [Master plan](../plan.md) | Program scope, high-level decisions, dependency order và completion criteria ở mức wave/PR | Execution detail hoặc trạng thái delivery hiện tại |
| [Progress tracker](../progress.md) | Trạng thái workflow/delivery hiện được ghi nhận và verification evidence theo thời điểm | Product/architecture decision bền vững |
| [Problems log](../problems.md) | Defect, risk, technical constraint và follow-up còn mở | Implementation contract đầy đủ |
| [ADR](../../../adr/refactor-student-user-flow-route-adr.md) | Quyết định route/user-flow bền vững | Current implementation status |
| Per-PR detailed plan | Implementation contract, scope/exclusions, checkpoints, acceptance criteria và verification strategy của PR | Trạng thái program khác PR đó |
| Owner-review brief | Decision surface ngắn gọn, quyền hiện tại và các điểm owner cần duyệt | Không được override detailed plan; mọi thay đổi quyết định phải reconcile vào plan trước khi triển khai |

Repository implementation và Git history là evidence cuối cùng khi tài liệu trạng thái mâu thuẫn. Nếu per-PR plan và owner-review brief khác nhau, dừng và reconcile; không tự chọn nguồn thuận tiện hơn.

## Planning artifact đang active

| Wave / PR | Detailed plan | Owner-review brief | Trạng thái planning |
| --- | --- | --- | --- |
| B3 — Redirect public detail cũ | [b3/plan.md](./b3/plan.md) | [b3/owner-review-brief.md](./b3/owner-review-brief.md) | Đã merge qua PR #74 (`59d0810`) |
| C1 — Enrolled course overview | [c1/plan.md](./c1/plan.md) | [c1/owner-review-brief.md](./c1/owner-review-brief.md) | Đã merge qua PR #75 (`3cb7a9f`) |
| C2 — Workspace route hardening | [c2/plan.md](./c2/plan.md) | [c2/owner-review-brief.md](./c2/owner-review-brief.md) | Kế hoạch execution được giữ làm lịch sử; xem [progress.md](../progress.md) cho delivery hiện tại |
| D1 — Topic authoring → review → publication | [d1/plan.md](./d1/plan.md) | — Owner request là decision source; không tạo brief trùng lặp | Đã merge qua PR #98; xem [progress.md](../progress.md) cho evidence hiện tại |
| Q7 — Internal previewer access correction | [q7/plan.md](./q7/plan.md) | — Owner decisions được ghi trong detail plan | Canonical detail plan; chưa triển khai, cần implementation authority riêng |

Các plan lịch sử trong `../plans/` được giữ tại chỗ cho PR đã hoàn tất. B3 đã được migrate vào hierarchy này; file B3 cũ không còn là một source song song. C1/C2/D1 là execution contract lịch sử, Q7 là canonical plan chưa triển khai. Delivery status/evidence vẫn thuộc [progress.md](../progress.md), risk/constraint thuộc [problems.md](../problems.md); index này không tự cấp implementation hay remote authority.
