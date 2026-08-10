# ASM-PR5A — Bản tóm tắt để owner duyệt

Status: `approved; CP1–CP9 delivery complete; RQ1 accepted; RQ2 reconciled`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface, không thay thế detailed plan. Mọi thay đổi material về scope, rule, checkpoint, evidence, permission hoặc rollback phải được reconcile vào cả hai file và re-review trước implementation.

## Quyết định cần owner đưa ra

Chọn một trong ba trạng thái:

- `approve`: duyệt material plan; implementation vẫn chỉ bắt đầu khi owner đồng thời hoặc sau đó cấp exact implementation/evidence/commit boundary;
- `revise`: nêu exact phần cần sửa; plan giữ `pending`;
- `reject`: dừng ASM-PR5A implementation.

Current decision: `approved and executed through CP9; CP9 normal-push grant consumed; no standing push permission`.

Ba lựa chọn phía trên là historical planning decision surface; chúng không còn mô tả một pending implementation gate.

Planning-package self-review: initial `0 Critical / 1 Required` for stale nested ASM-PR3/ASM-PR4 current-authority labels; corrected to historical/consumed wording. Re-review reached `0 Critical / 0 Required`. Initial final staged-diff pass found `0 Critical / 1 Required` for one remaining current/future historical-authority label; corrected. First final re-review found `0 Critical / 1 Required` for a machine-specific absolute path in the tooling-noise record; generalized. Terminal fresh-context cached-diff review reached `0 Critical / 0 Required`; verdict `Approved` for the planning commit/normal push only. No separate executor was used, so this is not labeled a formal independent-reviewer claim.

## Execution completion record

- Exact implementation range: `f30fbc5133a0978247ced2ad6fdec557de586f39..5c962b5dc0c770a57b9f39920dd3051983d5e298`.
- IPPB checkpoints: structural `a32fb77f5fd9910bb3616e534aed3973c4167805`, accepted correction `b0423355330059d49592c9e07d8a403262bdd207`; final semantic report `18/18 passed`, fresh-reader `4/4`, SHA-256 `85e8bf45cbd790822e220b8bf5b545c9509f8e63df6da1195a1debc3cbd1c336`.
- CRQ checkpoints: structural `11c30b143e0a4d1417fe0641b283846c988b7f96`, accepted correction `5c962b5dc0c770a57b9f39920dd3051983d5e298`; final semantic report `20/20 passed/equivalent`, fresh-reader `5/5`, SHA-256 `24157bc27426152560b4ae5ec66eb22dab4498176e2a835a31d4e1f9310d8e11`.
- The CP5 `crq-fresh-specialist-package` partial was preserved through structural CP6 and corrected only in CP7. The final package uses one bounded specialist reviewer without unsupported `fresh-reader` or `independent review` labels.
- Historical CP8 exact 10-file cumulative review passed all deterministic gates, preserved all six suite blobs at that checkpoint and ended `0 Critical / 0 Required`; a separate fresh-context executor confirmed the same verdict without claiming formal independence.
- CP9 delivery completed through `adabf38adcedd0bb475b2c651bb1072f5bf74710`, which was successfully normal-pushed to `origin/feat/agent-skills-asm-pr5a`. That exact push grant is consumed. PR creation/update, CI watch/fix, merge, deployment, force-push and history rewrite remain unauthorized.

## Post-delivery RQ1/RQ2 correction record

- RQ1 confirmed a real coverage gap and one IPPB evidence-discovered multi-PR under-read. The owner explicitly authorized the smallest exception to the earlier frozen-suite restriction.
- Commit `fa7bd54` keeps the correction independently revertible and changes exactly IPPB `routing.json`, CRQ `routing.json` and the IPPB route condition. Each routing suite adds three authoritative cases; the other four suite files remain unchanged.
- Current counts/evidence: IPPB `21 cases / 0 diagnostics`; CRQ `23 cases / 0 diagnostics`; cumulative `9 skills / 27 files / 183 cases / 0 diagnostics`; validator `37/37`; runner `130/130`; repository validator `11 skills / 0 errors / 0 warnings`; RQ1 review `0 Critical / 0 Required`.
- The two routing suites are no longer byte-identical to `461269b`; IPPB/CRQ regression and fresh-reader suites remain byte-identical. `461269b` remains the immutable behavioral baseline for the original migration comparisons and migrated-skill behavior where applicable. Historical `18/20`, `38` and `177` evidence below remains labeled by its original checkpoint.
- RQ2 is confirmed and corrected: CP9 delivery is complete, its push authority is consumed, and later corrections require a new explicit delivery grant. This local correction does not create push permission.

Current-state precedence: this post-delivery record supersedes only current delivery authority, suite-byte identity and case/validation totals. The original migration plan, CP8 gate and review findings below remain historical evidence and are not retroactively rewritten.

## Mục tiêu

Trên cùng nhánh `feat/agent-skills-asm-pr5a`, sau một permission riêng, migrate tuần tự:

```text
implementation-planning-and-pr-breakdown
→ code-review-and-quality
→ cumulative cross-skill final review
```

Mỗi skill được tách từ một monolithic core thành một concise core và đúng bốn references đã duyệt. Không redesign behavior, permission, ownership, status/verdict semantics hoặc stop behavior.

## Historical baseline và dependency đã xác nhận

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

Core giữ activation/ownership, routing, discovery/read-only, plan/implementation/Git separation, workflow fundamentals, evidence taxonomy, sizing/dependency/slicing, acceptance/verification, scope/stops/reporting và concise post-self-review specialist gate. Gate mặc định `0` và phải tự quyết định được read/skip trước khi reference được load; reference chỉ giữ detailed risk-clustering/decision/quota/reconciliation procedure.

### `code-review-and-quality`

- `references/domain-review-dimensions.md`
- `references/special-review-cases.md`
- `references/specialist-review.md`
- `references/review-report-templates.md`

Core giữ activation/ownership, read-only default, approval/range, main workflow, review-level selection và applicable-main-depth/reclassification rules, severity/status/verdict meanings, no-permission rule, re-review, checklist và concise post-main-review specialist gate. Gate mặc định `0` và giữ đủ hard-risk/material-uncertainty/evidence/cluster/benefit/permission conditions; reference giữ detailed clustering, quota, package, reviewer, reconciliation và claim-label procedure, không sở hữu review-level selection.

Detailed plan chứa exact read conditions, content allocation và skip groups cho từng reference.

## Historical frozen-suite sufficiency

Discovery audit kết luận sáu suite hiện tại đủ cho migration scope:

- mọi proposed reference có ít nhất một positive selection và meaningful negative skips;
- cả hai skill có all-skip controls;
- ownership, permission, read-only, status/verdict, stop và reporting invariants đều có coverage;
- không có gap nào cần sửa ASM-PR2C hoặc frozen files trước implementation.

Nếu execution phát hiện gap mới, affected migration phải stop. Không được sửa/weaken suite để candidate pass. RQ1 later followed this rule: investigation stopped before correction, then the owner explicitly authorized the separate, narrow coverage exception recorded above.

## Chín checkpoint tuần tự

1. Baseline/readiness: record exact `<implementation-start-head>`, recheck branch, eight blobs, control-plane tests, focused/all validation và permission.
2. IPPB immutable monolith baseline: 18 candidate-only baseline cases from `461269b`; no skill edit or comparison claim.
3. IPPB structural-only migration: exact four references, moved-content/route/structure validation, distinct structural checkpoint; no semantic correction.
4. IPPB semantic/fresh-reader evidence + correction + accepted rollback: comparative workspace against `461269b`, 18 cases, fresh `4/4`, new correction history only, `0/0`.
5. CRQ immutable monolith baseline: 20 candidate-only baseline cases from `461269b`; accepted IPPB tree is not its behavioral baseline.
6. CRQ structural-only migration: exact four references and distinct structural checkpoint; no semantic correction.
7. CRQ semantic/fresh-reader evidence + correction + accepted rollback: 20 comparative cases, fresh `5/5`, new correction history only, `0/0`.
8. Cumulative final review: exact resolved Git range `<implementation-start-head>..<crq-accepted-head>`; semantic reports remain pinned to `461269b`.
9. Delivery state: stop for a separate owner decision; push/PR/CI/merge are not inferred.

## Historical migration acceptance gate

Gate này mô tả CP8 và giữ nguyên như historical evidence. Current routing-suite/count state được supersede bởi post-delivery RQ1 record; CP8 không bị viết lại hồi tố.

- exact two cores + eight references;
- all mandatory core rules and read/skip conditions preserved;
- each core retains the complete minimum specialist candidate gate, while specialist references contain only detailed post-gate procedure;
- six suite blobs unchanged;
- all 38 comparisons and IPPB `4/4` + CRQ `5/5` mandatory fresh-reader cases complete;
- zero veto, regression, failed or materially inconclusive result;
- truthful resource/evidence status;
- per-skill and cumulative review all `0 Critical / 0 Required`;
- structural-only checkpoints remain distinct from later behavioral/routing correction commits;
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

Historical planning, planning-correction and CP6–CP9 grants are consumed. Owner instruction ngày `2026-08-09` authorized exact implementation/evidence/checkpoint work and one final normal push; implementation, cumulative review and that remote delivery are complete. Post-delivery RQ1/RQ2 authority covers two distinct local correction commits only and does not grant push, PR, CI, merge, deploy or destructive/history action.

Program-level bounded advisory read-only fresh-reader authority đã được dùng cho mandatory migration execution; nó không cấp edit/Git/remote permission và không mở rộng CP9.

## Historical owner response surface

Để implementation có thể bắt đầu sau planning delivery, owner cần xác nhận rõ:

1. `approve`, `revise` hoặc `reject` material plan;
2. nếu `approve`, exact Checkpoint 1–8 implementation/evidence boundary;
3. có cho phép distinct structural-only checkpoint commits và later per-skill correction/accepted rollback commits hay không;
4. delivery push, PR, CI và merge vẫn là các quyết định riêng.

Post-delivery correction boundary: keep the accepted RQ1 commit and durable-state commit distinct, re-review both, then stop. Any later delivery requires a new explicit push grant and current Git evidence; PR creation/update remains a separate decision.

## Planning-review findings

- Finding 1: `confirmed / correct in scope`. Prior contract made specialist-reference routing circular by leaving too little candidate gating in core. Roadmap, progressive-disclosure contract, current monoliths and frozen default-zero/positive specialist cases all support the corrected core/reference boundary.
- Finding 2: `confirmed / correct in scope`. Prior five-checkpoint design mixed structural split with semantic evidence/correction. Roadmap, master-plan completion rules and ASM-PR4 precedent require distinct structural-only history before later clarification.
- Historical planning finding: all six suites were unchanged and no gap was known at that checkpoint. The later RQ1 investigation supersedes only current routing-suite coverage through the explicitly authorized exception recorded above.
- Index/master plan/ASM-PR4 historical docs: unchanged because their owned information remains correct.
- Correction review gate: complete-diff self-review and terminal fresh-context main-agent review pass at `0 Critical / 0 Required`; no formal independent-reviewer identity is claimed.
