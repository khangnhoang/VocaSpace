# ASM-PR5B — Bản tóm tắt để owner duyệt

Status: `pending owner approval; implementation not authorized`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface, không thay detailed plan. Material change về scope, core/reference allocation, checkpoint, evidence, permission, delivery hoặc rollback phải được reconcile vào plan và re-review trước implementation.

## Quyết định owner cần đưa ra

Chọn một trạng thái:

- `approve`: duyệt material ASM-PR5B plan; không tự cấp implementation;
- `revise`: nêu exact phần cần sửa; plan tiếp tục `pending`;
- `reject`: dừng ASM-PR5B implementation.

Current decision: `pending`.

## Baseline và dependency

- Synchronized baseline: `main == origin/main == 3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a`.
- `3fa621c` là merge commit PR #72 / ASM-PR5A; dependency satisfied.
- Planning branch: `feat/agent-skills-asm-pr5b`, created directly from synchronized `main`; initial merge-base/HEAD equal `3fa621c`, divergence `0/0`.
- Hai target cores và sáu suite blobs byte-identical giữa `461269b` và `3fa621c`; detailed plan pins exact eight blob IDs.

## Discovery verdict

- GCW current monolith: `441` lines; suites `10/6/5 = 21`.
- GHCI current monolith: `437` lines; suites `11/7/6 = 24`.
- Every approved reference has positive selection and meaningful skips; cases cover protected local/remote authority, history/destructive, PR-only/initial-push, self-fix taxonomy, DB-risk, merge và reporting boundaries.
- No frozen-suite coverage gap was found; all six suites remain audit-only.
- One roadmap clarification is required: GCW `Specialist escalation signals` stays in core because it is a decision/routing rule with no approved optional consumer.
- `progress.md` is reconciled because Git proves ASM-PR5A has merged and ASM-PR5B is no longer dependency-blocked.

## Exact target bundle

### `git-checkpoint-workflow`

- `references/branch-start-and-sync.md`
- `references/commit-and-staging.md`
- `references/corrections-and-history.md`
- `references/push-and-remote.md`

Core keeps activation/ownership/routing, permission separation, dirty/base/staging stops, local/remote boundary, `Specialist escalation signals`, failure behavior, output contract và checklist.

### `github-pr-ci-workflow`

- `references/pr-create-update.md`
- `references/ci-watch-and-triage.md`
- `references/ci-self-fix.md`
- `references/merge-and-auto-merge.md`

Core keeps preconditions, exact permission modes, no-initial-push, self-fix minimum eligibility, DB-risk prohibition, merge authority, safety/stops và final status report.

## Chín checkpoint tuần tự

1. Reconfirm baseline/readiness/permission và record `<implementation-start-head>`.
2. Execute GCW immutable monolith baseline, 21 cases, no edit/comparison claim.
3. GCW structural-only split và distinct structural commit; no semantic correction.
4. GCW 21-case comparison + fresh-reader `5/5`; later corrections only; accepted rollback head `0 Critical / 0 Required`.
5. Execute GHCI immutable monolith baseline, 24 cases, still pinned to `3fa621c`.
6. GHCI structural-only split và distinct structural commit; no semantic correction.
7. GHCI 24-case comparison + fresh-reader `6/6`; later corrections only; accepted rollback head `0 Critical / 0 Required`.
8. Cumulative exact-range review, durable-doc reconciliation và terminal `0 Critical / 0 Required`; remote state remains not pushed/pending.
9. Separate delivery gate. Agent delivery requires a new grant covering accepted-head push plus post-push plan/brief/progress reconciliation commit và second normal push; PR/CI/merge remain separate.

Structural commits are never amended/rebased/squashed by default. One skill's pass cannot offset the other's regression.

## Verification readiness

Planning evidence on Node `v24.11.1`:

- `node --test .agents/scripts/validate-skill.test.mjs`: `37/37` pass;
- `node --test .agents/scripts/run-skill-evals.test.mjs`: `130/130` pass;
- repository validator: `11 skills / 0 errors / 0 warnings`;
- GCW focused: `21 cases / 0 diagnostics`;
- GHCI focused: `24 cases / 0 diagnostics`;
- cumulative: `9 skills / 27 files / 183 cases / 0 diagnostics`.

Future implementation must rerun these gates and all 45 comparisons. Synthetic packaging is not enforced isolation; runner does not execute/grade model; raw workspaces/reports remain transient.

## Scope không được mở rộng

- six frozen suites;
- validator/runner/schema/tests/CI/package/shared tooling;
- planning/review/Supabase/other skills;
- product/frontend/server/database/migration/deploy work;
- actual Git/GitHub mutation as semantic evidence;
- unsupported token/native-trigger/isolation/performance claims;
- PR, CI watch/fix, merge, force-push hoặc history rewrite without separate explicit permission.

## Rollback và stop

GCW và GHCI có distinct structural checkpoint, accepted semantic/correction range và independently revertible bundle. Stop trên blob drift, coverage gap, permission conflict, veto/regression/failure/material inconclusive, invalid provenance, deterministic failure hoặc any remaining Critical/Required finding.

## Permission record

Current instruction authorize planning docs, planning commit/correction commit(s) và normal push của planning branch. It does not authorize actual skill migration.

Trước khi implementation bắt đầu, owner vẫn phải:

1. `approve` material plan;
2. authorize exact CP1–CP8 local implementation/checkpoint scope: two cores, eight references, three durable docs và deterministic/semantic evidence workflow; the existing program default already covers bounded advisory read-only fresh readers, so no new permission round-trip is required solely for those in-scope reads;
3. authorize distinct local structural/correction/completion commits nếu muốn checkpoint/rollback history được tạo.

CP9 push/post-push durable reconciliation, PR creation/update, CI watch/fix và merge không cần để implementation bắt đầu và vẫn cần permission riêng.

## Planning-review state

- Discovery findings: `0 Critical / 2 Required`; both are in-scope documentation corrections described above.
- Suite coverage correction: none.
- Planning fresh-reader/specialist: `0`; direct evidence sufficient, mandatory implementation fresh-reader unaffected.
- Complete-diff main self-review: initial `0 Critical / 1 Required` for ambiguous fresh-reader permission wording; corrected and re-reviewed to `0 Critical / 0 Required` across the exact five-file planning scope.
