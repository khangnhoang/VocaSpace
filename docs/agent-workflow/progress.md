# Adaptive Agent Workflow — Progress

## Ownership

File này sở hữu trạng thái implementation và delivery hiện tại của chương trình adaptive workflow. [plan.md](./plan.md) tiếp tục sở hữu intended scope, dependency và acceptance criteria; [problems.md](./problems.md) tiếp tục sở hữu problem record.

Chỉ ghi trạng thái có evidence thực tế. Các trạng thái delivery độc lập gồm: `planned`, `approved`, `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`. Trong bảng chương trình, `approved` chỉ nghĩa là owner đã duyệt master-program intended scope; nó không tự duyệt exact per-PR plan và không tự cấp implementation permission. Per-PR plan decision nằm trong owner review record của PR tương ứng; cột permission riêng ghi action hiện được phép.

## Trạng thái chương trình

| Đơn vị | `planned` | Master-program `approved` | Implementation permission | `implemented` | `verified` | `committed` | `pushed` | `PR open` | `merged` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AW-PR1 — Owner-facing language và report localization | yes | yes | yes | yes | yes | yes | yes | no | yes |
| AW-PR2 — Lifecycle preflight, CI permission modes và adaptive planning | yes | yes | yes | no | no | yes | yes | no | no |
| AW-PR3A — Specialist review orchestration | yes | yes | no | no | no | no | no | no | no |
| AW-PR3B — Domain-owned escalation signals | yes | yes | no | no | no | no | no | no | no |

## AW-PR2 planning-document delivery

- Historical branch: `docs/agent-workflow-aw-pr2-planning`.
- Historical baseline: synchronized `main == origin/main == b134e0842ea3eac5a7bacc064c37570e35e45847` before planning began.
- Outcome: planning documents only; planning delivery did not implement AW-PR2 lifecycle/skill behavior.
- Per-PR plan decision: original six-file contract `approved` ngày 2026-07-18; post-implementation-review seven-file amendment `approved` ngày 2026-07-21 trong [owner-review-brief.md](./implementation-plans/aw-pr2/owner-review-brief.md).
- Planning delivery: commit `161798ac05bfa947e8362b1785151a349a073de4` đã merge qua [PR #57](https://github.com/khangnhoang/VocaSpace/pull/57) tại `b10be2654d1a1c2291f1483e82ade3d0404cc151`; các check `Test and Build`, `production-gate`, `Vercel` và `Vercel Preview Comments` đều `SUCCESS` trước merge.
- Delivery dependency: completed; planning-only PR đã merge trước implementation branch creation.
- Exact six-file scope là historical planning decision. Current behavior/tracker scope là seven files sau owner amendment thêm duy nhất `AGENTS.md`; planning/history-only amendment files không được tính vào behavior set nhưng vẫn xuất hiện trong cumulative Git accounting.
- Safe interim guidance của `AW-P001` trong [problems.md](./problems.md) có hiệu lực trong ownership của problem tracker từ planning merge; điều đó không tự implement lifecycle/skill behavior hoặc resolve problem.

## AW-PR2 implementation checkpoints

- Current branch: `feat/agent-workflow-aw-pr2`.
- Baseline: fetched and synchronized `main == origin/main == b10be2654d1a1c2291f1483e82ade3d0404cc151`; branch được tạo trực tiếp từ baseline này.
- Implementation permission: `yes` cho revised seven-file AW-PR2 behavior/tracker scope; current instruction chỉ cho amendment/root-routing correction trước CP2.
- Review baseline ngày 2026-07-21: local HEAD, upstream tracking ref và read-only remote HEAD cùng là `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`; working tree sạch, ahead/behind `0/0`.
- Delivery evidence: CP1 và CP1R đều committed/pushed. CP1R behavior commit là `dbf83da2e08ecefefe3af86323bc58c60c378df8`; remote delivery-record HEAD là `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`.
- Historical scope preflight: kết luận sáu required files, `AGENTS.md` audit-only và không có file thứ bảy. Independent review sau CP1/CP1R invalidated kết luận này vì root route không bảo đảm task nhỏ tải universal preflight trước mutation.
- Accepted review findings: 2 Bắt buộc (`Required`) — root-routing gap và stale pushed-HEAD/CP1R evidence. Owner đã duyệt amendment, planning/history correction, `AGENTS.md` behavior correction và stale-evidence correction.
- Permission boundary hiện tại: local checkpoint commit chỉ khi 0 Critical/Required; không push, PR create/update, CI watching, merge, force-push, specialist/sub-agent, production/destructive action hoặc CP2 implementation.

### Cumulative branch changed-file accounting sau CP1R2 correction

- Revised behavior/tracker contract có bảy file: `AGENTS.md`, `docs/agent-loops.md`, `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `.agents/skills/git-checkpoint-workflow/SKILL.md`, `.agents/skills/github-pr-ci-workflow/SKILL.md`, `docs/agent-workflow/progress.md` và `docs/agent-workflow/problems.md`.
- Actual cumulative branch set tại verification có tám file: `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `AGENTS.md`, `docs/agent-loops.md`, master `plan.md`, detailed AW-PR2 `plan.md`, `owner-review-brief.md`, `progress.md` và `problems.md`.
- Trong tám file actual, năm file hiện là behavior/tracker files (`AGENTS.md`, lifecycle, planning skill, progress, problems); ba file là planning/history-only amendment owners (master plan, detailed plan, owner brief).
- Git checkpoint skill và GitHub PR/CI skill thuộc revised seven-file behavior scope nhưng chưa xuất hiện trong cumulative diff vì CP2 vẫn `pending` và không được phép bắt đầu trong correction này.
- Vì vậy cumulative branch diff không phải exact seven-file diff; file accounting phải tiếp tục được lấy từ Git tại mỗi checkpoint.

| Checkpoint | Trạng thái | Files | Verification/review | Commit evidence |
| --- | --- | --- | --- | --- |
| CP0 — Discovery/revalidation | `completed` | none | Baseline, dependency, permission và exact file-set audit pass; 0 Critical, 0 Required | `not applicable` — read-only checkpoint |
| CP1 — Adaptive lifecycle/planning | `completed` | `docs/agent-loops.md`, `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `docs/agent-workflow/progress.md`, `docs/agent-workflow/problems.md` | Skill validator `valid` with 0 errors; text/Markdown/link/table/scope/secret and targeted contract checks pass; re-review has 0 Critical, 0 Required; fresh-reader `not_run` | `0e92a22e5cc0d9769e791da224d100bc668341a8` — `feat(agent-workflow): add adaptive planning lifecycle` |
| CP1R — Review correction | `completed; pushed` | `docs/agent-loops.md`, `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `docs/agent-workflow/progress.md` | Historical self-review passed, but later independent review found the root reachability gap and stale delivery evidence | `dbf83da2e08ecefefe3af86323bc58c60c378df8` — `fix(agent-workflow): align adaptive planning gates`; delivered through remote HEAD `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d` |
| CP1R2 — Root-routing scope amendment | `verified; ready for local checkpoint` | `AGENTS.md`; planning/history owners `docs/agent-workflow/plan.md`, detailed plan, owner brief; tracker owners `progress.md`, `problems.md` | Root typo-only/universal/same-instruction scenarios pass; validator `valid` with 0 errors; docs/text/link/table/scope/secret/Git audits pass; formal re-review has 0 Critical, 0 Required | pending local correction checkpoint; no push permission |
| CP2 — CI permission reconciliation | `pending` | `docs/agent-loops.md`, `.agents/skills/git-checkpoint-workflow/SKILL.md`, `.agents/skills/github-pr-ci-workflow/SKILL.md` | Not started | not committed |
| CP3 — Integration and closure evidence | `pending` | cumulative revised seven-file behavior/tracker contract plus separately classified amendment/history documents | Not started | not committed |

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
| `AW-P001` — CI observation/watch/self-fix permission drift | `confirmed` | `in progress` | `AW-PR2` |
| `AW-P002` — Universal preflight root-routing gap | `resolved` | `completed` | `AW-PR2 CP1R2` |

AW-P001 và AW-P002 là hai problem records độc lập. Root-routing correction không resolve CI permission drift; AW-PR1 không thay permission mode, CI self-fix contract, attempt limit hoặc Git/remote boundary của `AW-P001`.
