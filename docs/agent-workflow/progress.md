# Adaptive Agent Workflow — Progress

## Ownership

File này sở hữu trạng thái implementation và delivery hiện tại của chương trình adaptive workflow. [plan.md](./plan.md) tiếp tục sở hữu intended scope, dependency và acceptance criteria; [problems.md](./problems.md) tiếp tục sở hữu problem record.

Chỉ ghi trạng thái có evidence thực tế. Các trạng thái delivery độc lập gồm: `planned`, `approved`, `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`. Trong bảng chương trình, `approved` chỉ nghĩa là owner đã duyệt master-program intended scope; nó không tự duyệt exact per-PR plan và không tự cấp implementation permission. Per-PR plan decision nằm trong owner review record của PR tương ứng; cột permission riêng ghi action hiện được phép.

## Trạng thái chương trình

| Đơn vị | `planned` | Master-program `approved` | Implementation permission | `implemented` | `verified` | `committed` | `pushed` | `PR open` | `merged` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AW-PR1 — Owner-facing language và report localization | yes | yes | yes | yes | yes | yes | yes | no | yes |
| AW-PR2 — Lifecycle preflight, CI permission modes và adaptive planning | yes | yes | no | no | no | no | no | no | no |
| AW-PR3A — Specialist review orchestration | yes | yes | no | no | no | no | no | no | no |
| AW-PR3B — Domain-owned escalation signals | yes | yes | no | no | no | no | no | no | no |

## AW-PR2 planning-document checkpoint

- Current branch: `docs/agent-workflow-aw-pr2-planning`.
- Baseline: fetched `main == origin/main == b134e0842ea3eac5a7bacc064c37570e35e45847`.
- Current outcome: planning documents only; không có AW-PR2 lifecycle/skill behavior implementation.
- Per-PR plan decision: `approved` trong [owner-review-brief.md](./implementation-plans/aw-pr2/owner-review-brief.md), dựa trên explicit owner instruction ngày 2026-07-18; quyết định này chỉ duyệt exact planning contract.
- Planning delivery: chưa commit, push, tạo PR hoặc merge; mỗi action cần permission riêng.
- Implementation permission: `no`; future implementation branch `feat/agent-workflow-aw-pr2` chưa được tạo.
- Delivery dependency: planning-only PR phải merge, sau đó local `main` được sync và exact plan/permission được revalidate trước khi implementation branch bắt đầu.
- Exact six-file scope trong detailed plan chỉ áp dụng cho future implementation branch; planning documents không được tính vào scope đó.
- Khi planning-only PR merge, safe interim guidance của `AW-P001` trong [problems.md](./problems.md) có hiệu lực ngay trong ownership của problem tracker; điều đó không implement lifecycle/skill behavior và không đổi `confirmed/scheduled`.

## AW-PR1 implementation checkpoint

- Branch: `docs/agent-workflow-language-reporting`.
- Base: synchronized `main == origin/main` tại `6e3bc086fc4b2fedf899714ccea57339f9c40ac6`.
- Implementation permission: owner đã cấp riêng cho AW-PR1.
- Scope hiện tại: root language invariant; lifecycle output wording; owner-facing review, checkpoint và PR/CI report localization.
- Structural boundary: không tạo reference, không rename/move file và không refactor skill bundle.
- Verification: hoàn tất — repo skill validator `valid` với 0 lỗi; `git diff --check`, UTF-8/final-newline/trailing-whitespace, Markdown heading/fence, relative-link, conflict-marker, secret-oriented diff, EOL, stale-template, structural/change-set và 7 scenario contract audit đều pass.
- Main self-review và re-review: hoàn tất; 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`) còn lại.
- Fresh-reader: `not_run`; task không cấp quyền gọi fresh-reader hoặc specialist, và self-review không được trình bày như fresh-reader evidence.
- Git/remote delivery: implementation commit `c44c64385ea5714163d4cd8ea063f269c654503c` đã normal-push lên `origin/docs/agent-workflow-language-reporting`; xem trạng thái PR/CI hiện tại bên dưới.

### AW-PR1 review correction — localized report contract alignment

- Finding 1: `accepted` — lifecycle verdict mapping đã dùng exact canonical value `Implementation review passed; manual QA pending` do `code-review-and-quality` sở hữu.
- Finding 2: `accepted` — PR description và final report dùng ngôn ngữ owner yêu cầu, mặc định tiếng Việt khi không có yêu cầu khác; checklist đã dùng cùng rule.
- Finding 3: `accepted` — confidence và verification-status classification có mapping Việt–Anh không mơ hồ; canonical English value vẫn được giữ nếu machine-readable consumer yêu cầu.
- Semantics: không thay severity, verdict readiness, confidence, verification status, permission, CI self-fix, attempt limit hoặc Git/remote authority.
- Verification: repo skill validator `valid` với 0 lỗi; diff/UTF-8/final-newline/trailing-whitespace/Markdown/link/conflict/secret/EOL/structural audits và 7 scenario contract review đều pass.
- Main self-review và re-review: 0 Nghiêm trọng (`Critical`) và 0 Bắt buộc (`Required`) còn lại.
- Fresh-reader: `not_run` — không có qualified independent executor và current task cấm sub-agent; self-review không được dùng thay thế.
- Correction delivery: correction commit `0e3e7550120906a81c0f3a6ca7f67a0eb7f84081` đã normal-push lên `origin/docs/agent-workflow-language-reporting`; xem trạng thái PR/CI hiện tại bên dưới.

### AW-PR1 merged delivery state

- PR: [#56](https://github.com/khangnhoang/VocaSpace/pull/56).
- PR open: no.
- Merged: yes — merge commit `b134e0842ea3eac5a7bacc064c37570e35e45847` đã được xác minh trong fetched `origin/main`.
- CI: không re-assess trong planning-document correction pass này; merge/dependency fact được xác minh bằng Git.
- Fix attempts: `0`.

## Known problem status

| Problem | Trạng thái vấn đề | Trạng thái xử lý | Target |
| --- | --- | --- | --- |
| `AW-P001` — CI observation/watch/self-fix permission drift | `confirmed` | `scheduled` | `AW-PR2` |

AW-PR1 không thay permission mode, CI self-fix contract, attempt limit hoặc Git/remote boundary của `AW-P001`.
