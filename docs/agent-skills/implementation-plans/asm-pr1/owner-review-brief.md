# ASM-PR1 — Bản tóm tắt để owner duyệt

Status: `pending`

Detailed specification: [plan.md](./plan.md).

Brief này tóm tắt material decisions; nó không thay thế plan hoặc tự cấp implementation permission. Nếu owner decision làm đổi scope, behavior, ownership, permission, acceptance criteria, checkpoint order, verification, delivery hoặc rollback, `plan.md` phải được cập nhật và re-review trước implementation.

## ASM-PR1 sẽ hoàn thành gì

ASM-PR1 thêm một shared `skill_resource_access` artifact v1 và deterministic report support để:

- giữ `available`, `supplied`, `read` và `unknown` thành các fact riêng;
- bind supplied/read evidence vào exact workspace/case/variant/bundle;
- derive file/line/byte metrics từ immutable `bundle_manifest`;
- giữ self-report đúng là self-report;
- chặn false isolation, enforcement, context-reduction và token-saving claims.

Tooling này phải merge trước ASM-PR2A để mọi later suite/migration dùng cùng một evidence contract thay vì tự implement lại.

## Baseline và current state

- Branch: `feat/agent-skills-asm-pr1`.
- Synchronized baseline: `aa91278993d7bcad9e3cafb34405ac57a23a514a`.
- PR #63/approved ASM roadmap và PR #62 runner foundation đã có trong baseline.
- Discovery/plan: complete.
- Implementation: not started.

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

CP2/CP3 ban đầu được hợp nhất vì current runner validate optional evidence và build case report trong cùng `readCaseEvidence` boundary. Tách chúng sẽ tạo dead hoặc misleading intermediate state.

## Key evidence semantics

- `available`: runner-controlled fact từ immutable bundle manifest.
- `supplied`: exact bundle-relative resources được ghi là supplied; riêng `observed | unknown`.
- `read`: exact resources được quan sát là read; riêng `observed | unknown`.
- `unknown`: dùng `resources: null`, không dùng empty array/zero.
- Observed empty set dùng `resources: []`.
- Evidence basis phân biệt `runtime_observation`, `operator_observation`, `executor_self_report`, `unavailable`.
- Exact path/hash phải match selected variant manifest.
- Line/byte/file metrics do runner derive; artifact input không được nhập metric.

## Backward-compatibility decision

- Không đổi suite v1, workspace/bundle/context manifest fields, observation, human evaluation, status authority, completeness hoặc CLI grammar.
- Resource evidence là optional đối với semantic completeness.
- Missing artifact tạo supplied/read unknown và claim boundary.
- Present invalid artifact fail non-zero; không downgrade thành incomplete/unknown.
- `generated_report` thêm một additive per-case `resource_access` field; existing keys và meanings giữ nguyên.
- Final report immutability giữ nguyên: evidence cần cho claim phải có trước first complete report.

Owner approval của brief này bao gồm additive generated-report shape decision trên; program roadmap approval một mình chưa approve mechanics đó.

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

## Unresolved material decisions

Owner cần quyết định:

1. Approve hoặc request changes cho exact artifact fields/status/basis contract.
2. Approve hoặc request changes cho additive per-case `generated_report.resource_access` shape.
3. Approve hoặc request changes cho atomic CP2 boundary và immutable-report behavior khi evidence ban đầu absent.

Không có unresolved roadmap-order, candidate-allocation hoặc scope-program decision.

## Permission record

| Gate | Current state |
| --- | --- |
| Approved program intent | `approved` — roadmap scope/order |
| Detailed ASM-PR1 design | `pending` |
| ASM-PR1 implementation | `not granted` |
| In-scope correction during implementation | `not granted` |
| Stage/commit | `granted once for this planning checkpoint by owner instruction on 2026-07-29` |
| Push | `granted once for normal push of this planning checkpoint branch; no force-push` |
| PR create/update | `not granted` |
| CI watch/fix | `not granted` |
| Merge/auto-merge | `not granted` |
| Deploy/production/database | `not granted; out of scope` |

Fresh-reader trong planning: `not_run`; optional ASM-PR1 use không cần thiết sau direct code discovery và main self-review, và không được chạy chỉ để tăng evidence volume.

## Owner action nhỏ nhất tiếp theo

Review [detailed plan](./plan.md), rồi:

- approve exact ASM-PR1 detailed design; hoặc
- request specific design changes.

Nếu muốn implementation bắt đầu sau approval, owner phải cấp riêng ASM-PR1 implementation permission. One-time planning stage/commit/push permission không cấp implementation-checkpoint Git permission; PR, CI watch/fix và merge vẫn là các permission riêng.
