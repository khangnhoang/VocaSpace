# ASM-PR1 — Bản tóm tắt để owner duyệt

Status: `approved; implementation complete; PR #64 OPEN and ready for review`

Detailed specification: [plan.md](./plan.md).

Brief này tóm tắt material decisions; nó không thay thế plan hoặc tự cấp implementation permission. Nếu owner decision làm đổi scope, behavior, ownership, permission, acceptance criteria, checkpoint order, verification, delivery hoặc rollback, `plan.md` phải được cập nhật và re-review trước implementation.

## ASM-PR1 sẽ hoàn thành gì

ASM-PR1 thêm một shared `skill_resource_access` artifact v1 và deterministic report support để:

- giữ `available`, `supplied`, `read` và `unknown` thành các fact riêng;
- bind supplied/read evidence vào exact workspace/case/variant/bundle và exact observation bytes của cùng execution;
- derive file/line/byte metrics từ immutable `bundle_manifest`;
- giữ self-report đúng là self-report;
- chặn false isolation, enforcement, context-reduction và token-saving claims.

Tooling này phải merge trước ASM-PR2A để mọi later suite/migration dùng cùng một evidence contract thay vì tự implement lại.

## Baseline và current state

- Branch: `feat/agent-skills-asm-pr1`.
- Final head: `5a8ed0884169e5f34365e4934c4643655d6937fc`.
- Synchronized baseline: `aa91278993d7bcad9e3cafb34405ac57a23a514a`.
- PR #63/approved ASM roadmap và PR #62 runner foundation đã có trong baseline.
- Discovery/plan: corrected detailed design được owner approve trong current instruction.
- ASM-PR1 implementation: complete.
- CP2: complete.
- CP3: complete.
- PR: #64 `OPEN`, ready for review.
- Initial CI watch: consumed.
- CI result: `success`; `Test and Build`, `production-gate` và Node 20 runner/validator/build path đều success.
- Node 20 CI evidence: verified trong run `30456110172`; runner tests, validator tests, repository validator và application build đều success.
- CI-fix attempts used: `0`; conditional permission không được dùng và không tạo standing authority.
- Merge/auto-merge: not granted.
- Next action: owner review and separate merge decision.

## Proposed exact implementation scope

Behavior:

1. `.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs`
2. `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs`
3. `.agents/scripts/run-skill-evals.mjs`

Test/authority/tracker:

4. `.agents/scripts/run-skill-evals.test.mjs`
5. `.agents/skills/maintain-repo-skills/references/eval-design.md`
6. `docs/agent-skills/progress.md`

Planning artifacts already created:

7. `docs/agent-skills/implementation-plans/README.md`
8. `docs/agent-skills/implementation-plans/asm-pr1/plan.md`
9. `docs/agent-skills/implementation-plans/asm-pr1/owner-review-brief.md`

Không tạo helper module mới. Roadmap/master plan/PR 3B history, suite schema, structural validator và CI mặc định audit-only.

## Checkpoint summary

1. CP0 — synchronized baseline, dependency, authority và exact scope.
2. CP1 — durable plan, owner brief, design freeze và plan self-review.
3. CP2 — atomic artifact schema + template + validation + report ingestion + manifest-derived metrics + focused tests.
4. CP3 — cumulative verification, adversarial main review, in-scope corrections, progress reconciliation và delivery readiness.

Artifact/template/ingestion/report work vẫn nằm trong atomic CP2 vì current runner validate optional evidence và build case report trong cùng `readCaseEvidence` boundary. CP3 vẫn là cumulative verification/review gate; tách implementation contract thành intermediate schema/report states sẽ tạo dead hoặc misleading state.

## Key evidence semantics

- `available`: runner-controlled fact từ immutable bundle manifest.
- `supplied`: exact bundle-relative resources được ghi là supplied; riêng `observed | unknown`.
- `read`: exact resources được quan sát là read; riêng `observed | unknown`.
- `unknown`: dùng `resources: null`, không dùng empty array/zero.
- Observed empty set dùng `resources: []`.
- Evidence basis phân biệt `runtime_observation`, `operator_observation`, `executor_self_report`, `unavailable`.
- Exact path/hash phải match selected variant manifest.
- Mỗi present resource artifact có required `observation_sha256` bằng SHA-256 của exact accepted observation file bytes; hash này phải khớp same role/suite/case/variant/context mà `human_evaluation` independently references.
- Current observations không canonical-enforce key ordering, nên implementation dùng `sha256Bytes(observationBytes)` giống current human relationship; không reserialize object hoặc silently đổi observation compatibility.
- Candidate và baseline bind riêng vào observation của chính role; không được swap hoặc borrow evidence giữa executions.
- Với `execution_status: not_run`, present resource artifact chỉ được ghi supplied/read `unknown`; không được dùng observed empty set để ngụ ý model/executor đã chạy.
- Line/byte/file metrics do runner derive; artifact input không được nhập metric.

## Backward-compatibility decision

- Không đổi suite v1, workspace/bundle/context manifest fields, observation, human evaluation, status authority, completeness hoặc CLI grammar.
- Resource evidence là optional đối với semantic completeness.
- Missing artifact tạo supplied/read unknown và claim boundary.
- Present invalid artifact fail non-zero; không downgrade thành incomplete/unknown.
- `generated_report` thêm một top-level shared `resource_access.available` inventory cho mỗi role và additive per-case `resource_access` summaries chỉ cho supplied/read cùng observation binding; existing keys và meanings giữ nguyên.
- Shared inventory dùng validated bundle data mà `verifyPreparedPackages` đã visit một lần; canonical object-key sorting, lexical resource order và existing suite/case order giữ deterministic output.
- Final report immutability giữ nguyên: evidence cần cho claim phải có trước first complete report.

Current owner instruction ngày 2026-07-29 approve toàn bộ corrected detailed design, gồm `observed`/`unknown`, `basis_type`, exact observation-byte binding, additive generated-report evidence, shared available inventory, atomic CP2 và immutable-report behavior; đồng thời cấp CP2/CP3 implementation permission.

## Exit-code taxonomy được giữ nguyên

- Exit `1`: submitted `skill_resource_access` malformed hoặc sai schema, relationship, workspace/skill/suite/case/variant/context/bundle identity, resource path/SHA, `observation_sha256`, role binding hoặc `not_run` rule.
- Exit `2`: unsupported integer artifact version hoặc existing CLI usage/version boundary.
- Exit `3`: existing integrity/operational refusal liên quan runner-owned immutable manifests, captured package bytes, workspace inventory/path safety, persisted complete-report state hoặc equivalent trusted runner state.
- Wrong submitted bundle/resource/observation hash không dùng `INTEGRITY_MISMATCH`; nó là invalid evidence exit `1`.

## Claim limitations

- Full bundle package không chứng minh supplied/read.
- Self-report không chứng minh runtime enforcement hoặc isolation.
- Runtime observation không chứng minh runner enforcement.
- Unknown supplied/read chặn conclusion cho đúng dimension.
- File/line/byte reduction không phải token saving.
- Runner không infer semantic improvement, winner, native trigger hoặc automatic skill activation.

## Exclusions

Không suite, skill migration, candidate bundle edit, CI change, model/subagent execution, semantic grading, automatic winner, native-trigger evaluation, mutation-capable eval, product/UI/application test, Supabase/database, deploy/production, broad cleanup hoặc raw evidence commit.

## Verification

Focused:

- syntax checks cho changed MJS;
- focused rồi full runner Node suite;
- help/CLI regression;
- hostile missing/invalid/identity/path/hash/unknown/self-report/comparison fixtures;
- observation-hash match/mismatch/swap/replacement, absent corresponding observation và `not_run` relationship fixtures;
- shared-available-once, lexical ordering và manifest-derived metric fixtures;
- `git diff --check`.

Cumulative:

- runner suite;
- structural-validator suite;
- `validate --all`;
- current repository structural validation;
- deterministic output, Markdown/link/UTF-8/path/scope/secret/raw-evidence audits.

Node 20 chỉ được claim khi thực sự chạy trên Node 20.

## Rollback

CP2 là một atomic slice. Revert artifact validator, template/layout, ingestion, metrics, report output, tests và eval-design wording cùng nhau. Không để dead template hoặc unvalidated report path. Không amend/squash/rebase/reset/force-push/delete branch.

## Owner decision

Không còn unresolved mechanics trong hai review findings: execution binding, exit taxonomy, shared report shape, observed/unknown basis semantics và atomic/immutable behavior đã được incorporated. Owner đã approve exact corrected ASM-PR1 detailed design và cấp implementation permission cho CP2/CP3; roadmap order, candidate allocation và later PR sequence không đổi.

## Permission record

| Gate | Current state |
| --- | --- |
| Approved program intent | `approved` — roadmap scope/order |
| Detailed ASM-PR1 design | `approved` |
| ASM-PR1 implementation | `complete` |
| CP2 | `complete` |
| CP3 | `complete` |
| Stage/commit/push | `consumed by delivered checkpoints; no standing authority` |
| Pull request | `#64 OPEN; ready for review` |
| Initial CI watch | `consumed` |
| CI result | `success` — `Test and Build`, `production-gate` and the Node 20 runner/validator/build path succeeded |
| Node 20 CI evidence | `verified` |
| CI-fix attempts used | `0` |
| Conditional CI-fix permission | `not used; no standing authority` |
| Merge/auto-merge | `not granted` |
| Deploy/production/database | `not granted; out of scope` |

Fresh-reader trong correction: `not_run`; ASM-PR1 tooling/planning use là optional, direct code/tests đã resolve findings và không còn material independent comprehension uncertainty. Self-review không phải fresh-reader evidence; không có model/runner execution, isolation claim hoặc formal comparative evidence.

## Hành động tiếp theo

Owner review PR #64 và đưa ra separate merge decision. Merge và auto-merge vẫn không được cấp.
