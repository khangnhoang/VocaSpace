# Agent Skill Eval Harness CLI-first — Stage 4 evaluator/report implementation plan

## Trạng thái, baseline và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Stage: `4 — evaluator dispatch, advisory report, deterministic CI/docs and separately authorized pilot`.
- Branch: `feat/agent-skill-eval-cli-evaluator-report`.
- Exact base: Stage 3 merge commit `69e723556088cf885de1d7b2ebe4db29a44180f6`, PR #80, containing exact final Stage 3 head `d5d86b3681464d89d2d675b3e703ed34fe9a7f2a`.
- Planning-only metadata correction commit on this branch: `6559234` (`docs(agent-skills): reconcile Stage 3 delivery status`). It changes no Stage 3 behavior.
- Plan status: `owner-approved contract / S4-CP1–S4-CP3 committed / initial S4-CP4 stopped_on_evaluator_failure / schema correction committed 0e92e93 / corrected S4-CP4 tooling pilot completed / semantic migration acceptance not established`. Lịch sử, bằng chứng và kết quả hiện tại: [progress — S4-CP4](../../progress.md#s4-cp4-pilot-fail-và-schema-correction-2026-09-03).
- Current authority: owner đã yêu cầu implement theo master/detail, approve report-exit correction và authorize local checkpoint commits tuần tự sau deterministic verification + formal review `0 Critical / 0 Required` khi diff tạo coherent, meaningful commit boundary. Không commit empty/no-op hoặc unresolved findings; không amend/squash, push/PR/merge/remote action. Live pilot cần grant riêng. Prompt planning-only trước đó là historical snapshot.
- Historical initial grant: S4-CP4 candidate-only tối đa `6` dispatch, concurrency `2`; batch đầu đã dùng `2 reader + 2 evaluator` rồi dừng khi cả hai evaluator fail. Tại stop đó, schema correction không mở retry/live batch; reuse và affected rerun của run đầu vẫn `not_run`.
- Corrected grant: owner cấp explicit egress và chạy run mới `run-ca60fc06d0174a75966330950440b184`: initial `4` succeeded, same-ref reuse `4` units với dispatch `0`, A-only invalidation rồi affected `2` succeeded; tổng đúng `6`, retry/failure/unknown `0`. S4-CP4 tooling gate đã observed-complete. Final report vẫn partial `2 current / 20 incomplete`; A advisory evaluator đổi từ `satisfied/not_triggered` sang `partially_satisfied/triggered`, nên không claim migration acceptance hoặc human decision.
- Post-pilot owner correction ngày `2026-09-04` chốt riêng product semantics cho `question_options`: active rows reindex độc lập thành `0..n-1`, soft-deleted rows không tham gia active ordering và giữ existing `order_index` làm recovery/audit hint, restore là mutation riêng có reconciliation. Owner authorize ADR + exact suite context/rubric + ASM-PR6 backlog + truthful history correction; exclusion “skill/suite semantic changes” phía dưới vẫn áp dụng cho Stage 4 implementation mặc định, nhưng không chặn exact separately authorized coverage correction này. Historical migration, current skill, raw/persisted pilot evidence và CLI behavior giữ nguyên; migration acceptance/ASM-PR6/live/remote authority vẫn chưa được cấp.
- [Master plan](./plan.md) owns the cross-stage contract; [owner review brief](./owner-review-brief.md) owns decisions/authority; [progress](../../progress.md) owns current status. A material conflict among them or with merged source is a stop condition.

This plan elaborates only the existing master checkpoints `S4-CP1`–`S4-CP4`. It does not add a checkpoint, a new lifecycle gate, or a replacement behavior contract. Stage 3 schemas, attempt ordering, coverage latch, retry/patch-check all-or-nothing gates, lifetime `max_attempts`, and `run.json`-last publication remain frozen.

## Mục tiêu và điều kiện thành công

Stage 4 completes the CLI-first path by:

1. executing ready evaluator `PreparedUnit`s through the existing bounded `codex exec` worker without changing the generic `ExecutionResult` shape;
2. validating and accepting exact `evaluator-proposal-v1` output as model-authored advisory evidence only;
3. applying the existing durable attempt, restart, retry, budget, dependency and exact-reuse rules to evaluator units;
4. exposing a small read-only CLI report that truthfully separates exact-current evidence, mixed-revision retained reference and unavailable evidence;
5. documenting deterministic operator commands and ensuring the already-wired focused CLI suite covers evaluator/report behavior in CI;
6. keeping every actual pilot/model batch behind a separate explicit owner grant and explicit call/concurrency ceilings.

Success requires a deterministic fake end-to-end flow:

```text
prepare
  -> bounded reader/evaluator dependency waves
  -> one unit-local failure while independent success settles
  -> resume or explicit retry of the affected closure
  -> accepted evaluator proposal
  -> truthful report
```

The report must never materialize a proposal as `human_evaluation`, assign human `case_status`/`comparison_status`, choose a winner/action, or claim full current coverage from a mixed revision.

## Repository facts và reconciliation conclusion

### Facts tại Stage 3 baseline (historical planning snapshot)

- `.agents/scripts/run-skill-eval-cli.mjs` currently schedules only reader states. It compiles/materializes ready evaluator packages, then deliberately leaves evaluator dispatch at `0` and derives `paused / evaluator_dispatch_disabled`.
- `codex-cli-runner-v1.mjs` already has a generic process/timeout/result seam, but successful-output adaptation is reader-specific: it constructs `accepted-observation.json` from `logical_unit_key.source_role`.
- Stage 2 already owns the exact evaluator JSON Schema, canonical evaluator stdin, semantic dependency projections and `assertEvaluatorProposal(value, staticPlan)`.
- A materialized evaluator `PreparedUnit` contains exact stdin/schema paths and behavior projection, while the persisted producing revision contains the static evaluator plan and deterministic prepared directory. No additional descriptor or run-state field is required to validate a producing evaluator invocation.
- The dynamic evaluator descriptor's `source_locator.accepted_results` contains exact producing reader attempt identities in memory, but the create-once prepared directory persists only `stdin.txt` and `output-schema.json`; evaluator attempt evidence therefore proves the exact semantic dependency projections consumed by the evaluator, not exact producing reader `attempt_id`s.
- Stage 3 unit/attempt schemas already allow `reader|evaluator`; active attempts, immutable attempt records, `ExecutionResult`, accepted-attempt pointers and restart recovery are kind-neutral.
- Stage 3 reader evidence resolution is reader-specific because it derives an observation locator from a producing reader descriptor. Evaluator accepted evidence needs a bounded sibling resolver based on the exact producing attempt plus exact producing revision evaluator input.
- `patch_check_mixed_revision` is a persisted revision-wide coverage latch. The explicit patch selection/closure is emitted in that invocation's command result but is not stored as durable run metadata.
- Current v1 `run-skill-evals.mjs report --workspace` is complete only with validated human-authored `human_evaluation`; without it, semantic statuses remain `null`. It cannot truthfully consume `evaluator-proposal-v1` as complete human evidence.
- `.github/workflows/ci.yml` already runs `node --test .agents/scripts/run-skill-eval-cli.test.mjs` on Ubuntu. Stage 4 tests added to that file are therefore CI-covered without a duplicate workflow step.
- `docs/agent-skills/eval-design.md` does not yet exist. The master assigns that path to bounded Stage 4 operator docs; it must remain an operator guide, not a second governance/evaluation contract.

### Reconciliation conclusion

There is no master/source conflict requiring a stop. The master's explicit fallback applies: build the smallest CLI-first report because the advisory proposal cannot satisfy current v1 human-evaluation semantics.

The smallest truthful bridge is a canonical, read-only `report --run <run_id>` stdout artifact. It does not call the v1 report writer, write a durable report file, modify the run, or introduce publication/recovery/lifecycle state. Existing v1 human report semantics remain unchanged.

Because patch selection is not durable, Stage 4 must not invent an exact historical list of “selected” or “untouched” units. Report coverage is derived from currently validated producer evidence versus the current revision:

- exact-equal evidence is `current`;
- a fully valid older producer graph that is not current-equal is `retained_reference`, legal only under `patch_check_mixed_revision`;
- missing/non-success evidence is `unavailable` and makes the case/report incomplete;
- corruption, substitution or contradiction newly detected while validating accepted/historical evidence is a command error, never downgraded to incomplete/reference;
- a previously persisted, schema-valid `blocked / integrity_failure` unit is a trustworthy current state condition: report it as unavailable/incomplete without dereferencing its quarantined evidence. It is not the same condition as corruption first discovered by `report`.

This preserves the Stage 3 mixed-mode latch and accepted-evidence integrity boundary without changing its schema.

### Owner-supplied finding disposition

- `Required — historical report graph`: confirmed at S4-CP2. Corrected to evaluator-first semantic graph resolution; exact producing reader-attempt lineage remains unclaimed because persisting it would be a material schema decision outside this plan.
- `Required — integrity failure ambiguity`: confirmed at S4-CP2. Corrected by separating persisted schema-valid integrity quarantine (`incomplete`, exit `1`) from corruption/substitution/late contradiction newly detected by report (`command_error`, exit `3`, no report).
- `Required — raw canonical JSON`: confirmed at S4-CP1. Raw valid UTF-8 JSON formatting is accepted; exact semantic validation remains, and only the accepted proposal artifact requires canonical bytes.
- `Required — Stage 4 run-status priority`: confirmed at S4-CP1. The kind-neutral precedence and dependency-wait projection are frozen below without adding a status reason or changing Stage 3 derivation.
- `Suggestion — zero-unit report`: accepted as a bounded S4-CP2 regression for canonical Stage 2 v1/v2 runs.
- `Required — exact-current history gate`: confirmed at S4-CP2. Corrected so only mixed mode may resolve preserved history; exact-current missing current acceptance is incomplete, while `CLI_REPORT_COVERAGE_INVALID` is reserved for a persisted succeeded/accepted claim whose validated producer/current relation is unequal.
- `Required — incomplete with retained evidence`: confirmed at S4-CP2. Corrected report status/exit aggregation to follow case completeness, not evidence availability: any incomplete case yields `status = incomplete`, exit `1`, even when a coherent historical graph is displayed as retained reference. Existing corruption/coverage-invalid errors remain exit `3` with no report.

## Phạm vi

### Trong phạm vi

- Reader/evaluator output adapter split behind the existing process execution seam.
- Exact evaluator prepared-input and proposal validation.
- Evaluator attempts through current unit state, attempt records, restart recovery and bounded scheduler.
- Evaluator exact reuse across restart and revisions through immutable producing attempt + producing evaluator input.
- `run`, `resume`, explicit `retry`, and `patch-check` scheduling for eligible evaluators.
- Generic effective budget/status/count handling for both unit kinds while preserving all reader behavior.
- Read-only `report --run` and its pure canonical report builder/validator.
- Focused deterministic fake-worker regressions, existing v1 report compatibility, operator docs and current status reconciliation.
- A separately authorized, bounded S4-CP4 pilot plan and evidence template; no live execution under planning or implementation authority alone.

### Ngoài phạm vi

- Creating or accepting `human_evaluation`, human decisions, winner/action/recommendation or semantic acceptance statuses from model output.
- Editing current v1 `generated_report`/human-evaluation semantics.
- Importing App Server/CP9/v2 harness modules or building a generic backend/scheduler/report framework.
- New run-state/report publication schema, report file lifecycle, report cache, journal, signature, CAS/lease, multi-writer or distributed store.
- Persisting patch-check selection/closure after its existing command result.
- Automatic retry, budget reset, cleanup lifecycle or arbitrary prompts.
- Skill/suite semantic changes, migration verdicts or broad operator-document reorganization.
- Live calls, pilot, push, PR, CI-fix or merge without their own explicit grant.

If implementation requires one of these items, stop and reconcile the material decision before editing that scope.

## Expected files và ownership

| File | Stage 4 ownership |
| --- | --- |
| `.agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs` | preserve process/result seam; select reader or evaluator success adapter by `PreparedUnit.kind` |
| `.agents/scripts/lib/skill-evals/cli-evaluator-proposal-v1.mjs` | validate exact prepared evaluator input/schema, derive producer behavior projection and validate proposal bytes |
| `.agents/scripts/lib/skill-evals/cli-run-state-v1.mjs` | bounded evaluator accepted-attempt/result/producing-input resolver; generic kind-neutral attempt/state derivation |
| `.agents/scripts/lib/skill-evals/cli-impact-v1.mjs` | pure producer/current evaluator fingerprint relation if a separate pure decision helper is needed |
| `.agents/scripts/lib/skill-evals/cli-evaluation-report-v1.mjs` | new pure canonical CLI report builder/validator; no filesystem or process I/O |
| `.agents/scripts/run-skill-eval-cli.mjs` | command parsing, evaluator dependency-wave scheduling, reuse/invalidation and read-only report orchestration |
| `.agents/scripts/run-skill-eval-cli.test.mjs` | focused fake-worker/state/reuse/report regressions; no installed `codex` or network |
| `docs/agent-skills/eval-design.md` | bounded operator guide for the existing CLI commands and evidence boundaries |
| `docs/agent-skills/progress.md` | actual checkpoint/review/verification/authority status |

Conditional only:

- `.github/workflows/ci.yml`: edit only if implementation creates a new focused test entrypoint that the current CLI test step does not execute. Extending the already-wired test file requires no workflow duplication.
- `owner-review-brief.md`: reconcile an owner decision or current authority/status summary.
- master `plan.md`: edit only for a material cross-stage contract change. Adding a link to this detail plan is routing metadata, not a semantic change.

Do not edit `stage-1-cli-runner.md`, `stage-2-cli-prepare.md`, `stage-3-cli-reuse.md`, v1 human report schemas, suite definitions, skill bundles or App Server/CP9 modules during Stage 4 implementation.

## Frozen command extensions

Stage 4 retains all existing commands and adds only:

```text
node .agents/scripts/run-skill-eval-cli.mjs report --run <run-[a-f0-9]{32}>
```

It also broadens the existing explicit retry selector from reader-only to either unit kind:

```text
retry --run <run_id> --unit <reader|evaluator-unit_id> [--unit <...>]
```

Reader retry semantics do not change. Evaluator retry is eligible only when the selected evaluator is exact `failed`, every dependency is a valid current success, and its next run-wide ordinal is within the existing lifetime `max_attempts`. Duplicate, unknown, mixed-validity, dependency-ineligible or over-budget multi-selection remains an all-or-nothing command error before mutation/preflight/dispatch.

Command meanings after Stage 4:

- `run`: reconcile/reuse current accepted evidence and execute every eligible pending unit through deterministic dependency waves; never retry terminal failure/unknown automatically.
- `resume`: apply the same startup recovery, then execute eligible pending reader/evaluator work only.
- `retry`: reset only explicitly selected eligible failed units to pending; after a selected reader succeeds, its pending downstream evaluator may execute in the same dependency-bounded invocation.
- `patch-check`: remains restricted to its already validated closure and persisted mixed mode; Stage 4 may dispatch eligible evaluator closure members instead of only materializing them.
- `status`: remains read-only and dispatches `0`; it derives generic evaluator budget/dependency/current-relation status without accepting stale evidence as current.
- `report`: remains read-only, performs no preflight/model call and dispatches `0`.

Usage errors remain exit `2`. Operational/integrity/contract errors newly detected by a command remain canonical `command_error`, exit `3`; a persisted trustworthy state condition is handled by that command's explicit projection rules below. Mutating execution commands return `0` for a trustworthy settled result without failed/unknown/budget-exhausted work and `1` for trustworthy incomplete execution. After successful validation, `report` emits `status = incomplete` and exits `1` iff `counts.incomplete > 0`, including cases with a complete coherent retained graph; otherwise it emits `status = succeeded` and exits `0` under its declared coverage mode. Corrupt evidence or an impossible exact-current/reference relationship instead returns `command_error`, exit `3`, with no report.

## Evaluator worker adapter contract

The existing process invocation, timeout/interruption classification, logs, `result.json` publication and `ExecutionResult` keys remain unchanged. Only successful structured-output adaptation becomes kind-aware:

### Reader

- Preserve the exact existing path and semantics.
- Parse `{ raw_response, observed_access }`.
- Construct and validate the role-specific v1 observation.
- Publish `accepted-observation.json` exclusively.

### Evaluator

1. Validate the exact `PreparedUnit.kind`, logical evaluator identity and dependency membership.
2. Read exact stdin and output-schema bytes from the prepared invocation paths.
3. Require canonical evaluator stdin, exact identity/mode/rubric/dependency projection relationship, exact `evaluatorProposalSchema`, and behavior-projection hashes/options equal to the `PreparedUnit`.
4. Decode the last message as valid UTF-8 and parse exactly one JSON object. Raw JSON whitespace and object-key order need not be canonical; semantic validation remains exact.
5. Validate it with `assertEvaluatorProposal` against the static contract derived from the exact prepared input; do not use mutable current suite/workspace data.
6. Publish canonical `accepted-evaluator-proposal.json` exclusively and return its path/hash in the unchanged `ExecutionResult`.

Invalid evaluator output is the existing attempt-local terminal `failed / invalid_structured_output`; it consumes the ordinal and requires explicit retry. It does not become an operational latch or a human artifact.

The evaluator-input validator/projection helper must be reusable by both the worker and accepted-evidence resolver so immediate execution and restart/reuse apply the same contract. It remains pure over supplied bytes/objects.

### Correction sau pilot ngày 2026-09-03: schema gửi tới backend

Owner yêu cầu sửa sau khi Codex CLI `0.149.1` trả HTTP `400 / invalid_json_schema`: `output_type` thiếu `type`. [Lịch sử và bằng chứng gốc](../../progress.md#s4-cp4-pilot-fail-và-schema-correction-2026-09-03) ghi exact run/attempt, lỗi, schema hashes và verification; đây là correction có căn cứ cho schema transport do Stage 2 compiler phát ra, không phải thay đổi ngầm behavioral contract.

- Compiler/materializer mới thêm `type: integer` cho `schema_version`, `type: string` cho `output_type` và `assessment` ở cả hai finding arrays. `const`, `enum`, required keys, nullability, `schema_version: 1`, `evaluator-proposal-v1` và advisory authority giữ nguyên; không đổi persisted Stage 3 schema/lifecycle.
- Exact schema bytes/hash thay đổi, nên evaluator behavior fingerprint thay đổi theo contract sẵn có. `prepare --run` tạo revision mới với zero dispatch; reader đúng fingerprint được reuse, evaluator success cũ bị invalidation. Evaluator đã failed vẫn cần explicit retry và dùng ordinal kế tiếp trong lifetime budget.
- Producing-evidence resolver/recovery cho phép đọc thêm **duy nhất exact legacy schema SHA-256** `c6740d5ff183275f644aeb9e41bc7e4507550e879b566f2fdc4654e1f7d6ecfa`, derive producer fingerprint từ chính bytes cũ và vẫn kiểm tra toàn bộ identity/rubric/attempt/result relationships. Không coi schema cũ là schema mới, không rewrite evidence, không chấp nhận schema tùy ý. Compiler/materializer và worker output adapter mới vẫn yêu cầu schema hiện tại.
- Với run pilot đã fail, không retry trên prepared revision 1 có schema lỗi. Recovery cần revision mới và grant riêng; không tăng frozen `max_attempts`, không diễn giải fake regression thành live acceptance.

## Evaluator accepted evidence and exact reuse

### Anchor 1 — exact accepted attempt/result

Reuse the existing generic Stage 3 relationship:

```text
unit accepted_attempt
  -> immutable attempt.json
  -> immutable worker result.json
  -> contained accepted-evaluator-proposal.json bytes/hash
```

Identity, ordinal, producer revision, terminal success, path containment, regular-file, canonical bytes and every hash must exact-match. Missing/corrupt/substituted evidence is an integrity command error and is never converted to pending/reference.

### Anchor 2 — exact producing evaluator input

`producer_revision` selects the immutable producing `execution-plan.json`, exactly one static evaluator unit, and deterministic two-file input directory:

```text
revisions/<producer_revision>/prepared/<evaluator_unit_id>/input/
  stdin.txt
  output-schema.json
```

The resolver validates the exact regular-file inventory and bytes, binds the input identity to the producing static evaluator plan, derives the evaluator behavior projection, then validates the accepted proposal against that producing input. No mutable current unit field may supply or override the producer fingerprint/rubric.

### Current relation

For each succeeded evaluator:

1. resolve every current reader dependency through the existing reader two-anchor resolver;
2. require each reader to be exact-current reusable before treating the evaluator as current;
3. compile the current evaluator descriptor from those exact bindings;
4. compare descriptor-derived producer/current evaluator behavior fingerprints and compare the whole prior finalized `dependency_bindings` array with the freshly derived current array;
5. require a succeeded evaluator state's stored fingerprint to equal the immutable producing-input-derived fingerprint; mutable state supplies no producer proof, but its finalized dependency array remains the frozen Stage 3 current-binding equality gate;
6. exact fingerprint and binding equality permits reuse and refreshes current revision/fingerprint/bindings; valid inequality becomes pending invalidation in exact-current execution, or historical reference only for read-only mixed-mode reporting;
7. any accepted-evidence integrity failure or impossible succeeded-state/producer fingerprint relationship rejects before state/report mutation.

The implementation must retain the prior finalized evaluator fingerprint/bindings in the in-memory next-revision projection until this decision is complete; it must not clear them before comparison. A Stage 3-era evaluator state that has never executed remains pending and has no accepted evaluator result to reuse.

Next-revision preparation must project the complete reader/evaluator graph in memory before publishing. It may reuse exact evaluators or invalidate changed ones, but it must preserve the existing `run.json`-last boundary and must not add a post-publication window where an unvalidated old evaluator is reported as current.

No new field is added to `cli_run`, unit state, attempt record, execution plan or `ExecutionResult`.

## Dependency-wave scheduling

After startup recovery and full pre-mutation validation, each mutating execution command runs a bounded loop:

1. derive eligible pending units within the command scope and remaining lifetime budget;
2. finalize/exact-replay every dependency-ready evaluator `PreparedUnit` before that evaluator can enter the ready set;
3. sort the ready set by `unit_id` and run one bounded pool under frozen `planned_concurrency`;
4. persist active intent before each worker spawn and settle every started worker through existing attempt recovery/finalization rules;
5. recompute dependencies and continue only while newly ready in-scope work exists.

Ready readers and already dependency-ready evaluators may share a wave; an evaluator never starts before all of its own dependencies are accepted current successes. The two-level reader→evaluator graph does not justify a generic DAG framework.

The scheduler preserves:

- at most one active attempt per `unit_id`;
- independent unit settlement after one failure;
- no automatic retry;
- one frozen concurrency cap across both kinds;
- lifetime `max_attempts` on every reader/evaluator spawn path;
- `patch-check` closure restriction;
- completion-order-independent canonical result arrays/counts;
- preflight before the first spawn and `operational_condition` dispatch `0` on recognized preflight failure.

`evaluator_dispatch_disabled` remains a readable historical/transitional enum, but Stage 4 never newly derives it. A read-only command may project a valid historical Stage 3 marker in memory without writing it; a mutating Stage 4 command replaces the marker only through its existing allowed `run.json` transition. A ready evaluator is ordinary `prepared` work.

Exact Stage 4 run-status precedence is:

| Priority | Observable condition across selected units | Derived run status |
| --- | --- | --- |
| 1 | any persisted integrity block | `blocked / integrity_failure` |
| 2 | persisted operational latch | `paused / operational_condition` |
| 3 | any active/running attempt | `running / null` |
| 4 | any enabled pending reader, or dependency-ready pending evaluator, with a next ordinal inside lifetime `max_attempts` | `prepared / null` |
| 5 | any unresolved `outcome_unknown` | `blocked / outcome_unknown` |
| 6 | any failed reader/evaluator with a next ordinal, including downstream evaluator waiting on such a dependency | `paused / retry_required` |
| 7 | any pending/failed reader/evaluator with no next ordinal, including downstream evaluator waiting on such a dependency | `paused / attempt_budget_exhausted` |
| 8 | every selected unit exact-succeeded, or the selected inventory is empty | `completed / null` |

Dependency-not-ready is not a new durable run reason. For the frozen two-level reader→evaluator graph, every pending evaluator dependency is a reader whose current condition is already classified by priorities 1, 3–7; the highest applicable global priority determines the run result. A pending evaluator whose dependencies are all succeeded is priority 4 when it has budget, or priority 7 when exhausted. If a validated inventory claims dependency waiting but no non-success dependency exists, that is a state/plan contradiction and a canonical command error rather than a new status. Thus a ready evaluator wins over an unrelated `outcome_unknown`, a ready reader wins over an unrelated retryable evaluator failure, a ready reader wins over an unrelated exhausted evaluator, and a failed reader dependency yields the reader's `retry_required` or `attempt_budget_exhausted` result for the whole run.

## Read-only CLI report contract

`report --run` validates the authoritative marker, current plan, unit inventory and the accepted or historical evidence permitted by the active coverage mode wholly in memory. For an authoritative Stage 2 `cli_run` v1 marker, it reuses the frozen Stage 3 read-only zero-attempt projection: derive all reader/evaluator states in memory, ignore any unpublished `units/` bootstrap as non-authoritative, report every case incomplete, and perform no upgrade/write. It writes one newline-terminated canonical JSON object to stdout and leaves the complete run tree byte-for-byte unchanged.

Evidence selection is gated by `coverage_mode` before any historical attempt is read.

In `exact_current`, only a schema-valid persisted `succeeded` unit's exact `accepted_attempt` relationship can supply evidence. The resolver validates the accepted summary/record/result/output, producing input/descriptor and producer/current behavior/dependency relation. A non-succeeded unit with `accepted_attempt = null` is ordinary unavailable current evidence: prior successful summaries remain preserved history but are not opened or offered as retained context; the case is `incomplete`, attribution/proposal is unavailable/null and report exits `1`. If a persisted succeeded/accepted relationship is individually valid but its producing behavior or dependency relation is not exact-equal to the current descriptor graph, the coordinator failed to perform the frozen invalidation transition; report returns `CLI_REPORT_COVERAGE_INVALID`, exit `3`, with no report or mutation.

Only `patch_check_mixed_revision` may invoke historical lookup for a unit without usable current accepted evidence. Historical lookup never joins independently selected latest successes. It selects the evaluator's highest-ordinal successful immutable summary, validates that evaluator summary/record/result/proposal and exact producing evaluator stdin/schema, then treats the dependency projections in that validated stdin as the graph anchor. For each required `source_role`, it examines successful reader summaries for the exact logical reader unit in descending ordinal order, validates a candidate through its immutable attempt/result/output plus producing reader descriptor, derives its semantic projection, and retains the first exact-equal match to the evaluator-input dependency projection. A valid semantic non-match is skipped; corruption/substitution encountered on this deterministic resolution path is a command error rather than a skippable non-match. Highest ordinal is therefore only the deterministic tie-breaker among valid matching candidates.

Because the prepared directory does not persist `source_locator.accepted_results`, a matched historical reader is explicitly semantically equivalent evidence, not a claim that it is the exact reader attempt that produced the evaluator input. No attempt ID may be reconstructed from output equality. If any required role has no validated exact semantic match, the evaluator attempt is not a usable retained graph: the case is `incomplete`, the missing reader relation is `unavailable`, and the evaluator proposal/relation is also emitted as `null`/`unavailable` rather than `retained_reference`. This lookup does not restore acceptance or mutate state. In mixed mode, a failed, unknown or budget-blocked unit may expose prior evidence only when this coherent graph exists, and its case remains `incomplete`; historical success cannot mask the current terminal condition or exhausted budget. Persisted integrity-blocked units never enter this lookup.

Exact successful shape:

```text
{
  schema_version: 1,
  artifact_type: "cli_evaluation_report",
  command: "report",
  status: "succeeded" | "incomplete",
  run_id,
  workspace_id,
  revision,
  coverage_mode: "exact_current" | "patch_check_mixed_revision",
  authority: "advisory_evaluator_proposals_only",
  cases: [{
    suite,
    case_id,
    evaluator_unit_id,
    coverage_status: "current" | "retained_reference" | "incomplete",
    reader_results: [{
      source_role: "baseline" | "candidate",
      unit_id,
      unit_status: "pending" | "running" | "succeeded" | "failed" |
        "outcome_unknown" | "blocked",
      effective_status: "pending" | "running" | "succeeded" | "failed" |
        "outcome_unknown" | "blocked",
      block_reason: null | "integrity_failure" | "dependency_not_ready" |
        "attempt_budget_exhausted",
      relation: "current" | "retained_reference" | "unavailable",
      attempt_id: string | null,
      producer_revision: positive_integer | null,
      structured_output_sha256: sha256 | null
    }],
    evaluator_result: {
      unit_id,
      unit_status: "pending" | "running" | "succeeded" | "failed" |
        "outcome_unknown" | "blocked",
      effective_status: "pending" | "running" | "succeeded" | "failed" |
        "outcome_unknown" | "blocked",
      block_reason: null | "integrity_failure" | "dependency_not_ready" |
        "attempt_budget_exhausted",
      relation: "current" | "retained_reference" | "unavailable",
      attempt_id: string | null,
      producer_revision: positive_integer | null,
      structured_output_sha256: sha256 | null,
      proposal: evaluator-proposal-v1 | null
    }
  }],
  counts: {
    cases,
    current,
    retained_reference,
    incomplete
  },
  dispatch_counts: { reader: 0, evaluator: 0, total: 0 }
}
```

Canonical rules:

- cases follow suite order then lexical `case_id`; reader results follow semantic `baseline`, `candidate` order when present;
- count buckets are mutually exclusive and sum to `cases`;
- `current` requires every reader and evaluator accepted result to be valid and exact-equal to the current descriptor graph;
- `retained_reference` requires one evaluator-anchored coherent graph resolved by the algorithm above, with at least one non-current relation, and is legal only when `coverage_mode = patch_check_mixed_revision`; reader `attempt_id` in such a graph identifies selected semantically equivalent evidence unless an independent current accepted relationship proves more, never an inferred exact producing attempt;
- `incomplete` applies when any required current unit is failed, unknown, running, persisted integrity/budget blocked, or lacks usable current/reference evidence. Exact-current never displays preserved history for these states. Mixed mode may still show a prior coherent graph for failed/unknown/running/budget conditions with `relation = retained_reference`, but it cannot change the case bucket; persisted integrity-blocked evidence remains unavailable and is never dereferenced;
- nullable attribution fields and evaluator `proposal` are all null when the active coverage mode has no usable coherent graph, including every exact-current non-succeeded unit, persisted integrity quarantine and a mixed-mode standalone evaluator attempt whose reader graph cannot be reconstructed;
- mixed mode is always printed as mixed even if every currently visible case relation happens to be current; only the next successful `prepare --run` may reset the latch;
- exact-current returns `CLI_REPORT_COVERAGE_INVALID`, exit `3`, only when a persisted succeeded/accepted relationship claims current coverage but its fully validated producing behavior or dependency relation is not exact-equal to the current descriptor graph. Preserved summaries behind a non-succeeded unit are expected history and are never resolved into this error;
- proposal contents are emitted exactly as validated advisory content. The report has no `human_evaluation`, `case_status`, `comparison_status`, winner, action, recommendation or acceptance field;
- a schema-valid persisted `blocked / integrity_failure` state returns a canonical incomplete report, marks the affected relation unavailable, does not dereference quarantined evidence and exits `1`;
- corruption/substitution first detected while validating evidence selected as current or retained reference, including a late-result contradiction discovered during the report read, returns a command error with dispatch `0`, emits no report and exits `3`;
- exact-current pending/dependency-waiting/failed/unknown/budget state returns a canonical unavailable/incomplete report without historical lookup and exits `1`. In either coverage mode, after successful validation, any case in the `incomplete` bucket makes report `status = incomplete`, exit `1`, even if mixed mode displays a complete coherent retained graph. Historical evidence supplies reference context only and cannot erase the current failed/unknown/running or integrity/budget-blocked condition. Report `status = succeeded`, exit `0`, requires no incomplete case; the command errors above still take precedence and emit no report.

The new report neither writes `report/generated-report.json` nor invokes `run-skill-evals.mjs report --workspace`. Existing v1 report output and tests must remain unchanged.

## Checkpoint plan

No checkpoint is added. The four master checkpoints remain the only Stage 4 sequence. Each implementation checkpoint requires focused deterministic verification, explicit diff review and `0 Critical / 0 Required` before proceeding; commit remains separately owner-authorized.

### S4-CP1 — evaluator adapter, scheduling and reuse

- Split reader/evaluator successful-output adaptation without changing process or `ExecutionResult` semantics.
- Add exact evaluator prepared-input/proposal validation and accepted proposal publication.
- Add evaluator accepted-evidence resolution through exact producing attempt + producing prepared input.
- Extend next-revision in-memory projection, status/budget derivation, retry validation and dependency-wave scheduling to evaluator units.
- Prove evaluator restart/revision exact reuse, invalidation, failure isolation, explicit retry and patch-check closure behavior.

Acceptance: ready evaluators dispatch only after exact dependencies; invalid proposal is one consumed failed attempt; exact evaluator success survives restart and provenance-only revision; rubric/schema/semantic dependency change invalidates only the evaluator; every evaluator spawn respects the existing budget and recovery rules; reader behavior remains unchanged.

Suggested commit after separate approval: `feat(skill-evals): execute and reuse CLI evaluators`

### S4-CP2 — truthful advisory report

- Add the pure report builder/validator and `report --run` parser/orchestration.
- Resolve exact-current/reference/unavailable relations from validated producer evidence without state mutation.
- Reject impossible exact-current mixed evidence; label patch-check retained reference and mixed coverage.
- Prove no proposal is materialized or named as human evidence and v1 report behavior remains unchanged.

Acceptance: exact-current completed run emits deterministic current report; partial run emits incomplete/exit `1`; mixed run emits explicit mixed coverage with current/reference cases; corrupt evidence errors; complete run tree snapshot is byte-identical before/after every report case.

Suggested commit after separate approval: `feat(skill-evals): report advisory CLI evaluation evidence`

### S4-CP3 — deterministic CI, operator docs and cumulative review

- Add bounded `docs/agent-skills/eval-design.md` operator commands, status/exit interpretation, mixed-report warning and authority/call boundaries.
- Keep the doc procedural; link to existing governance/master contracts rather than restating or changing them.
- Confirm the Stage 4 focused deterministic suite is executed by the existing Ubuntu CI step; change workflow only if repository evidence shows it is not.
- Run cumulative Stage 1–4/v1 compatibility/validator/hygiene checks and reconcile exact status/counts/authority in `progress.md`.
- Review cumulative branch for scope, current truth, stale evaluator-zero-dispatch claims and proposal/human/report boundary.

Acceptance: deterministic required checks pass; docs match exact command behavior; CI coverage is explicit without duplicate expensive steps; cumulative review is `0 Critical / 0 Required`; no live calls or delivery action occurred.

Suggested commit after separate approval: `docs(agent-skills): document CLI evaluator workflow`

### S4-CP4 — separately authorized pilot and migration evidence

This checkpoint is a gate, not standing permission.

Before any call, require a new owner instruction that freezes:

- exact run/skill/scope and candidate/baseline refs;
- maximum total reader/evaluator calls and automatic retry `0`;
- maximum concurrency not exceeding the Stage 2 recommendation, owner cap and local cap;
- whether execution stops after first operational condition, unknown outcome or budget issue;
- exact allowed commands and whether a report is requested;
- evidence/report destination and whether any later commit/push/PR action is separately allowed.

The pilot must first pass preflight and deterministic current-head checks. Report only observed CLI behavior, exact counts/statuses/revisions and known limitations. A pilot does not create a human evaluation, migration verdict, production certification or standing live authority.

Acceptance: only under a separate grant, the bounded batch stays within exact call/concurrency ceilings and produces truthful retained evidence. Without that grant, S4-CP4 status remains `not_run / unauthorized`, which does not block completion of S4-CP1–S4-CP3 implementation review but does block any live-result claim.

Suggested commit: none by default; any pilot evidence commit requires a separate explicit decision after review.

## Required deterministic regression matrix

### Adapter and producing-input validation

- Reader success path remains byte-for-byte/schema-compatible with current accepted observation behavior.
- Candidate-only and comparison evaluator outputs with exact criterion/veto order pass and publish `accepted-evaluator-proposal.json`.
- Semantically valid JSON with non-canonical whitespace or object-key order passes and is canonicalized only in `accepted-evaluator-proposal.json`.
- Malformed JSON, extra/missing semantic fields, duplicate/missing/misordered rubric IDs, authoritative fields, padded required text, wrong candidate-only comparison shape or wrong schema fails as `invalid_structured_output` and consumes one attempt.
- Prepared evaluator stdin/schema/identity/mode/dependency/hash/options mismatch fails before accepting output; no mutable current suite data can validate a different producing input.
- Restart resolver validates the same output bytes against the producing revision input and rejects cross-unit/revision/path/hash substitution.

### Scheduling, state and reuse

- Fresh run schedules readers and then dependency-ready evaluators in bounded waves; evaluator never precedes its own reader dependencies.
- A ready evaluator from earlier reader success may share a wave with an unrelated ready reader under one concurrency cap.
- One reader/evaluator failure does not prevent independent started/ready units from settling.
- `run`/`resume` do not retry failed/unknown units; explicit retry accepts eligible failed reader/evaluator units only.
- Reader retry success enables its pending downstream evaluator in the same invocation; evaluator retry requires current successful dependencies.
- Evaluator active attempt, restart result/record recovery, late-result contradiction and `outcome_unknown` follow the exact Stage 3 rules with no duplicate ordinal/dispatch.
- `max_attempts` gates initial, resume, retry, invalidated and patch-check evaluator spawns across revisions; exhausted evaluator appears in the generic budget bucket and requires a new run.
- Provenance-only revision preserves exact reader and evaluator success; changed evaluator rubric/schema/projection invalidates evaluator only; changed reader semantic output invalidates its evaluator.
- Evaluator reuse requires both producing/current behavior-fingerprint equality and exact prior/current dependency-binding array equality; mismatch invalidates without trusting a mutable producer fingerprint.
- Complete next-revision graph is projected before `run.json`-last publication; injected crash cannot expose an unvalidated evaluator as current.
- Existing Stage 3 mixed-mode ordering/recovery/all-or-nothing regressions continue to pass with evaluator dispatch enabled only after the marker and closure validation.
- Run-status state-matrix regressions freeze ready evaluator + unrelated `outcome_unknown`, ready reader + retryable failed evaluator, ready reader + exhausted evaluator, failed/exhausted reader dependency + pending downstream evaluator, and historical `evaluator_dispatch_disabled` read-only/mutating reconciliation under the exact precedence table.

### Report truthfulness

- Exact-current all-success run reports every case `current`, counts partition exactly, dispatch `0`, exit `0`.
- Exact-current pending/failed/unknown/budget/dependency case reports `incomplete`, unavailable/null attribution, dispatch `0`, exit `1`, without reading prior successful summaries. For current failed/unknown/running/budget conditions, mixed mode may display a coherent historical graph, but that context cannot upgrade the case bucket or report status/exit.
- Mixed run with valid non-current untouched evidence reports `retained_reference`; mixed latch remains unchanged before/after report.
- Mixed-mode invalidated graph regression: reader attempt 1 produces `O1`, evaluator attempt 1 produces `E1` from `O1`, reader attempt 2 produces distinct `O2`, evaluator attempt 2 fails. Report resolves `E1` first and may pair it only with a validated reader attempt whose semantic projection exact-equals `O1`; highest ordinal applies only among matches. It never reports `O2` beside `E1` as a fully valid graph. With that coherent retained graph available, assert `evaluator_result.relation = retained_reference`, case `coverage_status = incomplete`, the case counted only in `counts.incomplete`, report `status = incomplete`, exit `1`, dispatch `0 / 0 / 0`, and no run-tree mutation.
- If the matching historical reader attempt is unavailable, the same graph is incomplete and the evaluator proposal is not emitted as retained reference; if multiple valid reader attempts have exact-equal `O1`, the selected one is labeled semantically equivalent evidence rather than exact producing lineage.
- Mixed run whose selected closure is current may show current cases but still prints `coverage_mode = patch_check_mixed_revision`.
- `prepare --run` invalidates a prior success to `pending + accepted_attempt = null` while preserving attempt history; exact-current report does not open that history and returns unavailable/incomplete, dispatch `0`, exit `1`, with no mutation.
- A persisted exact-current `succeeded + accepted_attempt` claim whose accepted evidence is structurally valid but whose producer/current behavior or dependency relation mismatches returns `CLI_REPORT_COVERAGE_INVALID`, dispatch `0`, exit `3`, no report and no mutation.
- Persisted schema-valid `blocked / integrity_failure` reports unavailable/incomplete without dereferencing quarantined evidence; newly detected corrupt accepted attempt/result/proposal/producing input and late-result contradiction error with no report and complete run-tree snapshot unchanged.
- Proposal content remains advisory; forbidden human/status/winner/action fields are absent from the report schema and serialized output.
- Repeated report over unchanged run emits exact-equal bytes and writes no file.
- Report over a canonical Stage 2 v1 marker emits the deterministic zero-attempt incomplete inventory, ignores unpublished bootstrap bytes and leaves the whole run tree unchanged.
- Zero-unit Stage 2 v1 and v2 runs both emit `cases: []`, `counts = { cases: 0, current: 0, retained_reference: 0, incomplete: 0 }`, `coverage_mode: "exact_current"`, `status: "succeeded"`, dispatch `0 / 0 / 0`, exit `0`, and leave the run tree byte-for-byte unchanged.
- Existing `run-skill-evals.mjs report --workspace` incomplete/complete/human-evaluation tests remain unchanged and pass.

### Public CLI and compatibility

- Help/parser includes evaluator retry and `report --run`; malformed forms exit `2` before preflight/store mutation.
- Every execution command reports sorted/count-consistent reader/evaluator dispatch IDs and kind-specific counts.
- Historical `evaluator_dispatch_disabled` state upgrades/reconciles into ready evaluator work without losing evidence or inventing an attempt.
- Stage 1 `execute-prepared`, Stage 2 prepare barrier and all Stage 3 reader/recovery/patch-check tests retain observable behavior except the explicitly owned Stage 4 evaluator dispatch/status extension.
- Fake tests inject worker/preflight and never call installed `codex`, network or a model.

## Verification strategy

Minimum implementation checks:

```text
node --check .agents/scripts/run-skill-eval-cli.mjs
node --check .agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-evaluator-proposal-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-run-state-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-impact-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-evaluation-report-v1.mjs
node --check .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

Also run link/fence/UTF-8/no-BOM/final-newline, conflict-marker and secret-like material checks for changed docs/source. Record exact counts only after commands actually run. The existing GitHub Ubuntu CLI test step is the remote portability gate after separately authorized push/PR; local success grants no remote action.

Manual QA is command-contract inspection with fake/local temp stores only until S4-CP4 receives separate live authority. Do not use a real model merely to validate documentation or deterministic report formatting.

## Review và delivery gates

- Review dimensions: permission/authority, proposal-versus-human boundary, producing-input provenance, state/restart/budget invariants, dependency scheduling, mixed coverage truth, read-only report, path containment, compatibility, scope and docs accuracy.
- A checkpoint pass does not authorize commit or the next action. Implementation, each local commit, push, PR, CI watch/fix, merge and live pilot remain separate owner decisions.
- Do not amend/squash Stage 3 history or fold the metadata correction into a future implementation commit.
- A plan written or self-reviewed by the agent remains a draft until owner approval of its material decisions; it cannot authorize its own implementation.

## Stop conditions

Stop and report exact evidence, affected stage/checkpoint and smallest options when:

- master/detail/owner brief/progress/source conflict materially;
- evaluator output cannot be bound to exact attempt + producing revision input without changing Stage 3 schemas;
- exact evaluator reuse requires persisting a new descriptor, patch selection or post-publication reconciliation lifecycle;
- report truth requires relabeling proposal as human evidence or changing v1 human report semantics;
- exact-current versus retained-reference relation cannot be derived without trusting mutable state;
- evaluator scheduling requires multiple coordinators/writers, generic DAG/backend abstraction or changed Stage 3 attempt ordering;
- an expected regression cannot prove no mutation/no dispatch through observable snapshots;
- implementation needs suite/skill semantics, App Server/CP9/v2 modules, distributed hardening or an unexpected source domain;
- S4-CP4 lacks exact live call/concurrency/scope authority.

Do not silently average the contracts or choose a larger architecture.

## Completion criteria

Stage 4 deterministic implementation is ready for owner delivery review only when S4-CP1–S4-CP3 pass their focused and cumulative gates; formal review is `0 Critical / 0 Required`; current docs contain no stale Stage 3/4 branch, authority, dispatch or report claims; exact test counts are recorded; report remains advisory/read-only and mixed-mode truthful; no frozen Stage 3 schema/lifecycle changed; and live/model/evaluator calls remain `0` unless S4-CP4 later receives and consumes a separate exact grant.

S4-CP4 is complete only from separately authorized observed evidence. Its absence must be reported as `not_run / unauthorized`, never inferred from fake tests.
