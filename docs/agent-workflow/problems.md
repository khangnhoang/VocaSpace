# Adaptive Agent Workflow — Problems

## Ownership và trạng thái

File này sở hữu các vấn đề đã được xác nhận của chương trình adaptive workflow, cách xử lý an toàn tạm thời, PR dự kiến xử lý và bằng chứng đóng vấn đề.

- [plan.md](./plan.md) sở hữu intended scope, dependency và owner-confirmed decision.
- `progress.md` sẽ sở hữu current implementation/delivery status sau khi có implementation consumer thực tế.
- Problem record không tự authorize implementation, commit, push, PR, merge hoặc remote action.
- Cách xử lý an toàn tạm thời không thay thế permission source; khi các source còn drift, agent phải dùng rule cụ thể hơn hoặc hạn chế hơn và báo conflict.
- Chỉ đánh dấu `resolved` khi affected sources và verification evidence hiện hành đã khớp; plan-only scheduling không phải resolution.

Trạng thái dùng trong file này:

- `confirmed`: repository evidence xác nhận problem tồn tại;
- `scheduled`: owner đã chọn target PR nhưng implementation chưa hoàn tất;
- `in progress`: implementation đã bắt đầu với permission hợp lệ;
- `resolved`: source contracts đã reconcile và verification tương ứng đã pass;
- `deferred`: owner đã chủ động hoãn và ghi điều kiện mở lại;
- `blocked`: thiếu decision, permission hoặc external state cần thiết.

## AW-P001 — CI observation/watch/self-fix permission drift

| Trường | Giá trị |
| --- | --- |
| Trạng thái | `confirmed`, `scheduled` |
| PR dự kiến xử lý | `AW-PR2` |
| Rủi ro | Permission drift có thể làm agent sửa, commit hoặc push từ instruction hẹp hơn ý owner |
| Nguồn bị ảnh hưởng | [AGENTS.md](../../AGENTS.md), [docs/agent-loops.md](../agent-loops.md), [github-pr-ci-workflow](../../.agents/skills/github-pr-ci-workflow/SKILL.md) |
| Ảnh hưởng dependency | Không đổi `AW-PR1 → AW-PR2 → AW-PR3A → AW-PR3B` |

### Bằng chứng xác nhận

- `docs/agent-loops.md` trigger dùng “inspect or handle”, nhưng mode nói default inspection có local fix.
- Lifecycle cho remote correction khi task kích hoạt CI watching hoặc CI fixing.
- `AGENTS.md` và `github-pr-ci-workflow` giới hạn bounded no-commit/no-push exception vào owner request có PR creation/update plus CI watching.
- Lifecycle giới hạn 1–2 completed fix attempts; skill cho attempt thứ ba khi owner cho phép hoặc agent tự đánh giá next fix cực rõ và ít rủi ro.

### Cách xử lý an toàn tạm thời

- Inspect-only là read-only: đọc state/log và report, không sửa file.
- Watch-only không tự cấp permission sửa, commit hoặc push.
- PR creation/update plus CI watching có thể dùng bounded self-fix chỉ cho `branch-caused-small-safe`, theo normal push conditions của skill.
- Explicit CI-fix instruction ngoài mode trên chỉ cấp đúng action owner nói; không tự suy ra commit hoặc push.
- Dùng tối đa 2 completed fix attempts cho tới khi contracts được reconcile.
- Không merge, force-push, delete branch, sửa DB/RLS/migration/production state hoặc tự xử lý large/risky/unclear failure.

### Tiêu chí đóng vấn đề trong AW-PR2

Scope và acceptance criteria trong [plan.md](./plan.md) là implementation contract authoritative. Các điểm dưới đây chỉ là problem-specific closure criteria:

- `docs/agent-loops.md` sở hữu lifecycle trigger, permission mode và stop rule ở mức khái quát.
- `github-pr-ci-workflow` sở hữu command procedure, failure classification, exact self-fix cycle và normal push conditions.
- `AGENTS.md` chỉ giữ routing/invariant ngắn, không duplicate procedure.
- Inspect-only, watch-only, create/update plus watch và explicit fix-only phải có behavior không mơ hồ.
- Default maximum là 2 completed fix attempts; attempt thứ ba chỉ khi owner cho phép rõ ràng.
- Không thay CI classification, GitHub Actions workflow, auto-merge, force-push hoặc domain-risk stop boundary.

### Kiểm tra trước khi đánh dấu resolved

- Targeted text audit không còn permission hoặc attempt-limit conflict giữa ba affected sources.
- Scenario review bao phủ inspect-only, watch-only, create/update plus watch, explicit fix-only, attempt 2/3 và remote action.
- Skill validation, Markdown/link/encoding checks và relevant fresh-reader/evidence procedure chạy theo repository contract.
- Resolution evidence được ghi vào `progress.md` khi file đó có concrete implementation consumer.
