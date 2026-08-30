# Agent Skill Eval Harness CLI-first — master implementation plan

## Trạng thái và quyền hạn

- Workstream: `eval-harness-cli-first`.
- Stage 0 planning branch: `feat/agent-skill-eval-cli-first`; merged qua PR #77 tại `e195569479ee49dd9592a93573c49ecad85cd9e6`.
- Current Stage 1 branch: `feat/agent-skill-eval-cli-runner`, tạo từ exact merged Stage 0 base trên ngày `2026-08-30`.
- Document status: `reviewed / Stage 1 input-correction implementation_pending`; master contract và [Stage 1 implementation plan](./stage-1-cli-runner.md) terminal correction self-review `0 Critical / 0 Required`.
- Runner implementation status: S1-CP1–S1-CP4 committed tại `49b8777`; first S1-CP5 exhausted exact `1 + 2` ceiling nhưng đạt only `transport_schema_succeeded / semantic_input_access_failed`, nên Stage 1 vẫn `STOP / design_change_required` cho tới khi approved stdin-envelope correction được implement và verify.
- Current task authority chỉ gồm update/review/local-commit correction plan và current progress evidence. Không có authority cho correction implementation, live model/evaluator call mới, push, PR, CI-fix hoặc merge.

Tài liệu này là master implementation plan của CLI-first program: nó sở hữu stage/branch order, checkpoint boundaries, acceptance criteria và verification. [Owner review brief](./owner-review-brief.md) là decision surface rút gọn; [program master plan](../../plan.md) sở hữu higher-level intent; [progress](../../progress.md) sở hữu current status.

## Mục tiêu gốc phải đạt trước tiên

Harness phải **chạy được bằng Codex CLI** và giải quyết đúng hai nguồn lãng phí đã tạo ra nhu cầu ban đầu:

1. `prepare` hoàn tất validation của toàn bộ selected static scope và đóng gói đủ prompt, context, skill/reference documents, output schema cùng model/runtime options cho mọi reader **trước reader call đầu tiên**; downstream evaluator package phải được finalize từ validated reader results và pass cùng nguyên tắc trước evaluator call tương ứng;
2. sau một failure hoặc một thay đổi bounded, harness giữ nguyên kết quả tốt, chỉ chạy lại unit bị ảnh hưởng và các dependent downstream của unit đó, thay vì mặc định chạy lại full run.

Luồng program target:

```text
validate all selected static inputs + prepare all reader units
  → write-once prepared unit packages + integrity validation
  → fresh ephemeral `codex exec` per reader unit
  → validated per-unit result
  → finalize + validate evaluator unit when reader dependencies are ready
  → fresh ephemeral `codex exec` per evaluator unit
  → status/report

failure/change
  → classify affected unit(s)
  → preserve completed independent units
  → rerun affected unit(s) + downstream dependents only
```

Thành công không phải là “có thêm adapter CLI” trên giấy. Thành công nghĩa là một operator có thể dùng command surface thực tế để:

- prepare một selected run mà không gọi model;
- chạy reader/evaluator bằng installed Codex CLI;
- thấy status theo unit;
- resume sau harness process interruption;
- retry một unit local failure mà không dispatch lại independent successes;
- thay một case input/evaluator input và chỉ invalidated unit cộng dependency closure;
- chạy tối đa một số CLI process có giới hạn;
- tạo report phản ánh rõ current, reused, failed, blocked và patch-check units.

## Lập trường kiến trúc

Chọn **CLI-only program**:

- runtime duy nhất trong workstream này là fresh/ephemeral `codex exec` subprocess;
- reuse deterministic `validate → prepare → report` foundation hiện có, đặc biệt synthetic per-case packages;
- thêm một CLI runner nhỏ, state theo unit và dependency graph tối thiểu;
- không làm App Server backend, native Codex subagent backend hoặc generic multi-backend abstraction trong program này;
- không xóa đường mở rộng: runtime invocation nằm sau một bounded internal function/interface, nhưng không tạo plugin registry, capability matrix hoặc backend-neutral schema khi chưa có backend thứ hai;
- không tiếp tục mở rộng App Server-oriented v2 harness để làm CLI path.

Stage 1 dùng delivery mode duy nhất `stdin_embedded_executor_input_v1`: runner validate exact selected v1 source package rồi losslessly materialize full textual bundle, case prompt, selected context và canonical requested execution policy trong deterministic stdin. `filesystem: package_read_only` là requested access boundary nếu filesystem access xảy ra; nó không bắt buộc reader phải gọi tool để acquire input. `tools: none` vẫn giữ nguyên và reader không được hướng dẫn gọi tool/process. Attempt-local payload copies có thể tồn tại cho transient diagnostics, nhưng stdin envelope mới là reader-facing acquisition path.

Lý do: mục tiêu hiện tại là operational throughput và bounded rerun. Mang lại toàn bộ attestation, authority, retention và transport certainty của hardening v2 sẽ lặp lại độ phức tạp đã làm lệch mục tiêu, trong khi CLI không expose đủ dữ liệu để chứng minh các guarantee đó.

## Program delivery shape

Không dồn toàn bộ implementation vào một long-lived branch. Current branch chỉ giao master plan; mỗi stage sau dùng một independent branch/PR tạo từ refreshed `main` sau khi stage trước merge:

| Stage | Planned branch | Outcome bắt buộc |
| --- | --- | --- |
| Stage 0 | `feat/agent-skill-eval-cli-first` | Master plan only; no runner implementation |
| Stage 1 | `feat/agent-skill-eval-cli-runner` | CLI runner chứng minh target executor topology: one-process-per-unit, bounded parallel và local-failure isolation trên existing prepared workspace |
| Stage 2 | `feat/agent-skill-eval-cli-prepare` | Prepare-all static barrier, execution plan và concurrency estimate |
| Stage 3 | `feat/agent-skill-eval-cli-reuse` | Exact reuse, resume, unit-local retry và affected/dependency-only rerun |
| Stage 4 | `feat/agent-skill-eval-cli-evaluator-report` | Evaluator scheduling, report/CI/docs và bounded migration pilot |

Branch names là planned names; implementation agent xác nhận conflict và refreshed base trước khi tạo. Branches không stacked mặc định. Không stage sau nào được inherit implementation, push, PR, live-call hoặc merge permission từ stage trước.

## Những gì CLI program không tuyên bố

Không implement hoặc claim:

- exact provider request/model-visible envelope ngoài input harness cấp cho `codex exec`;
- proof rằng model/provider call chắc chắn đã hoặc chưa xảy ra trong mọi crash window;
- runtime-enforced credential, network, filesystem hoặc tool isolation ngoài behavior mà Codex CLI công khai và process exit/output quan sát được;
- security hardening, signed evidence, append-only audit chain, cleanup authority, remote shadow-thread lifecycle hoặc forensic retention;
- App Server certification, native-subagent equivalence, distributed scheduler, multi-host store hoặc multiple harness writers;
- automatic semantic inference rằng một dòng đổi trong shared `SKILL.md` không thể ảnh hưởng case khác;
- token/cost accounting nếu Codex CLI không trả dữ liệu đáng tin cậy trong observable output;
- production-readiness hoặc security-readiness từ một pilot eval.

Các giới hạn này phải hiện trong `--help`/operator docs và report metadata ở mức ngắn gọn. Không dựng thêm subsystem chỉ để “chứng minh” điều CLI không quan sát được.

## Design-change escalation — không tự harden âm thầm

Nếu implementation phát hiện plan không khả thi, contract mâu thuẫn hoặc CLI không hỗ trợ assumption đã ghi, agent phải:

1. dừng affected checkpoint trước material design edit;
2. đọc lại exact source/tests/current CLI help và official docs liên quan;
3. báo owner evidence, impact, alternatives và recommendation;
4. chờ owner xác nhận nếu thay đổi runtime/backend, state/reuse semantics, command surface, stage/branch order, live-call boundary, report authority hoặc scope/exclusion;
5. update master plan + owner brief + progress và review lại trước implementation theo design mới.

Agent không được tự biến một gap thành attestation, security hardening, audit subsystem, generic abstraction hoặc App Server/native-subagent work mà owner không biết. Bounded bug fix giữ nguyên approved design có thể làm trong checkpoint đã authorize, nhưng phải được ghi trong checkpoint report; nếu không chắc đó là bug fix hay design change, treat as design change và báo owner.

## State tối thiểu vẫn bắt buộc

“Không hardening/evidence” không có nghĩa là bỏ manifest, hash hoặc dependency. Ba thứ này là functional state của chính mục tiêu resume/reuse:

- stable `unit_id` cho reader/evaluator;
- hash của exact prepared model input và execution options của unit;
- dependency edges reader → evaluator → report;
- per-unit state `pending | running | succeeded | failed | outcome_unknown | blocked`;
- bounded attempt list và accepted result path/hash;
- run-level selected scope và concurrency/retry settings.

State dùng local per-run files và one harness writer. Atomic temp-write/rename chỉ bảo vệ resume state khỏi partial local write; nó không được mô tả là security hoặc audit guarantee.

## Contract xuyên stage đã freeze

Phần này là implementation contract, không phải gợi ý. Fresh implementation session phải dùng contract này và chỉ dừng hỏi owner khi repository/CLI evidence mới chứng minh nó không khả thi. Không checkpoint nào được đổi identity, projection, state hoặc failure action bên dưới chỉ để thuận tiện cho implementation.

### Logical unit identity

Logical identity cho biết **unit là ai** qua nhiều workspace/run; behavioral fingerprint cho biết **input revision nào** của unit đang được xét; attempt ID cho biết **lần execute cụ thể nào**. Ba giá trị không được thay thế cho nhau.

Canonical logical key version `1`:

```text
reader:
{
  schema_version: 1,
  kind: "reader",
  skill: <validated skill name>,
  source_role: "candidate" | "baseline",
  suite: <validated suite name>,
  case_id: <validated case id>
}

evaluator:
{
  schema_version: 1,
  kind: "evaluator",
  skill: <validated skill name>,
  suite: <validated suite name>,
  case_id: <validated case id>
}
```

`unit_id` phải là `${kind}-${sha256Canonical(logical_unit_key)}` dùng `sha256Canonical` hiện có. Evaluator phụ thuộc mọi selected reader role của cùng `{ skill, suite, case_id }`. Candidate-only plan có một reader dependency; comparison plan có `candidate` và `baseline` dependencies.

Các trường sau **không được** tham gia logical key: `workspace_id`, absolute/temporary path, `variant_id` `A/B`, requested/ref commit, HEAD, timestamp, attempt number, model input hash hoặc execution-context hash. `A/B` không ổn định về semantic role vì v1 gán variant theo bundle hash; implementation phải resolve qua `workspace_manifest.variant_mapping` rồi dùng `candidate`/`baseline`.

S1-CP1 sở hữu key schema và `unit_id` trên. Stage 2 materialize chúng vào execution plan. Stage 3 không được định nghĩa lại identity; nó chỉ gắn fingerprint/history vào ID đã có.

### `ExecutionRequest → ExecutionResult` seam

Stage 1 freeze một internal executor seam tối thiểu. Exact JavaScript representation có thể theo nearby conventions, nhưng required fields và ownership không được đổi:

```text
PreparedUnit {
  schema_version: 1
  unit_id
  logical_unit_key
  kind: "reader" | "evaluator"
  dependencies: unit_id[]
  invocation {
    stdin_path
    output_schema_path
    cwd
    cli_options
  }
  behavior_projection
  source_locator
}

ExecutionRequest {
  prepared_unit
  attempt_id
  attempt_ordinal
  output_path
}

ExecutionResult {
  schema_version: 1
  unit_id
  attempt_id
  terminal_status: "succeeded" | "failed" | "outcome_unknown"
  exit_code
  structured_output_path
  structured_output_sha256
  process_metadata
  failure
}
```

Coordinator cấp `attempt_ordinal` positive contiguous bắt đầu từ `1` cho mỗi unit và `attempt_id = ${unit_id}-attempt-${attempt_ordinal}`. Output path phải nằm trong attempt-specific directory; retry không overwrite output/result của attempt trước. Stage 1 canary dùng ordinal `1`; Stage 3 store mới sở hữu việc cấp ordinal tiếp theo và từ chối duplicate/discontinuous sequence.

`source_locator` chứa workspace/provenance/navigation data như `workspace_id`, `variant_id`, absolute paths và source refs. Nó dùng để locate/validate package nhưng không được hash vào behavioral fingerprint. `process_metadata` và timestamps phục vụ status/debug; chúng không được hash vào reuse identity.

Worker chỉ nhận một `ExecutionRequest`, spawn/observe đúng một fresh CLI process từ `prepared_unit` và trả `ExecutionResult`. Worker không đọc/write run store, không cấp attempt ordinal, không quyết định cache/reuse/invalidation/resume/report và không tự retry. Coordinator sở hữu queue, concurrency, attempt assignment, state transition và dependency scheduling. Thiết kế này là bounded seam cho CLI hiện tại, không phải generic backend interface hoặc plugin registry.

Stage 1 có thể build `PreparedUnit` adapter tạm từ one existing v1 prepared case để chứng minh executor topology. Stage 2 thay adapter tạm bằng execution-plan compiler cho toàn selected scope mà không đổi executor seam.

### Canonical behavioral projection và fingerprint

`behavior_projection` phải mô tả mọi byte/option có thể ảnh hưởng observable model execution nhưng bỏ provenance/navigation. Reader projection version `1` giữ nguyên shape:

```text
{
  schema_version: 1,
  kind: "reader",
  stdin_sha256,
  model_visible_files: [{ relative_path, sha256 }],
  output_schema_sha256,
  cli_behavior_options
}
```

Với reader, `stdin_sha256` hash exact canonical stdin envelope đã gửi cho CLI. `model_visible_files` là lexically sorted logical payload inventory của bundle/prompt/context được losslessly nhúng trong envelope; nó không claim reader đã mở các attempt-local copies qua filesystem. Mỗi entry giữ exact source `{ relative_path, sha256 }` để giải thích input change và hỗ trợ Stage 3 invalidation. Với evaluator, cùng shape dùng `kind: "evaluator"` và `model_visible_files` gồm exact finalized evaluator-visible reader results/dependency artifacts. Absolute workspace path không được dùng.

`cli_behavior_options` chỉ gồm normalized effective values ảnh hưởng hành vi model/invocation, tối thiểu model, sandbox, ignored-user-config mode và mọi option Stage 1 thực sự truyền có thể đổi output. Omitted/default values phải được compiler resolve về một canonical explicit value trước hash. Timeout, concurrency, target minutes, output destination, run root và retry setting là coordinator/process policy, không phải behavioral fingerprint trừ khi chúng được đưa vào model-visible input.

`behavior_fingerprint = sha256Canonical(behavior_projection)`. Exact reuse yêu cầu cùng `unit_id`, cùng `behavior_fingerprint`, prior terminal `succeeded`, accepted output bytes/hash còn valid và mọi dependency fingerprint/result hash required bởi unit không đổi.

V1 raw `bundle-manifest.json`, `execution-context-manifest.json`, `workspace_input_hash` và `execution_context_hash` chỉ được validate như provenance/integrity của source workspace. Raw manifest bytes không được copy vào bounded reader input hoặc `model_visible_files`: chúng chứa random `workspace_id`, opaque `variant_id` và hashes phụ thuộc các locator đó. Runner strict-UTF-8 validates and round-trips exact validated bundle/prompt/context bytes, records their exact source hashes, and embeds the lossless strings plus exact canonical-matching `requested_execution_policy` in stdin. Complete envelope compilation occurs before attempt-directory creation; any invalid UTF-8 or byte-round-trip mismatch fails pre-materialization/pre-spawn with dispatch count `0` and no partial attempt. Runner không base64, chunk, summarize hoặc silently repair. Raw manifest identities/hashes ở `source_locator`, không ở behavioral identity.

Khi `variant_identity = "blind"`, harness-generated stdin, relative paths và metadata không được encode/reveal semantic `candidate`/`baseline`, opaque `A/B` identity hoặc `variant_mapping`. Semantic role chỉ tồn tại coordinator-side trong `logical_unit_key`, `unit_id` và `source_locator`. Đây không phải substring ban trên exact copied bundle/prompt/context content; harness không scan/rewrite payload hợp lệ chỉ vì các literal đó xuất hiện tự nhiên.

`terminal_status: succeeded` chỉ có nghĩa child process kết thúc `0`, last message đúng schema và accepted observation structurally valid. Nó không phải semantic case verdict. Deterministic runner không tự nâng transport/schema success thành semantic pass; S1-CP5 dùng bounded human/main-agent inspection riêng để xác nhận reader thực sự hiểu và thực hiện supplied case prompt.

### Failure và dispatch action

Stage 1 normalize process outcomes; Stage 3 persist và áp dụng action. Không xây generalized taxonomy ngoài bảng sau:

| Observable condition | Unit result | Run/coordinator action | Retry contract |
| --- | --- | --- | --- |
| installed executable/required-flag preflight fail trước mọi dispatch | không tạo attempt/unit failure | run `paused`, dispatch count `0` | operator sửa environment rồi `resume`; không automatic retry |
| per-unit spawn fail trước khi child process tồn tại | `failed`, `failure.code = confirmed_not_started` | independent units tiếp tục | `retry --unit` được phép; không automatic retry |
| child exit terminal nonzero với output/error đã capture | `failed`, `failure.code = terminal_process_failure` | independent units tiếp tục; dependent units chờ/block | explicit `retry --unit` được phép và attempt cũ vẫn được tính là đã execute |
| child exit zero nhưng structured output missing/invalid | `failed`, `failure.code = invalid_structured_output` | independent units tiếp tục; dependent units chờ/block | explicit `retry --unit` được phép và attempt cũ vẫn được tính là đã execute |
| timeout/cancel/interruption sau khi child đã spawn, hoặc harness restart thấy leftover `running` | `outcome_unknown` | quarantine unit; independent units có thể tiếp tục; dependents block | `resume` và `retry --unit` không redispatch unit này trong program hiện tại |
| recognized CLI-wide operational condition như executable unavailable, rate/resource ceiling có reliable signal | affected unit `failed` hoặc chưa dispatch | pause dispatch mới, preserve successes và pending units | operator sửa điều kiện rồi `resume`; không invalidate successes |
| manifest/store/fingerprint/dependency integrity không còn đáng tin | affected unit/run `blocked` | block dispatch và reuse cho run | stop và báo owner; không auto-repair hoặc import v2 hardening |

Không được suy từ “không thấy output” thành “model chưa chạy”. `confirmed_not_started` chỉ đúng khi spawn API chứng minh không có child process. Nếu child đã tồn tại rồi harness mất certainty, kết quả là `outcome_unknown` bất kể provider call thực tế có thể đã hoặc chưa xảy ra.

Minimal durable run status ở Stage 3 là `prepared | running | paused | completed | blocked`. `paused` dành cho operational condition có thể sửa mà không làm mất trust của success; `blocked` dành cho integrity failure hoặc khi không còn independent runnable work nhưng unresolved `outcome_unknown`/blocked dependency khiến run không thể complete trung thực. Unit status giữ `pending | running | succeeded | failed | outcome_unknown | blocked`; dependent `blocked` là derived state và không tạo attempt.

### Run revision, store layout và reuse decision

Stage 2 first `prepare` không có `--run`: nó tạo random local `run_id`, minimal `run.json` và execution-plan revision `1`. Stage 3 mới thêm `prepare --run <run_id>`; command này chỉ được dùng khi selected skill/suites/source roles không đổi, tạo revision kế tiếp trong cùng run, preserve unit/attempt history và compare plan mới với current stored revision. Nếu selected scope đổi, command phải refuse và yêu cầu một new run; cross-run cache/reuse không thuộc program này.

Mọi command sau prepare nhận exact `--run <run_id>`. `run_id` là local locator, không tham gia logical identity hoặc behavioral fingerprint.

Minimal Stage 3 layout:

```text
<run-root>/<run_id>/
  run.json
  revisions/<revision>/execution-plan.json
  units/<unit_id>.json
  attempts/<unit_id>/<attempt_ordinal>/result.json
  attempts/<unit_id>/<attempt_ordinal>/output/
```

`run.json` chứa `schema_version`, `run_id`, exact selected scope, current revision, run status, unit IDs và normalized concurrency/process settings, gồm frozen per-run `max_attempts`. `units/<unit_id>.json` chứa logical key, current fingerprint, dependencies + required dependency result bindings, current status, accepted result reference/hash và ordered attempt summaries. Attempt result chứa full `ExecutionResult`; stdout/stderr/structured output nằm dưới attempt output directory và được reference bằng relative path + hash. Mỗi JSON mutation dùng canonical JSON, temp file trong cùng directory rồi atomic rename; one coordinator là writer duy nhất.

Sau `prepare --run`, coordinator phân loại từng current unit theo thứ tự bắt buộc:

1. không có stored unit cùng `unit_id` → `pending`;
2. stored status `running` từ process trước → append/record terminal `outcome_unknown`, không dispatch;
3. stored `outcome_unknown` hoặc integrity `blocked` → giữ quarantine/block;
4. stored `succeeded`, same fingerprint, accepted output hash valid và all dependency bindings still exact → reusable `succeeded`, dispatch count `0`;
5. own fingerprint đổi hoặc accepted output invalid → `pending` invalidated; preserve old attempts/history;
6. evaluator/dependent chưa có ready dependency results → derived `blocked`, chưa finalize fingerprint và chưa dispatch; khi dependencies success/reusable, finalize exact evaluator `PreparedUnit`, rồi reuse nếu resulting fingerprint + bindings vẫn exact, nếu không thì `pending` invalidated;
7. stored `failed` → giữ `failed` cho tới explicit `retry --unit`; `run`/`resume` không tự dispatch nó;
8. dependency chưa success/reusable → derived `blocked` cho đến khi dependency đạt success; independent `pending` units vẫn runnable.

`run` và `resume` dispatch only `pending` ready units. `retry --unit` accepts only exact selected `failed` units khi next ordinal không vượt per-run `max_attempts`, allocates next contiguous attempt và không reconsider dependents cho tới khi retry succeeds. Sau success, coordinator finalize each dependent projection: equal fingerprint/bindings reuse prior success; changed projection becomes `pending` và được dispatch. `patch-check --unit` builds closure from current revision but leaves every untouched invalidated old-revision unit historical; exact-current completeness remains false.

### V1/V2 reuse matrix

“Reuse” trong bảng này có ba nghĩa tách biệt: `direct` là import/call implementation hiện có; `extend` là giữ module/format v1 và thêm bounded consumer/field qua owning stage; `port invariant/tests` là viết CLI-native code mới nhưng copy observable guarantee và regression scenario, không copy dependency graph của v2.

| Existing asset | Quyết định bắt buộc | Stage/consumer | Contract cụ thể |
| --- | --- | --- | --- |
| `artifact-schema-v1.mjs` | `direct` | Stages 1–4 | Dùng `canonicalJson`, `canonicalJsonLine`, `sha256Bytes`, `sha256Canonical`, `parseStrictJson` và existing v1 validators khi đọc artifact tương ứng; không tạo canonical/hash helper thứ hai. |
| `run-skill-evals.mjs validate/prepare/report` | `direct` cho current commands; bounded bridge | Stages 1, 2, 4 | Stage 1 consume workspace do current `prepare` tạo; Stage 2 gọi/reuse validation + prepare foundation; Stage 4 chỉ bridge vào report nếu không làm sai human/model attribution. Runner v1 vẫn không được claim là model executor. |
| `synthetic-workspace-v1.mjs` | `direct consumer`, không edit trong approved Stage 1–2 scope | Stages 1–2 | Stage 1 dùng `resolveWorkspace`, `readArtifactBytes`, `resolveWorkspacePath` và `listWorkspaceFiles` để consume selected prepared units; Stage 2 reuse `prepareSyntheticWorkspace` và các read helpers để compile all-unit plan. Viết adapter/compiler bên ngoài module. Nếu required model-visible package data thật sự không thể derive từ validated files hiện có, stop theo design-change escalation trước khi sửa packager. |
| `logical-identity-v2.mjs` | `port invariant/tests`, không import | Stages 1, 3 | Port separation giữa provenance và behavior, exact affected-unit identity cases và dependency-change cases vào CLI-native key/projection phía trên. Không import v2 HarnessArtifact/runtime-attestation contracts. |
| `orchestrator-v2.mjs` | `port invariant/tests`, không extract/import worker loop mặc định | Stages 1, 3 | Viết scheduler CLI-native nhỏ; port bounded overlap, cap, independent survival, no duplicate unit và completion-order-independent outcomes. Chỉ được extract helper nếu checkpoint discovery chứng minh helper thuần, không kéo readiness/store/App Server imports và diff nhỏ hơn scheduler mới; nếu không thỏa thì giữ quyết định viết mới. |
| `run-store-v2.mjs` | `port state invariants/tests`, không import | Stage 3 | Viết `cli-run-state-v1.mjs` one-writer + atomic replace. Port success reuse, prepared-safe retry, dispatched/running → `outcome_unknown`, no duplicate dispatch, restart continuation và affected history cases. Không port CAS, journal chain, lease, runtime snapshot/index, authority hoặc housekeeping. |
| `readiness-v2.mjs` | `port pre-dispatch invariant/tests`, không import | Stage 2 | Static selected-input/package/schema/config failure phải tạo dispatch count `0`. Không port grants, rounds, attestation, helper calls hoặc CP8A adapter certification. |
| `review-v2.mjs` | `port evaluator/report invariants/tests`, không import | Stage 4 | Model evaluator output vẫn proposal/advisory; deterministic report không relabel thành human-authored acceptance. Không port v2 review artifact graph, retention hoặc human-acceptance subsystem. |
| `harness-schema-v2.mjs`, runtime identity, App Server/CP9 modules | `reject` | none | Không import, extend hoặc làm dependency của CLI-first runtime. Một shared pure helper cần move là material design finding và phải theo design-change escalation. |

CLI-native modules phải viết mới vì ownership/runtime khác, dù v2 đã có behavior tương tự:

- `codex-cli-runner-v1.mjs`: process invocation + bounded worker pool theo executor seam;
- `cli-execution-plan-v1.mjs`: compile logical keys, PreparedUnits, dependencies, counts và concurrency estimate từ validated v1 workspace;
- `cli-run-state-v1.mjs`: minimal run/unit/attempt persistence, one writer và atomic replace;
- `cli-impact-v1.mjs`: compare current plan với stored fingerprints và compute downstream closure;
- CLI command orchestration trong `.agents/scripts/run-skill-eval-cli.mjs`.

Không được copy v2 module rồi xóa dần dependencies. Regression case được port phải assert CLI-first observable behavior bằng fake child process/store boundary; không giữ artifact/field chỉ vì v2 test từng dùng nó.

## Repository discovery đã xác nhận

- `.agents/scripts/run-skill-evals.mjs` hiện sở hữu `validate`, `prepare --isolation synthetic` và `report`.
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` đã tạo deterministic workspace, per-case prompt/context, `execution-context-manifest.json`, skill/reference bundle và output templates.
- `.agents/scripts/run-skill-eval-harness.mjs` cùng v2 modules hiện tập trung vào App Server/CP9 contracts; CLI-first workstream không cần mở rộng contract đó để đạt mục tiêu gốc.
- CI hiện chạy v1 runner tests, v2 harness tests và repository/suite validation.
- Local Codex CLI `0.151.0-alpha.7.2` expose non-interactive `codex exec`, prompt từ stdin, `--ephemeral`, `--json`, `--output-schema`, `--output-last-message`, `--model`, `--sandbox`, `--cd` và `--ignore-user-config`.
- [Official Codex CLI reference](https://developers.openai.com/codex/cli/reference) mô tả `codex exec` là non-interactive command, có JSONL output, structured output schema và ephemeral mode. Exact available flags vẫn phải được preflight từ installed executable tại runtime; plan không pin alpha version làm product contract.

## Reuse và invalidation — ranh giới trung thực

### Automatic exact reuse

Một `succeeded` unit được reuse tự động chỉ khi exact prepared model input, output schema và behavior-relevant CLI options của unit không đổi. Downstream unit được reuse khi input riêng và hashes của mọi required dependency đều không đổi.

Ví dụ:

- typo chỉ trong context của case A → rerun reader A và evaluator A;
- evaluator rubric/schema đổi → giữ reader results, rerun affected evaluator units;
- reader A malformed output → mark failed và cho phép explicit retry reader A; evaluator A đợi, case B–N tiếp tục;
- reader A timeout sau spawn → `outcome_unknown`, không redispatch; evaluator A block, case B–N tiếp tục;
- report rendering đổi → không rerun reader/evaluator.

### Shared skill change

Nếu full `SKILL.md` là model-visible input của mọi reader, một thay đổi trong file đó làm đổi exact input của mọi reader. Harness không được tự tuyên bố các reader khác “unaffected” bằng semantic guessing.

Để vòng chỉnh sửa 1–2 dòng không phải đốt full run ngay lập tức, Stage 3 có `patch-check`/affected-only operation:

- operator nêu explicit affected unit IDs;
- harness chạy các unit đó và dependency closure trên package mới;
- prior successes của unit khác được giữ làm historical reference, không bị xóa;
- status/report đánh dấu run là partial/mixed-revision patch check và không claim complete current-revision coverage.

Khi cần final exact-current report, mọi unit có changed exact input phải được chạy hoặc có exact-current success. Package slicing/declared section-to-case dependency có thể làm finer-grained exact reuse trong future workstream, nhưng không thuộc program này vì nó thay đổi model-visible evaluation contract.

## Command surface dự kiến

Command spelling dưới đây được freeze bởi Stage 0; implementation không đổi tên/meaning nếu không đi qua design-change escalation:

```text
execute-prepared --workspace <workspace_id>
                 --unit <candidate|baseline>:<suite>:<case_id> [--unit ...]
                 [--concurrency <n>]
                    # Stage 1 diagnostic/live-canary path; consumes only an already validated v1 workspace; no durable reuse/retry
prepare [existing v1 selection flags]
                    # Stage 2 creates a new run/revision 1; zero model calls
prepare --run <run_id> [same-scope existing v1 selection flags]
                    # Stage 3 adds same-run next revision; preserve history; zero model calls
run --run <run_id>  # run prepared pending ready units
status --run <run_id>
                    # show per-unit and aggregate state
resume --run <run_id>
                    # continue pending work without rerunning successes; never redispatch outcome_unknown
retry --run <run_id> --unit <unit_id> [--unit <unit_id> ...]
                    # retry explicit failed units, reject outcome_unknown, then re-evaluate downstream dependents after success
patch-check --run <run_id> --unit <unit_id> [--unit <unit_id> ...]
                    # run explicit affected closure against current changed input; keep mixed-revision label
report --run <run_id>
                    # summarize exact-current or clearly partial/mixed state

common execution options:
  --concurrency <n>       # number of simultaneous fresh CLI processes
  --max-concurrency <n>   # owner/operator ceiling used by recommendation
  --max-attempts <n>      # total attempts per unit, integer >= 1, default 2; retry remains explicit
  --target-minutes <n>    # optional wall-time target for planning
```

Command ownership: Stage 1 implements `execute-prepared`; Stage 2 implements new-run `prepare` and emits run ID/revision-1 execution plan/estimate without model calls; Stage 3 adds same-run `prepare --run` plus `run`, `status`, `resume`, `retry` and `patch-check`; Stage 4 implements `report`. `execute-prepared` remains a low-level diagnostic/canary path and is never evidence of durable reuse/resume. Không có arbitrary prompt command. Runner chỉ consume validated prepared packages owned by the workspace.

## Stage và checkpoint breakdown

### Stage 0 — Master plan only

Branch: `feat/agent-skill-eval-cli-first`.

- S0-CP1: confirm CLI/process, prepared-workspace and independent-branch feasibility.
- S0-CP2: freeze program stages, design escalation, concurrency sizing and permission boundaries.
- S0-CP3: validate docs/source-of-truth links, staged diff and formal review.

Acceptance: docs-only diff; validation pass; terminal review `0 Critical / 0 Required`; one English Conventional Commit and normal push. No runner source/workflow edit và model calls `0`.

### Stage 1 — Runnable bounded-parallel CLI runner

Branch: `feat/agent-skill-eval-cli-runner`, from refreshed `main` after Stage 0 delivery/merge decision.

Exact transferable contract: [Stage 1 implementation plan](./stage-1-cli-runner.md). Nếu summary dưới đây và detailed Stage 1 plan conflict, dừng và reconcile master plan; không chọn ngầm một bản.

Stage 1 consumes an existing validated workspace from `run-skill-evals prepare`; it does not rebuild prepare orchestration.

- S1-CP1: new small CLI entrypoint with exact `execute-prepared` command above; freeze `logical_unit_key`/`unit_id` and `ExecutionRequest → ExecutionResult` seam; add installed-executable/flag preflight and bounded invocation function for fresh `codex exec --ephemeral` with stdin prompt, structured output schema and isolated per-unit outputs. Stage 1 adapter resolves v1 `variant_mapping` to semantic `candidate`/`baseline`; it never keys by `A/B`.
- S1-CP2: sequential vertical-slice test on the same branch proves one prepared unit can invoke, finish and validate correctly. Sequential is a diagnostic gate only, not target architecture or a separately mergeable delivery.
- S1-CP3: bounded worker pool on the same branch; default concurrency `4`, explicit operator cap, one fresh process per active unit, one coordinator, configured timeout and independent failure isolation.
- S1-CP4: parallel integration tests prove overlap, cap enforcement, per-unit output binding and local-failure survival. Stage 1 is not complete and its PR is not merge-ready if only the sequential slice passes.
- S1-CP5 historical gate: exact `1` sequential plus `2` parallel readers is consumed and retained only as transport/schema + overlap evidence because semantic input acquisition failed. After stdin-envelope correction deterministic review, a new separately authorized affected-only gate runs exactly two **different** prepared reader units in one command at concurrency `2`; new ceiling `2 reader / 0 evaluator / 0 automatic retry`. No new sequential canary belongs to the correction gate.

Acceptance:

- tests observe real overlap with `active_count > 1` and never exceed cap;
- one process start failure, nonzero exit, timeout or malformed output does not cancel independent units;
- same unit never has simultaneous attempts;
- same semantic reader produces the same `unit_id` across two workspaces with different random `workspace_id`; a simulated `A/B` flip does not change candidate/baseline unit IDs;
- executor worker receives only `ExecutionRequest`, returns only `ExecutionResult` and never reads/writes future run state, assigns attempt sequence or retries itself;
- exact argv/stdin/cwd/schema works with Windows/spaced paths;
- deterministic tests make zero real calls;
- sequential pass proves only that one CLI invocation works;
- Stage 1 cannot claim “harness works as intended” or close until bounded parallel behavior passes;
- corrected actual-model CLI semantic input consumption remains unverified until the separately authorized two-reader concurrent correction gate passes; retained first-gate evidence continues to prove only transport/schema and process overlap.

Forbidden quota pattern: full or representative-large sequential batch followed by the same full parallel batch. Deterministic fake-process tests may use many units because they make zero model calls; the only proposed new live Stage 1 gate is the affected-only two-reader concurrent command above. Full migration is not authorized until later stages provide prepare, recovery/reuse and final execution planning.

Stop if installed CLI cannot consume a prepared package non-interactively or structured output cannot be bound to one invocation. Do not fall back silently to App Server.

### Stage 2 — Prepare barrier, execution plan and concurrency estimate

Branch: `feat/agent-skill-eval-cli-prepare`, from refreshed `main` after Stage 1 merge.

- S2-CP1: reuse v1 suite validation/synthetic packaging; compile every selected reader into the frozen `PreparedUnit` contract plus evaluator logical keys/static plans/dependency skeletons. Compiler derives semantic source role from `variant_mapping` and preserves workspace/path/ref data only under `source_locator`.
- S2-CP2: validate all selected static inputs, required files, output schemas, CLI config and writable run root before first reader dispatch.
- S2-CP3: build canonical reader `behavior_projection`; create random `run_id`, minimal `run.json` and `revisions/1/execution-plan.json`; emit total reader/evaluator units, ready-set/dependency waves, expected calls and a concurrency recommendation. Model-visible file inventory uses relative paths + content hashes; provenance/navigation fields remain outside the projection. Stage 2 writes no attempt, accepted result, retry hoặc reuse history.
- S2-CP4: finalize each evaluator `PreparedUnit`, dependency result bindings and canonical `behavior_projection` only after required reader results exist; validate all of them before the evaluator call.

Concurrency sizing:

```text
total_work_seconds = sum(estimated duration of selected runnable units)
concurrency_for_target = ceil(total_work_seconds / target_wall_time_seconds)
recommended_concurrency = min(
  max(1, concurrency_for_target),
  owner_max_concurrency,
  local_process_cap,
  observed_rate_limit_cap
)
estimated_wall_time >= max(total_work_seconds / recommended_concurrency,
                           dependency_critical_path_seconds)
```

- If no trustworthy duration/rate-limit history exists, report those inputs as `unknown` and recommend `min(4, owner/local caps)` rather than inventing precision.
- For `30` independent units and concurrency `4`, show `ceil(30/4) = 8` scheduling waves; evaluator dependencies are calculated separately or through the DAG critical path.
- Concurrency changes wall time, not total quota. Expected calls remain unit count plus explicitly authorized retries.
- Duration calibration reuses timing from already-authorized canary/migration units; it does not run an extra full sequential benchmark.
- `429`, repeated transport failure or local resource pressure blocks fan-out increase; current program does not need an automatic adaptive controller.

Acceptance: invalid/missing selected static input yields reader dispatch count `0`; generated plan accounts for every unit/dependency; regenerated equivalent workspace yields equal logical IDs and behavior fingerprints despite different `workspace_id`/absolute root; changing only provenance/HEAD metadata does not invalidate behavior, while changing stdin/model-visible bytes/schema/behavior option does; estimate exposes assumptions and caps; no unsupported rate-limit certainty claim.

### Stage 3 — Exact reuse, resume and affected-only rerun

Branch: `feat/agent-skill-eval-cli-reuse`, from refreshed `main` after Stage 2 merge.

- S3-CP1: add same-run `prepare --run`; consume Stage 1 logical IDs without redefining them; persist canonical reader/evaluator `behavior_fingerprint`, dependency result bindings and accepted output path/hash; implement exact reuse decision from the frozen projection contract.
- S3-CP2: new `cli-run-state-v1.mjs` with one writer, one local run manifest plus bounded per-unit attempt history and atomic temp-write/rename. Persist run status, unit status, attempt ID/result/failure and selected execution settings only; do not import v2 store.
- S3-CP3: `resume` continues `pending` work and retains exact successes; explicit `retry --unit` accepts only `failed` and creates the next attempt when next ordinal is within frozen per-run `max_attempts` (default `2`). After retry success, finalize downstream projections and dispatch only dependents whose exact fingerprint/bindings changed; reuse still-exact dependents. No automatic retry. Leftover `running`, timeout/interruption after spawn or lost child certainty becomes `outcome_unknown`; both `resume` and `retry --unit` reject redispatch of that unit while independent work remains runnable.
- S3-CP4: compare current execution plan with stored `{ unit_id, behavior_fingerprint, dependency bindings }`, invalidate exact changed units and compute downstream closure; implement explicitly selected `patch-check` with partial/mixed-revision labeling and no promotion of untouched old-revision success to exact-current success.

Acceptance:

- process restart does not rerun exact successes;
- equivalent re-prepare under a new `workspace_id`, absolute root or HEAD-only provenance change reuses exact successes;
- case-local input change reruns that reader plus downstream evaluator only;
- evaluator-only change preserves reader results;
- local failure affects one unit and dependents while independent workers continue;
- spawn-confirmed-not-started can be explicitly retried; malformed terminal output can be explicitly retried and preserves the consumed attempt; retry beyond `max_attempts` is rejected without dispatch; `outcome_unknown` cannot be redispatched by `resume` or `retry --unit`;
- completion order does not change persisted reuse/rerun/blocked sets; two entries with the same `unit_id` are never dispatched concurrently;
- shared `SKILL.md` change affects every exact input receiving it; patch-check never appears as complete exact-current report.

### Stage 4 — Evaluator, report and migration completion

Branch: `feat/agent-skill-eval-cli-evaluator-report`, from refreshed `main` after Stage 3 merge.

- S4-CP1: evaluator as an ordinary dependent CLI unit; model output remains advisory/draft and is not relabeled human-authored.
- S4-CP2: smallest truthful bridge to current v1 report, or a small CLI-first report shape if v1 human-evaluation semantics cannot be reused.
- S4-CP3: deterministic CI and operator docs covering prepare, estimate, run, failure, resume, retry, patch-check and report.
- S4-CP4: separately authorized pilot/migration batch using Stage 2 recommendation and explicit call/concurrency ceilings.

Acceptance: fake end-to-end prepare → parallel execute → one-unit failure → preserve independent success → resume/retry affected closure → evaluator/report passes; evaluator proposal is never materialized as human-authored acceptance; exact-current report rejects mixed-revision untouched units while patch-check report labels them; cumulative review `0 Critical / 0 Required`; live result claims only observed CLI behavior.

## Expected source ownership by stage

Exact names may be adjusted at the owning checkpoint to match conventions, nhưng một stage không được prebuild files/abstractions của later stage:

| Stage | Expected source ownership |
| --- | --- |
| Stage 1 | new `.agents/scripts/run-skill-eval-cli.mjs`, focused test file và `codex-cli-runner-v1.mjs`, plus focused deterministic runner step in `.github/workflows/ci.yml`; owns command spelling, logical key/ID helpers, selected v1 workspace adapter, process invocation, `ExecutionRequest → ExecutionResult` seam and worker pool only |
| Stage 2 | `cli-execution-plan-v1.mjs` plus minimal consumer/extension of v1 suite/synthetic-workspace modules; owns PreparedUnit compilation, behavioral projection, dependency skeleton and estimate; no resume/reuse state |
| Stage 3 | `cli-run-state-v1.mjs`, `cli-impact-v1.mjs` and corresponding command/test extensions |
| Stage 4 | evaluator/report bridge, corresponding evaluator/report CI extension and bounded `docs/agent-skills/eval-design.md` operator docs |
| Every stage | exact status reconciliation in `docs/agent-skills/progress.md`; master plan changes only through the design-change protocol |

Follow the frozen V1/V2 reuse matrix above; “prefer reuse” không phải quyền tùy ý import v2 dependency graph. Do not edit App Server/CP9 modules unless a later repository fact proves a shared pure helper must move; such a change is material, requires owner notification, plan update and re-review first.

## Verification strategy

No live model is needed for deterministic implementation review. Stage 1 actual-CLI canary và Stage 4 pilot remain separately authorized live gates. Required deterministic layers:

- unit tests for identity, dependency closure, state transitions and command construction;
- integration-style fake child-process tests for success, local failure, malformed output, timeout/interruption, restart, retry and concurrency;
- existing v1 runner and repository/suite validators;
- syntax, targeted lint if applicable, `git diff --check`, added-line secret/conflict scan;
- per-checkpoint staged-diff review and cumulative branch review.

Tests assert observable behavior: dispatch counts by unit, persisted status, reuse/rerun sets, dependency blocking and report completeness label. They must not mock away the coordinator/store boundary being tested.

Required v2 regression mining is fixed below. Implementation agent locates current tests by exact test name, ports the observable scenario into CLI-first tests with fake child processes/local CLI store, and does **not** import the v2 subject under test:

| Owning stage | Existing regression scenario to port | CLI-first assertion |
| --- | --- | --- |
| Stage 1 | `CP7 classified retry and bounded concurrency append durable attempts without duplicate units` — concurrency/no-duplicate subset only | real worker overlap, cap enforcement, one process per active unit and no simultaneous duplicate `unit_id`; retry/store parts remain Stage 3 |
| Stage 2 | readiness/static-invalid fixtures in current harness tests | invalid selected package/schema/config produces child-process dispatch count `0` |
| Stage 3 | `CP3 recovery converts a persisted dispatched call into terminal outcome_unknown without retry` | leftover `running` becomes `outcome_unknown` and no resume/retry dispatch occurs |
| Stage 3 | `CP3 resume planning retries a prepared call that is confirmed not started` | `confirmed_not_started` unit is eligible only for explicit retry and receives next attempt ID |
| Stage 3 | `CP3 rejects duplicate or skipped retry sequence numbers for one unit` | CLI store rejects duplicate/discontinuous attempt sequence |
| Stage 3 | `CP5 restart reuses exact completed readers and resumes only the incomplete unit` | restart dispatch set excludes exact successes |
| Stage 3 | `CP5 reader identity change reruns only the exact affected unit and preserves its history` | changed fingerprint invalidates that unit + downstream closure, not independent units |
| Stage 3 | `CP5 outcome_unknown blocks resume without duplicate dispatch` | uncertain unit remains quarantined while independent pending work may continue |
| Stage 4 | current evaluator/review tests separating proposal, human decision and report | CLI evaluator output remains advisory and report completeness/attribution is truthful |

Additional CLI-first regression cases with no exact v2 equivalent are mandatory:

- two v1 workspaces with different random `workspace_id` but identical model-visible bytes/options produce equal unit IDs and fingerprints;
- simulated `variant_mapping` flip preserves semantic candidate/baseline unit IDs, deterministic stdin and fingerprints for the same semantic payload;
- provenance-only HEAD/ref/absolute-root/timestamp changes do not invalidate reuse;
- raw bundle/context manifests and every referenced payload byte validate before spawn; manifest/hash/path or source-policy-to-suite mismatch yields dispatch count `0`;
- raw source manifests are absent from reader-visible input and projection while their provenance stays in `source_locator`;
- canonical stdin contains exact requested execution policy plus lossless bundle/prompt/context payload values; policy, instruction, embedded payload bytes/relative label, output schema or behavior option change invalidates the exact unit;
- invalid UTF-8 or byte-round-trip mismatch fails before spawn with dispatch `0`; no base64/chunk/repair fallback is introduced;
- blind harness-generated stdin/path/metadata does not expose semantic role, opaque variant identity or mapping; regression assertions do not substring-scan or rewrite exact payload content;
- `patch-check` cannot promote untouched old-revision unit to exact-current reusable success;
- a terminal malformed-output failure records one consumed attempt, explicit retry creates one additional dispatch, and independent success count remains unchanged.

## Delivery and review gates

Every implementation checkpoint is an independent rollback/review boundary:

```text
implement one CP
  → focused deterministic verification
  → inspect working diff
  → stage explicit CP files
  → inspect staged diff
  → formal review
  → require 0 Critical / 0 Required
  → English Conventional Commit
```

Push, PR creation, CI watch/fix, merge and live model calls remain separate permissions unless the owner explicitly grants them for that checkpoint. No implementation begins merely because Stage 0 master plan is pushed.

## Risks và stop conditions

- If structured CLI output cannot be bound reliably to one invocation, stop before persistent success/reuse is implemented.
- If evaluator output cannot fit current v1 human-evaluation contract without false attribution, add a small CLI-first draft/report shape; do not mislabel model output as human evidence.
- If exact-current reuse and “one-line shared skill edit reruns only one case” conflict, preserve exact-current correctness and use patch-check. Do not hide mixed revisions.
- If bounded concurrency needs multiple writers or cross-process locks, keep single coordinator and lower concurrency; do not build a distributed store.
- If required work expands into App Server/native subagent/security hardening, stop and request a separate plan decision.

## Owner decisions đã chốt và gate còn lại

Owner direction trong task hiện tại đã chốt:

1. CLI-only program; App Server/native subagent/multi-backend nằm ngoài implementation scope và không block CLI path.
2. Master plan dùng Stage 0 planning branch rồi bốn independent implementation branches/PRs, merge tuần tự từ refreshed `main`.
3. Stage 1 phải chứng minh target executor topology bằng bounded parallel; sequential-only runner không phải target architecture.
4. Stage 2 phải chuẩn bị/validate trước call và tính concurrency từ unit count, duration/target/caps; không invent rate-limit certainty.
5. Stage 3 sở hữu exact reuse/resume/affected rerun; Stage 4 sở hữu evaluator/report/pilot completion.
6. Không dựng hardening/attestation mà Codex CLI không hỗ trợ; vẫn giữ functional state tối thiểu cho resume/reuse.
7. Mọi material design conflict phải báo owner và update/review plan trước; không tự harden hoặc đổi architecture âm thầm.
8. Stage 0 chỉ lập, review, commit và push master plan; chưa implement runner.
9. S1-CP1 sở hữu stable logical key/ID và executor seam; Stage 3 chỉ sở hữu behavioral fingerprint, store, reuse/resume/retry/invalidation trên contract đó.
10. Logical ID dùng semantic `candidate`/`baseline`, không dùng opaque `A/B`; reuse fingerprint loại `workspace_id`, absolute path, HEAD/ref/timestamp/provenance và v1 execution-context hash.
11. Reuse v1 direct theo matrix; v2 chỉ là nguồn invariant/regression cases. CLI scheduler, execution plan, store và impact engine phải là CLI-native modules mới, không import App Server/v2 dependency graph.
12. `outcome_unknown` bị quarantine và không được `resume`/`retry --unit` redispatch; local terminal failure có thể explicit retry, không automatic retry.

Owner đã approve master-plan direction và yêu cầu review-pass delivery. Quyền bắt đầu Stage 1 implementation vẫn là gate riêng chưa được cấp.
