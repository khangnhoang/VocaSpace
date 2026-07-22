# Adaptive Agent Workflow — Progress

## Ownership

File này sở hữu trạng thái implementation và delivery hiện tại của chương trình adaptive workflow. [plan.md](./plan.md) tiếp tục sở hữu intended scope, dependency và acceptance criteria; [problems.md](./problems.md) tiếp tục sở hữu problem record.

Chỉ ghi trạng thái có evidence thực tế. Các trạng thái delivery độc lập gồm: `planned`, `approved`, `implemented`, `verified`, `committed`, `pushed`, `PR open` và `merged`. Trong bảng chương trình, `approved` chỉ nghĩa là owner đã duyệt master-program intended scope; nó không tự duyệt exact per-PR plan và không tự cấp implementation permission. Per-PR plan decision nằm trong owner review record của PR tương ứng; cột permission riêng ghi action hiện được phép.

## Trạng thái chương trình

| Đơn vị | `planned` | Master-program `approved` | Implementation permission | `implemented` | `verified` | `committed` | `pushed` | `PR open` | `merged` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AW-PR1 — Owner-facing language và report localization | yes | yes | yes | yes | yes | yes | yes | no | yes |
| AW-PR2 — Lifecycle preflight, CI permission modes và adaptive planning | yes | yes | yes | yes | yes | yes | yes | yes | no |
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
- Implementation permission: AW-PR2 behavior implementation đã hoàn tất; instruction hiện tại cấp exact deterministic warning-snapshot correction trong sole approved test-support file, directly necessary records và PR/CI delivery cho exact branch. Không cấp AW-PR3A/AW-PR3B, behavior implementation mới, validator/threshold change hoặc unrelated test work.
- CP2 preflight ngày 2026-07-22: local HEAD, upstream tracking ref và read-only remote HEAD cùng là `868bf5dde523c26a941b7ba73d59ef08e2ed898b`; working tree sạch, ahead/behind `0/0`; merge-base với synchronized `main == origin/main` là `b10be2654d1a1c2291f1483e82ade3d0404cc151`.
- CP3 preflight ngày 2026-07-22: local HEAD, upstream tracking ref và read-only remote HEAD cùng là `218a9d8cf5ebd90c44d1ee2af6271d16ca840639`; working tree sạch, ahead/behind `0/0`; merge-base với synchronized `main == origin/main` vẫn là `b10be2654d1a1c2291f1483e82ade3d0404cc151`.
- Final-delivery preflight ngày 2026-07-22: sau `git fetch origin`, local HEAD, upstream và live remote HEAD cùng là `901b3f3f27dca7171eef20d52df67fc95305da04`; `main == origin/main == b10be2654d1a1c2291f1483e82ade3d0404cc151`, working tree sạch, ahead/behind `0/0`, cumulative diff đúng 10 files và chưa có PR cho branch.
- Final-audit correction `464d03f398fd5ce21d77a246cd5193742a33a8e4` đã normal-push và [PR #59](https://github.com/khangnhoang/VocaSpace/pull/59) được tạo vào `main` với đúng head commit đó. Initial checks: `Test and Build` `IN_PROGRESS`, `Vercel` `PENDING`, `Vercel Preview Comments` `SUCCESS`; CI terminal evidence sẽ được báo sau khi watch hoàn tất.
- PR #59 tại head `e15dfca50dcfc7183866cb07cd1a9b5b1baa55d4` sau đó có `Test and Build=FAILURE`, `production-gate=FAILURE`, `Vercel=SUCCESS`, `Vercel Preview Comments=SUCCESS`. Failed logs cho thấy current-repository validator test kỳ vọng 2 warning codes nhưng live validator trả 3 `CORE_LENGTH_SIGNAL`; `production-gate` fail dây chuyền từ `test-and-build result: failure`.
- Historical CI classification là `branch-caused-large-risky` vì fix tối thiểu cần test file thứ 11 ngoài ten-file scope được duyệt tại thời điểm đó; không có self-fix attempt nào bắt đầu. Owner instruction tiếp theo duyệt `.agents/scripts/validate-skill.test.mjs` làm sole test-support amendment và cấp explicit correction/validation/commit/normal-push/re-watch permission; quyết định mới không viết lại classification lịch sử.
- Delivery evidence: CP1 và CP1R đều committed/pushed. CP1R behavior commit là `dbf83da2e08ecefefe3af86323bc58c60c378df8`; remote delivery-record HEAD là `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d`.
- CP1R2 behavior/planning correction gồm `3027959ac68ea9203d6af1594668cb22d6e7c3d9` và delivery-record commit `868bf5dde523c26a941b7ba73d59ef08e2ed898b`; cả hai đã được normal-push tới cùng remote HEAD `868bf5dde523c26a941b7ba73d59ef08e2ed898b`. Các record “not pushed” tại checkpoint trước vẫn là evidence lịch sử đúng tại thời điểm được ghi.
- One-time CP1R2 push permission đã được owner cấp và tiêu thụ cho exact normal push đó. Tại checkpoint CP1R2, không còn standing push permission và PR/CI/merge/remote actions chưa được cấp; current final-delivery permission được ghi riêng bên dưới.
- Historical scope preflight: kết luận sáu required files, `AGENTS.md` audit-only và không có file thứ bảy. Independent review sau CP1/CP1R invalidated kết luận này vì root route không bảo đảm task nhỏ tải universal preflight trước mutation.
- Accepted review findings: 2 Bắt buộc (`Required`) — root-routing gap và stale pushed-HEAD/CP1R evidence. Owner đã duyệt amendment, planning/history correction, `AGENTS.md` behavior correction và stale-evidence correction.
- Permission boundary hiện tại: sole validator test-support correction, directly necessary record updates, targeted validation, one focused local checkpoint, normal push và re-watch PR #59 được cấp. Merge, auto-merge, force-push, branch deletion, validator/threshold change, unrelated test refactor, specialist/sub-agent, AW-PR3A/AW-PR3B, production/deployment/database/remote-environment và unrelated scope không được cấp.

### Cumulative branch changed-file accounting trong CP3

- Revised behavior/tracker contract có bảy file: `AGENTS.md`, `docs/agent-loops.md`, `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `.agents/skills/git-checkpoint-workflow/SKILL.md`, `.agents/skills/github-pr-ci-workflow/SKILL.md`, `docs/agent-workflow/progress.md` và `docs/agent-workflow/problems.md`.
- Actual cumulative branch set trong CP2 có mười file: bảy behavior/tracker files của revised contract và ba planning/history-only amendment owners là master `plan.md`, detailed AW-PR2 `plan.md` và `owner-review-brief.md`.
- Hai CP2 skill files hiện đã xuất hiện trong cumulative diff; exact current set tiếp tục phải lấy từ Git tại verification/checkpoint thay vì suy từ plan.
- Vì vậy cumulative branch diff không phải exact seven-file diff; file accounting phải tiếp tục được lấy từ Git tại mỗi checkpoint.
- CP2 local verification: repository skill validator `valid` với 0 errors; static contract scenarios cho inspect/watch/create/update/combined/fix-only/commit-only/push-only, initial push, interactive push/fork, attempts 1/2/3 và risky-failure stops đều pass; Markdown/link/table/UTF-8/EOL/final-newline/trailing-whitespace, `git diff --check`, conflict/zero-width/secret, exact worktree/cumulative scope và Git-state audits pass.
- CP2 behavior commit `95d6fb468a3017077917536708aeecc7385f182a` và delivery-record commit `218a9d8cf5ebd90c44d1ee2af6271d16ca840639` đã được normal-push tới remote HEAD `218a9d8cf5ebd90c44d1ee2af6271d16ca840639`. Record “not pushed” tại CP2 local checkpoint là evidence lịch sử đúng trước action này; one-time CP2 push permission đã được tiêu thụ và không tạo standing remote permission.
- CP3 cumulative audit xác nhận đủ bảy behavior/tracker sources, ba planning/history amendment sources và complete ten-file Git diff; không có behavior file thứ tám, competing final rule, taxonomy drift hoặc excluded scope.
- Current approved cumulative scope sau CI amendment là 11 files: giữ nguyên 7 behavior/tracker và 3 planning/history files, cộng riêng `.agents/scripts/validate-skill.test.mjs` làm test-support file. Live validator xác nhận deterministic warning order là `implementation-planning-and-pr-breakdown`, `nextjs-server-action-zod`, `test-quality-strategy`, đều với code `CORE_LENGTH_SIGNAL`.
- `AW-P001` chuyển sang `resolved/completed` sau four-source permission audit, toàn bộ adaptive/CI scenarios, validator/docs/scope checks và formal cumulative review; `AW-P002` giữ `resolved/completed`.

| Checkpoint | Trạng thái | Files | Verification/review | Commit evidence |
| --- | --- | --- | --- | --- |
| CP0 — Discovery/revalidation | `completed` | none | Baseline, dependency, permission và exact file-set audit pass; 0 Critical, 0 Required | `not applicable` — read-only checkpoint |
| CP1 — Adaptive lifecycle/planning | `completed` | `docs/agent-loops.md`, `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `docs/agent-workflow/progress.md`, `docs/agent-workflow/problems.md` | Skill validator `valid` with 0 errors; text/Markdown/link/table/scope/secret and targeted contract checks pass; re-review has 0 Critical, 0 Required; fresh-reader `not_run` | `0e92a22e5cc0d9769e791da224d100bc668341a8` — `feat(agent-workflow): add adaptive planning lifecycle` |
| CP1R — Review correction | `completed; pushed` | `docs/agent-loops.md`, `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`, `docs/agent-workflow/progress.md` | Historical self-review passed, but later independent review found the root reachability gap and stale delivery evidence | `dbf83da2e08ecefefe3af86323bc58c60c378df8` — `fix(agent-workflow): align adaptive planning gates`; delivered through remote HEAD `609e5ea9173e3de43e63eaab2f2ec2e9c5cf698d` |
| CP1R2 — Root-routing scope amendment | `completed; pushed` | `AGENTS.md`; planning/history owners `docs/agent-workflow/plan.md`, detailed plan, owner brief; tracker owners `progress.md`, `problems.md` | Root typo-only/universal/same-instruction scenarios pass; validator `valid` with 0 errors; docs/text/link/table/scope/secret/Git audits pass; formal re-review has 0 Critical, 0 Required | `3027959ac68ea9203d6af1594668cb22d6e7c3d9` — `fix(agent-workflow): route universal preflight from root`; delivery record `868bf5dde523c26a941b7ba73d59ef08e2ed898b`; normal-pushed through remote HEAD `868bf5dde523c26a941b7ba73d59ef08e2ed898b` |
| CP2 — CI permission reconciliation | `completed; pushed` | `docs/agent-loops.md`, `.agents/skills/git-checkpoint-workflow/SKILL.md`, `.agents/skills/github-pr-ci-workflow/SKILL.md`; supporting tracker/decision records only from actual evidence | Validator, permission scenarios, docs/text/link/table/scope/secret/Git audits pass; formal re-review has 0 Critical, 0 Required; fresh-reader `not_run` | `95d6fb468a3017077917536708aeecc7385f182a` — `feat(agent-workflow): reconcile CI permission modes`; delivery record `218a9d8cf5ebd90c44d1ee2af6271d16ca840639`; normal-pushed through remote HEAD `218a9d8cf5ebd90c44d1ee2af6271d16ca840639` |
| CP3 — Integration and closure evidence | `completed; pushed` | cumulative revised seven-file behavior/tracker contract plus three separately classified planning/history documents; CP3 mutates supporting records only | Full section 20 suite and formal cumulative review pass with 0 Critical, 0 Required; fresh-reader `not_run` | Closure `17960fd8f3c36a44c540b78f05a3c22640440fa1`; record `901b3f3f27dca7171eef20d52df67fc95305da04`; normal-pushed through remote HEAD `901b3f3f27dca7171eef20d52df67fc95305da04` |

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
| `AW-P001` — CI observation/watch/self-fix permission drift | `resolved` | `completed` | `AW-PR2` |
| `AW-P002` — Universal preflight root-routing gap | `resolved` | `completed` | `AW-PR2 CP1R2` |

AW-P001 và AW-P002 là hai problem records độc lập. Root-routing correction không tự resolve CI permission drift; `AW-P001` chỉ đóng sau CP2 behavior reconciliation và CP3 cumulative closure evidence. AW-PR1 không thay permission mode, CI self-fix contract, attempt limit hoặc Git/remote boundary của `AW-P001`.
