# ASM-PR5B — Bản tóm tắt để owner duyệt

Status: `approved; CP1–CP8 complete; CP9 implementation-complete head pushed; delivery-record boundary active`.

Detailed specification: [plan.md](./plan.md).

Brief này là decision surface, không thay detailed plan. Material change về scope, core/reference allocation, checkpoint, evidence, permission, delivery hoặc rollback phải được reconcile vào plan và re-review trước implementation.

## Quyết định owner cần đưa ra

Chọn một trạng thái:

- `approve`: duyệt material ASM-PR5B plan; không tự cấp implementation;
- `revise`: nêu exact phần cần sửa; plan tiếp tục `pending`;
- `reject`: dừng ASM-PR5B implementation.

Current decision: `approved on 2026-08-13; CP1–CP8 authorized`.

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
9. Separate delivery gate. Agent delivery requires a new grant covering normal push of the reviewed `<implementation-complete-head>` plus post-push plan/brief/progress reconciliation commit và second normal push; PR/CI/merge remain separate.

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

Planning checkpoint `8e3a746` (`docs(agent-skills): plan ASM-PR5B delivery migration`) và planning corrections through `d39365d` đã được normal-push tới `origin/feat/agent-skills-asm-pr5b`; các planning grants đó đã consumed. Owner instruction ngày `2026-08-13` authorize exact CP1–CP8 migration/evidence/correction/durable-doc scope và distinct local checkpoint commits. Implementation-start head là `d39365d69aef54fb2cdde41ccdeda37137682899`.

Material plan approval, exact CP1–CP8 local implementation/checkpoint scope và distinct structural/correction/completion commits đã được authorize. Existing program default cùng current instruction cover bounded advisory read-only fresh readers và mandatory CP4/CP7 evidence.

Owner later authorized the complete CP9 delivery bundle with up to two normal pushes: first the reviewed `<implementation-complete-head>`, then the docs-only post-push durable-state reconciliation commit. PR creation/update, CI watch/fix và merge vẫn cần permission riêng.

## Implementation outcome

- GCW accepted head `41de1e6`: `21/21 passed`, `12 improved / 9 equivalent`, mandatory fresh-reader `5/5`, complete report SHA-256 `13cfd4fab2193dfa49f9b10c0118d5d8f6327fa684c95285418076c2d13f5cd1`.
- GHCI immutable monolith baseline preserved `18 passed / 6 failed`. Structural checkpoint `f412d46` preceded every semantic correction.
- GHCI accepted head `c3a2534`: `24/24 passed`, `8 improved / 16 equivalent`, mandatory fresh-reader `6/6`, complete report SHA-256 `222c818eb147c6e8fb5ccf5f76fb627c9a9a73720ebf8c81a58962260bb1bc3f`.
- Exact final bundle shape is `2 cores + 8 direct references`; six frozen suites and all excluded tooling/CI/product/database/other-skill paths remain unchanged.
- Deterministic CP8 evidence passes `37/37`, `130/130`, repository `11/0/0`, focused `21/24`, cumulative `9/27/183/0`; CP4 and CP7 reviews are `0 Critical / 0 Required`.
- CP8 completion/status commit and its final cumulative exact-range review remain the last local boundary before the authorized CP9 delivery sequence.
- Reviewed implementation-complete head `8dc69cd8b5b6a1e2d4f9321f1b2f3e036ccc19cf` was normal-pushed and verified equal across local, tracking and actual remote with divergence `0/0` and a clean worktree. The commit containing this brief update is the docs-only final delivery head; CP9 becomes complete when its authorized normal push is verified with the same equality/`0/0`/clean-state checks, consuming both push grants without requiring a third docs edit.

## Planning-review state

- Discovery findings: `0 Critical / 2 Required`; both are in-scope documentation corrections described above.
- Suite coverage correction: none.
- Planning fresh-reader/specialist: `0`; direct evidence sufficient, mandatory implementation fresh-reader unaffected.
- Complete-diff main self-review: initial `0 Critical / 1 Required` for ambiguous fresh-reader permission wording; corrected and re-reviewed to `0 Critical / 0 Required` across the exact five-file planning scope.
- Planning checkpoint `8e3a746` pushed successfully; exact three-document delivery-state reconciliation is docs-only, carries no material plan change, and focused cached/cumulative re-review reached `0 Critical / 0 Required` across exact correction scope `3/3` and full planning range `5/5`.
