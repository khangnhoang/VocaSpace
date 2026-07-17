# Adaptive Agent Workflow — Progress

## Ownership

File này sở hữu trạng thái implementation và delivery hiện tại của chương trình adaptive workflow. [plan.md](./plan.md) tiếp tục sở hữu intended scope, dependency và acceptance criteria; [problems.md](./problems.md) tiếp tục sở hữu problem record.

Chỉ ghi trạng thái có evidence thực tế. Các trạng thái delivery độc lập gồm: `planned`, `approved`, `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`. `approved` nghĩa là owner đã duyệt intended scope; nó không tự cấp implementation permission. Cột permission riêng ghi action hiện được phép.

## Trạng thái chương trình

| Đơn vị | `planned` | `approved` | Implementation permission | `implemented` | `verified` | `committed` | `pushed` | `PR open` | `merged` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AW-PR1 — Owner-facing language và report localization | yes | yes | yes | yes | yes | yes | yes | no | no |
| AW-PR2 — Lifecycle preflight, CI permission modes và adaptive planning | yes | yes | no | no | no | no | no | no | no |
| AW-PR3A — Specialist review orchestration | yes | yes | no | no | no | no | no | no | no |
| AW-PR3B — Domain-owned escalation signals | yes | yes | no | no | no | no | no | no | no |

## AW-PR1 implementation checkpoint

- Branch: `docs/agent-workflow-language-reporting`.
- Base: synchronized `main == origin/main` tại `6e3bc086fc4b2fedf899714ccea57339f9c40ac6`.
- Implementation permission: owner đã cấp riêng cho AW-PR1.
- Scope hiện tại: root language invariant; lifecycle output wording; owner-facing review, checkpoint và PR/CI report localization.
- Structural boundary: không tạo reference, không rename/move file và không refactor skill bundle.
- Verification: hoàn tất — repo skill validator `valid` với 0 lỗi; `git diff --check`, UTF-8/final-newline/trailing-whitespace, Markdown heading/fence, relative-link, conflict-marker, secret-oriented diff, EOL, stale-template, structural/change-set và 7 scenario contract audit đều pass.
- Main self-review và re-review: hoàn tất; 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`) còn lại.
- Fresh-reader: `not_run`; task không cấp quyền gọi fresh-reader hoặc specialist, và self-review không được trình bày như fresh-reader evidence.
- Git/remote delivery: implementation commit `c44c64385ea5714163d4cd8ea063f269c654503c` đã normal-push lên `origin/docs/agent-workflow-language-reporting`; chưa tạo PR hoặc merge.

## Known problem status

| Problem | Trạng thái vấn đề | Trạng thái xử lý | Target |
| --- | --- | --- | --- |
| `AW-P001` — CI observation/watch/self-fix permission drift | `confirmed` | `scheduled` | `AW-PR2` |

AW-PR1 không thay permission mode, CI self-fix contract, attempt limit hoặc Git/remote boundary của `AW-P001`.
