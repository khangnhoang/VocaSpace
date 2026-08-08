# ASM-PR5A — Bản tóm tắt để owner duyệt

Status: `pending owner review; implementation not authorized`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface, không thay thế detailed plan. Mọi thay đổi material về scope, rule, checkpoint, evidence, permission hoặc rollback phải được reconcile vào cả hai file và re-review trước implementation.

## Quyết định cần owner đưa ra

Chọn một trong ba trạng thái:

- `approve`: duyệt material plan; implementation vẫn chỉ bắt đầu khi owner đồng thời hoặc sau đó cấp exact implementation/evidence/commit boundary;
- `revise`: nêu exact phần cần sửa; plan giữ `pending`;
- `reject`: dừng ASM-PR5A implementation.

Current decision: `pending`.

Planning-package self-review: initial `0 Critical / 1 Required` for stale nested ASM-PR3/ASM-PR4 current-authority labels; corrected to historical/consumed wording. Re-review reached `0 Critical / 0 Required`. Initial final staged-diff pass found `0 Critical / 1 Required` for one remaining current/future historical-authority label; corrected. First final re-review found `0 Critical / 1 Required` for a machine-specific absolute path in the tooling-noise record; generalized. Terminal fresh-context cached-diff review reached `0 Critical / 0 Required`; verdict `Approved` for the planning commit/normal push only. No separate executor was used, so this is not labeled a formal independent-reviewer claim.

## Mục tiêu

Trên cùng nhánh `feat/agent-skills-asm-pr5a`, sau một permission riêng, migrate tuần tự:

```text
implementation-planning-and-pr-breakdown
→ code-review-and-quality
→ cumulative cross-skill final review
```

Mỗi skill được tách từ một monolithic core thành một concise core và đúng bốn references đã duyệt. Không redesign behavior, permission, ownership, status/verdict semantics hoặc stop behavior.

## Baseline và dependency đã xác nhận

- ASM-PR4 merged through PR #71 at `461269b70d8b5a9623f30ec43005f2d085958f43`.
- Local `main` đã synchronize với `origin/main` bằng fast-forward-only workflow.
- Planning/later-implementation branch được tạo trực tiếp từ mốc này; initial `HEAD` và merge-base đều bằng `461269b`.
- Hai core và sáu frozen suite blobs đã pin trong detailed plan.
- Frozen allocation: IPPB `18` cases; CRQ `20` cases; tổng `38`.
- Readiness hiện có: validator `37/37`; runner `130/130`; repository `11 skills / 0 errors / 2 expected target warnings`; focused `18/20`; cumulative `9 skills / 27 files / 177 cases / 0 diagnostics`.
- Runner test pass đến từ conclusive escalated run với sufficient bounded timeout; sandbox `EPERM` và initial 180-second timeout được giữ như environment noise, không được dùng làm repository failure hoặc pass evidence.

## Exact target bundle

### `implementation-planning-and-pr-breakdown`

- `references/tracked-program-and-durable-plan.md`
- `references/pr-breakdown-and-handoff.md`
- `references/qa-fixture-readiness.md`
- `references/specialist-plan-review.md`

Core giữ activation/ownership, routing, discovery/read-only, plan/implementation/Git separation, workflow fundamentals, evidence taxonomy, sizing/dependency/slicing, acceptance/verification, scope/stops/reporting và default `0` specialists.

### `code-review-and-quality`

- `references/domain-review-dimensions.md`
- `references/special-review-cases.md`
- `references/specialist-review.md`
- `references/review-report-templates.md`

Core giữ activation/ownership, read-only default, approval/range, main workflow, severity/status/verdict meanings, no-permission rule, re-review, checklist và default `0` specialists.

Detailed plan chứa exact read conditions, content allocation và skip groups cho từng reference.

## Frozen-suite sufficiency

Discovery audit kết luận sáu suite hiện tại đủ cho migration scope:

- mọi proposed reference có ít nhất một positive selection và meaningful negative skips;
- cả hai skill có all-skip controls;
- ownership, permission, read-only, status/verdict, stop và reporting invariants đều có coverage;
- không có gap nào cần sửa ASM-PR2C hoặc frozen files trước implementation.

Nếu execution phát hiện gap mới, affected migration phải stop. Không được sửa/weaken suite để candidate pass.

## Năm checkpoint tuần tự

1. Baseline/readiness: recheck branch, eight blobs, control-plane tests, focused/all validation và permission.
2. IPPB: 18-case monolith baseline, exact four-reference migration, full comparative/fresh-reader evidence, main review, `0/0`, independent rollback checkpoint.
3. CRQ: re-pin baseline `461269b`, 20-case monolith/candidate evidence, exact four-reference migration, main review, `0/0`, independent rollback checkpoint.
4. Cumulative cross-skill final review: exact 10-file shape, routing/permission/status/verdict audit, all deterministic gates, frozen blobs and `0/0`.
5. Delivery state: stop for a separate owner decision; push/PR/CI/merge are not inferred.

## Acceptance gate

- exact two cores + eight references;
- all mandatory core rules and read/skip conditions preserved;
- six suite blobs unchanged;
- all 38 comparisons and IPPB `4/4` + CRQ `5/5` mandatory fresh-reader cases complete;
- zero veto, regression, failed or materially inconclusive result;
- truthful resource/evidence status;
- per-skill and cumulative review all `0 Critical / 0 Required`;
- no excluded path or unauthorized action.

## Scope không được mở rộng

- frozen suites, validator, runner, schemas, tests, CI, packages và shared tooling;
- Git/GitHub skill migration hoặc actual Git/GitHub workflow behavior;
- product/frontend/server/database/Supabase code, fixtures, migration hoặc deployment;
- PR creation/update, CI watch/fix, merge, force-push, history rewrite;
- unsupported token-saving, isolation, native-routing hoặc performance claim.

## Rollback và stop

IPPB core + bốn references là một rollback bundle. CRQ core + bốn references là rollback bundle thứ hai. Revert một bundle không được làm yếu suite hoặc kéo theo bundle đã accepted còn lại.

Stop khi baseline/permission thay đổi, suite gap xuất hiện, evidence có veto/regression/failure/material inconclusive, provenance không đủ, deterministic tests chưa kết luận hoặc còn Critical/Required.

## Permission record

Instruction ngày `2026-08-08` cấp planning discovery/docs, một coherent planning commit và một normal push trên `feat/agent-skills-asm-pr5a`. Grant này không cấp target implementation, checkpoint commits, model execution ngoài bounded program authority, PR, CI, merge, deploy hoặc destructive/history action.

Program-level bounded advisory read-only fresh-reader authority vẫn tồn tại và mandatory cho migration execution; nó không cấp edit/Git/remote permission.

## Owner response surface

Để implementation có thể bắt đầu sau planning delivery, owner cần xác nhận rõ:

1. `approve`, `revise` hoặc `reject` material plan;
2. nếu `approve`, exact Checkpoint 1–4 implementation/evidence boundary;
3. có cho phép per-skill local rollback commits hay không;
4. delivery push, PR, CI và merge vẫn là các quyết định riêng.

Next action sau planning delivery: owner review. Không bắt đầu implementation, không tạo PR.
