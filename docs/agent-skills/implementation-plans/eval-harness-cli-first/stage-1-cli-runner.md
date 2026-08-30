# Stage 1 implementation plan — runnable bounded-parallel Codex CLI runner

## Trạng thái, baseline và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Stage: `Stage 1 — CLI runner`.
- Branch: `feat/agent-skill-eval-cli-runner`.
- Branch base: merged Stage 0 commit `e195569479ee49dd9592a93573c49ecad85cd9e6` từ PR #77.
- Pre-implementation cleanup: commit `0d30904` chỉ loại ba suite CP8A/CP8B/CP9 cũ khỏi CI mặc định; source test vẫn chạy thủ công được.
- Plan status: `reviewed / input-correction implementation_pending` sau terminal correction self-review `0 Critical / 0 Required`.
- Runner implementation status: S1-CP1–S1-CP4 committed tại `49b8777`; first S1-CP5 exhausted exact `1 + 2` ceiling nhưng chỉ chứng minh transport/schema và process overlap. Semantic input acquisition failed because the reader was instructed to use filesystem reads while `tools: none`.
- Current authority chỉ gồm update/review/local-commit correction plan và current progress evidence. Grant này không cấp correction implementation, live model/evaluator call mới, push, PR creation, CI-fix, merge hoặc branch deletion.

Tài liệu này là transferable implementation contract cho riêng Stage 1. Implementing session phải đọc tài liệu này cùng [master plan](./plan.md), [owner review brief](./owner-review-brief.md), [program plan](../../plan.md), [progress](../../progress.md), `AGENTS.md`, `docs/agent-loops.md` và các skill được route bởi diff thực tế. Nếu material contract conflict, dừng và báo owner; không tự trung bình hóa hoặc hardening.

## Mục tiêu và điều kiện thành công

Stage 1 phải chứng minh topology executor mục tiêu trên một workspace v1 đã được `run-skill-evals.mjs prepare` tạo sẵn:

1. một selected reader unit được chuyển thành bounded invocation package và chạy bằng một fresh `codex exec --ephemeral` process;
2. nhiều independent selected reader units chạy đồng thời dưới bounded worker pool, default concurrency `4`;
3. một unit terminal failure, invalid structured output hoặc timeout không hủy các independent units khác;
4. harness losslessly supply full textual selected skill bundle và đúng case package của unit đó trong canonical stdin envelope; attempt-local `cwd` copies chỉ là transient diagnostics, không phải reader acquisition path; evaluator rubric và case package khác không được supply;
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
3. Raw v1 bundle/context manifests không thể vừa reader-visible vừa bị loại khỏi provenance-independent fingerprint vì bytes của chúng chứa `workspace_id`/opaque `variant_id`. Owner giữ Option 1: validate raw manifests source-side, fingerprint exact payload bytes và embed exact canonical requested execution policy trong deterministic blind stdin.
4. First S1-CP5 proved the CLI process/schema path and cap-two overlap but invalidated the file-acquisition assumption: all three readers honored `tools: none` and therefore could not execute the prompt that told them to read `bundle/SKILL.md`, `case/prompt.txt` and schema from `cwd`. Correction does not rewrite any suite policy. Stage 1 changes only its reader-input compiler to delivery mode `stdin_embedded_executor_input_v1`.

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
- Any new live call ngoài separately authorized corrected two-reader/concurrency-two gate; historical `1 + 2` authority is consumed.

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

`source_locator` holds `workspace_id`, `variant_id`, workspace path, exact prepared source paths and raw source-manifest identities/hashes. It is navigation/provenance only. `behavior_projection` follows master version `1` and includes exact stdin hash, sorted logical embedded-payload path/hash list under existing field `model_visible_files`, output-schema hash and normalized CLI behavior options. Raw `bundle-manifest.json` and `execution-context-manifest.json` bytes are never reader-visible and never enter this projection.

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
- Before `mkdirExclusive(inputPath)` or any attempt-local write, every bundle/prompt/context payload must decode as strict UTF-8 and re-encode byte-for-byte equal to the validated source, and the complete stdin envelope bytes must be built successfully. Invalid UTF-8 or round-trip mismatch fails pre-materialization/pre-dispatch with operational exit `3`, no partial attempt directory/result and reader dispatch count `0`. Do not base64, chunk, summarize, normalize newline/BOM or silently repair content; non-text bundle support is a future material design decision.
- `stdin.txt` is exact `canonicalJson(reader_input_envelope)` under delivery mode `stdin_embedded_executor_input_v1`; `canonicalJson` supplies the only final LF. The envelope contains no absolute path, workspace/ref, raw manifest, semantic role, opaque variant identity, evaluator input or previous result.
- Construct the envelope with exactly this semantic shape. Object-key serialization follows repository `canonicalJson`; `bundle_files` and `context_files` are sorted by `relative_path` using repository canonical string ordering:

```text
{
  schema_version: 1,
  kind: "fresh_reader_input",
  instruction: {
    task: "Apply the supplied skill bundle to the supplied case prompt and context under the requested execution policy.",
    resources: "Treat bundle/SKILL.md as the skill entrypoint and consult relevant bundled resources from bundle_files; all required content is already embedded in this input.",
    tool_use: "Follow requested_execution_policy.requested_access exactly. Do not invoke any tool or process to acquire package content because all required package content is already embedded.",
    identity: "Do not infer or state any hidden variant identity or mapping.",
    response: "Return exactly one JSON object matching the output schema enforced by the CLI, with no prose outside that object."
  },
  identity: {
    skill: <skill>,
    suite: <suite>,
    case_id: <case_id>
  },
  requested_execution_policy: <exact validated policy object>,
  bundle_files: [{ relative_path, sha256, content_utf8 }],
  case_prompt: {
    relative_path: "case/prompt.txt",
    sha256,
    content_utf8
  },
  context_files: [{ relative_path, sha256, content_utf8 }]
}
```

- `content_utf8` is the lossless decoded string whose encoded bytes equal the source bytes; `sha256` hashes those source bytes. The reader does not need to open `bundle/SKILL.md`, `case/prompt.txt`, context files or `reader-output-schema.json` through a tool. `--output-schema` remains the CLI-owned structural-output mechanism.
- Attempt-local exact bundle/prompt/context copies may remain in `input/` for transient diagnostics and existing exclusive-write evidence. They are not the reader acquisition path, and their presence is not evidence that the reader accessed filesystem resources.
- `model_visible_files` retains the existing projection field name but means the sorted logical payload inventory embedded in stdin. `stdin_sha256` is authoritative for exact transmitted framing plus contents; source hashes explain which payload changed. A policy or payload-only change changes `stdin_sha256` and the behavior fingerprint, while provenance-only changes do not.
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
- exact canonical stdin envelope contains requested policy plus lossless full bundle/prompt/context payloads; a policy or payload-only change changes `stdin_sha256` and projection;
- embedded logical payload enumeration is lexically stable; changing only workspace/ref/absolute locator or opaque variant mapping leaves stdin/projection unchanged, while changing policy, instruction framing, a supplied payload file, output schema or normalized CLI behavior option changes the corresponding projection field;
- strict UTF-8/byte-round-trip failure stops before spawn with dispatch count `0`.

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

### S1-CP4C — Stdin-envelope design correction

This is the only reopened deterministic implementation boundary after first S1-CP5. It is a correction checkpoint on the same Stage 1 branch, not a new stage and not permission to rewrite prior commits.

Implementation scope:

- `.agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs`: replace file-read instruction stdin with exact envelope compiler, strict UTF-8/round-trip pre-dispatch gate and unchanged-shape projection over embedded payload inventory;
- `.agents/scripts/run-skill-eval-cli.test.mjs`: make the spawned fake CLI derive mode/delay/case behavior exclusively from parsed stdin envelope; remove bundle/prompt/context filesystem reads from the fake child and add the exact regression matrix below;
- `docs/agent-skills/progress.md`: record deterministic correction results and truthful next live-call status after implementation;
- no planned change to `run-skill-evals.mjs`, `synthetic-workspace-v1.mjs`, suite JSON/schema, public CLI command/argv, output schema, worker pool, timeout/outcome mapping, CI command, Stage 2/3 modules or v1 report.

Implementation order:

1. Add one private strict text-decoding/round-trip helper and compile the frozen `reader_input_envelope` from already validated selected bytes before `mkdirExclusive(inputPath)`; do not create a generic serializer/backend interface.
2. Pass bundle/prompt/context payloads into `buildReaderStdin`; only after envelope compilation succeeds, create the attempt package, retain existing attempt-local exact copies and projection field names.
3. Change fake CLI fixture to parse stdin and read `case_prompt.content_utf8`; it must not read package payload files from `cwd`.
4. Add focused regression cases for complete envelope content/order/hashes, provenance stability, payload/policy invalidation, blind metadata exclusion and invalid-UTF-8 dispatch `0`.
5. Run affected checks and cumulative Stage 1 self-review. Stop on any need to change suite policy, packager, public CLI, scheduler/state semantics or live-call boundary.

Acceptance:

- exact current `filesystem: package_read_only` plus `tools: none` policy remains byte/semantic unchanged and is present in the envelope;
- each model-required textual payload is available as lossless `content_utf8` without reader tool/process acquisition;
- fake sequential and cap-two parallel paths succeed when the child consumes stdin only;
- all pre-existing process, schema, timeout, failure-isolation, deterministic-order and no-retry guarantees remain covered;
- focused deterministic suite and repository skill validator pass, `git diff --check` passes, and correction review reaches `0 Critical / 0 Required`;
- model/provider/evaluator/helper calls remain `0` during this checkpoint.

### S1-CP5 — Separately authorized actual-CLI gate

The first separately authorized gate is complete and consumed: exact `1` sequential plus `2` parallel reader calls proved process/schema success and cap-two overlap, but all three failed semantic input acquisition under the superseded file-read prompt. It is retained as truthful `transport_schema_succeeded / semantic_input_access_failed` evidence and must not be retried or relabeled.

After the stdin-envelope correction passes deterministic review, a new owner authorization may run exactly one affected-only live command:

1. Select exactly two distinct prepared reader units already covered by the corrected deterministic package/compiler path.
2. Run both in one command at concurrency `2`.
3. Do not run a new sequential canary: the prior sequential gate already proved process/schema transport, while corrected fake-child tests must prove per-unit stdin-only consumption before live authority is requested.
4. No evaluator, retry, full batch, duplicate unit or calibration run.

New ceiling if separately authorized: `2 reader / 0 evaluator / 0 retry`. Evidence must report exact unit IDs, command settings, exit/status/counts, observed overlap and bounded human/main-agent semantic inspection of whether each raw response actually performs its supplied case. Both readers must achieve process/schema success and semantic input consumption; exit `0` or structurally valid self-report alone is insufficient. Without new authority/result, Stage 1 remains `STOP / input_correction_live_canary_pending` after deterministic correction implementation.

## Required deterministic test matrix

Test file uses `node:test`, `node:assert/strict`, temp workspaces and a fake Codex CLI script launched through `process.execPath`; no network/model dependency.

| Area | Observable test |
| --- | --- |
| Parser | help; missing/duplicate/unknown flags; invalid workspace/unit/concurrency; duplicate selector; dispatch `0` |
| Identity | candidate/baseline mapping; variant flip; random workspace ID stability; no provenance/path in ID |
| Source validation | canonical raw manifests and every referenced payload byte pass; manifest/hash/path/policy-to-suite mismatch fails before spawn with dispatch `0` |
| Behavior projection | stable lexical embedded-payload order; provenance/opaque-mapping-only change ignored; policy, instruction framing, payload, schema and CLI behavior changes reflected exactly |
| Package | exact diagnostic bundle/prompt/context copies; raw manifests and other case/rubric absent; spaced paths; exclusive destination |
| Stdin envelope | fake child derives task behavior only from canonical stdin; full lossless bundle/prompt/context and exact policy present; equivalent workspace gives identical stdin; payload/policy-only change changes `stdin_sha256` |
| Text gate | invalid UTF-8 or byte-round-trip mismatch fails before spawn with dispatch `0`; no base64/chunk/repair fallback |
| Blind input | harness-generated stdin/path/metadata exposes no semantic role, opaque variant identity or mapping; test does not substring-scan or rewrite copied payload content |
| Preflight | version/help success; missing required flag or executable failure produces dispatch `0` |
| Sequential success | exact argv/stdin/cwd/schema; fake child performs no bundle/prompt/context filesystem read; one process; accepted observation path/hash; exit `0` |
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

- Codex CLI no longer supports a required flag or cannot consume the canonical stdin envelope/write structured output non-interactively;
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

Actual-CLI Stage 1 completion additionally requires separately authorized corrected S1-CP5 `2-reader / concurrency-2` semantic canary success combined with retained first-gate transport/schema and overlap evidence. Until then, the truthful status after deterministic correction is `STOP / input_correction_live_canary_pending`.
