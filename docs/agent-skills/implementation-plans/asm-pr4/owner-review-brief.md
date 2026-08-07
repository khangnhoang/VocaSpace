# ASM-PR4 — Bản tóm tắt để owner duyệt

Status: `pending owner review`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface, không thay thế detailed plan. Nó chỉ ghi decision khi có explicit owner evidence. `pending` không cấp ASM-PR4 skill implementation, correction, commit, push, PR, CI hoặc merge permission.

## Quyết định owner được yêu cầu

Owner chọn một trong ba hướng cho material plan:

- `approve`: duyệt exact candidate/order/target bundle, frozen-suite, verification, rollback và stop contract;
- `revise`: yêu cầu thay đổi plan trước implementation;
- `reject`: dừng ASM-PR4 approach này.

Plan approval vẫn tách khỏi permission cho skill edits, per-skill commits, final push, PR/CI và merge. Existing program authority đã cho phép bounded advisory read-only fresh readers trong migration comparison; authority đó không cho phép sửa candidate hoặc thực hiện Git/remote action.

## Mục tiêu

Structurally migrate ba product-engineering skills, theo exact sequential order:

```text
frontend-workflow
→ test-quality-strategy
→ nextjs-server-action-zod
```

Mỗi migration phải:

- giữ mandatory authority/safety/routing/stop/reporting behavior trong core;
- move existing conditional procedure sang exact approved references, structural-only;
- chọn tất cả và chỉ matching references;
- giữ committed suites audit-only;
- pass base-versus-candidate comparison, mandatory fresh-reader gate và formal review;
- có correction/rollback boundary độc lập trước candidate tiếp theo.

## Dependency, branch và baseline

- ASM-PR3 owner pilot decision: `continue` on `2026-08-05`.
- ASM-PR3 final head: `1301ed6`.
- PR #70 merge commit: `c8e4245f7fb8337063e2ef2a4e0d5120f6427556`.
- Current planning/later-implementation branch: `feat/agent-skills-asm-pr4`.
- Branch created from synchronized `main == origin/main == c8e4245`.
- Proposed immutable behavioral baseline for all three candidates: `c8e4245`.
- Current target cores and all 9 suite files match their exact `c8e4245` Git blobs.

## Proposed target bundles

```text
.agents/skills/frontend-workflow/
├── SKILL.md
└── references/
    ├── mock-data.md
    ├── async-state-and-forms.md
    └── manual-ui-validation.md

.agents/skills/test-quality-strategy/
├── SKILL.md
└── references/
    ├── smoke-e2e-and-browser.md
    ├── manual-qa-and-fixtures.md
    ├── test-plan-headers.md
    └── mocking-and-regression.md

.agents/skills/nextjs-server-action-zod/
├── SKILL.md
└── references/
    ├── schema-placement-and-design.md
    ├── server-actions-and-route-handlers.md
    ├── formdata-and-react-hook-form.md
    ├── uploads-webhooks-and-payments.md
    └── validation-test-matrix.md
```

Không thêm reference, script, asset, metadata hoặc example mới ngoài catalog này.

## Mandatory core behavior

`frontend-workflow` core giữ modes/plan permission, repository/contract discovery, related owners, no-fake-success, minimum async/form/state invariants, fixture routing, hard stops, final audit và truthful report.

`test-quality-strategy` core giữ lowest-useful-layer, observable guarantee, coverage model, verification-scope selection, evidence/coverage truth, related owners, anti-patterns và checklist.

`nextjs-server-action-zod` core giữ server validation, parsed-only use, privileged-field protection, auth/permission/state separation, side-effect order, business/security boundaries, Supabase ordering, safe errors, required workflow và stops.

Nếu một mandatory rule cần reference mới quyết định được, split bị reject dù core ngắn hơn.

## Frozen evidence contract

| Candidate | Suite files | Cases |
| --- | ---: | ---: |
| `frontend-workflow` | 3 | 19 |
| `test-quality-strategy` | 3 | 15 |
| `nextjs-server-action-zod` | 3 | 20 |
| **Total** | **9** | **54** |

- Suite definitions không được sửa/weaken trong ASM-PR4.
- Suite gap trước baseline → stop affected candidate và dùng separately reviewed coverage correction.
- Candidate failure sau baseline → không sửa oracle để pass.
- Formal comparison chạy mọi 54 cases; mandatory fresh-reader gate chạy đủ 13 committed fresh-reader cases.
- Resource evidence phải phân biệt `available`, `supplied`, `read`, `unknown`; self-report không phải runtime enforcement.
- Không claim token saving, native trigger hoặc isolation nếu evidence không chứng minh.

## Ordered gates

1. Owner approves/revises/rejects plan và cấp exact later implementation/Git permissions nếu approve.
2. Reconfirm `c8e4245` and all 12 core/suite blobs; freeze 54 cases.
3. Capture 19-case `frontend-workflow` monolith baseline.
4. Structural split FW → deterministic checks → 19 comparisons → 4 fresh-reader cases → review/correction → independent rollback checkpoint.
5. Capture 15-case TQS monolith baseline at the same PR base.
6. Structural split TQS → checks → 15 comparisons → 4 fresh-reader cases → review/correction → independent rollback checkpoint.
7. Capture 20-case NSAZ monolith baseline at the same PR base.
8. Structural split NSAZ → checks → 20 comparisons → 5 fresh-reader cases → trust-boundary integration review/correction → independent rollback checkpoint.
9. Cumulative all-suite, bundle-shape, cross-skill routing, source-scope và Git hygiene review.
10. Continue correction/re-review loop only within granted scope until final `0 Critical / 0 Required`.
11. Stop for owner delivery decision; no push/PR/CI/merge is inferred.

## Verification bắt buộc

```text
node --test .agents/scripts/validate-skill.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --skill frontend-workflow
node .agents/scripts/run-skill-evals.mjs validate --skill test-quality-strategy
node .agents/scripts/run-skill-evals.mjs validate --skill nextjs-server-action-zod
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Current deterministic baseline: validator `37/37`; runner `130/130`; structural `11 skills / 0 errors / 4` existing warnings; focused `19/15/20`; cumulative `9/27/177/0`.

Ngoài ra phải pass direct link/path/regular-file/reparse, moved-content, UTF-8/no-BOM/newline/fence/table, frozen-blob, exact-scope, secret/conflict-marker, semantic comparison và fresh-reader audits.

## Blocking rules

- Wrong/missing reference, mandatory rule rời core, suite gap/drift, material regression, safety veto hoặc material `inconclusive` → stop active candidate.
- Behavior rewrite, new reference, tooling/CI/product/DB need → scope expansion; stop.
- Một candidate pass không bù cho candidate khác fail.
- Later candidate vẫn dùng `c8e4245`, không dùng prior migrated working tree làm baseline.
- Raw evidence/workspace/transcript/absolute temp path không commit.
- `not_run` không phải pass.
- ASM-PR5A không bắt đầu trước khi ASM-PR4 merge.

## Exact current permission

Đã được cấp trong owner instruction hiện tại:

- sync local `main`;
- create/use `feat/agent-skills-asm-pr4` cho planning và later implementation;
- reconcile stale ASM-PR3 docs;
- perform ASM-PR4 discovery;
- write/review planning artifacts;
- create one coherent planning checkpoint commit;
- normal-push planning branch sau final `0 Critical / 0 Required`.

Chưa được cấp:

- edit three target skill bundles;
- implementation correction/checkpoint commits;
- unbounded/non-program model action;
- suite/tooling/CI/product/DB changes;
- PR creation/update, CI watch/fix, merge, deployment;
- destructive/history rewrite.

## Quyết định owner hiện tại

Current decision: `pending`.

Planning-package self-review: initial `0 Critical / 1 Required`; the fresh-reader permission contradiction was corrected; re-review reached `0 Critical / 0 Required`. Final cumulative planning review also reached `0 Critical / 0 Required`; verdict `Approved` for the owner-authorized planning commit and normal push only. Fresh-reader for planning: `not_run` because direct deterministic evidence resolved the plan. Material plan decision remains `pending` and no skill implementation is authorized.

Smallest next owner action sau planning delivery: review [plan.md](./plan.md) và trả `approve`, `revise` hoặc `reject`; nếu `approve`, nêu exact implementation/checkpoint/push/PR/CI permissions mong muốn cho session implementation.
