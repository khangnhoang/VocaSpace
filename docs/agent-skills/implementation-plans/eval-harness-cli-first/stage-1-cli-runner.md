# Stage 1 implementation plan — runnable bounded-parallel Codex CLI runner

## Trạng thái, baseline và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Stage: `Stage 1 — CLI runner`.
- Branch: `feat/agent-skill-eval-cli-runner`.
- Branch base: merged Stage 0 commit `e195569479ee49dd9592a93573c49ecad85cd9e6` từ PR #77.
- Pre-implementation cleanup: commit `0d30904` chỉ loại ba suite CP8A/CP8B/CP9 cũ khỏi CI mặc định; source test vẫn chạy thủ công được.
- Plan status: `reviewed / implementation_pending` sau terminal self-review `0 Critical / 0 Required`.
- Runner implementation status: `not_started`; cleanup commit không phải runner implementation.
- Correction delivery authority: owner đã chọn policy-in-stdin contract và yêu cầu sửa, self-review, commit, normal-push docs correction này. Grant đó được consumed bởi correction delivery và không tự cấp runner implementation, live model/evaluator call, PR creation, CI-fix, merge hoặc branch deletion.

Tài liệu này là transferable implementation contract cho riêng Stage 1. Implementing session phải đọc tài liệu này cùng [master plan](./plan.md), [owner review brief](./owner-review-brief.md), [program plan](../../plan.md), [progress](../../progress.md), `AGENTS.md`, `docs/agent-loops.md` và các skill được route bởi diff thực tế. Nếu material contract conflict, dừng và báo owner; không tự trung bình hóa hoặc hardening.

## Mục tiêu và điều kiện thành công

Stage 1 phải chứng minh topology executor mục tiêu trên một workspace v1 đã được `run-skill-evals.mjs prepare` tạo sẵn:

1. một selected reader unit được chuyển thành bounded invocation package và chạy bằng một fresh `codex exec --ephemeral` process;
2. nhiều independent selected reader units chạy đồng thời dưới bounded worker pool, default concurrency `4`;
3. một unit terminal failure, invalid structured output hoặc timeout không hủy các independent units khác;
4. harness chỉ supply full selected skill bundle và đúng case package của unit đó qua stdin/cwd contract, không supply evaluator rubric hoặc case package khác;
5. output của từng attempt nằm trong directory riêng, được validate và bind lại đúng semantic `candidate`/`baseline` unit;
6. deterministic tests gọi `0` real model/provider/evaluator/helper;
7. sequential vertical slice và parallel proof nằm trong cùng branch/PR; sequential pass một mình không đóng Stage 1.

Stage 1 không giải quyết prepare-all barrier, durable state, exact reuse, resume, retry, dependency invalidation, evaluator hoặc report. Các outcome đó thuộc Stage 2–4 theo master plan.

## Repository facts đã xác nhận

- `.agents/scripts/run-skill-evals.mjs` hiện sở hữu `validate`, `prepare --isolation synthetic` và `report`; nó không gọi model.
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` xuất `resolveWorkspace`, `readArtifactBytes`, `resolveWorkspacePath` và `listWorkspaceFiles`; workspace root hiện là temp `vocaspace-agent-skill-evals/v1/<workspace_id>`.
- Workspace manifest map opaque `variant_id` `A/B` sang semantic `candidate`/`baseline` qua `variant_mapping`. `A/B` không được dùng trong logical unit identity.
- Mỗi variant hiện có `bundle/`, `bundle-manifest.json` và `cases/<suite>/<case_id>/{prompt.txt,context/,execution-context-manifest.json,...}`. Bundle nằm ngoài case directory, nên runner phải tạo một bounded per-unit invocation view; đặt CLI cwd ở variant root sẽ làm lộ các case khác.
- `artifact-schema-v1.mjs` đã có `canonicalJson`, `sha256Bytes`, `sha256Canonical`, `parseStrictJson`, `assertWorkspaceManifest`, `assertBundleManifest`, `assertExecutionContextManifest` và `assertObservation`.
- Current v1 report chỉ inventory-check `executor/` và known `evaluator/` evidence paths. Stage 1 execution output phải nằm ngoài hai ownership roots đó và không được gọi v1 report như thể report đã biết model được runner mới thực thi.
- Local executable research ngày `2026-08-30`: `codex-cli 0.151.0-alpha.7.2`; `codex exec --help` expose `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `--skip-git-repo-check`, `--model`, `--sandbox`, `--cd`, `--output-schema`, `--output-last-message`, `--json`, `--strict-config` và `-c`.
- Local non-model probes xác nhận executable và public `codex exec` flags có mặt. [Official Codex configuration reference](https://developers.openai.com/codex/config-reference/) xác nhận `model_reasoning_effort` là config key hợp lệ và `medium` là một giá trị được hỗ trợ. `--version`/`--help` không chứng minh effective config, model availability, authentication hoặc provider/network readiness; installed version/path chỉ là preflight observation, không phải pinned product contract.
- CI trước cleanup chạy generic harness khoảng `4s`, CP8A khoảng `20s`, CP8B khoảng `4s`; CP9 giữ job gần phần lớn tổng `10m23s`. Commit `0d30904` bỏ đúng ba specialized steps, giữ generic harness và source tests.

## Reconciliation corrections đối với master plan

Ba điểm dưới đây reconcile repository evidence với master contract mà không đổi CLI-only architecture:

1. Stage 1 là consumer trực tiếp của `synthetic-workspace-v1.mjs` vì `execute-prepared --workspace` không thể resolve/read bounded workspace bằng contract hiện có nếu chờ Stage 2. Stage 1 chỉ dùng read helpers; không sửa packager hoặc prepare command.
2. Stage 1 phải thêm deterministic CLI-runner suite vào `.github/workflows/ci.yml`. Chờ Stage 4 mới wire CI sẽ để Stage 1–3 merge mà runner mới không được remote-check. Stage 4 chỉ sở hữu CI extension cho evaluator/report/pilot docs.
3. Raw v1 bundle/context manifests không thể vừa model-visible vừa bị loại khỏi provenance-independent fingerprint vì bytes của chúng chứa `workspace_id`/opaque `variant_id`. Owner chọn Option 1: validate raw manifests source-side, copy/fingerprint exact payload bytes và embed exact canonical requested execution policy trong deterministic blind stdin.

Master plan được chỉnh hai ownership rows và exact model-input/fingerprint boundary trong docs commits của plan này. Nếu implementation discovery đòi sửa packager, v1 report semantics hoặc command surface, đó không còn là correction nhỏ: dừng theo design-change protocol.

## Phạm vi

### Trong phạm vi

- New CLI entrypoint `run-skill-eval-cli.mjs` với duy nhất command Stage 1 `execute-prepared` và `--help`.
- Parse exact workspace/unit/concurrency arguments đã freeze.
- Resolve và validate selected v1 workspace/package bằng existing v1 helpers/validators.
- Derive stable semantic reader logical key và `unit_id` theo master plan.
- Materialize bounded per-unit invocation view cho selected reader case.
- Compile deterministic stdin, static reader response JSON Schema và `behavior_projection`.
- Fresh Codex CLI process invocation, timeout/result normalization và attempt-local files.
- Bounded worker pool, input-order-independent scheduling nhưng deterministic result ordering.
- Focused Node tests với real child processes chạy fake CLI fixture.
- Add focused deterministic Stage 1 suite vào CI.
- Reconcile current progress after implementation/review.

### Ngoài phạm vi

- Sửa `run-skill-evals.mjs prepare`, suite schema hoặc `synthetic-workspace-v1.mjs` packager.
- App Server, CP8/CP9 runtime modules, native Codex subagent hoặc multi-backend abstraction.
- Durable run/store/revision, accepted-result reuse, resume, retry, patch-check hoặc downstream closure.
- Evaluator scheduling, semantic grading, human acceptance hoặc v1 report bridge.
- Arbitrary prompt execution.
- Automatic retry; attempt ordinal trong Stage 1 luôn `1`.
- Provider-envelope/call-certainty proof, signed evidence, credential/network/tool-isolation proof hoặc production-security certification.
- Full sequential batch, full parallel migration hoặc benchmark/calibration run.
- Live call ngoài separately authorized `1 + 2` gate.

## Expected files và files không được sửa

### Expected implementation files

| Path | Ownership |
| --- | --- |
| `.agents/scripts/run-skill-eval-cli.mjs` | CLI parser, `execute-prepared` orchestration, command summary và exit codes |
| `.agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs` | identity helper, selected-workspace adapter, bounded package materialization, CLI preflight/invocation, result normalization và worker pool |
| `.agents/scripts/run-skill-eval-cli.test.mjs` | deterministic unit/integration-style child-process tests, including sequential and parallel proof |
| `.github/workflows/ci.yml` | one focused `node --test .agents/scripts/run-skill-eval-cli.test.mjs` step; không restore CP8A/CP8B/CP9 steps |
| `docs/agent-skills/progress.md` | exact Stage 1 checkpoint/review evidence |

`artifact-schema-v1.mjs` và `synthetic-workspace-v1.mjs` là direct imports, không expected edits. Nếu thiếu một pure exported helper thật sự block implementation, báo owner và update/re-review plan trước khi export hoặc move code.

### Không được sửa trong Stage 1

- `.agents/scripts/run-skill-evals.mjs` và `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs`.
- `harness-schema-v2.mjs`, `orchestrator-v2.mjs`, `run-store-v2.mjs`, `readiness-v2.mjs`, `review-v2.mjs`, `cp9-*` và App Server modules.
- Any repo-local skill, eval suite semantic content, product app, Supabase/database, auth, payment hoặc deployment config.
- Master command spelling/meaning, except an owner-confirmed design-change correction.

## Frozen command contract

```text
node .agents/scripts/run-skill-eval-cli.mjs execute-prepared \
  --workspace <ws-[a-f0-9]{32}> \
  --unit <candidate|baseline>:<regression|routing|fresh-reader>:<case_id> \
  [--unit <...>] \
  [--concurrency <positive-integer>]
```

Rules:

- `--workspace` xuất hiện đúng một lần.
- `--unit` xuất hiện ít nhất một lần; selector trùng bị từ chối trước preflight/dispatch.
- Role phải tồn tại trong `workspace_manifest.source_roles`; candidate-only workspace từ chối `baseline:*`.
- Suite/case phải tồn tại trong prepared suite definition và exact selected case path.
- `--concurrency` xuất hiện tối đa một lần; default `4`; effective value là `min(requested_or_4, unique_selected_unit_count)`.
- Unknown/missing/duplicated flags hoặc non-positive/non-safe integer trả usage exit `2`, model dispatch `0`.
- Stage 1 không nhận `--run`, `--retry`, `--model`, `--sandbox`, arbitrary prompt hoặc output path từ caller.

`--help` phải mô tả rõ: consumes an already prepared v1 workspace; reader-only; no durable reuse/retry/report; default concurrency `4`; real execution may consume model quota.

## Logical identity và Stage 1 PreparedUnit

Reader logical key và ID dùng exact master contract:

```text
logical_unit_key = {
  schema_version: 1,
  kind: "reader",
  skill,
  source_role: "candidate" | "baseline",
  suite,
  case_id
}

unit_id = `reader-${sha256Canonical(logical_unit_key)}`
```

Không hash `workspace_id`, `variant_id`, ref/commit, absolute path, attempt, prompt hash hoặc execution-context hash vào `unit_id`.

Stage 1 materializes one internal `PreparedUnit` per valid selector:

```text
PreparedUnit {
  schema_version: 1,
  unit_id,
  logical_unit_key,
  kind: "reader",
  dependencies: [],
  invocation: {
    stdin_path,
    output_schema_path,
    cwd,
    cli_options
  },
  behavior_projection,
  source_locator
}
```

`source_locator` holds `workspace_id`, `variant_id`, workspace path, exact prepared source paths and raw source-manifest identities/hashes. It is navigation/provenance only. `behavior_projection` follows master version `1` and includes exact stdin hash, sorted bounded model-visible payload path/hash list, output-schema hash and normalized CLI behavior options. Raw `bundle-manifest.json` and `execution-context-manifest.json` bytes are never model-visible and never enter this projection.

## Bounded invocation package

Each command creates random locator `execution_id = exec-<32 lowercase hex>` only to prevent overwrite between Stage 1 diagnostic invocations. It does not enter logical identity or behavior projection.

```text
<workspace>/cli-executions/<execution_id>/
  units/<unit_id>/attempts/1/
    input/
      bundle/<exact prepared bundle files>
      case/prompt.txt
      case/context/<selected context files>
      stdin.txt
      reader-output-schema.json
    output/
      model-events.jsonl
      model-stderr.txt
      model-last-message.json
      accepted-observation.json          # only on valid success
    result.json
  summary.json
```

Package rules:

- Before materialization, read and validate the canonical source `bundle-manifest.json` and selected `execution-context-manifest.json`, their identities/internal hashes, the selected suite/case relationship and every referenced bundle/prompt/context byte. `canonicalJson(context.requested_execution_policy)` must equal `canonicalJson(selectedCase.executor_input.execution_policy)`; any mismatch fails before spawn with dispatch count `0`.
- Raw source manifests remain validate-only provenance under the prepared workspace and `source_locator`; do not copy either manifest into attempt `input/` or otherwise expose their `workspace_id`, opaque `variant_id`, aggregate hash or `execution_context_hash` to the reader.
- Copy exact validated bundle, prompt and selected context bytes with exclusive create; never mutate prepared `executor/` bytes.
- Include full selected skill bundle because the current eval contract evaluates the full skill.
- Include only selected case prompt/context payload. Do not include other case roots, evaluator suite definitions, human evaluation files, previous observations or report.
- `cwd` is exact attempt `input/`, outside the repository and under the prepared temp workspace.
- `stdin.txt` is deterministic harness-owned text. It identifies only the selected skill/suite/case, instructs the fresh reader to use only supplied package files, read `bundle/SKILL.md`, relevant bundled resources plus `case/prompt.txt` and `case/context/**`, applies the exact canonical requested execution policy, and returns only the required JSON object. It must not embed evaluator rubric, migration verdict, semantic source role or opaque variant identity.
- Construct stdin from the exact template below. Replace only the four angle-bracket placeholders with their validated values; `<canonical-policy-json>` is exact `canonicalJson(context.requested_execution_policy)` on one line. Encode UTF-8 with exactly one final LF; do not pretty-print, reorder, summarize or silently repair policy.

```text
You are the fresh reader for one prepared agent-skill evaluation case.
Use only the supplied input package.
Skill: <skill>
Suite: <suite>
Case: <case_id>
Requested execution policy (canonical JSON):
<canonical-policy-json>
Read bundle/SKILL.md and only the bundled resources it directs you to when relevant.
Read case/prompt.txt and the selected files under case/context/ when that directory is present.
Do not infer or state any hidden variant identity or mapping.
Complete the task in case/prompt.txt under the requested execution policy.
Return only the JSON object required by reader-output-schema.json.
```

Because policy bytes are inside stdin, a policy-only change changes `stdin_sha256` and the behavior fingerprint without adding a model-facing policy artifact.
- For blind input, harness-generated framing, relative paths and metadata must not encode or reveal `candidate`/`baseline`, opaque `A/B` identity or `variant_mapping`. This is an identity-flow rule, not a substring ban over exact copied bundle/prompt/context content; payload content is neither scanned nor rewritten merely because those literals occur naturally.
- Input package bytes are immutable for that attempt. Existing execution/attempt destination causes fail-loud; no overwrite or implicit retry.
- `cli-executions/` remains outside v1 prepared inventory and evaluator evidence ownership. Stage 1 does not write canonical `evaluator/observations/...` paths or call `report`.
- Đây là bounded harness-supplied input contract, không phải claim rằng CLI enforces filesystem-read isolation. `read-only` sandbox, prompt instruction hoặc `observed_access` self-report không chứng minh model không thể thấy path ngoài cwd.

## Reader output contract

The model-facing static JSON Schema permits exactly:

```text
{
  raw_response: string,
  observed_access: {
    basis: non-empty string,
    credentials: "observed" | "not_observed" | "unknown",
    filesystem: "observed" | "not_observed" | "unknown",
    model_runtime: "observed" | "not_observed" | "unknown",
    mutation: "observed" | "not_observed" | "unknown",
    network: "observed" | "not_observed" | "unknown",
    process: "observed" | "not_observed" | "unknown",
    remote: "observed" | "not_observed" | "unknown",
    tools: "observed" | "not_observed" | "unknown"
  }
}
```

All keys are required and every object uses `additionalProperties: false`. The schema does not ask the model to repeat workspace/unit hashes.

On child exit `0`, runner reads `model-last-message.json`, parses strict JSON, constructs the full v1 observation deterministically from prepared identity plus returned `raw_response/observed_access`, then calls existing `assertObservation`. Accepted canonical bytes are written to `accepted-observation.json`; `ExecutionResult.structured_output_path` and SHA refer to this accepted file. Stage 1 does not construct `skill_resource_access` because exact read-resource evidence/report ownership is not part of this stage.

## Exact production CLI invocation

Production adapter uses `spawn` with `shell: false`, stdin pipe and this normalized argv order:

```text
codex exec
  --ignore-user-config
  --strict-config
  -c model_reasoning_effort="medium"
  --model gpt-5.6-sol
  --sandbox read-only
  --ephemeral
  --ignore-rules
  --skip-git-repo-check
  --color never
  --cd <attempt-input-directory>
  --output-schema <reader-output-schema.json>
  --output-last-message <model-last-message.json>
  --json
  -
```

`stdin.txt` bytes are written to child stdin, then stdin is closed. No shell composition, resume/fork/session persistence, approval bypass, `danger-full-access`, additional writable directory or arbitrary config is allowed.

Frozen Stage 1 behavior options are:

```text
{
  model: "gpt-5.6-sol",
  reasoning_effort: "medium",
  sandbox: "read-only",
  ephemeral: true,
  ignore_user_config: true,
  ignore_rules: true
}
```

Configured process timeout is `120000ms` per unit. It is process policy, not behavioral fingerprint. Tests inject shorter timeouts; Stage 1 command does not add an unplanned timeout flag.

Before creating attempts, one command-wide non-model preflight runs `codex --version` and `codex exec --help`. It verifies executable resolution and only the required public flag names/sandbox literal advertised by help. `model_reasoning_effort` is frozen from the official config reference above; preflight must not claim to prove effective config, selected-model availability, authentication or provider/network readiness. Preflight failure returns operational exit `3`, produces no attempt directory and launches no reader. Runtime executable resolution defaults to PATH token `codex`; internal dependency injection may supply `process.execPath` plus a fake-script prefix in tests, but no test-only public CLI flag/environment contract is added.

No clean zero-model installed-CLI probe has been established for full runtime readiness. Therefore the separately authorized first real sequential reader in S1-CP5 is the runtime canary. If it cannot run, Stage 1 records or reports the truthful failure at the boundary reached and does not start the parallel gate.

## ExecutionRequest, ExecutionResult và outcome mapping

Stage 1 coordinator assigns `attempt_ordinal = 1` and `attempt_id = ${unit_id}-attempt-1` exactly once per selected unit.

```text
ExecutionRequest {
  prepared_unit,
  attempt_id,
  attempt_ordinal: 1,
  output_path
}

ExecutionResult {
  schema_version: 1,
  unit_id,
  attempt_id,
  terminal_status: "succeeded" | "failed" | "outcome_unknown",
  exit_code: integer | null,
  structured_output_path: string | null,
  structured_output_sha256: lowercase-sha256 | null,
  process_metadata: {
    spawned: boolean,
    pid: integer | null,
    started_at: ISO-8601,
    finished_at: ISO-8601,
    duration_ms: non-negative-integer,
    events_path: string,
    stderr_path: string,
    cli_version: string
  },
  failure: null | { code, message }
}
```

Outcome mapping is exact:

| Observable result | Terminal result |
| --- | --- |
| Child emits `error` before `spawn` | `failed / confirmed_not_started`, `exit_code: null` |
| Spawned child exits nonzero | `failed / terminal_process_failure`, preserve exit code/events/stderr |
| Spawned child exits zero but last-message missing, malformed or rejected by v1 observation validation | `failed / invalid_structured_output` |
| Timeout/cancel/interruption after `spawn` | `outcome_unknown / process_outcome_unknown`; terminate process best-effort, never infer model was not called |
| Valid accepted observation after exit zero | `succeeded`, failure `null`, accepted path/hash present |

Failure of one worker returns its result to the coordinator; it must not reject/cancel the pool. Only command-wide CLI preflight, invalid workspace manifest/selected package integrity or an internal coordinator invariant aborts before reader dispatch.

## Bounded worker pool contract

- Coordinator is the only scheduler; worker never schedules/retries another unit.
- At most `effective_concurrency` spawned readers are active simultaneously.
- Each selected `unit_id` is dispatched at most once in Stage 1.
- Queue order is input selector order after duplicate rejection; final summary results are sorted by the same stable selected order regardless of completion order.
- One worker failure leaves pending independent workers runnable.
- Timeout of one worker yields `outcome_unknown` only for that unit; no automatic retry.
- Pool returns only after all selected units have one terminal `ExecutionResult` unless a command-wide internal invariant fails.
- Default `4` is a scheduling cap, not four calls per batch and not a quota claim. For `N` independent units, expected waves are `ceil(N/effective_concurrency)`; Stage 2 later owns duration/rate-limit recommendation.

No shared durable store, lease, journal, retry policy or evaluator dependency scheduling is created in this module.

## CLI summary và exit codes

`summary.json` and stdout use canonical JSON with:

```text
{
  schema_version: 1,
  command: "execute-prepared",
  status: "succeeded" | "partial_failure" | "outcome_unknown",
  execution_id,
  workspace_id,
  requested_concurrency,
  effective_concurrency,
  selected_unit_ids,
  counts: { succeeded, failed, outcome_unknown },
  results
}
```

Status precedence: any `outcome_unknown` → `outcome_unknown`; else any failed → `partial_failure`; otherwise `succeeded`.

- exit `0`: all selected units succeeded;
- exit `1`: every selected unit reached a truthful terminal result, but at least one is failed/outcome_unknown;
- exit `2`: usage/selector error before preflight/dispatch;
- exit `3`: workspace/preflight/internal operational failure before a trustworthy per-unit result set exists.

## Checkpoint plan

### S1-CP1 — Command, identity, adapter và package boundary

Implement exact parser/help, v1 direct imports, semantic selector resolution, logical ID helper, selected package validation, bounded invocation layout, static output schema, deterministic stdin and behavior projection.

Acceptance:

- candidate/baseline resolves through `variant_mapping`, never opaque `A/B` identity;
- candidate-only baseline selector and duplicate/unknown selectors fail before child dispatch;
- raw source manifests and their referenced payload bytes validate before package materialization; source policy mismatch fails with dispatch count `0`;
- package contains full skill bundle plus only selected prompt/context payload, deterministic stdin and output schema; raw manifests are absent;
- evaluator rubric/other cases are absent;
- same semantic role/suite/case across different workspace IDs yields same `unit_id`;
- workspace/provenance paths remain only in `source_locator`;
- blind harness-generated input never encodes semantic role, opaque variant identity or their mapping;
- exact canonical requested execution policy is present in stdin; a policy-only change changes `stdin_sha256` and projection;
- model-visible file enumeration is lexically stable; changing only workspace/ref/absolute locator or opaque variant mapping leaves stdin/projection unchanged, while changing policy, other stdin framing bytes, a supplied payload file, output schema or normalized CLI behavior option changes the corresponding projection field.

### S1-CP2 — Sequential vertical slice

Implement non-model preflight and one `ExecutionRequest → ExecutionResult` worker. Use a real spawned fake CLI child process, not a mocked promise, to prove stdin/argv/cwd/schema/output files.

Acceptance:

- one selected unit launches exactly one child;
- exact argv order/values, stdin bytes, cwd and paths work with Windows/spaced directories;
- child exit zero plus valid model result becomes one canonical accepted v1 observation and success result;
- spawn failure, nonzero exit, invalid output and timeout map exactly;
- real Codex/model/provider calls remain `0`.

This checkpoint is diagnostic only and cannot close Stage 1.

### S1-CP3 — Bounded worker pool

Add coordinator queue with default `4`, effective cap, one dispatch per unique unit, local terminal result capture and deterministic final ordering.

Acceptance:

- no duplicate active `unit_id`;
- active count never exceeds cap;
- at least two fake child processes demonstrably overlap when cap ≥ `2`;
- a failed unit does not cancel pending/active independent units;
- no automatic retry.

### S1-CP4 — Parallel integration, CI và final deterministic review

Complete integration-style fake CLI topology suite, add its focused CI step, run affected-only verification, update progress and perform cumulative branch review.

Acceptance:

- four-unit/cap-two test proves two scheduling waves, real process overlap, max active `2` and exactly one spawn per unit;
- one failure plus independent successes yields truthful summary/exit `1` and all results preserved;
- timeout unit is `outcome_unknown` while independent unit succeeds;
- completion order does not change selected/result ordering;
- focused suite is in CI; CP8A/CP8B/CP9 specialized steps stay absent;
- cumulative review reaches `0 Critical / 0 Required` before any implementation commit/push permission is consumed.

### S1-CP5 — Separately authorized actual-CLI gate

This checkpoint is not authorized by the plan or current task.

1. Run exactly one prepared reader unit sequentially at concurrency `1`.
2. Stop if it fails or is uncertain.
3. If it succeeds and remaining authority is confirmed, run exactly two different prepared reader units concurrently at concurrency `2`.
4. No evaluator, retry, full batch, sequential duplicate of the two parallel units or calibration run.

Ceiling: `3 reader / 0 evaluator / 0 retry`. Evidence must report exact unit IDs, command settings, exit/status/counts and whether overlap was observed. A fake-process parallel pass proves scheduler behavior; it does not claim actual-model CLI success. Without CP5 authority/result, Stage 1 status remains `deterministic_ready / live_canary_pending`.

## Required deterministic test matrix

Test file uses `node:test`, `node:assert/strict`, temp workspaces and a fake Codex CLI script launched through `process.execPath`; no network/model dependency.

| Area | Observable test |
| --- | --- |
| Parser | help; missing/duplicate/unknown flags; invalid workspace/unit/concurrency; duplicate selector; dispatch `0` |
| Identity | candidate/baseline mapping; variant flip; random workspace ID stability; no provenance/path in ID |
| Source validation | canonical raw manifests and every referenced payload byte pass; manifest/hash/path/policy-to-suite mismatch fails before spawn with dispatch `0` |
| Behavior projection | stable lexical file order; provenance/opaque-mapping-only change ignored; policy-only, other stdin, payload file, schema and CLI behavior changes reflected exactly |
| Package | exact bundle/prompt/context bytes; raw manifests and other case/rubric absent; spaced paths; exclusive destination |
| Policy in stdin | exact `canonicalJson(requested_execution_policy)` under frozen framing and one final LF; equivalent workspace gives identical stdin; policy-only change changes `stdin_sha256` |
| Blind input | harness-generated stdin/path/metadata exposes no semantic role, opaque variant identity or mapping; test does not substring-scan or rewrite copied payload content |
| Preflight | version/help success; missing required flag or executable failure produces dispatch `0` |
| Sequential success | exact argv/stdin/cwd/schema; one process; accepted observation path/hash; exit `0` |
| Spawn failure | no `spawn` event → `confirmed_not_started`; independent unit still succeeds in pool test |
| Terminal failure | nonzero child exit → `terminal_process_failure`, preserved exit/stderr, no retry |
| Structured output | missing/malformed/extra-field/invalid observed-access output → `invalid_structured_output` |
| Timeout | spawned slow child → `outcome_unknown`; independent unit completes; no redispatch |
| Parallel | four units/cap two overlap; max active two; exactly four child spawns; two waves |
| Isolation | one failing unit does not cancel three independent units |
| Determinism | different completion order yields same selected/result ordering and counts |
| CLI black-box | in-process exported `main(args,deps)` or spawned entrypoint with injected internal dependencies returns exact stdout/exit without a test-only public flag |

The test file requires the repository Vietnamese test-plan header. It must state `not run` until actually executed and be updated with the real focused result before checkpoint completion.

## Verification strategy

During implementation, run affected-only checks after each checkpoint:

```text
node --check .agents/scripts/run-skill-eval-cli.mjs
node --check .agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs
node --check .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-eval-cli.test.mjs
node .agents/scripts/run-skill-eval-cli.mjs --help
node .agents/scripts/validate-skill.mjs
git diff --check
```

Do not run CP8A/CP8B/CP9 suites or the full application test suite by default. Broaden only if the actual diff crosses their ownership or focused evidence reveals a shared regression. No real `execute-prepared` call is part of deterministic verification.

CI adds exactly:

```yaml
- name: Run agent skill CLI eval runner tests
  run: node --test .agents/scripts/run-skill-eval-cli.test.mjs
```

## Review, checkpoint và delivery gates

Each completed implementation checkpoint receives the universal minimum review; S1-CP2 and S1-CP4 are formal review boundaries. Review must inspect:

- exact master/Stage 1 contract match;
- one-process-per-unit and bounded overlap;
- no hidden retry/store/evaluator/backend abstraction;
- package leakage to other cases/rubric;
- failure isolation and timeout certainty labeling;
- real call count `0` in deterministic tests;
- CI step exactness and continued absence of specialized CP8/CP9 steps;
- secrets/debug/conflict markers, unrelated formatting, EOL/encoding and staged/unstaged/untracked scope.

Implementation commit/push/PR/merge are permission gates, not implied by review. Suggested coherent implementation commit after owner approval:

```text
feat(agent-skills): add bounded parallel CLI eval runner
```

The already-created cleanup commit `0d30904` remains separate and must not be squashed into implementation merely for aesthetics.

## Progress updates

After each checkpoint, update only the CLI-first current-status block in `docs/agent-skills/progress.md` with actual state and commands. Distinguish:

- `planned`;
- `implemented`;
- `deterministic checks passed`;
- `live_canary_pending` or exact live result;
- `committed`;
- `pushed`;
- `PR open`;
- `merged`.

Never label Stage 1 complete from sequential-only evidence, fake-process-only evidence as actual CLI/model success, or a pushed branch as merged.

## Stop conditions và design-change protocol

Stop before implementation continues and report owner when any of these occurs:

- Codex CLI no longer supports a required flag or cannot read prompt from stdin/write structured output non-interactively;
- selected v1 package cannot be consumed without changing `run-skill-evals prepare` or exposing other cases/evaluator rubric;
- correct execution requires a new public command/flag, generic backend interface, durable store or Stage 2/3 behavior;
- v1 observation cannot represent accepted reader output without changing report/attribution semantics;
- timeout/cancel outcome cannot be conservatively classified after spawn;
- deterministic fake CLI cannot exercise real process overlap on supported CI platforms;
- implementation would import App Server/v2 dependency graph instead of porting only the named observable concurrency invariant;
- required test/CI evidence fails outside a bounded Stage 1 cause.

Procedure:

1. gather exact local code/help/test evidence;
2. describe conflict and smallest options/trade-offs to owner;
3. update master + Stage 1 plan only after owner confirmation if material contract changes;
4. self-review updated plan;
5. resume implementation only under explicit current authority.

Do not respond by adding attestation, authority, security proof, generalized retry taxonomy, multi-backend abstraction or other unsupported hardening.

## Completion criteria

Stage 1 deterministic implementation is ready for owner review only when:

- S1-CP1–S1-CP4 acceptance criteria pass;
- focused tests and CI wiring pass with real model calls `0`;
- sequential and bounded-parallel fake-process proofs both pass;
- one local unit failure/timeout preserves independent unit completion;
- only expected files changed;
- progress is truthful;
- cumulative review is `0 Critical / 0 Required`.

Actual-CLI Stage 1 completion additionally requires separately authorized S1-CP5 `1 + 2` canary success. Until then, the only truthful terminal status is `deterministic_ready / live_canary_pending`.
