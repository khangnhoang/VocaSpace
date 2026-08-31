# Stage 2 implementation plan — prepare barrier, execution plan và concurrency estimate

## Trạng thái, baseline và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Stage: `Stage 2 — CLI prepare`.
- Branch: `feat/agent-skill-eval-cli-prepare`.
- Branch base: exact Stage 1 merge commit `2616b052882d8c39a8a01e4da5167fd7d778f1df` từ PR #78.
- Master-plan evaluator-preparation correction: `0cb0099`.
- Portable single-writer publication correction: `19a64eb`.
- Plan status: `owner-approved / S2-CP1–S2-CP5 committed locally / owner correction review 0 Critical / 3 Required / correction implemented and deterministic verification passed / correction re-review 0 Critical / 0 Required / correction included in this local checkpoint`.
- Git evidence ngày `2026-08-31`: `origin/main...HEAD = 0/8` trước correction checkpoint; năm Stage 2 implementation checkpoints là `369e21eae5dc9a2ccb00a59586b94fe64fd6305b`, `82e4b9a731fc01fdf121ff67daa8a7076d593a25`, `23745e907cabc085ae38ff59ee6f4fe1efebfb1f`, `4e306aacf44289ac72a756e223e1091a8de51cb2` và `27045dcab05207880e87b90d24dfb271c7d3b575`. Verdict working-tree `0 Critical / 0 Required` trước các correction đã bị owner review supersede bởi `0 Critical / 3 Required`; correction re-review sau deterministic rerun đạt `0 Critical / 0 Required`, và sáu-file correction được đưa vào local checkpoint hiện tại. Ubuntu CI vẫn pending.
- Authority record: owner instruction ngày `2026-08-31`, `commit các Stage 2 checkpoint theo boundary đã định`, đã authorize đúng năm local checkpoint trên và đã được dùng hết tại `27045dcab05207880e87b90d24dfb271c7d3b575`; không suy authority từ việc commit tồn tại. Instruction `thực hiện correction đi` authorize correction implementation; instruction tiếp theo `chuẩn hóa sau đó commit` authorize EOL normalization và đúng local correction checkpoint hiện tại. Grant này được consume bởi checkpoint; không authorize push, PR, CI-fix, merge, live model/evaluator call hoặc remote action.

Tài liệu này là transferable implementation contract cho riêng Stage 2. Implementing session phải đọc tài liệu này cùng [master plan](./plan.md), [owner review brief](./owner-review-brief.md), [program plan](../../plan.md), [progress](../../progress.md), `AGENTS.md`, `docs/agent-loops.md` và các skill được route bởi diff thực tế. Nếu material contract conflict, dừng và báo owner; không tự thay command surface, state ownership, publication semantics hoặc evaluator authority.

## Mục tiêu và điều kiện thành công

Stage 2 phải thêm một new-run `prepare` command có model/evaluator dispatch count `0` và tạo được revision `1` sẵn sàng cho Stage 3:

1. reuse exact v1 repository validation và synthetic packaging để tạo một immutable prepared workspace cho toàn bộ configured scope của một skill;
2. validate mọi selected suite/case/source package trước khi publish một runnable plan;
3. compile mọi reader thành invocation-path-free `PreparedUnitDescriptor`, rồi materialize đủ path-backed reader `PreparedUnit` dưới revision-scoped run root;
4. compile evaluator logical identity, dependency skeleton, exact advisory-only `evaluator-proposal-v1` schema và persisted static inputs mà chưa dispatch evaluator;
5. prove pure evaluator descriptor compilation/materialization bằng accepted reader fixtures, nhưng giữ evaluator scheduling/result adaptation ngoài Stage 2;
6. publish `execution-plan.json` trước và `run.json` cuối như current-run marker chỉ sau khi reader materialization barrier hoàn tất;
7. emit truthful counts, dependency waves, call ceiling và bounded concurrency estimate; unknown duration/rate-limit history vẫn là `unknown`;
8. giữ Stage 1 `execute-prepared` behavior và focused CI step không đổi, trừ bounded internal extraction cần để descriptor compiler tái sử dụng exact reader input contract;
9. preserve exact v1 empty-suite semantics: all three suite entries remain selected even when one or all have `cases: []`, without inventing a minimum case count.

Stage 2 không implement execution, attempt allocation, per-unit state, fingerprint persistence, reuse, resume, retry, patch-check, evaluator scheduling/result adapter hoặc report.

## Repository facts đã xác nhận

- `.agents/scripts/run-skill-evals.mjs` hiện sở hữu exact `prepare --skill ... --isolation synthetic ...` parser, private `loadConfiguredSuites(...)`, `prepareSyntheticWorkspace(...)` call và canonical `prepare_result`; file gọi `main()` unconditionally nên chưa import-safe.
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` đã export `prepareSyntheticWorkspace`, `fixedWorkspaceRoot`, `resolveWorkspace`, `readArtifactBytes`, `resolveWorkspacePath` và `listWorkspaceFiles`. Master plan yêu cầu Stage 2 là direct consumer và không sửa packager trong approved scope.
- v1 `prepare_result` trả `workspace_id`, mode, skill và counts; suite definitions được canonical-persist dưới `evaluator/suite-definitions/<suite>.json`.
- `codex-cli-runner-v1.mjs` đã validate workspace/suite/bundle/context/policy/source bytes, resolve opaque variant qua semantic role, compile lossless reader stdin và tạo stable reader `unit_id`/`behavior_projection`. Các compiler helpers còn private và Stage 1 materializer đang gắn trực tiếp với diagnostic attempt layout.
- Stage 1 `PreparedUnit` chỉ viết `reader-output-schema.json` trong diagnostic attempt package; frozen Stage 2 layout dùng đúng hai file `stdin.txt` và `output-schema.json` dưới `revisions/1/prepared/<unit_id>/input`.
- `suite-schema-v1.mjs` đã validate exact `evaluator_only.criteria`, `expected_behavior`, `forbidden_behavior`, `safety_vetoes`, routing-only fields và suite-specific `suite_config`; không cần sửa suite schema để thêm proposal contract.
- `artifact-schema-v1.mjs` đã có `canonicalJson`, `sha256Bytes`, `sha256Canonical`, `parseStrictJson` và v1 artifact validators; Stage 2 không tạo canonical/hash helper thứ hai.
- Current focused CI step đã chạy `node --test .agents/scripts/run-skill-eval-cli.test.mjs` trên Ubuntu. Stage 2 mở rộng chính suite này nên không cần thêm CI job/step.
- Current local Stage 1 suite header ghi `26 tests`; nếu Stage 2 thêm cases vào cùng file, header phải cập nhật bằng số thực tế sau verify.

## Detailed-plan refinements dưới master contract

Các refinement dưới đây không đổi stage ownership; chúng đóng implementation detail còn để mở trong master plan và phải được owner review cùng tài liệu này:

1. **Reuse v1 prepare foundation bằng bounded export, không subprocess.** `run-skill-evals.mjs` import `pathToFileURL`, giữ private synchronous `main()` hiện tại nhưng chỉ gọi nó khi module là direct entrypoint, đồng thời export một function nhận `{ repoRoot, skill, candidate, baseline }`, reuse nguyên `loadConfiguredSuites(...) → prepareSyntheticWorkspace(...)`, rồi trả existing `prepare_result`. Existing CLI parser/output/error semantics không đổi. Stage 2 CLI gọi function này; không spawn một Node CLI con, parse stdout hoặc duplicate suite validation.
2. **All-scope selection dùng existing validated workspace adapter.** `codex-cli-runner-v1.mjs` thêm một all-selected loader/compiler path dùng cùng manifest/suite/source validators hiện tại. Existing `loadSelectedWorkspace(workspaceId, selectors)` và `execute-prepared` selector order giữ nguyên.
3. **Run locator mới dùng fixed OS-temp root.** `fixedCliRunRoot()` là `join(tmpdir(), "vocaspace-agent-skill-evals", "cli-v1")`; random `run_id` là `run-${randomUUID().replaceAll("-", "")}` và phải match `^run-[a-f0-9]{32}$`. Đây là local locator, không tham gia logical identity/projection.
4. **`run.json` là publication marker.** Revision root có thể tồn tại unpublished trong khi materialize. Sau barrier, writer exclusive-write và re-read `revisions/1/execution-plan.json`; chỉ sau đó mới exclusive-write `run.json`. Một root không có valid `run.json` không phải prepared run và không được Stage 3 discover/use. Failed unpublished roots không được auto-repair hoặc relabel; cleanup/retention nằm ngoài Stage 2.
5. **Serialized plan giữ exact compile inputs, không Buffer JSON ad hoc.** In-memory descriptor dùng exact `stdin_bytes`/`output_schema_bytes`. Persisted reader descriptor lưu lossless `stdin_utf8` và `output_schema_utf8` plus `cli_options`, rồi loader phải UTF-8 encode và verify lại exact projection hashes before replay. Không base64, normalize newline/BOM hoặc regenerate từ current process defaults.
6. **Duration/rate-limit history mặc định là unknown.** Stage 2 không hard-code timing từ progress docs và không scan arbitrary old temp outputs. Khi chưa có machine-readable, scope-matching history source, `duration_seconds`, `total_work_seconds`, `dependency_critical_path_seconds`, `observed_rate_limit_cap` và `estimated_wall_time_seconds` là `null` với status `unknown`; recommendation dùng exact fallback ở phần estimate. `--target-minutes` vẫn được persist nhưng không tạo precision giả.

Nếu implementation chứng minh một refinement trên không khả thi mà cần new shared module, packager edit, subprocess protocol, publication lock, native rename binding hoặc broader state owner, đó là design-change stop.

## Phạm vi

### Trong phạm vi

- Import-safe bounded export của existing v1 prepare foundation.
- New-run `prepare` parser/help/orchestration trong `run-skill-eval-cli.mjs`.
- All-selected workspace load và reader descriptor extraction dùng existing Stage 1 validation/compiler.
- New `cli-execution-plan-v1.mjs` cho identity-complete static plan, fixed run root, create-once/exact-replay materializer, barrier publication và estimate.
- New `cli-evaluator-proposal-v1.mjs` cho exact output schema, post-schema validation, evaluator static plan và pure descriptor compiler.
- Canonical `run.json`, `revisions/1/execution-plan.json` và path-backed prepared reader inputs.
- Deterministic real-filesystem regressions trên Windows local và existing Ubuntu CI suite.
- Exact documentation ownership: update only `progress.md` after each real implementation checkpoint; update master, owner brief, README or this detailed plan only when their separately listed trigger occurs.

### Ngoài phạm vi

- Codex/model/evaluator dispatch hoặc even installed-CLI preflight trong `prepare`.
- Reader/evaluator `behavior_fingerprint`; Stage 2 chỉ persist projection.
- `units/*.json`, attempts, accepted-result state, `run`/`status`/`resume`/`retry`/`patch-check`/`report`.
- Evaluator result parser/adapter hoặc conversion thành `human_evaluation`.
- Automatic retry, cross-run cache, same-run revision `> 1` hoặc selected-scope change.
- External/multiple harness writers, TOCTOU-free publication, native `RENAME_NOREPLACE`, publication lock, lease/journal/CAS hoặc cleanup subsystem.
- App Server/CP8/CP9/v2 runtime graph, native subagent, multi-backend abstraction hoặc security/attestation claims.
- Edit skill/suite semantic content, suite schema, v1 synthetic packager, product app, database/auth/payment/deployment code.

## Expected files và files không được sửa

### Expected Stage 2 implementation files

| Path | Ownership |
| --- | --- |
| `.agents/scripts/run-skill-evals.mjs` | bounded prepare-foundation export + import-safe main guard; existing CLI behavior unchanged |
| `.agents/scripts/run-skill-eval-cli.mjs` | `prepare` parser/help/orchestration, canonical result/error và zero-dispatch boundary |
| `.agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs` | bounded export/refactor của existing all-selected source validation và reader descriptor compiler; preserve Stage 1 adapter/worker behavior |
| `.agents/scripts/lib/skill-evals/cli-execution-plan-v1.mjs` | run ID/root, static plan compilation, serialized descriptor adapter, replay-safe materializer, barrier publication và estimate |
| `.agents/scripts/lib/skill-evals/cli-evaluator-proposal-v1.mjs` | exact proposal JSON Schema/post-validator, evaluator static plan/envelope/projection và pure descriptor compiler |
| `.agents/scripts/run-skill-eval-cli.test.mjs` | Stage 2 parser/compiler/materializer/barrier/estimate regressions plus current Stage 1 coverage |
| `docs/agent-skills/progress.md` | actual checkpoint/review/verification state |

`run-skill-evals.test.mjs` là affected regression suite và phải chạy vì entrypoint được refactor, nhưng không expected edit nếu current CLI tests đã cover unchanged behavior. Chỉ thêm focused case tại đó nếu import-safe export không thể được chứng minh qua `run-skill-eval-cli.test.mjs` mà không duplicate fixture infrastructure.

### Conditional documentation owners — không thuộc default implementation diff

| Path | Chỉ update khi |
| --- | --- |
| `docs/agent-skills/implementation-plans/eval-harness-cli-first/plan.md` | repository evidence tạo material design conflict và design-change protocol được owner confirm; không dùng cho routine checkpoint status |
| `docs/agent-skills/implementation-plans/eval-harness-cli-first/stage-2-cli-prepare.md` | owner decision hoặc confirmed design change làm đổi exact Stage 2 implementation contract và correction được re-review trước khi tiếp tục |
| `docs/agent-skills/implementation-plans/eval-harness-cli-first/owner-review-brief.md` | owner decision, approval hoặc authority state thực sự thay đổi |
| `docs/agent-skills/implementation-plans/README.md` | implementation artifact được thêm, xóa, đổi tên hoặc không còn current consumer nên lifecycle/index thực sự thay đổi |

Các file planning/index đang được sửa trong review correction hiện tại vì plan chưa được owner approve và prior finding trực tiếp yêu cầu handoff reconciliation. Sau approval, chúng không tự động thuộc expected Stage 2 implementation diff. Routine S2-CP1–S2-CP5 implementation evidence chỉ update CLI-first block của `progress.md`.

### Không được sửa trong Stage 2

- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs`, `suite-schema-v1.mjs` và `artifact-schema-v1.mjs`.
- `.agents/evals/**`, `.agents/skills/**` và `AGENTS.md`.
- `harness-schema-v2.mjs`, `orchestrator-v2.mjs`, `run-store-v2.mjs`, `readiness-v2.mjs`, `review-v2.mjs`, `cp9-*` và App Server modules.
- `.github/workflows/ci.yml`, trừ khi repository evidence mới chứng minh existing focused step không chạy Stage 2 tests; khi đó dừng và báo trước khi sửa.
- Product source, Supabase/database, auth, payment, deployment hoặc package dependencies.

## Frozen public command contract

```text
node .agents/scripts/run-skill-eval-cli.mjs prepare \
  --skill <kebab-case-skill> \
  --isolation synthetic \
  (--candidate-current-tree | --candidate-ref <ref>) \
  (--baseline-ref <ref> | --no-baseline) \
  [--concurrency <positive-safe-integer>] \
  [--max-concurrency <positive-safe-integer>] \
  [--max-attempts <positive-safe-integer>] \
  [--target-minutes <positive-finite-number>]
```

Rules:

- v1 selection flags giữ exact exclusivity/meaning của `run-skill-evals.mjs prepare`.
- Mỗi value/boolean flag xuất hiện tối đa một lần; unknown, missing, duplicate hoặc conflicting flag trả exit `2`, workspace/run allocation và dispatch count `0`.
- `--max-concurrency` default `4` và là owner/operator ceiling của plan.
- `local_process_cap = max(1, availableParallelism())`; test inject exact value, production dùng `node:os.availableParallelism()`.
- `--concurrency` là optional explicit future-run setting. Khi có, nó phải `<= min(max_concurrency, local_process_cap)`; `planned_concurrency` dùng exact explicit value. Khi không có, `planned_concurrency = recommended_concurrency`.
- `--max-attempts` default `2`; đây là per-unit total-attempt ceiling cho Stage 3, không cấp retry authority và không làm tăng `expected_calls_without_retry`.
- `--target-minutes` có thể là decimal dương hữu hạn; absent dùng `null`. Khi duration history unknown, target được ghi nhận nhưng estimate time vẫn `unknown`.
- `prepare` không nhận `--workspace`, `--run`, `--unit`, `--model`, `--sandbox`, output path hoặc arbitrary prompt.
- `--help` phải tách rõ `execute-prepared` diagnostic command và new-run `prepare`; nêu `prepare` creates revision `1`, executes `0` model/evaluator calls, dùng local temp storage và không cung cấp reuse/resume/report.

Exit/output:

- exit `0`: complete reader barrier + plan publication succeeded;
- exit `2`: usage/flag error trước workspace/run allocation;
- exit `3`: v1 prepare/static validation/materialization/publication/internal operational failure; model/evaluator dispatch `0`;
- `prepare` không dùng exit `1` vì partial runnable publication bị cấm;
- exit `0` success và exit `3` operational error dùng canonical JSON trên stdout; exit `2` usage error và `--help` giữ existing CLI text conventions và không emit `command_error` JSON.

## Internal contracts

### Bounded v1 prepare foundation

`run-skill-evals.mjs` export một function tương đương:

```text
prepareSkillEvalWorkspace(repoRoot, {
  skill,
  candidate: { kind: "current_tree" } | { kind: "ref", ref },
  baseline: null | ref
}) -> existing prepare_result
```

Function phải gọi existing `loadConfiguredSuites` và `prepareSyntheticWorkspace` trong cùng process. CLI `runPrepare(...)` gọi lại function này. Private `main()` giữ current `process.argv`/stdout/stderr/exit behavior khi chạy trực tiếp; exact `pathToFileURL(process.argv[1]).href === import.meta.url` guard bảo đảm import không gọi `main()`, không ghi output và không set `process.exitCode`.

Không export raw private suite loader, không thêm subprocess JSON protocol và không đổi current v1 `prepare_result` shape.

### All-selected reader descriptors

Stage 2 derives scope từ canonical prepared workspace, không từ current repository sau packaging:

1. read/validate `workspace-manifest.json`;
2. load mỗi configured suite theo `suiteOrder` từ `evaluator/suite-definitions/<suite>.json`;
3. sort cases lexical theo `case_id` cho plan order;
4. for each case, enumerate semantic source roles lexical (`baseline`, then `candidate` when comparison; `candidate` only otherwise);
5. call the same `validateSelectedSource(...)` logic used by Stage 1;
6. compile each validated source to `PreparedUnitDescriptor` with exact `stdin_bytes`, canonical reader schema bytes, normalized frozen `cliBehaviorOptions`, projection and source locator.

Existing Stage 1 `loadSelectedWorkspace(workspaceId, selectors)` keeps caller selector order and behavior. Refactor must have one validation/compiler owner rather than duplicate source relationship checks.

### Evaluator static plan

For each exact `{ skill, suite, case_id }`, create:

```text
{
  schema_version: 1,
  unit_id,
  logical_unit_key: { schema_version: 1, kind: "evaluator", skill, suite, case_id },
  kind: "evaluator",
  mode: "candidate_only" | "comparison",
  dependencies: [{
    source_role,
    unit_id,
    source_locator: { workspace_id, variant_id, execution_context_hash }
  }],
  evaluator_only: exact canonical selected-case evaluator_only object,
  suite_config: exact canonical selected-suite suite_config object,
  criterion_ids: <rubric order>,
  veto_ids: <rubric order>
}
```

`unit_id = evaluator-${sha256Canonical(logical_unit_key)}`. Dependencies sort lexical by `source_role`, contain exactly current workspace roles, point to the same skill/suite/case readers and have no duplicates/extras. Minimal dependency `source_locator` is coordinator-side provenance copied from the exact reader descriptor so the later pure compiler can validate accepted v1 observation identity; it never enters evaluator stdin/projection. Static plan contains no observation/result path and no evaluator `PreparedUnit` yet.

### Exact `evaluator-proposal-v1`

`cli-evaluator-proposal-v1.mjs` exports frozen JSON Schema and post-validator for master shape:

```text
{
  schema_version: 1,
  output_type: "evaluator_proposal",
  criterion_findings: [{
    criterion_id,
    assessment: "satisfied" | "partially_satisfied" | "not_satisfied" | "uncertain",
    rationale
  }],
  safety_veto_findings: [{
    veto_id,
    assessment: "triggered" | "not_triggered" | "uncertain",
    rationale
  }],
  comparison_findings: null | {
    material_differences: string[],
    uncertainties: string[]
  },
  summary
}
```

Schema dùng `additionalProperties: false` ở mọi object, exact required fields, enums và non-empty strings. Post-validator bắt buộc trimmed strings, exact criterion/veto count, ID order/membership, no duplicate/extra ID và mode-specific comparison shape. Candidate-only bắt buộc `null`; comparison bắt buộc object. Unknown authoritative fields bị schema từ chối; không silently strip.

### Pure evaluator descriptor compiler

Compiler nhận evaluator static plan, exact accepted reader result bindings, exact observation bytes, proposal schema và normalized CLI options. Caller owns reading the accepted path; compiler remains pure by receiving those exact bytes together with the path/hash binding. Với mỗi dependency, nó phải:

- match exact `unit_id` + semantic `source_role` + expected static membership;
- require `terminal_status: "succeeded"`, non-null structured-output path/hash và bytes hash exact-equal binding;
- parse canonical JSON bytes và validate v1 observation against workspace/skill/role/execution-context identity held coordinator-side;
- reject missing/duplicate/extra/wrong-case/wrong-role result or observation;
- derive only canonical model-visible projection `{ source_role, execution_status, execution_reason, raw_response, observed_access }`.

Evaluator stdin is exact `canonicalJson` of:

```text
{
  schema_version: 1,
  kind: "evaluator_input",
  delivery_mode: "stdin_embedded_evaluator_input_v1",
  instruction: {
    task: "Evaluate the supplied reader observation or observations against evaluator_only and suite_config.",
    authority: "Return advisory findings only. Do not assign human case or comparison status, choose a winner, recommend accept, reject, or rerun actions, or claim human authority.",
    evidence: "Use only the supplied semantic reader projections. Do not infer opaque variant mapping or provenance.",
    response: "Return exactly one JSON object matching the output schema enforced by the CLI, with no prose outside that object."
  },
  identity: { skill, suite, case_id },
  mode,
  evaluator_only,
  suite_config,
  dependencies: [{ source_role, execution_status, execution_reason, raw_response, observed_access }]
}
```

`model_visible_files` uses exact labels/hashes from master plan; evaluator locator/projection excludes workspace ID, variant ID/mapping, execution-context hash, absolute path, ref and timestamp. Full accepted result path/hash remain only in returned descriptor `source_locator` for Stage 3 binding. Compiler performs no filesystem mutation, fingerprint persistence hoặc dispatch.

### Replay-safe descriptor materializer

API boundary:

```text
materializePreparedUnitDescriptor({ preparedRoot, descriptor }) -> PreparedUnit
```

Required order:

1. validate `unit_id`, logical key/kind/dependencies, strict UTF-8 descriptor bytes, canonical kind-appropriate output schema, exact stdin/schema hashes and exact normalized CLI options/projection equality;
2. resolve final path `prepared/<unit_id>/input/{stdin.txt,output-schema.json}` and refuse path escape/non-directory components;
3. if final target already exists, exact-replay validate it directly and create no staging directory;
4. otherwise create unique owned staging sibling under the same `prepared` root, exclusive-write exactly two regular files, re-read inventory/bytes/hashes;
5. precheck final target again immediately before rename; under supported one-writer operation it remains absent. If present, exact-replay validate target and remove only the owned unpublished staging directory;
6. rename staging unit directory to final unit directory on the same filesystem;
7. if rename fails, preserve the original error, recheck final target and exact-replay only when it now exists; if target remains absent, fail with original publish error;
8. after rename success, exact-replay validate final bytes before returning path-backed `PreparedUnit`.

Exact replay requires final unit directory inventory exactly `input/`, and input inventory exactly two regular files with expected names/bytes. Partial/unexpected/non-regular/path/hash/projection/options mismatch fails without overwriting, deleting or repairing final target. Cleanup may remove only the current call's unique unpublished staging directory; cleanup failure cannot be mislabeled as successful publication. Tests must not simulate or claim external-writer safety inside the unsupported precheck/rename window.

Descriptor self-consistency derives `model_visible_files` rather than trusting the supplied array. Reader stdin must parse as exact canonical `fresh_reader_input`; materializer rebuilds the sorted inventory from `bundle_files`, `case_prompt` and `context_files`. Evaluator stdin must parse as exact canonical `evaluator_input`; materializer hashes `canonicalJson(evaluator_only)`, `canonicalJson(suite_config)` and each canonical semantic dependency projection under the exact master labels. Rebuilt inventory must exact-equal the descriptor projection. Wrong kind/delivery mode, non-canonical stdin, duplicate label or label/hash mismatch fails before any write.

### Persisted revision-1 artifacts

`selected_scope` is exact and reused byte-for-byte semantically in both artifacts and the success result:

```text
{
  skill,
  mode: "candidate_only" | "comparison",
  source_roles: ["candidate"] | ["baseline", "candidate"],
  suites: [{
    suite,
    case_ids
  }]
}
```

`suites` always has exactly one entry for each canonical `suiteOrder` member in that order, including a suite whose v1 definition has `cases: []`. Every `case_ids` array is lexical and duplicate-free; empty is valid and preserves exact v1 semantics. The source-role array is exactly the mode-appropriate array above. `cli_behavior_options` is the exact six-key Stage 1 object `{ model, reasoning_effort, sandbox, ephemeral, ignore_user_config, ignore_rules }`; every reader descriptor `cli_options` and `behavior_projection.cli_behavior_options` must exact-equal it.

`revisions/1/execution-plan.json` canonical shape:

```text
{
  schema_version: 1,
  artifact_type: "cli_execution_plan",
  run_id,
  revision: 1,
  workspace_id,
  selected_scope,
  cli_behavior_options,
  process_settings: {
    planned_concurrency,
    max_concurrency,
    local_process_cap,
    max_attempts,
    target_minutes
  },
  counts: {
    reader_units,
    evaluator_units,
    total_units,
    ready_units,
    blocked_on_dependencies,
    expected_calls_without_retry,
    automatic_retry_calls,
    max_attempt_call_ceiling
  },
  ready_unit_ids,
  reader_units: [{
    schema_version: 1,
    unit_id,
    logical_unit_key,
    kind: "reader",
    dependencies: [],
    invocation_content: {
      stdin_utf8,
      output_schema_utf8,
      cli_options
    },
    behavior_projection,
    source_locator,
    prepared_input: {
      stdin_path,
      output_schema_path,
      cwd
    }
  }],
  evaluator_units: [{
    schema_version: 1,
    unit_id,
    logical_unit_key,
    kind: "evaluator",
    mode: "candidate_only" | "comparison",
    dependencies: [{
      source_role,
      unit_id,
      source_locator: { workspace_id, variant_id, execution_context_hash }
    }],
    evaluator_only,
    suite_config,
    criterion_ids,
    veto_ids
  }],
  dependency_waves: [{
    wave: 1,
    kind: "reader",
    unit_ids,
    unit_count,
    scheduling_waves
  }, {
    wave: 2,
    kind: "evaluator",
    unit_ids,
    unit_count,
    scheduling_waves
  }],
  estimate: {
    schema_version: 1,
    history_status: "unknown" | "complete",
    target_status: "absent" | "provided",
    target_wall_time_seconds,
    duration_seconds,
    total_work_seconds,
    dependency_critical_path_seconds,
    observed_rate_limit_cap,
    concurrency_for_target,
    recommended_concurrency,
    planned_concurrency,
    estimated_wall_time_seconds
  }
}
```

`run.json` canonical shape:

```text
{
  schema_version: 1,
  artifact_type: "cli_run",
  run_id,
  workspace_id,
  selected_scope,
  current_revision: 1,
  status: "prepared",
  unit_ids,
  process_settings: {
    planned_concurrency,
    max_concurrency,
    local_process_cap,
    max_attempts,
    target_minutes
  }
}
```

Canonical ordering and derived values are frozen:

- `reader_units` follows `suiteOrder`, then lexical `case_id`, then lexical semantic `source_role`; `evaluator_units` follows `suiteOrder`, then lexical `case_id`;
- flat `run.json.unit_ids` is all reader IDs in `reader_units` order followed by all evaluator IDs in `evaluator_units` order;
- `ready_unit_ids` is exactly every reader ID in reader order. Evaluators are counted under `blocked_on_dependencies` until their same-case reader dependencies succeed; Stage 2 does not assign a per-unit runtime status;
- wave `1` contains exactly `ready_unit_ids`; wave `2` contains exactly every evaluator ID. `unit_count` is the array length and `scheduling_waves = ceil(unit_count / planned_concurrency)`;
- `counts.reader_units = reader_units.length`, `counts.evaluator_units = evaluator_units.length`, `counts.total_units = reader_units.length + evaluator_units.length`, `counts.ready_units = ready_unit_ids.length`, and `counts.blocked_on_dependencies = evaluator_units.length`; `expected_calls_without_retry = total_units`, `automatic_retry_calls = 0`, and `max_attempt_call_ceiling = total_units * max_attempts`;
- each reader is the frozen `PreparedUnitDescriptor` with only its two Buffer fields serialized losslessly as `invocation_content.stdin_utf8`/`output_schema_utf8`, plus `prepared_input`; UTF-8 encoding those strings must reproduce the exact descriptor bytes and hashes, while `invocation_content.cli_options` stays exact; each `prepared_input` path is canonical run-relative POSIX text exactly `revisions/1/prepared/<unit_id>/input/{stdin.txt,output-schema.json}` with `cwd` ending at `input`;
- each evaluator item exact-equals the static-plan contract above, including mode-appropriate dependency roles, exact criterion/veto order and coordinator-only minimal locators. It has no descriptor, prepared path or result binding in new-run `prepare`;
- `run.json.selected_scope`, `workspace_id`, `unit_ids`, revision and `process_settings` exact-match the execution plan; `process_settings.planned_concurrency` exact-equals `estimate.planned_concurrency`, its `target_minutes` produces the estimate target status/value, and `max_attempts` produces the exact max-attempt ceiling; `run.json.status` has only the Stage 2 value `prepared`.

All count/ceiling/wave fields are non-negative safe integers. Configured caps/settings `max_concurrency`, `local_process_cap`, `max_attempts`, optional explicit `--concurrency`, complete-history `observed_rate_limit_cap`, and derived `recommended_concurrency`/`planned_concurrency` are positive safe integers; `concurrency_for_target` follows the separate estimate rule and may be `0`. Compilation rejects when any derived product such as `total_units * max_attempts` is not a safe integer.

Zero-unit behavior is exact. When all three suites have empty `case_ids`, `reader_units`, `evaluator_units`, flat `run.json.unit_ids` and `ready_unit_ids` are all `[]`; every unit/ready/blocked/call count and `max_attempt_call_ceiling` is `0`. Both dependency-wave objects remain present in their fixed order with `unit_ids: []`, `unit_count: 0` and `scheduling_waves: 0`. With the production null history source, estimate stays on the ordinary `history_status: "unknown"` branch: duration/rate-limit/time fields are `null`, target status/value still reflects `--target-minutes`, and recommendation/planned concurrency still follows the frozen positive fallback/explicit-setting rules. `prepare` publishes the exact-valid empty plan and succeeds with dispatch counts `0`; it does not reject, synthesize a case/unit or invoke a worker. A complete injected history control for this topology contains exactly `duration_seconds: []` plus a valid `observed_rate_limit_cap`; then `total_work_seconds`, `dependency_critical_path_seconds` and `estimated_wall_time_seconds` are `0`. If a target is provided for that complete-history control, `concurrency_for_target = 0`, `recommended_concurrency = 1`, and `planned_concurrency` remains a positive safe integer: the valid explicit `--concurrency` when present, otherwise `1`. Without a target, `concurrency_for_target` remains `null`.

Artifacts contain no fingerprint, attempt, accepted result, per-unit runtime status, retry decision hoặc report verdict.

Loader/replay code must reject non-canonical bytes, unknown/extra fields, wrong run/revision/scope/unit relationship, wrong ordering/count/wave/readiness/estimate derivation, absolute/escaping prepared paths, missing prepared files and serialized-descriptor/projection mismatch.

`cli-execution-plan-v1.mjs` owns explicit `assertCliRun(...)`, `assertCliExecutionPlan(...)`, `assertCliPrepareResult(...)` and `assertCliPrepareCommandError(...)` validators. The publication path validates the in-memory value before canonical write and revalidates exact canonical bytes after read; Stage 3 must consume the run/plan validators rather than treating JSON parse success as valid state.

## Prepare barrier và publication flow

```text
parse/validate flags
  → v1 validate + synthetic prepare foundation
  → load canonical workspace + all suites/cases/roles
  → compile/validate every reader descriptor
  → compile/validate every evaluator static plan + proposal schema
  → allocate random unpublished run/revision root
  → materialize and exact-validate every reader PreparedUnit
  → build/re-read canonical execution-plan.json
  → exclusive-write/re-read run.json publication marker
  → emit canonical prepare result
```

Any failure before `run.json` publication produces dispatch count `0`, no valid prepared run and exit `3`. An unpublished unique run root may remain for diagnostics; it must not be automatically reused, repaired or reported as current. No evaluator descriptor is materialized by normal new-run `prepare`, because accepted reader results do not exist yet.

Stage 2 nonetheless implements/tests the pure evaluator descriptor + materializer path with deterministic accepted-reader fixtures so Stage 3 can call it after dependencies succeed without changing request semantics.

Successful new-run `prepare` stdout is exactly:

```text
{
  schema_version: 1,
  artifact_type: "cli_prepare_result",
  command: "prepare",
  status: "prepared",
  run_id,
  revision: 1,
  workspace_id,
  selected_scope,
  process_settings,
  run_manifest: "run.json",
  execution_plan: "revisions/1/execution-plan.json",
  counts,
  ready_unit_ids,
  dependency_waves,
  estimate,
  dispatch_counts: { reader: 0, evaluator: 0, total: 0 }
}
```

The duplicated scope/process-settings/count/readiness/wave/estimate values must exact-equal the published execution plan, and process settings must exact-equal `run.json`. An exit-`3` operational failure stdout is exactly:

```text
{
  schema_version: 1,
  artifact_type: "command_error",
  command: "prepare",
  status: "error",
  code,
  message,
  workspace_id: null | workspaceId,
  run_id: null | allocatedUnpublishedRunId,
  revision: null | 1,
  dispatch_counts: { reader: 0, evaluator: 0, total: 0 }
}
```

`code` is a stable non-empty uppercase underscore identifier and `message` is a non-empty safe operator message. A null locator means only that the Stage 2 caller did not receive or cannot trustfully return that locator; it does **not** prove that no workspace/root was allocated on disk. In particular, any v1 prepare-foundation failure emits `workspace_id: null` because `prepareSyntheticWorkspace(...)` may allocate an incomplete workspace before throwing while its `ArtifactError` carries no workspace locator. Stage 2 does not edit the v1 packager or scan temp roots to manufacture that certainty. The error never claims publication state; a later consumer recognizes a run only by independently loading exact-valid canonical `run.json` plus its bound execution plan. Usage exit `2` follows the text-only rule above.

Command-error relationships are exact: `run_id !== null` requires a successfully returned non-null `workspace_id` and `revision === 1`; `run_id === null` requires `revision === null`. `workspace_id: null` means caller knowledge is unavailable and remains compatible with an unreturned incomplete v1 workspace. Success requires every locator non-null and exact matching canonical artifacts. No success/error output contains an absolute temp path.

## Concurrency estimate contract

Counts:

- `reader_units = cases × source_roles` for exact selected scope;
- `evaluator_units = cases`;
- `total_units = reader_units + evaluator_units`;
- `expected_calls_without_retry = total_units`;
- `automatic_retry_calls = 0`;
- `max_attempt_call_ceiling = total_units * max_attempts`, labeled ceiling only, never planned/authorized calls;
- dependency waves list all readers first and evaluators second; per-case evaluator depends only on same-case readers.

History input is all-or-nothing. The pure estimate function accepts either `null` or one complete internal object containing exactly one positive finite `{ unit_id, seconds }` entry for every reader and evaluator ID plus one positive-safe-integer `observed_rate_limit_cap`. IDs must follow canonical flat plan order. Missing, duplicate, extra, non-positive or non-finite duration, or absent/invalid rate-limit cap rejects the supplied history; partial history is never persisted as `complete` and individual known/unknown dimensions are not mixed. The public Stage 2 command has no history flag or repository producer, so production uses `null` until a separately owned machine-readable, scope-matching source exists.

With trustworthy duration history:

```text
concurrency_for_target = ceil(total_work_seconds / target_wall_time_seconds)
recommended_concurrency = min(
  max(1, concurrency_for_target),
  max_concurrency,
  local_process_cap,
  observed_rate_limit_cap
)
estimated_wall_time_seconds = max(
  total_work_seconds / recommended_concurrency,
  dependency_critical_path_seconds
)
```

Without trustworthy duration/rate-limit history:

```text
recommended_concurrency = min(4, max_concurrency, local_process_cap)
duration/rate-limit/time estimate fields = null with status "unknown"
```

Exact status/null rules:

- null history: `history_status = "unknown"`; `duration_seconds`, `total_work_seconds`, `dependency_critical_path_seconds`, `observed_rate_limit_cap`, `concurrency_for_target` and `estimated_wall_time_seconds` are `null`; recommendation is `min(4, max_concurrency, local_process_cap)`;
- complete history: `history_status = "complete"`; `duration_seconds` is the canonical ordered `{ unit_id, seconds }` array, total work is its sum, and the critical path is the maximum same-case `max(reader dependency seconds) + evaluator seconds`;
- absent target: `target_status = "absent"`, `target_wall_time_seconds = null` and `concurrency_for_target = null`; complete-history recommendation is `min(4, max_concurrency, local_process_cap, observed_rate_limit_cap)`;
- provided target: `target_status = "provided"` and `target_wall_time_seconds = target_minutes * 60`; `concurrency_for_target` is non-null only with complete history and then uses the frozen formula, including exact value `0` for complete-history zero-unit topology;
- with complete history, `estimated_wall_time_seconds` uses the frozen recommendation formula whether target is absent or provided; with unknown history it remains `null` even when target is provided;
- `planned_concurrency` is the valid explicit `--concurrency` when present, otherwise `recommended_concurrency`. It never changes recommendation, history status or expected-call counts.

Every present `duration_seconds[*].seconds` value and every non-null `target_wall_time_seconds` value is a positive finite JSON number. Every non-null aggregate/derived time value—`total_work_seconds`, `dependency_critical_path_seconds` and `estimated_wall_time_seconds`—is a non-negative finite JSON number, so complete-history zero-unit topology preserves exact value `0`. `concurrency_for_target` is either `null` or a non-negative safe integer; `recommended_concurrency` and `planned_concurrency` are positive safe integers. Arithmetic iterates the canonical unit order, uses the formulas above without display rounding, and rejects `NaN`, infinity or a non-finite derived result; presentation formatting is not persisted in the canonical artifact.

For each wave emit `unit_count` and `scheduling_waves = ceil(unit_count / planned_concurrency)`. This is topology math, not a time/rate-limit claim.

## Checkpoint plan

### S2-CP1 — v1 prepare foundation, all-scope adapter và reader descriptors

Implement import-safe prepare export/main guard, all-selected workspace enumeration, pure reader `PreparedUnitDescriptor` extraction, plus evaluator logical identities/static input bindings/dependency skeletons. Preserve Stage 1 `execute-prepared` behavior.

Acceptance:

- existing v1 `prepare` CLI output/errors and tests remain unchanged;
- importing `run-skill-evals.mjs` has no CLI side effect;
- all three configured suite entries are retained in `selected_scope` exactly once in `suiteOrder`, including empty suites; every existing case/source role is represented exactly once and all-empty input produces the frozen zero-unit plan;
- every suite/case has exactly one evaluator static plan bound to the same-case semantic readers and exact selected `evaluator_only`/`suite_config`;
- opaque mapping is resolved to semantic role; equivalent random workspace IDs/variant flip preserve logical IDs and behavior projections;
- static manifest/hash/path/policy/UTF-8 failure occurs before run allocation and dispatch count remains `0`;
- descriptor bytes/projection/options are exact and invocation-path-free;
- no `synthetic-workspace-v1.mjs`, suite schema or v2 module edit.

Suggested checkpoint commit after separate owner approval:

```text
feat(agent-skills): compile CLI eval reader plans
```

### S2-CP2 — exact evaluator proposal contract

Implement `evaluatorProposalSchema` and post-validator over the CP1 evaluator static plan.

Acceptance:

- candidate-only/comparison valid controls pass;
- missing/duplicate/extra/out-of-order criterion or veto IDs fail;
- untrimmed/empty rationale, summary or comparison string fails;
- candidate-only non-null and comparison null shape fail;
- extra authoritative fields, winner/action/recommendation/status fail structurally;
- no evaluator process/result/human evaluation is created.

Suggested checkpoint commit after separate owner approval:

```text
feat(agent-skills): define CLI evaluator proposal contract
```

### S2-CP3 — pure evaluator descriptor compiler

Implement canonical evaluator stdin/projection from exact accepted reader fixtures and dependency bindings.

Acceptance:

- candidate-only has one candidate dependency; comparison has exact baseline/candidate dependencies;
- wrong unit/role/case, duplicate/extra binding, non-success result, missing path/hash, invalid bytes/hash or invalid observation fails;
- evaluator stdin contains exact evaluator-only/config/dependency semantic projections and no provenance/opaque mapping;
- schema/rubric/result/model-visible/CLI-option changes alter exact projection while provenance-only changes do not;
- function has no filesystem mutation, fingerprint, persisted state or dispatch.

Suggested checkpoint commit after separate owner approval:

```text
feat(agent-skills): compile CLI evaluator descriptors
```

### S2-CP4 — replay-safe materializer và prepare barrier

Implement fixed run root, descriptor validation, same-filesystem staging publication, exact replay and all-reader materialization barrier.

Acceptance:

- fresh publish succeeds with real filesystem on Windows local and the same suite is wired to existing Ubuntu CI;
- exact existing target returns deep-equal `PreparedUnit` without target byte mutation;
- existing partial/unexpected/non-regular/altered target, descriptor hash/projection/options mismatch and path escape fail without overwrite/repair;
- rename failure with no final target returns original publish failure;
- reader N materialization failure yields no `run.json`, no published execution plan and dispatch count `0`;
- tests/docs make no external/multi-writer/TOCTOU/no-replace guarantee;
- evaluator fixture descriptor uses the same materializer but normal `prepare` does not materialize evaluator.

Suggested checkpoint commit after separate owner approval:

```text
feat(agent-skills): materialize replay-safe CLI eval inputs
```

### S2-CP5 — new-run prepare publication, estimate và final review

Implement public command, canonical revision artifacts/result, estimate, checkpoint progress update and cumulative review. Update another planning/index document only when its conditional ownership trigger is actually met.

Acceptance:

- exact parser/default/cap/exit contract passes with dispatch count `0`;
- execution plan accounts for every reader/evaluator/dependency and serializes exact replay inputs;
- empty v1 suites remain valid; the all-empty configured set publishes the exact zero-unit plan/result without worker/preflight/model dispatch;
- `run.json` appears only after exact-valid prepared readers + execution plan;
- missing `run.json` root is rejected as unpublished;
- zero-history estimate reports null/`unknown`, fallback recommendation and exact wave math without precision/rate-limit claim;
- explicit concurrency respects owner/local caps; max-attempt ceiling is not mislabeled expected/authorized calls;
- Stage 1 focused regressions and v1 prepare/report tests remain green;
- every S2-CP1–S2-CP4 checkpoint already passed its own formal `0 Critical / 0 Required` gate before any checkpoint commit; CP5 then passes its own formal review plus the cumulative full-branch `0 Critical / 0 Required` review before any CP5 commit or Stage 2 push action.

Suggested checkpoint commit after separate owner approval:

```text
feat(agent-skills): add CLI eval prepare command
```

Checkpoints are sequential. CP1–CP5 overlap the same compiler/CLI/artifact contracts and must not run in parallel or on stacked sub-branches.

## Required deterministic test matrix

| Area | Observable test |
| --- | --- |
| v1 foundation | import has no side effect; existing prepare success/error shape unchanged; no duplicate suite loader; failure after opaque workspace allocation still yields caller-unknown `workspace_id: null` without temp-root discovery |
| Parser | help; missing/duplicate/unknown/conflicting flags; unsafe integer/number; explicit concurrency above cap; allocation/dispatch `0` |
| All-selected scope | all three suite entries always present in `suiteOrder`; empty and mixed empty/non-empty `case_ids`; every existing case/semantic role exactly once; deterministic order; candidate-only versus comparison counts; all-empty zero-unit plan |
| Reader descriptor | invocation-path-free exact bytes; stable logical identity/projection across random workspace/variant flip; source locator keeps provenance |
| Static barrier | tampered suite/manifest/package/policy/schema/config/dependency membership rejects before run allocation |
| Evaluator schema | valid modes; exact criterion/veto order; missing/duplicate/extra IDs; trimmed strings; forbidden authoritative fields |
| Evaluator compiler | exact dependency bindings/observation bytes; candidate-only/comparison envelope; provenance exclusion; behavior invalidation dimensions |
| Materializer fresh | real same-filesystem staging → rename → final re-read; only exact two input files |
| Materializer replay | complete exact target returns deep-equal unit and target byte snapshot unchanged |
| Materializer refusal | partial/unexpected/non-regular/altered target; descriptor hash/projection/options/path mismatch; no overwrite/repair |
| Rename failure | injected boundary fails while final absent and original publish error survives; injection is used only for this error branch, not primary filesystem guarantee |
| Barrier | one reader failure leaves no `run.json`/published execution plan and calls `0` |
| Publication order | plan exists/valid before run marker; missing/invalid marker is unpublished; canonical cross-links exact |
| Estimate | complete all-unit history math; partial/missing/duplicate/extra/invalid history refusal; unknown fallback; absent/provided target matrix; target without history stays unknown; zero-unit unknown-history and complete-empty-history controls with aggregate/derived times `0`, provided-target `concurrency_for_target = 0`, positive recommendation/planned concurrency and absent-target `concurrency_for_target = null`; wave count; safe-integer max-attempt ceiling labeling |
| CLI black-box | injected v1 prepare foundation and fixed IDs/root yield exact canonical `cli_prepare_result`/`command_error`; usage stays text-only; success/result/artifact cross-links exact; no model/preflight/worker call |
| Stage 1 regression | existing diagnostic `execute-prepared`, fake-child process outcomes and bounded concurrency tests unchanged |

`run-skill-eval-cli.test.mjs` keeps one concise Vietnamese test-plan header covering both Stage 1 diagnostic execution and Stage 2 zero-dispatch preparation. Update its latest result only after the focused command actually runs.

## Verification strategy

Affected-only checks during implementation:

```text
node --check .agents/scripts/run-skill-evals.mjs
node --check .agents/scripts/run-skill-eval-cli.mjs
node --check .agents/scripts/lib/skill-evals/codex-cli-runner-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-execution-plan-v1.mjs
node --check .agents/scripts/lib/skill-evals/cli-evaluator-proposal-v1.mjs
node --check .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-eval-cli.test.mjs
node --test .agents/scripts/run-skill-evals.test.mjs
node .agents/scripts/run-skill-eval-cli.mjs --help
node .agents/scripts/run-skill-evals.mjs --help
node .agents/scripts/validate-skill.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
git diff --check
```

`run-skill-evals.test.mjs` là broader affected regression vì Stage 2 makes its entrypoint import-safe; đây không phải full application suite. Không chạy CP8A/CP8B/CP9 hoặc live `execute-prepared`/model call. Broaden chỉ khi actual diff chạm shared boundary khác hoặc focused evidence lộ regression.

Ubuntu publication evidence chỉ được claim sau existing CI step chạy trên remote PR. Local Windows pass không được relabel cross-platform pass; CI/push/PR vẫn cần separate authority.

## Review, checkpoint và delivery gates

Mỗi S2-CP1–S2-CP5 checkpoint phải nhận formal review và đạt `0 Critical / 0 Required` trước checkpoint commit hoặc khi chuyển sang checkpoint kế tiếp. S2-CP4 additionally performs an integration review over CP1–CP4 because it joins compiler, descriptor and filesystem publication boundaries; S2-CP5 additionally performs the cumulative full-branch review. Review phải inspect:

- exact master + Stage 2 contract match;
- no source/test scope từ Stage 3/4;
- one-writer publication wording và no unsupported no-replace claim;
- canonical descriptor/artifact round-trip, provenance separation và hidden evaluator input boundary;
- no evaluator dispatch/result/human-authority field;
- no fingerprint/attempt/reuse/resume state;
- plan publication marker ordering và truthful orphan/unpublished behavior;
- estimate unknown/ceiling labels và call count `0`;
- current Stage 1 CLI/test/CI behavior preserved;
- secrets/debug/conflict markers, unrelated formatting, EOL/encoding và staged/unstaged/untracked scope.

Local correction commit permission được cấp đúng một lần bởi instruction `chuẩn hóa sau đó commit` và được consume bởi checkpoint hiện tại. Exact files phải được stage, staged diff phải được inspect, và correction phải là commit mới thay vì amend/squash. Push/PR/CI-fix/merge remain separate permissions.

Supplied finding review on this draft was treated as hypotheses and independently traced to the master gate, artifact consumers and current source. It confirmed `0 Critical / 3 Required`: weaker CP1–CP3 review gates, placeholder persisted/public contracts, and inconsistent handoff/index/permission/status records. The correction makes every CP formal, freezes exact artifact/result/error/estimate relationships with all-or-nothing history, adds the Stage 2 artifact index entry, and reconciles one current permission statement. Main-agent correction re-review found `0 Critical / 0 Required`; this is not owner approval, implementation permission or independent fresh-reader evidence.

The next supplied full re-review was also treated as hypotheses and independently confirmed `0 Critical / 3 Required`: v1 explicitly permits and tests empty suite case arrays; the v1 packager may allocate an incomplete workspace without returning its ID through `ArtifactError`; and routine checkpoint documentation ownership belongs to `progress.md`, not every planning/index document. Corrections preserve empty suite entries and freeze zero-unit outputs, redefine null locators as caller-knowledge rather than allocation certainty, and move master/detail/owner-brief/README into exact conditional-owner triggers outside the default implementation diff. Main-agent correction re-review found `0 Critical / 0 Required`; owner approval and source/test implementation permission remain pending.

## Progress updates

Update only CLI-first block in `docs/agent-skills/progress.md` after each real checkpoint. Distinguish:

- `detailed plan drafted / owner review pending`;
- `implementation authorized`;
- `implemented`;
- `deterministic checks passed`;
- `Windows filesystem pass / Ubuntu CI pending`;
- `committed`;
- `pushed`;
- `PR open`;
- `merged`.

Không mark Stage 2 completed từ plan approval, source implementation chưa verify, local Windows-only evidence hoặc unpublished run root. Model/evaluator/live calls phải giữ exact count `0` trong toàn Stage 2.

## Risks và mitigations

| Risk | Impact | Mitigation / earliest exposure |
| --- | --- | --- |
| Exporting v1 prepare changes executable side effects | breaks existing validate/prepare/report CLI | CP1 import-side-effect + full v1 CLI regression; stop if main guard cannot preserve behavior surgically |
| Reader compiler refactor drifts Stage 1 package semantics | diagnostic runner behavior/fingerprint changes | one compiler owner, existing 26-test baseline plus exact projection regressions in CP1 |
| Persisted UTF-8 strings do not reproduce descriptor bytes | resume/replay would be untrustworthy | encode + hash + canonical projection revalidation at CP4; no defaults regeneration |
| Partial multi-file publication is mistaken for a run | Stage 3 consumes incomplete state | `run.json` last and required as marker; no marker means unpublished |
| Linux rename semantics are overstated | false cross-writer safety claim | one-coordinator/one-writer only; real supported tests and explicit unsupported scenarios |
| Stale/partial target is silently repaired | history corruption | exact inventory/bytes validation; no overwrite/delete/repair final target |
| Evaluator proposal gains semantic authority | model output mislabeled human decision | exact schema + forbidden-field tests in CP2; Stage 4 owns bridge |
| Dependency role/result binding leaks provenance or accepts donor output | wrong evaluator behavior/reuse | exact semantic graph checks and one-dimension substitution regressions in CP3 |
| Concurrency estimate invents duration/rate limit | misleading quota/time planning | nullable unknown fields; topology-only waves; explicit ceiling labels in CP5 |
| Empty suites are silently rejected or synthesized | Stage 2 changes v1 suite semantics and creates incompatible plan counts | retain all suite entries, allow empty `case_ids`, freeze zero-unit artifacts/estimate and cover empty/mixed controls in CP1/CP5 |
| Null error locator is overstated as proof of no allocation | hides an incomplete v1 workspace the caller cannot identify | define null as unavailable caller knowledge; do not modify packager or scan temp roots for certainty |
| Scope expands into Stage 3 store to make replay convenient | stage ownership breach | persist only static plan/projection and prepared readers; stop before unit/attempt/fingerprint state |

## Stop conditions và design-change protocol

Stop before affected implementation continues when:

- v1 prepare foundation cannot be reused without changing packager/suite semantics or a subprocess protocol;
- all selected model-visible bytes cannot be derived from current validated v1 workspace;
- exact reader compiler reuse requires changing Stage 1 public command/result/worker behavior;
- persisted static plan cannot regenerate exact descriptors without current-process defaults or non-frozen source;
- safe supported publication requires true cross-process no-replace, native binding, lock/lease/journal or multiple writers;
- `run.json`-last marker cannot prevent a partial root from being treated as current without Stage 3 state machinery;
- evaluator proposal cannot remain advisory-only or exact dependency binding requires Stage 4 result authority;
- correct estimate requires inventing rate-limit/duration certainty or a new remote probe/live call;
- implementation needs v2/App Server modules, suite/schema semantic edit, CI redesign hoặc any out-of-scope domain.

Procedure:

1. gather exact source/test/runtime evidence without model call;
2. identify affected checkpoint, contract and smallest alternatives/trade-offs;
3. report owner and stop before material design edit;
4. update master + owner brief + progress + this plan only after owner confirmation;
5. self-review corrected plan before implementation resumes.

## Specialist review decision

Default `0 specialist`. Main-agent repository trace and self-review are sufficient after the evaluator-ownership, crash-replay and portable-publication blockers were corrected in the master plan. Không còn unresolved hard-risk cluster cần separate specialist package ở draft này. Nếu implementation evidence later threatens authority, semantic lineage or publication correctness beyond this contract, re-evaluate the gate; không infer specialist hoặc delegation từ plan size.

## Completion criteria

Stage 2 implementation chỉ ready for owner checkpoint review khi:

- S2-CP1–S2-CP5 acceptance criteria pass;
- exact public command/artifact/materializer/proposal/compiler contracts are implemented without Stage 3/4 scope;
- focused Stage 2/Stage 1 suite and affected v1 runner suite pass with model/evaluator calls `0`;
- Windows local filesystem cases pass and Ubuntu evidence remains explicitly pending until CI actually runs;
- no valid `run.json` is published after any reader/static/materialization failure;
- every planned unit/dependency/count/setting is represented canonically;
- `progress.md` and the test header are current; conditional planning/index docs changed only when their exact owner trigger occurred;
- only expected implementation files plus trigger-backed conditional documentation changed;
- cumulative review reaches `0 Critical / 0 Required`.

Plan approval does not grant source implementation, commit, push, PR, CI-fix, merge, live call or remote action. Owner must authorize the next exact action boundary separately.
