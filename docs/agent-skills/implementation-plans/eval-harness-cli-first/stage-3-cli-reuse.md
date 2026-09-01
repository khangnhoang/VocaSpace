# Agent Skill Eval Harness CLI-first — Stage 3 exact reuse implementation plan

## Trạng thái, baseline và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Stage: `3 — exact reuse, resume and affected-only rerun`.
- Branch: `feat/agent-skill-eval-cli-reuse`.
- Exact base: Stage 2 merge commit `d4b5f78a09fa997da75e969822bbc678c7f002a4`, PR #79.
- Plan status: `owner-directed draft / producer-anchor + compatibility/recovery/state/public-CLI + integrity/operational/v1-status/mode + run-wide-budget/preflight-count corrections applied / implementation not authorized`.
- Current task authority cho phép xác minh findings, sửa tài liệu liên quan và đúng một local docs commit theo follow-up `commit docs`; grant commit được consume bởi checkpoint này. Không authorize source/test implementation, thêm local commit, push, PR, CI-fix, merge hoặc live model/evaluator call.
- [Master plan](./plan.md) sở hữu cross-stage contract; [owner review brief](./owner-review-brief.md) sở hữu decision/authority surface; [progress](../../progress.md) sở hữu current status. Nếu ba nguồn conflict materially, dừng trước implementation và reconcile.

## Mục tiêu và điều kiện thành công

Stage 3 phải biến Stage 1 runner và Stage 2 execution plan/materializer thành một local durable workflow có thể:

1. tạo revision kế tiếp trong cùng run mà không gọi model;
2. giữ exact successful reader attempts qua process restart và provenance-only revision changes;
3. dispatch independent ready reader units, persist attempt/result relationship và không duplicate one `unit_id`;
4. resume/retry theo failure contract mà không redispatch `outcome_unknown`;
5. compile/replay ready evaluator packages từ accepted reader dependencies nhưng vẫn giữ evaluator dispatch bằng `0` cho tới Stage 4;
6. invalidate changed units + downstream closure và hỗ trợ explicit partial/mixed-revision `patch-check`;
7. chứng minh accepted result thuộc exact producer attempt/revision/descriptor thay vì tin mutable current unit state.

Success yêu cầu deterministic observable evidence cho state transitions, attempt identity, dispatch set/count, reuse set, dependency blocking, provenance rejection và crash recovery. Không có live model call trong Stage 3 implementation/review.

## Repository facts và finding đã xác nhận

- Master plan đã yêu cầu cross-revision reuse từ Stage 0: cùng `unit_id`, cùng behavioral projection/fingerprint, valid accepted bytes/hash và exact dependency bindings phải reuse dù `workspace_id`, absolute root hoặc HEAD-only provenance đổi.
- Stage 2 đã merge pure evaluator descriptor compiler và serialized reader descriptors. Mỗi reader descriptor trong execution plan đã lưu `behavior_projection` và `source_locator`; đây là immutable producer SSOT có sẵn.
- Current `ExecutionResult` chỉ giữ `unit_id`, `attempt_id`, terminal status, exit code, structured-output path/hash, process metadata và failure. Nó không giữ producing revision, producer fingerprint hoặc trusted producer locator.
- Current packager tạo random `workspace_id` cho mỗi prepare. Current compiler/assertion path còn lấy current static dependency locator để validate accepted observation, vì vậy một valid accepted observation từ equivalent older workspace bị từ chối.
- Observation schema thực tế không có `unit_id` hoặc `source_role`. Nó có semantic case fields, role-specific `artifact_type` và producer provenance fields. Không được rewrite schema chỉ để vá state/compiler seam.
- `cli-run-state-v1.mjs` và `cli-impact-v1.mjs` chưa tồn tại ở merged Stage 2 base.

Kết luận `Required`: cross-revision reuse không phải requirement mới của Stage 3; accepted-attempt/producer anchor là detail mới được chứng minh thiếu khi Stage 3 planning ghép durable reuse state với compiler đã merge. Correction logic thuộc interface vốn phục vụ Stage 2 compilation, nhưng implementation/reconciliation được cô lập thành S3-CP0 trên Stage 3 branch. Historical [Stage 2 detailed plan](./stage-2-cli-prepare.md) giữ nguyên như delivered/merged record.

Final transferability re-review xác nhận thêm `0 Critical / 2 Required`: prior text gated only explicit retry despite a run-wide ordinal, leaving later-revision invalidation and patch-check eligibility undefined; operational error text also permitted a nonzero count despite the pre-spawn lifecycle. The frozen correction below applies one lifetime budget gate to every spawn, defines exhausted state/exit/new-run behavior plus exact patch-check eligibility, and reserves `operational_condition` for a zero-dispatch preflight.

## Phạm vi

### Trong phạm vi

- Two-anchor accepted-result rule: exact accepted attempt/result và exact producing revision descriptor.
- Canonical Stage 3 run/unit/attempt schemas, one-writer read/write và startup reconciliation.
- Producing-revision descriptor lookup; derive/recompute producer locator và fingerprint.
- Canonical run-relative path validation, run/attempt containment, regular-file check, bytes/hash validation.
- Expanded normalized accepted-reader binding và evaluator descriptor `source_locator.accepted_results` validation.
- Pure evaluator compiler correction theo real observation fields; compiler không đọc store.
- Same-run `prepare --run`, `run`, `status`, `resume`, `retry`, `patch-check`.
- Exact reuse, dependency-bounded invalidation, evaluator package compile/materialize/exact replay với evaluator dispatch `0`.
- Focused deterministic regressions, v1 compatibility, current progress reconciliation và checkpoint reviews.

### Ngoài phạm vi

- Sửa `synthetic-workspace-v1.mjs` hoặc thêm cross-run cache.
- Thêm `unit_id`/`source_role` vào observation hay rewrite observation schema.
- Import `run-store-v2.mjs`, App Server/CP9 state, generic scheduler hoặc backend abstraction.
- Journal chain, signatures, signed evidence, generic attestation, CAS/lease, multi-writer hoặc adversarial-store hardening.
- Evaluator process dispatch/result adapter, report/human authority, CI/report operator docs hoặc Stage 4 pilot.
- Automatic retry, cleanup/lifecycle subsystem, arbitrary prompt command, semantic package slicing.

Nếu functional correction chỉ có thể hoàn thành bằng một mục ngoài phạm vi trên, dừng theo design-change protocol; không tự mở rộng scope.

## Expected files và files không được sửa

### Expected implementation files

| File | Ownership |
| --- | --- |
| `.agents/scripts/lib/skill-evals/cli-run-state-v1.mjs` | canonical state read/write; attempt/result relationship; path containment; producing revision + serialized reader descriptor resolution; normalized accepted evidence |
| `.agents/scripts/lib/skill-evals/cli-impact-v1.mjs` | producer/current fingerprint comparison, exact reuse eligibility, invalidation và downstream closure |
| `.agents/scripts/lib/skill-evals/cli-evaluator-proposal-v1.mjs` | validate normalized binding + observation against derived producer locator; semantic dependency membership; pure evaluator descriptor compilation |
| `.agents/scripts/lib/skill-evals/cli-execution-plan-v1.mjs` | validate expanded serialized evaluator `descriptor.source_locator.accepted_results` contract |
| `.agents/scripts/run-skill-eval-cli.mjs` | Stage 3 command parsing/orchestration and reader-only dispatch |
| `.agents/scripts/run-skill-eval-cli.test.mjs` | focused state/reuse/recovery/impact/compiler regressions with fake process/local temp store |
| `docs/agent-skills/progress.md` | actual checkpoint, verification and authority status after implementation work |

`codex-cli-runner-v1.mjs` chỉ được sửa nếu exact current `ExecutionRequest → ExecutionResult` seam không thể persist required Stage 3 attempt relation qua coordinator wrapper. Nếu cần đổi its public result contract hoặc Stage 1 observable behavior, dừng và update/review plan first.

### Conditional documentation owners

- `plan.md`: chỉ khi implementation evidence tạo material contract conflict.
- `owner-review-brief.md`: chỉ khi owner đưa decision/authority mới hoặc current summary cần reconcile sau material change.
- `stage-3-cli-reuse.md`: chỉ khi approved Stage 3 contract/checkpoint/verification đổi materially.
- implementation-plans `README.md` và program `plan.md`: chỉ khi routing/index/program status đổi.

### Không được sửa trong Stage 3

- `stage-2-cli-prepare.md`: historical merged Stage 2 contract.
- `synthetic-workspace-v1.mjs`, v2/App Server/CP9 modules, suite/skill content, evaluator report/human artifacts.
- `.github/workflows/ci.yml` trừ khi exact existing focused CLI test step không chạy Stage 3 suite; nếu fact đó xảy ra, dừng và request scope decision trước CI edit.

## Frozen public command contract

Command spelling/meaning giữ đúng master plan:

```text
prepare --run <run_id> [same-scope existing v1 selection flags]
run --run <run_id>
status --run <run_id>
resume --run <run_id>
retry --run <run_id> --unit <unit_id> [--unit <unit_id> ...]
patch-check --run <run_id> --unit <unit_id> [--unit <unit_id> ...]
```

- `prepare --run` validates exact same selected skill/suites/source roles, creates next revision and dispatches `0` processes. Scope change rejects and requires a new run.
- `run` dispatches current `pending` ready reader units only when the next run-wide attempt ordinal remains within frozen `max_attempts`. It does not retry `failed` or `outcome_unknown`; evaluator dispatch remains `0`.
- `status` is read-only and reports run/revision mode, aggregate statuses, per-unit state and exact-current versus partial/mixed-revision completeness. On an exact Stage 2 v1 marker it validates v1 + revision-1 plan and derives the complete zero-attempt snapshot in memory; it does not publish `units/` or upgrade `run.json`.
- `resume` first reconciles stale `running` through its persisted `active_attempt`: finalize an existing valid attempt/result at its exact terminal status, synthesize recovery-only `outcome_unknown` only when neither exists, and integrity-block invalid/mismatched evidence. It then reconstructs dependency state, exact-reuses success and dispatches only enabled `pending` ready readers whose next run-wide attempt ordinal remains within budget.
- `retry` accepts explicit selected `failed` units only, requires next contiguous ordinal within frozen `max_attempts`, and reevaluates downstream dependencies after success. No automatic retry.
- `patch-check` requires explicit unit IDs, computes their downstream closure against current revision and retains untouched historical results without promoting them to exact-current success.
- Per-run concurrency/process/max-attempt settings remain those frozen in `run.json`; Stage 3 does not silently mutate them during `run`/`resume`/`retry`.

### Canonical command result và exit codes

Every structurally valid Stage 3 command writes one newline-terminated canonical JSON object to stdout with exact keys:

```text
{
  schema_version: 1,
  artifact_type: "cli_run_command_result",
  command: "prepare" | "run" | "status" | "resume" | "retry" | "patch-check",
  status: "succeeded" | "incomplete",
  run_id,
  workspace_id,
  revision,
  run_status: "prepared" | "running" | "paused" | "completed" | "blocked",
  run_status_reason: null | "evaluator_dispatch_disabled" | "retry_required" |
    "attempt_budget_exhausted" | "operational_condition" | "integrity_failure" |
    "outcome_unknown",
  mode: "exact_current" | "patch_check_mixed_revision",
  requested_unit_ids,
  affected_unit_ids,
  dispatched_unit_ids,
  reused_unit_ids,
  invalidated_unit_ids,
  unit_statuses: [{
    unit_id,
    kind: "reader" | "evaluator",
    persisted_status: "pending" | "running" | "succeeded" | "failed" |
      "outcome_unknown" | "blocked",
    effective_status: "pending" | "running" | "succeeded" | "failed" |
      "outcome_unknown" | "blocked",
    block_reason: null | "dependency_not_ready" | "attempt_budget_exhausted" |
      "integrity_failure",
    current_revision,
    current_behavior_fingerprint: sha256 | null,
    active_attempt_id: string | null,
    accepted_attempt_id: string | null,
    attempt_count
  }],
  counts: {
    reader_units,
    evaluator_units,
    total_units,
    pending,
    running,
    succeeded,
    failed,
    outcome_unknown,
    integrity_blocked,
    dependency_blocked,
    attempt_budget_blocked
  },
  dispatch_counts: { reader, evaluator, total }
}
```

All unit-ID arrays are duplicate-free and lexically sorted. `unit_statuses` is sorted by `unit_id`; the eight mutually exclusive effective buckets `pending + running + succeeded + failed + outcome_unknown + integrity_blocked + dependency_blocked + attempt_budget_blocked` equal `total_units`. `requested_unit_ids` is the exact sorted explicit selection for `retry`/`patch-check` and `[]` otherwise. `affected_unit_ids` contains only units whose canonical plan/state classification changed in this invocation; `dispatched_unit_ids` contains actual reader spawns; `reused_unit_ids` and `invalidated_unit_ids` report exact decisions made by this invocation. `status` is command outcome, distinct from `run_status`.

Command-specific guarantees:

- `prepare --run`: revision is the newly published revision; dispatch arrays/counts are empty/zero; result covers post-upgrade/revision reconciliation.
- `status`: read-only; every change/dispatch/reuse/invalidation array is empty and counts/unit statuses are a full current snapshot. For canonical v1, derive readers as `pending` with descriptor fingerprints and bindings `[]`, evaluators as persisted `pending`/effective `blocked / dependency_not_ready` with fingerprint/bindings `null/null`, attempt IDs null/count `0`, mode `exact_current`, and run status by the ordinary priority (`prepared / null`, or `completed / null` for zero units). Ignore unpublished `units/` bootstrap bytes when producing this v1 snapshot; a later mutating upgrade still exact-validates or rejects those bytes under the upgrade contract.
- `run`/`resume`: requested IDs are empty; affected/dispatched/reused/invalidated arrays describe this invocation only.
- `retry`: requested IDs exactly equal valid explicit failed units with an available next run-wide ordinal; any unknown/non-failed/duplicate/over-limit unit is an operation error, not silently skipped.
- `patch-check`: requested IDs are exact operator selection, affected IDs are exact downstream closure, and mode is `patch_check_mixed_revision`. Exact projected eligibility follows the matrix below; it cannot act as an implicit retry or bypass the run-wide attempt budget.

`retry` and `patch-check` validate the entire duplicate-free selection, every unit/status/revision/max-attempt constraint and the full closure before the first state mutation, materialization or dispatch. One invalid member returns `command_error` for the whole command with dispatch `0`; no valid subset is partially applied.

Their common pre-mutation gate order is exact: (1) validate canonical marker/plans/unit and immutable evidence, deriving startup-recovery/impact transitions in memory only; (2) validate the entire requested selection against that projected state and compute the full closure; (3) if the valid selection exposes a coordinator-owned in-flight integrity contradiction, persist only that frozen `blocked / integrity_failure` transition and stop with `command_error`; (4) otherwise run required execution preflights; (5) only then persist allowed reconciliation/operational/mode/unit changes and dispatch. Accepted-evidence integrity failure or one invalid selection member returns before any persistence. An invalid command never changes unrelated projected recovery state.

Exit behavior keeps the current CLI convention:

| Exit | Output | Meaning |
| --- | --- | --- |
| `0` | canonical result with `status: succeeded` | command completed truthfully; `status` reads always return `0` when the store is valid; `prepare --run` returns `0` after publication; `paused / evaluator_dispatch_disabled` is expected Stage 3 success |
| `1` | canonical result with `status: incomplete` | valid `run`/`resume`/`retry`/`patch-check` settled with a newly attempted `failed`/`outcome_unknown`, or no permitted automatic action can progress because failed/unknown/budget-exhausted work needs explicit operator action or a new run |
| `2` | usage text on stderr, no JSON artifact | command/flag/value syntax is invalid |
| `3` | canonical `command_error` on stdout | validation, integrity, relationship, I/O, preflight or unsupported-operation failure prevented a trustworthy command result |

`completed` is not required for exit `0`: reader completion followed by `paused / evaluator_dispatch_disabled` is a successful Stage 3 operation. Conversely, a read-only `status` of `blocked` still exits `0` if the persisted store itself validates; unreadable/corrupt state exits `3`.

Exact Stage 3 error shape extends the current `command_error` convention:

```text
{
  schema_version: 1,
  artifact_type: "command_error",
  command: "prepare" | "run" | "status" | "resume" | "retry" | "patch-check",
  status: "error",
  code,
  message,
  workspace_id: string | null,
  run_id: string | null,
  revision: positive-safe-integer | null,
  dispatch_counts: { reader, evaluator, total }
}
```

Errors never claim affected/reuse/status snapshots. When a recognized operational preflight condition is safely attributable to a valid run, coordinator first persists `paused / operational_condition`, emits `command_error`, and reports exact `{ reader: 0, evaluator: 0, total: 0 }`; it does not invalidate success.

## Durable schemas và ownership

### Run state

`run.json` remains the publication marker. Stage 3 must not reinterpret or silently broaden the merged Stage 2 schema. It supports two explicit versions:

- Stage 2 `cli_run` v1 is accepted only through the existing exact `assertCliRun` relationship with revision-1 `execution-plan.json`;
- Stage 3 atomically upgrades that validated marker to `cli_run` v2 before any Stage 3 dispatch/reuse command continues.

Exact Stage 3 v2 content keeps the Stage 2 field names and required identity fields:

```text
{
  schema_version: 2,
  artifact_type: "cli_run",
  run_id,
  workspace_id,
  selected_scope,
  current_revision,
  status: "prepared" | "running" | "paused" | "completed" | "blocked",
  mode: "exact_current" | "patch_check_mixed_revision",
  unit_ids,
  process_settings: {
    local_process_cap,
    max_concurrency,
    max_attempts,
    planned_concurrency,
    target_minutes
  },
  status_reason: null | "evaluator_dispatch_disabled" | "retry_required" |
    "attempt_budget_exhausted" | "operational_condition" | "integrity_failure" |
    "outcome_unknown"
}
```

`workspace_id`, `unit_ids` and `current_revision` exact-match the current execution plan; `selected_scope` and `process_settings` remain exact-equal to the validated Stage 2 v1 marker and are frozen for the run. Unknown fields, invalid enums, non-canonical unit order/duplicates, scope mismatch or missing current execution plan fail closed before dispatch/reuse.

`mode` is a persisted coverage-mode latch with an exact lifecycle:

- the v1 in-memory status projection and every newly upgraded/newly prepared revision start `exact_current`;
- after full `patch-check` selection/closure validation and passing execution preflights, atomically replace `run.json` with `patch_check_mixed_revision` as the command's first and standalone mutation, before unit mutation/materialization/dispatch; if an operational latch was present, this same replace clears it rather than performing two marker writes. Crash immediately afterward leaves a conservative mixed marker with no false exact-current claim;
- `status`, `run`, `resume` and `retry` never clear mixed mode in the same revision, even if their current snapshot happens to contain no pending reader; this prevents an implicit full-coverage claim;
- only successful `prepare --run` publication of the next revision resets mode to `exact_current`, because it reclassifies the full selected graph against that new current revision. Crash before `run.json`-last publication leaves the old mixed marker authoritative; crash after publication leaves the new exact-current marker authoritative.

Run status is derived after every reconciliation/mutation, except that the exact persisted operational latch below overrides ready-work derivation:

1. any persisted unit `blocked` for integrity → run `blocked / integrity_failure`;
2. otherwise persisted `status = paused` + `status_reason = operational_condition` remains `paused / operational_condition` until a mutating execution command clears it through the lifecycle below;
3. otherwise any active attempt/unit `running` → `running / null`;
4. otherwise any ready enabled reader `pending` with an available next ordinal → `prepared / null` so `run`/`resume` may continue independent work;
5. otherwise any `outcome_unknown` that prevents exact completion → `blocked / outcome_unknown`;
6. otherwise any explicit-retry-eligible `failed` unit or dependent waiting on it → `paused / retry_required`;
7. otherwise any current reader `pending`/`failed` whose next ordinal would exceed `max_attempts`, or a dependent waiting on it → `paused / attempt_budget_exhausted`;
8. otherwise any non-succeeded evaluator whose reader dependencies are ready while evaluator dispatch is disabled → `paused / evaluator_dispatch_disabled`;
9. otherwise every selected unit is exact `succeeded`—or selected unit count is zero—→ `completed / null`.

The operational latch lifecycle is exact: after canonical state validation, full in-memory explicit-selection/reconciliation validation and any required coordinator-owned integrity transition, but before any new spawn, a recognized CLI-wide preflight/resource failure atomically writes `paused / operational_condition`, preserves unit state/success and emits `command_error` with dispatch count exactly `0`. Read-only `status` reports but never clears the latch. The next `run`/`resume`/`retry`/`patch-check` re-runs all recognized preflights before ordinary ready-work derivation: failure retains the latch and dispatches `0`; success clears it in that command's first allowed `run.json` mutation before any unit mutation/materialization/dispatch. For patch-check, latch clearing and mixed-mode publication are one marker replace. Integrity failure always wins priority and cannot be masked or cleared by this lifecycle.

`operational_condition` is reserved for this pre-spawn gate. A resource/transport/process failure first observed after a child exists is not retroactively relabeled as an operational preflight or latch: it settles that already allocated attempt as `failed` when terminal certainty exists or `outcome_unknown` when certainty is lost, using the ordinary local-failure scheduler contract. Stage 3 does not add a separate mid-dispatch pause/settlement policy.

`prepare --run` does not claim the execution condition has recovered: when the authoritative prior v2 marker carries the operational latch, successful next-revision publication preserves `paused / operational_condition` while resetting only coverage `mode = exact_current`. A later mutating execution command must pass preflight to clear the latch. Canonical v1 has no Stage 3 operational latch to preserve.

Stage 3 normally settles at `paused / evaluator_dispatch_disabled` after all readers succeed and evaluator packages are ready; it must not claim `completed` merely because reader work ended. Dependency-derived blocking is a read-time effective state and does not override an available independent reader in step 4.

Upgrade order is frozen:

1. read canonical `run.json`, validate exact Stage 2 v1 against immutable revision-1 plan and reject any extra/missing/mismatched field;
2. derive initial Stage 3 unit state deterministically from that plan with zero attempts;
3. publish the complete `units/` bootstrap through same-filesystem staging + create-once/exact-replay validation under the one-writer contract;
4. write exact canonical v2 bytes to a same-directory temp file and atomically replace `run.json` **last**;
5. re-read and validate v2 plus its current plan/unit relationships before any dispatch/reuse decision.

Crash recovery preserves the marker invariant: before the final replace, valid v1 remains authoritative and a completely published `units/` bootstrap is only replay input; after replace, valid v2 is authoritative. Orphan staging/temp files are never publication markers. Restart exact-replays a complete matching bootstrap and retries the deterministic v2 replace; partial/mismatched bootstrap or an invalid canonical v1/v2 blocks without dispatch or silent repair. A valid v2 is idempotently re-read, never upgraded again.

Revision plans also remain version-explicit: the immutable Stage 2 revision-1 `cli_execution_plan` v1 is never rewritten; Stage 3 emits `cli_execution_plan` v2 for revisions `>= 2` with the same semantic inventory plus the actual positive revision. The plan validator dispatches by schema version and rejects v1 with revision other than `1`, v2 with revision below `2`, unknown versions and cross-version relationship mismatch.

### Unit state

```text
{
  schema_version: 1,
  run_id,
  unit_id,
  logical_unit_key,
  current_revision,
  current_behavior_fingerprint: sha256 | null,
  dependency_bindings: [] | null | [{
    source_role,
    unit_id,
    producer_behavior_fingerprint,
    structured_output_sha256
  }],
  status: "pending" | "running" | "succeeded" | "failed" | "outcome_unknown" | "blocked",
  block_reason: null | "integrity_failure",
  active_attempt: null | {
    attempt_id,
    attempt_ordinal,
    producer_revision,
    attempt_record_path,
    execution_result_path,
    output_directory_path
  },
  accepted_attempt: null | {
    attempt_id,
    attempt_record_path,
    attempt_record_sha256
  },
  attempt_summaries: [{
    attempt_id,
    attempt_ordinal,
    producer_revision,
    terminal_status,
    result_origin,
    attempt_record_path,
    attempt_record_sha256
  }]
}
```

Exact unit-state rules:

- reader `current_behavior_fingerprint` is always `sha256Canonical(current reader descriptor.behavior_projection)` and `dependency_bindings = []`;
- evaluator waiting for any accepted reader dependency has `current_behavior_fingerprint = null` and `dependency_bindings = null`; once every dependency resolves, both finalize together before evaluator materialization/reuse;
- finalized evaluator bindings are sorted lexically by `source_role`, contain exactly one item per static dependency, and canonical equality is exact equality of the whole array;
- dependency binding deliberately contains only semantic role/unit, descriptor-derived producer behavior fingerprint and accepted structured-output hash. It excludes `attempt_id`, producer revision, locator and path so an intact newly bound provenance graph with equal behavior/output can reuse across provenance-only revisions. Those excluded fields remain validated provenance in the accepted-attempt resolver and evaluator descriptor `source_locator.accepted_results`;
- `current_behavior_fingerprint` is current planning state only and cannot prove what produced an old output. Unit state never duplicates a trusted producer locator/fingerprint;
- `status = running` requires `active_attempt` non-null. A non-null active attempt is allowed only for `running` or `blocked / integrity_failure`; the blocked form retains contradictory in-flight evidence for diagnosis without treating it as runnable. `pending`, `succeeded`, `failed` and `outcome_unknown` require `active_attempt = null`;
- `accepted_attempt` is non-null iff persisted status is `succeeded`; `failed`, `outcome_unknown`, `pending` and `blocked` cannot retain accepted current success;
- persisted `blocked` is reserved for integrity failure and requires `block_reason = integrity_failure`. All other statuses require `block_reason = null`;
- an evaluator waiting on dependencies remains persisted `pending`; status output derives `effective_status = blocked` and `block_reason = dependency_not_ready`. A `pending` or `failed` reader with no available next ordinal likewise retains its persisted status but derives `effective_status = blocked` and `block_reason = attempt_budget_exhausted`. Neither derived block is written into the unit file.

### Run-wide attempt budget và patch-check eligibility

`process_settings.max_attempts` is a lifetime ceiling per logical unit within one `run_id`. It never resets when revision, producing descriptor, behavior fingerprint or dependency binding changes. Every allocated ordinal—worker-backed success/failure/unknown and recovery-only unknown—counts. For canonical state:

- allocated count is `attempt_summaries.length + (active_attempt === null ? 0 : 1)` and equals both the highest allocated ordinal and public `unit_statuses[].attempt_count`; summaries plus any active ordinal must be exactly contiguous `1..allocated_count` with no duplicate or gap;
- every path that could spawn a unit—`run`, `resume`, `retry`, `patch-check`, and a later stage enabling another unit kind through this same engine—must require `allocated_count + 1 <= max_attempts` immediately before allocating the intent; the gate is not retry-specific;
- `prepare --run` performs no spawn and therefore does not reject an otherwise valid next revision solely because a changed unit exhausted budget. It publishes the revision, preserves attempt history, marks the validly invalidated unit persisted `pending`, and exposes derived `blocked / attempt_budget_exhausted`. Independent ready units with budget keep run status `prepared`; once no permitted work can progress, status is `paused / attempt_budget_exhausted`;
- `run`/`resume` never spawn an exhausted unit. If only budget-exhausted work remains they return canonical `incomplete`, exit `1`, and direct the operator to create a new run; budget is never silently raised or reset;
- `retry` or `patch-check` whose explicit selection/closure requires an over-budget spawn rejects the whole command with `code = CLI_ATTEMPT_BUDGET_EXHAUSTED`, exit `3`, dispatch/state/materialization mutation `0`.

`patch-check` validates this projected-state matrix before its mixed-mode marker or any other mutation:

| Projected selected unit | Eligibility |
| --- | --- |
| reader `pending`, ready, next ordinal within budget | eligible; it may spawn once under ordinary scheduling |
| evaluator `pending` | eligible for compile/materialize/exact replay with evaluator dispatch `0` only when dependencies are already ready or every missing reader dependency is an eligible member of the same requested/derived closure; otherwise whole-command error |
| exact-current `succeeded` | whole-command error because current impact did not classify it as affected |
| `failed` | whole-command error; use `retry` |
| `outcome_unknown` | whole-command error; quarantine cannot be bypassed |
| `running` | whole-command error; duplicate execution is forbidden |
| persisted `blocked / integrity_failure` | whole-command integrity error |
| reader requiring a spawn with exhausted budget | `CLI_ATTEMPT_BUDGET_EXHAUSTED` whole-command error |

A downstream evaluator that initially waits on an eligible selected reader may remain derived `dependency_not_ready` until that reader succeeds; this deferred closure member is not an invalid selection. No evaluator process is dispatched in Stage 3.

### Immutable attempt record và worker result

Canonical coordinator-owned path: `attempts/<unit_id>/<attempt_ordinal>/attempt.json`. Stage 1 worker-generated `result.json` remains an immutable sibling and is not repurposed as the Stage 3 wrapper.

```text
{
  schema_version: 1,
  artifact_type: "cli_attempt_record",
  run_id,
  unit_id,
  attempt_id,
  attempt_ordinal,
  producer_revision,
  terminal_status: "succeeded" | "failed" | "outcome_unknown",
  result_origin: "worker_result" | "recovered_missing_result",
  execution_result_path: string | null,
  execution_result_sha256: sha256 | null,
  structured_output_path: string | null,
  structured_output_sha256: sha256 | null,
  recovery_reason: null | "coordinator_restart_without_result"
}
```

- `attempt_id = ${unit_id}-attempt-${attempt_ordinal}`.
- Ordinal is positive, safe, contiguous and unique per unit.
- Worker `result.json` and coordinator `attempt.json` use exclusive create and are immutable after publication; mutable run/unit state uses canonical JSON temp-write + same-directory atomic rename under one coordinator/writer.
- `result_origin = worker_result` requires execution-result path/hash both non-null, `recovery_reason = null`, exact canonical worker result bytes and exact record/result identity. Record `terminal_status` exact-matches `ExecutionResult.terminal_status`.
- `result_origin = recovered_missing_result` requires terminal status `outcome_unknown`, execution-result path/hash `null/null`, structured-output path/hash `null/null` and exact recovery reason `coordinator_restart_without_result`. It records consumed attempt identity/ordinal without inventing a worker result relationship.
- Recovery-only publication is terminal for that attempt. If a late worker `result.json` appears afterward, the store now contains contradictory unexpected evidence and must become `blocked / integrity_failure`; it is never upgraded, accepted or used to rewrite the immutable recovery record.
- For worker-backed output, `succeeded` requires structured-output path/hash both non-null, canonical, contained and valid; `failed | outcome_unknown` requires both `null`. Any half-null pair, origin/status/reason mismatch or record/result identity mismatch rejects. Only `succeeded` may become `accepted_attempt`.

### Active-attempt write order và restart recovery

The one-writer coordinator follows this exact sequence:

1. allocate the next contiguous ordinal and deterministic attempt/output/result/record paths;
2. atomically persist unit `status = running` plus complete `active_attempt` **before** invoking the worker; this persisted intent consumes the ordinal if coordinator certainty is later lost;
3. invoke Stage 1 worker with exact active attempt ID/ordinal/output directory; worker exclusively publishes its `result.json` only after its terminal process handling settles;
4. validate a canonical terminal worker result, then exclusive-create the matching worker-backed `attempt.json`;
5. atomically append the exact attempt summary, clear `active_attempt`, set terminal unit state, and set `accepted_attempt` only for succeeded output.

Startup reconciliation of `status = running` is deterministic:

- valid matching `attempt.json` already exists → exact-replay it and finish step 5;
- no attempt record, but a valid matching terminal `result.json` exists → create the worker-backed attempt record and finish with that exact `succeeded`, `failed` or `outcome_unknown` result; never downgrade a valid terminal result to restart-unknown;
- neither record nor result exists → create the recovery-only `outcome_unknown` attempt record, append its summary, clear active attempt and persist unit `outcome_unknown`; the ordinal remains consumed and cannot be retried/resumed;
- an existing partial/invalid/mismatched result or attempt record → persist unit `blocked / integrity_failure` while retaining `active_attempt` for diagnosis; do not synthesize recovery, overwrite evidence, allocate a new ordinal or dispatch.

Thus crash before worker result has a truthful recovery-only record, crash after valid worker result preserves its exact terminal status, and crash after attempt-record publication finishes idempotently without duplicate dispatch.

### Canonical paths and containment

- Persist only canonical run-relative POSIX paths; reject absolute, backslash, empty/dot segments, `..`, non-canonical normalization and NUL.
- Resolve `attempt_record_path` and every non-null `execution_result_path` strictly beneath exact attempt root and verify regular files without following a path escape/symlink.
- For `succeeded`, resolve authoritative recorded `structured_output_path` strictly beneath `attempts/<unit_id>/<attempt_ordinal>/output/`, verify regular file, read exact bytes and validate SHA-256 before parsing. Raw absolute paths returned inside current `ExecutionResult` are non-authoritative and must resolve/normalize to this same recorded file. For `failed | outcome_unknown`, require the recorded and raw output path/hash pairs to be `null/null` and perform no output-file resolution.
- Accepted reference must match exact run/unit/attempt/ordinal/producer revision. A valid result/path from another unit or revision cannot be cross-wired against that relationship. An intact older producing revision remains eligible for cross-revision reuse after derived producer/current behavior equality.

## Two-anchor accepted-result resolution

### Anchor 1 — exact accepted attempt/result

`accepted_attempt` selects one immutable coordinator attempt record. `cli-run-state-v1.mjs` validates record path/hash/identity, its exact worker result path/hash, `ExecutionResult`, terminal success and contained structured output bytes/hash. This proves `attempt_id → unit_id`, producing revision and output ownership without changing the Stage 1 result shape.

### Anchor 2 — exact producing revision descriptor

`producer_revision` selects `revisions/<producer_revision>/execution-plan.json`. State reader validates the serialized plan and locates exactly one reader descriptor with the accepted `unit_id`. From that descriptor it derives:

```text
producer_locator = {
  workspace_id: descriptor.source_locator.workspace_id,
  variant_id: descriptor.source_locator.variant_id,
  execution_context_hash: descriptor.source_locator.execution_context_hash
}
producer_behavior_fingerprint = sha256Canonical(descriptor.behavior_projection)
```

Neither value may be copied from or overridden by mutable unit state. A current unit fingerprint cannot launder an old attempt. Missing/duplicate descriptor, plan mismatch or revision substitution blocks reuse.

### Normalized accepted reader binding

Only after both anchors validate may state/impact orchestration form:

```text
{
  source_role,
  unit_id,
  attempt_id,
  producer_revision,
  producer_behavior_fingerprint,
  producer_locator,
  terminal_status: "succeeded",
  structured_output_path,
  structured_output_sha256,
  observation_bytes
}
```

`source_role` comes from the current evaluator dependency relation, not observation. `producer_locator` is the exact bounded `{ workspace_id, variant_id, execution_context_hash }` projection from the producing descriptor; it does not copy absolute/source-navigation paths. Locator and fingerprint are derived values. `observation_bytes` are the exact validated structured-output bytes, not a separately supplied mutable copy.

## Responsibility split

### `cli-run-state-v1.mjs`

- canonical run/unit/attempt validation and mutation;
- attempt ID/ordinal/result relationship;
- path containment, regular-file and bytes/hash checks;
- producing revision plan + serialized reader descriptor resolution;
- derive producer locator/fingerprint and emit normalized accepted evidence;
- no impact policy or evaluator projection compilation.

### `cli-impact-v1.mjs`

- calculate current reader/evaluator fingerprints from validated current descriptors;
- compare descriptor-derived producer fingerprint with current reader fingerprint;
- require accepted output validity and exact dependency bindings;
- return deterministic reusable/invalidated/blocked/pending sets and downstream closure;
- never trust mutable current unit fingerprint as producer evidence.

### `cli-evaluator-proposal-v1.mjs`

- remain pure and perform no store/filesystem I/O;
- require exact normalized binding membership for every current evaluator dependency by `source_role + unit_id`;
- verify observation SHA-256/bytes, semantic `skill`, `suite`, `case_id`, role-specific `artifact_type` and exact derived `producer_locator`;
- do not require observation `unit_id` or `source_role`, because the schema has neither;
- do not compare reused observation locator to current revision workspace locator;
- compile the existing semantic observation projection and canonical evaluator descriptor.

### `cli-execution-plan-v1.mjs`

Validate expanded serialized evaluator `descriptor.source_locator.accepted_results` with exact keys:

```text
{
  source_role,
  unit_id,
  attempt_id,
  producer_revision,
  producer_behavior_fingerprint,
  producer_locator: { workspace_id, variant_id, execution_context_hash },
  structured_output_path,
  structured_output_sha256
}
```

Entries are sorted by semantic `source_role`, exact-match static dependencies and remain coordinator-side provenance. They do not enter evaluator `behavior_projection` or stdin except through the already-frozen semantic observation projection. Descriptor validation rejects unknown/missing keys, duplicate roles/units, invalid IDs/revision/hash/path/locator and dependency mismatch.

## Reconciliation and reuse algorithm

For each current unit, in deterministic `unit_id` order:

1. missing stored unit → `pending`;
2. prior `running` → apply the frozen `active_attempt` recovery algorithm: finalize a valid existing attempt/result at its exact terminal status; only the no-record/no-result case becomes recovery-only `outcome_unknown`; invalid/mismatched evidence becomes persisted integrity `blocked`; never redispatch that consumed attempt;
3. prior `outcome_unknown`/integrity `blocked` → retain quarantine/block;
4. prior `succeeded` → resolve both anchors, validate accepted bytes/hash, compare derived producer fingerprint with current descriptor and compare exact dependency bindings;
5. if every check equals → reusable `succeeded`, dispatch `0`;
6. if the old accepted graph remains fully valid but the current behavior fingerprint or exact dependency binding differs → preserve history and mark `pending` invalidated;
7. if accepted attempt record/result/output bytes/hash/path, producing plan/descriptor or their exact relationships are missing, corrupt, substituted or otherwise fail integrity validation → emit `command_error`, dispatch/materialization/state mutation `0`; do not convert to `pending` or persist a new block that would overwrite the evidence under inspection;
8. evaluator without ready reusable reader dependencies → derived `blocked` and no attempt;
9. ready evaluator → compile from normalized bindings, materialize/exact-replay under current revision, compute fingerprint/bindings and persist pending/reuse decision; evaluator process dispatch remains `0`;
10. stored `failed` remains failed until explicit `retry`; when the next ordinal exceeds the frozen run-wide budget, its effective state is `blocked / attempt_budget_exhausted` instead of retry-eligible;
11. a validly invalidated `pending` reader with exhausted run-wide budget also derives `blocked / attempt_budget_exhausted`; no scheduler path allocates another ordinal;
12. independent pending readers with available budget remain runnable regardless of unrelated failed/blocked dependencies.

Persisted `blocked / integrity_failure` remains legal only for a coordinator-owned transition with a previously validated mutable state basis—currently the in-flight recovery contradiction/late-result cases above. Validation failure of an already accepted immutable evidence graph or a caller-supplied forbidden substitution is observational: `command_error` with byte-for-byte state/prepared inventory preservation. This boundary prevents automatic rerun from laundering corrupt accepted evidence while keeping crash recovery diagnosable.

Completion order may change event timing but cannot change canonical persisted reusable/invalidated/blocked sets.

## Checkpoint plan

Every checkpoint must pass focused deterministic verification, explicit diff review and formal `0 Critical / 0 Required` before the next checkpoint. Commit remains separately owner-authorized.

### S3-CP0 — accepted-result provenance rebinding

- Extend normalized accepted binding and serialized evaluator accepted-results validation.
- Implement pure compiler responsibility split using real observation fields.
- Add state-side producer resolver seam sufficient for tests; derive locator/fingerprint from producing descriptor.
- Replace current-workspace rejection regression with positive cross-revision provenance path through state reader → impact resolver → compiler.
- Add mutable-fingerprint laundering and cross-revision attempt substitution rejection cases.
- Add an allowed two-workspace `variant_mapping` A/B-flip control proving semantic candidate/baseline identity, fingerprint and reuse remain stable.

Acceptance: equivalent producing/current reader descriptors across different workspace provenance or opaque A/B mapping compile successfully under stable semantic roles; accepted observation path/hash/bytes remain byte-for-byte unchanged. Every forbidden substitution rejects before evaluator materialization and leaves canonical run/unit/attempt state byte-for-byte unchanged. Compiler remains pure; observation schema unchanged; evaluator dispatch `0`.

Suggested commit after separate approval: `fix(skill-evals): bind accepted results to producer attempts`

### S3-CP1 — revision and canonical state foundation

- Implement full run/unit/attempt validators, one-writer mutations and immutable attempt publication.
- Implement exact Stage 2 `cli_run` v1 validation followed by create-once unit-state bootstrap and `run.json`-last atomic upgrade to Stage 3 v2; support restart before/after the marker replacement without a mixed schema.
- Add `prepare --run`, same-scope guard, next contiguous revision and history preservation.
- Validate immutable revision-1 execution-plan v1, later-revision execution-plan v2, current/producing plan relationships and canonical path containment.
- Bootstrap Stage 2 revision-1 runs without inventing attempts.
- Freeze exact reader/evaluator fingerprint nullability, semantic dependency-binding array/equality and persisted-integrity versus derived-dependency block rules.

Acceptance: valid Stage 2 v1 upgrades once to exact Stage 3 v2; crash before marker replacement retains valid v1 and restart exact-replays bootstrap; crash after replacement retains valid v2; partial/mismatched bootstrap or invalid v1/v2 blocks with dispatch/state mutation `0`. Same-scope revision increments once with dispatch `0`; scope mismatch/invalid store/path/substitution fails closed; revision/attempt history remains immutable.

Suggested commit after separate approval: `feat(skill-evals): add revisioned CLI run state`

### S3-CP2 — run/status and reader attempts

- Implement `run` and read-only `status`.
- Implement canonical v1 in-memory zero-attempt `status` without upgrade/bootstrap writes.
- Dispatch ready `pending` readers through current Stage 1 worker pool with per-unit exclusivity and the run-wide attempt-budget gate on every spawn.
- Persist complete `active_attempt` before worker invocation, then apply exact worker-result/attempt-record/unit-finalization write order and all restart windows.
- Persist every consumed attempt with exact terminal-status/output-nullability matrix; only succeeded attempts may be accepted.
- Apply exact-success resolver and evaluator ready/block preparation without evaluator dispatch.
- Emit canonical Stage 3 result/error envelopes, aggregate unit snapshot and exit code contract.
- Separate valid behavior/binding invalidation from accepted-evidence integrity failure; the latter returns no-mutation `command_error`.

Acceptance: independent reader failure does not stop other readers; no simultaneous duplicate unit; every spawn path respects the frozen run-wide ceiling; success survives restart; accepted success always resolves through both anchors; crash before result creates recovery-only unknown without fake result, valid terminal result is finalized exactly, and crash after attempt record exact-replays finalization; corrupt accepted evidence cannot be laundered into pending; v1 `status` leaves the complete run tree unchanged; public output/exit code matches the frozen contract.

Suggested commit after separate approval: `feat(skill-evals): persist CLI reader attempts`

### S3-CP3 — resume and explicit retry

- Reconcile stale `running` through exact active-attempt evidence; preserve valid terminal result status, use recovery-only `outcome_unknown` only when no result/record exists, and integrity-block invalid/mismatched evidence.
- Implement persisted operational-condition latch, read-only reporting and preflight recheck/clear lifecycle before new dispatch.
- Implement `resume` for ready pending readers only.
- Implement explicit multi-unit `retry` for exact `failed` units with the same contiguous run-wide ordinal/max-attempt gate used by every spawn.
- Validate the entire retry selection before any state mutation or dispatch.
- Reevaluate downstream evaluator descriptors after reader retry success; exact replay crash window without duplicate dispatch.

Acceptance: exact success never reruns; `outcome_unknown` never redispatches; malformed terminal output consumes one attempt; explicit retry consumes one next attempt; over-limit retry dispatches `0`; operational-preflight `command_error` always reports dispatch count exactly `0`.

Suggested commit after separate approval: `feat(skill-evals): resume and retry CLI eval units`

### S3-CP4 — impact and patch-check

- Finalize exact impact comparison and downstream closure.
- Implement explicit `patch-check` mixed-revision mode.
- Validate the whole patch-check selection/closure against the frozen projected-status/budget matrix before mutation and persist the same-revision mixed-mode latch; only next successful `prepare --run` resets it.
- Prove provenance-only changes preserve success; behavior/dependency changes invalidate exact closure.
- Preserve old attempts/history without relabeling untouched old-revision results.

Acceptance: case-local change invalidates reader + its evaluator only; evaluator-only rubric/schema change preserves readers; shared model-visible skill change affects every reader receiving it; one invalid/non-eligible/over-budget patch-check member applies no subset; failed/unknown/running/integrity-blocked units cannot use patch-check as retry/recovery; patch-check never reports complete exact-current state and mixed mode survives every same-revision command.

Suggested commit after separate approval: `feat(skill-evals): rerun affected CLI eval units`

### S3-CP5 — cumulative integration and review

- Run full deterministic matrix and v1 compatibility suite.
- Reconcile `progress.md` with exact counts/evidence/authority.
- Review cumulative branch for contract, scope, path safety, state transitions, evaluator zero-dispatch and stale contradictory claims.

Acceptance: all required checks pass; formal cumulative review `0 Critical / 0 Required`; no live/model/evaluator call; no delivery action without separate owner grant.

Suggested commit after separate approval: `docs(agent-skills): record CLI reuse checkpoint`

## Required deterministic regression matrix

### Producer anchor and compiler seam

- Different random `workspace_id`, absolute root or HEAD-only provenance; same semantic reader bytes/options → state reader + impact resolver + compiler accepts old success and produces equal evaluator semantic projection without changing accepted observation path, hash or bytes.
- Two otherwise equivalent valid workspaces flip opaque `variant_mapping` A/B while preserving semantic candidate/baseline payloads → semantic unit IDs, producer/current fingerprints, dependency membership and reuse decision remain equal; accepted observation bytes remain untouched.
- Mutable current unit fingerprint is changed to match current reader while old producing descriptor differs → reject reuse before evaluator materialization and preserve byte-for-byte snapshots of canonical run/unit/attempt state.
- A valid attempt/result path from another producer revision is cross-wired against the accepted reference's exact attempt/producer-revision relationship → reject before evaluator materialization and state mutation even if observation, locator and fingerprint are individually valid.
- Attempt record/worker `ExecutionResult` unit, attempt, producer revision, terminal status or output-nullability mismatch → reject before evaluator materialization and state mutation.
- Missing/duplicate producing reader descriptor or invalid producing plan → reject before evaluator materialization and state mutation.
- Output path escape, symlink/non-regular file, wrong bytes/hash or path outside exact attempt output directory → reject before evaluator materialization and state mutation.
- A fully valid accepted graph with only current behavior/dependency binding changed becomes `pending` invalidated; the control proves old history remains immutable. Corrupt/missing/substituted accepted record/result/output/producing plan instead returns `command_error` with state/prepared inventory unchanged and never becomes pending.
- Observation has no `unit_id`/`source_role` but valid relationship/binding/semantic fields/artifact/derived locator → accept.
- Wrong semantic role membership, skill/suite/case, artifact type or derived producer locator → reject before evaluator materialization and state mutation.
- Positive and forbidden provenance cases must traverse state reader → impact resolver → compiler. Pure compiler fixtures supplement but do not replace them. Each forbidden case snapshots canonical state and evaluator prepared-target inventory before/after, proving no mutation or materialization.

### State, execution and recovery

- Exact Stage 2 `cli_run` v1 + revision-1 plan validate before upgrade; v1 unknown/missing/mismatched fields reject without state bootstrap.
- Read-only `status` on canonical v1 derives the exact zero-attempt snapshot in memory, returns all change/dispatch arrays empty, and leaves `run.json`, `units/` plus the whole run tree byte-for-byte unchanged. Zero-unit and reader/evaluator controls assert the ordinary derived status/count rules.
- New Stage 2 revision-1 run publishes a complete zero-attempt unit bootstrap before atomically replacing `run.json` with exact Stage 3 v2.
- Crash before unit-bootstrap publication leaves v1 authoritative; crash after complete bootstrap but before marker replacement exact-replays bootstrap; crash after replacement reads v2 idempotently. Partial/mismatched bootstrap, invalid v2 or orphan temp cannot become the publication marker and yields dispatch `0`.
- Same-scope `prepare --run` creates exactly next revision; scope change refuses.
- Exact successes survive restart and dispatch count stays `0` for them.
- One failed reader does not stop independent readers; dependents block without attempt.
- No two active executions share one `unit_id`; completion order does not change final sets.
- Leftover `running` with neither attempt record nor worker result, or timeout/cancel/interruption after spawn with lost outcome certainty → recovery-only/worker-backed `outcome_unknown`; resume/retry dispatch `0` for that consumed attempt. A valid terminal result found on restart retains its exact status instead.
- Running unit always persists complete active attempt identity/ordinal/producer revision and deterministic paths before worker invocation.
- Restart with valid attempt record finishes unit state idempotently; restart with only valid terminal worker result publishes a matching record and preserves exact result status; restart with neither publishes recovery-only `outcome_unknown`; present invalid/mismatched result/record produces integrity block with no new ordinal/dispatch.
- A worker result appearing after recovery-only unknown publication causes integrity block; it never upgrades/replaces the recovery record or becomes accepted success.
- `confirmed_not_started`/terminal failure requires explicit retry; next ordinal contiguous; duplicate/skipped/over-limit rejected.
- With `max_attempts = 2`, revision-1 attempt 1 success plus revision-2 invalidation attempt 2 success exhausts that reader; revision 3 may publish and preserve history but derives `blocked / attempt_budget_exhausted`, `run`/`resume` dispatch `0`, settled execution exits `1`, and only a new run permits another attempt.
- The same run-wide gate covers initial/invalidated `run`, `resume`, explicit `retry` and patch-check scheduling; recovery-only unknown consumes its ordinal. No fingerprint/revision transition resets the count.
- `succeeded` attempt record requires non-null path/hash; `failed | outcome_unknown` requires `null/null`; every half-null or terminal-status mismatch rejects while the valid unsuccessful attempt still consumes its ordinal.
- Crash after evaluator materializer publish but before state persistence → resume exact-replays identical bytes once and creates no evaluator dispatch.
- A recognized preflight failure with ready pending readers persists `paused / operational_condition` before any spawn; its `command_error.dispatch_counts` is exactly `{ reader: 0, evaluator: 0, total: 0 }`. `status` preserves the latch, `prepare --run` carries it into the new revision while resetting coverage mode only, a still-failing execution command retains it with dispatch `0`, and the first passing execution command clears it before deriving `prepared`/other ordinary status and dispatching. A failure first observed after child creation is recorded only as the allocated attempt's terminal `failed`/`outcome_unknown`, never as an operational-preflight latch.

### Impact and patch-check

- Case-local reader input change invalidates exact reader + downstream evaluator only.
- Evaluator rubric/schema/semantic dependency result change invalidates evaluator only.
- Shared `SKILL.md` input change invalidates every reader whose projection includes it.
- Provenance-only workspace/ref/root/timestamp change preserves exact reuse.
- Explicit patch-check closure is deterministic; untouched old-revision success remains historical and run remains partial/mixed.
- Patch-check projected-status matrix: ready pending reader within budget and dependency-ready/deferred evaluator closure are accepted; exact-current success, failed, unknown, running, integrity block, unsatisfied external dependency and any required over-budget spawn reject the whole command before mode/state/materialization/dispatch. Include a multi-selection control proving one ineligible unit applies none of the eligible subset.
- Successful patch-check atomically publishes mixed mode as its standalone first mutation before unit mutation/dispatch; crash immediately after leaves conservative mixed state. Same-revision `status`/`run`/`resume`/`retry` never clear it; crash around next `prepare --run` publication leaves exact old-mixed or new-revision-exact-current marker according to `run.json`-last.

### Unit/dependency/public CLI contract

- Reader fingerprint is always a hash with bindings `[]`; dependency-waiting evaluator uses fingerprint/bindings `null/null`; ready evaluator finalizes both together.
- Evaluator dependency bindings are lexical by `source_role`, exact-member arrays of `{ source_role, unit_id, producer_behavior_fingerprint, structured_output_sha256 }`; changing attempt/revision/path alone does not change equality after provenance revalidation.
- Dependency-not-ready evaluator remains persisted pending and appears derived `blocked / dependency_not_ready`; only integrity failure persists unit `blocked / integrity_failure`.
- Run status priority and reason matrix covers independent runnable work, active attempts, retry-required failure, run-wide attempt-budget exhaustion, unknown quarantine, evaluator-dispatch-disabled pause, integrity block and true completion.
- Each Stage 3 command emits the exact canonical result or error shape; arrays/order/count partition, dispatch counts and exit `0/1/2/3` are asserted. Reader-complete/evaluator-disabled returns exit `0` with `paused / evaluator_dispatch_disabled`, not false `completed`.
- Multi-unit `retry` and `patch-check` derive startup recovery/impact in memory, then validate the complete duplicate-free selection and closure before preflight/persistence. One invalid/unknown/non-eligible/over-limit member yields one `command_error`, dispatch `0`, and byte-for-byte unchanged run/unit/attempt/prepared inventory—including unrelated projected recovery state; no valid subset is applied.

## Verification strategy

Minimum commands after relevant files exist/change:

```text
node --check .agents/scripts/run-skill-eval-cli.mjs
node --check .agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-execution-plan-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-evaluator-proposal-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-run-state-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-impact-v1.mjs
node --check .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/validate-skill.mjs
git diff --check
```

Also inspect added lines for conflict markers and secret-like material. Run focused tests after each checkpoint and cumulative tests at S3-CP5. Use fake child processes and isolated temp run roots; deterministic tests must not invoke installed `codex`, network or a model. Existing Ubuntu focused CLI suite is the remote portability gate after separately authorized push/PR; local passing tests do not authorize that action.

## Review và delivery gates

- Formal review examines exact persisted schemas, unknown-field rejection, canonical serialization, write ordering, immutable attempts, path containment, state/compiler purity boundary, fingerprint provenance, dependency membership, zero evaluator dispatch and failure/recovery truthfulness.
- A passing checkpoint does not authorize its commit. Commit, push, PR, CI watch/fix and merge are separate owner gates.
- Do not amend/squash historical Stage 2 commits to make S3-CP0 appear earlier. Git history should show the discovered seam correction on the Stage 3 branch.
- No source implementation starts from this plan-only task. The next action requires explicit owner authorization.

## Stop conditions

Stop before further implementation when:

- master/detail/owner brief/progress conflict materially;
- accepted output cannot be bound to one exact attempt and producing descriptor without changing observation semantics;
- current serialized reader descriptor is insufficient as immutable producer SSOT;
- cross-revision success requires current workspace locator equality;
- safe function requires packager rewrite, import/edit of an existing App Server/CP9/v2 module, evaluator dispatch, report/human semantics or generic hardening; Stage 3-owned `cli_run`/`cli_execution_plan` v2 artifacts are not such an import;
- one-writer state cannot preserve no-duplicate attempts/restart truth without multi-writer/CAS/lease design;
- required regression cannot exercise state reader + impact resolver + compiler through observable behavior;
- implementation would modify an unexpected source/CI/suite/skill file.

Report exact evidence, affected contract and smallest options/trade-offs; do not choose silently.

## Completion criteria

Stage 3 is ready for owner delivery review only when S3-CP0–S3-CP5 all pass their own gates; cumulative review is `0 Critical / 0 Required`; current docs contain no stale branch/authority/status claims; deterministic suites pass with exact counts recorded; evaluator/model/live calls remain `0`; and the diff contains no Stage 4, packager, observation-schema or generic-hardening expansion. Stage 3-owned `cli_run` v2 and `cli_execution_plan` v2 defined by this plan are explicitly allowed; importing or editing existing App Server/CP9/v2 modules—including `run-store-v2.mjs`—remains forbidden.
