# Agent Skill Eval Harness hardening — detailed implementation plan

## Trạng thái và quyền hạn

- Workstream: `eval-harness-hardening`.
- Planning branch: `refactor/agent-skill-eval-harness`.
- Synchronized planning base: `origin/main` tại `3cb7a9f9707e805c275bfced1c4e11b489727eb3` ngày `2026-08-20`.
- Document status: Stage 1 (`CP1–CP4`) is completed and delivered. Final delivered Stage 1 HEAD is `54453746b2ea796558ef229831a569a69c4ed3f4`; exact latest delivery state belongs to Git evidence.
- Implementation decision: Stage 1 (`CP1–CP4`) was implemented/delivered; Stage 2 (`CP5–CP7`) is implemented and has passed its terminal cumulative `0 Critical / 0 Required` gate using deterministic/fake adapters only. Exact latest delivery state belongs to Git evidence.
- Owner-decided architecture baseline trong task này là authoritative cho plan; nó không tự cấp quyền implement bất kỳ checkpoint nào.
- Stage 3 CP8A is completed at `f9c821323ae5e8aa277d2cd68d4b416d80cf553e` with terminal correction review `0 Critical / 0 Required`; certification used deterministic mocked App Server transport only and made zero live model/helper/evaluator/provider calls. The CP8B Pre-code Contract Freeze below is owner-approved, but CP8B implementation remains a separate gate.
- No standing Stage 1, Stage 2 or CP8A implementation/push authority remains. Current authority is limited to the CP8B planning/owner-review contract documents and the one local contract-freeze checkpoint explicitly requested for this task. This plan does not grant CP8B implementation, live model/helper/evaluator/provider calls, push, PR creation/update, CI watch/fix, merge, deployment or history rewrite.

Tài liệu này sở hữu detailed implementation specification, dependency order, acceptance criteria và verification strategy của hardening workstream. [Owner review brief](./owner-review-brief.md) là decision surface rút gọn; [master plan](../../plan.md) sở hữu program intent; [progress](../../progress.md) sở hữu trạng thái hiện tại.

## Kết quả cần đạt

Hardening phải biến foundation v1 từ bộ công cụ deterministic `validate → prepare → report` thành một orchestration layer có thể chạy và tiếp tục model eval an toàn, nhưng vẫn tái sử dụng foundation hiện tại. Luồng authoritative là:

```text
validated suite
  → prepared package
  → compiled reader invocation
  → readiness attestation
  → reader attempt
  → validated observation
  → evaluator proposal
  → canonical run review summary
  → deterministic Markdown/HTML review representations
  → human/authorized reviewer decision
  → accepted semantic evidence
  → deterministic report
```

Thành công nghĩa là:

1. không reader call nào xảy ra trước khi exact compiled invocation vượt P0;
2. model evaluator chỉ tạo proposal, không trực tiếp tạo authoritative `human_evaluation`;
3. cache/reuse dựa trên logical inputs, còn Git ref/commit chỉ là provenance;
4. attempt và validated artifact là immutable, có thể resume sau process/workspace/HEAD change;
5. unknown dependency impact fail closed hoặc rerun bounded affected group;
6. active task giữ resume state; lifecycle cleanup không dựa chủ yếu vào TTL;
7. concurrency, retry, timeout, cancellation và progress không làm yếu readiness, identity hoặc artifact correctness;
8. historical v1 artifacts vẫn đọc được mà không được auto-promote thành accepted v2 evidence.
9. owner có thể đọc aggregate run outcome và mọi exception từ canonical structured summary qua Markdown hoặc offline-safe HTML mà không mở từng successful/equivalent case.
10. reader/evaluator/user-derived review content chỉ hiển thị như untrusted text, không thể trở thành executable Markdown/HTML/JavaScript/CSS, unsafe URL hoặc remote resource load.
11. mọi aggregate count được derive/validate từ exact declared scope và không thể tự mâu thuẫn sau retry, resume, reuse hoặc incomplete evidence.
12. mỗi historical run cho phép owner tìm một bounded local index để hiểu `why → intended input → exact App Server request → runtime events → evidence/result` mà không cần tra lại Codex chat, đồng thời không overclaim provider-transparent execution.

## Ngoài phạm vi

- Không thay đổi suite meaning, skill content, migration allocation hoặc frozen historical verdict.
- Không tự động sửa durable policy/schema để làm readiness pass.
- Không dùng evaluator output làm final authority.
- Không thiết kế distributed scheduler, multi-host lock service hoặc general-purpose job platform.
- Không hỗ trợ mutation-capable model eval cho tới khi có environment-enforced disposable sandbox riêng.
- Không mặc định full-suite rerun nếu dependency impact có thể giới hạn an toàn.
- Không xóa v1 CLI hoặc rewrite historical artifact.
- Không thực hiện model eval trong các checkpoint code foundation; real pilot là gate riêng cần explicit authority.

## Repository discovery đã xác nhận

### Foundation cần giữ

- `.agents/scripts/run-skill-evals.mjs` hiện sở hữu ba command `validate`, `prepare --isolation synthetic`, `report`.
- `.agents/scripts/lib/skill-evals/suite-schema-v1.mjs` validate suite/case/executor input và requested execution policy.
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` sở hữu snapshot, blind package, manifest/hash, bounded path và integrity behavior.
- `.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs` sở hữu observation, human evaluation và generated report v1.
- `.agents/scripts/run-skill-evals.test.mjs` hiện có 130 deterministic tests; `.github/workflows/ci.yml` chạy test và `validate --all`.
- Eval catalog hiện configure `9 skills / 27 suite files / 187 cases` và deterministic validation không có diagnostic; repository structural validator nhận `11 skills`.

Foundation v1 không invoke model, không có execution adapter, durable run state, resume, evaluator proposal, acceptance gate hoặc cleanup. `execution-context-manifest.json` chứa requested policy, nhưng observation template chỉ yêu cầu executor tự ghi access. Vì vậy package đúng không chứng minh exact executor invocation đã expose policy hoặc enforcement được thỏa.

### Contradiction check sau sync

Range mới từ old branch head `effb5571955aa09b714e97b7162a6bb3bed0bca4` tới synchronized `3cb7a9f9707e805c275bfced1c4e11b489727eb3` không đổi `.agents/**`, `docs/agent-skills/**`, `AGENTS.md` hoặc `docs/agent-loops.md`. Không có evidence làm invalid owner baseline hoặc discovery trên.

## Evidence classification và planning depth

### Confirmed facts

- Runner/schema/workspace paths, v1 command surface, CI wiring, test count và catalog count được đọc trực tiếp từ synchronized repository.
- V1 `workspace_input_hash` có Git/control-plane/source provenance nhưng không phải logical cross-run reader cache identity.
- Current prepared package records requested execution policy; không có adapter/dispatch layer chứng minh exact reader invocation đã expose hoặc enforce policy.
- Current `human_evaluation` v1 là human-authored comparison artifact; report xem valid present artifact là complete evidence. Hardening phải giữ v1 semantics và thêm v2 authority chain riêng.
- Current workspace là fixed OS-temp location, không có resume/cleanup contract.
- Sáu CP9 case IDs tồn tại trong current GCW/GHCI suite files.
- Owner đã chọn `codex_chatgpt_app_server` với `runtime_mediated` assurance và ChatGPT subscription/auth boundary. Official App Server contract expose exact local JSON-RPC lifecycle, `threadId`/`turnId`, `instructionSources`, model/effort, sandbox policy and `outputSchema`, nhưng không expose exact upstream provider request/model-visible envelope.

### Assumptions cần verify cục bộ trong checkpoint

- Node built-ins đủ cho atomic local store/lease của single-host trusted-local threat model; CP3 phải kiểm chứng Windows/POSIX rename/lock behavior trước khi đóng implementation.
- `codex_chatgpt_app_server` có thể expose exact harness-controlled input và exact JSON-RPC request tại harness → App Server boundary, capability/runtime evidence and bounded call-certainty behavior. CP8A must certify that concrete mapping; unsupported provider-envelope transparency remains explicit rather than being inferred.
- Git common dir là stable task-state root cho current worktree workflows; bare repo, detached/no-repo invocation và permission errors cần explicit negative behavior.
- Human reviewer identity ban đầu có thể là bounded local identity record; stronger signing remains an explicit CP6 decision.

Assumption không được biến thành claim. Nếu checkpoint evidence bác bỏ assumption, dừng tại checkpoint boundary và update plan/owner decision trước khi đổi architecture.

### Conflicts

Không có material conflict giữa owner baseline, synchronized code và repo skill contracts. Foundation v1 cố ý không execute/grade model; v2 orchestration vì vậy phải là additive layer, không reinterpret v1 như incomplete implementation defect.

### Open questions

Các implementation-level questions được liệt kê cuối plan. Chúng không block planning vì checkpoint và stop condition đã bound từng quyết định; chúng block checkpoint tương ứng nếu repository evidence không resolve được.

### Size và review depth

Classification: `Large/high-risk`. Lý do là external-call authority, P0 enforcement, crash/call certainty, durable mutation, conservative invalidation, human evidence authority và cleanup có khả năng phá dữ liệu. Plan dùng 10 numbered implementation checkpoints, trong đó CP8 có hai mandatory sequential rollback subcheckpoints; không parallelize CP1–CP6. Sau CP6, CP7 controls, CP8A runtime adapter và CP8B retention/docs vẫn tuần tự vì cùng state/schema/transport contracts; chỉ test-fixture authoring độc lập mới có thể parallelize nếu owner/agent system cho phép.

## Relevant repo skills và instruction owners

- `docs/agent-loops.md`: lifecycle routing, preflight, planning/review/checkpoint loops.
- `maintain-repo-skills`: eval claim boundary, fresh-reader/model evidence và repo-skill governance.
- `implementation-planning-and-pr-breakdown`: durable handoff, checkpoint dependencies, acceptance, risk và progress tracking.
- `test-quality-strategy`: behavior-layer tests, deterministic fixtures, fault/retry/concurrency matrices và truthful gaps.
- `code-review-and-quality`: per-checkpoint and cumulative `0 Critical / 0 Required` gate.
- `code-commenting-and-maintainability`: non-obvious P0/concurrency/compatibility comments and test-plan headers only.
- `git-checkpoint-workflow`: branch/base/dirty-tree, coherent commits, permission-separated push/PR actions.

Implementation phải đọc lại only relevant current skill instructions và affected source contracts at each checkpoint; no broad skill/catalog rediscovery is required unless those owners materially change.

## Alternatives và trade-offs đã quyết định

| Alternative | Decision | Reason |
| --- | --- | --- |
| Expand `run-skill-evals.mjs` into one large runner | Reject | mixes stable v1 compatibility with mutable execution/authority/lifecycle state |
| New v2 orchestration entrypoint reusing v1 modules | Choose | isolates risk while preserving validated foundation |
| Key cache by HEAD/workspace | Reject | causes unrelated invalidation and loses valid evidence across task/worktree changes |
| One identity for all evidence | Reject | evaluator/review changes would unnecessarily rerun readers |
| Evaluator writes final human evaluation | Reject | violates human authority and hides review decision |
| Always rerun full suite on uncertainty | Reject as default | expensive and unnecessary; bounded dependency-closed rerun is safer without pretending certainty |
| TTL-only cleanup | Reject | can purge active resumable state and cannot express task lifecycle |
| Add concurrency with first adapter | Defer | obscures readiness/identity/resume defects before sequential correctness is proven |

## Kiến trúc ownership dự kiến

Giữ v1 modules backward-compatible và thêm một entrypoint orchestration mới:

```text
.agents/scripts/run-skill-evals.mjs                 # v1 validate/prepare/report; compatibility owner
.agents/scripts/run-skill-eval-harness.mjs          # v2 orchestration CLI
.agents/scripts/run-skill-eval-harness.test.mjs     # v2 observable contract tests
.agents/scripts/lib/skill-evals/harness-schema-v2.mjs
.agents/scripts/lib/skill-evals/logical-identity-v2.mjs
.agents/scripts/lib/skill-evals/run-store-v2.mjs
.agents/scripts/lib/skill-evals/readiness-v2.mjs
.agents/scripts/lib/skill-evals/orchestrator-v2.mjs
.agents/scripts/lib/skill-evals/review-v2.mjs
.agents/scripts/lib/skill-evals/codex-chatgpt-app-server-v2.mjs
.agents/scripts/lib/skill-evals/retention-v2.mjs
```

Tên/file exact có thể được điều chỉnh trong CP1 nếu existing convention yêu cầu, nhưng boundary không được collapse:

| Owner | Trách nhiệm | Không được sở hữu |
| --- | --- | --- |
| v1 runner/schema/workspace | deterministic suite validation, package/snapshot, v1 artifact/report compatibility | model dispatch, v2 task lifecycle |
| harness schema | strict versioned v2 artifact shapes và cross-artifact links | filesystem mutation, model calls |
| logical identity | canonical reader/evaluator/acceptance identities và impact graph | mutable run status |
| run store | atomic durable state, journal, leases, immutable objects/attempts | semantic grading |
| readiness | compiled invocation, adapter capabilities, P0 comparison và dispatch grant | durable-contract mutation |
| orchestrator | state transitions, dispatch, resume, retry/cancel/timeout/progress/concurrency | human decision |
| review | evaluator proposal validation, arithmetic-safe canonical summary, untrusted-text-safe deterministic Markdown/HTML rendering, acceptance decision materialization | reader execution hoặc independent semantic verdict/executable untrusted content trong renderer |
| retention | lifecycle classification, quarantine/cleanup policy | active-run correctness decisions |

Production dependencies phải giữ ở Node built-ins nếu feasible. Thêm package chỉ khi một checkpoint chứng minh existing code không thể đáp ứng atomicity/schema/locking requirement bằng bounded implementation.

### Planned file/checkpoint map

| Checkpoint | Exact intended files/domains |
| --- | --- |
| CP1 | new `harness-schema-v2.mjs`, harness test fixtures/test file; minimal v1 version-routing reuse only if required |
| CP2 | new `logical-identity-v2.mjs` plus identity/impact tests |
| CP3 | new `run-store-v2.mjs`, harness CLI state commands, fault/recovery tests |
| CP4 | new `readiness-v2.mjs`, generic adapter/helper capability interfaces in orchestrator boundary, reader P0 plus evaluator-static-readiness tests |
| CP5 | new `orchestrator-v2.mjs`, harness CLI reader commands, fake adapter tests |
| CP6 | new `review-v2.mjs`, evaluator-stage finalizer/guard, canonical summary builder, deterministic Markdown/HTML renderers, CLI review/accept/report commands, fake evaluator and authority tests |
| CP7 | extend orchestrator/CLI/tests only for controls/concurrency; no schema ownership migration |
| CP8A | new `codex-chatgpt-app-server-v2.mjs` or the nearest convention-matching adapter module, minimal shared schema/store integration for the frozen runtime artifacts, and deterministic mocked-App-Server transport/capability/dispatch tests; no live model call |
| CP8B | new `retention-v2.mjs`, CLI housekeeping/legacy commands, operator/eval-design docs, CI test wiring |
| CP9 | no required source change; authorized runtime artifacts live in task store, not repository |
| CP10 | only justified corrections plus plan/progress/status reconciliation |

Forbidden throughout unless separately approved: skill/reference/suite semantic changes, product/database code, package upgrade, workflow changes beyond the exact deterministic test step, historical artifact rewrite, committed raw model evidence or secrets.

## Artifact và schema contract v2

Mỗi artifact dùng strict `artifact_type`, `schema_version: 2`, stable logical identity, content hash, producer metadata và links tới exact inputs. Unknown field handling phải explicit; không silently coerce v1 thành v2.

| Artifact | Producer | Mục đích |
| --- | --- | --- |
| `task_manifest` | operator/harness | task identity, lifecycle, branch/PR provenance, retention policy |
| `run_manifest` | harness | selected suites/cases/variants, immutable `intent`, config, runtime/adapter, state |
| `compiled_invocation` | readiness compiler | exact harness-controlled prompt/context/tools/policy/runtime payload intended for the adapter; not the complete provider/model-visible envelope |
| `readiness_analysis` | readiness | round, reader/evaluator stage, field-by-field requested/compiled/attested result, dispatch grant |
| `execution_attempt` | orchestrator | immutable reader/evaluator/verification-helper attempt, timing, outcome/call certainty |
| `runtime_attestation` | concrete adapter | exact App Server/runtime/auth/config/fresh-thread evidence available before model dispatch, with explicit `runtime_mediated` limitations |
| `runtime_dispatch_request` | concrete adapter | exact canonical `turn/start` request and behavior-relevant projection, persisted before the request is written to App Server |
| `runtime_event` | concrete adapter | bounded exact App Server control-plane write/ack/terminal/interrupt/error evidence bound to one request and attempt |
| `observation` | adapter + validator | raw reader output, observed access/resource/timing, input/attempt links |
| `resource_observation` | adapter + validator | supplied/read/denied resource evidence with evidence source |
| `evaluator_proposal` | advisory evaluator | proposed case/comparison statuses, rationale, citations, uncertainty |
| `run_review_summary` | review builder | canonical structured aggregate/exception review source, serialized as `summary.json` or exact CLI convention |
| `human_review_decision` | authorized reviewer | accept/reject/rerun decision, scope, identity, rationale |
| `human_evaluation` | deterministic materializer | accepted semantic evidence bound to proposal, summary and decision |
| `generated_report` | deterministic reporter | aggregate only structurally valid, accepted evidence |

`human_evaluation` v2 may reuse the historical artifact name for downstream continuity, but only deterministic code may materialize it after a valid `human_review_decision`. Model output with that artifact type is rejected. Accepted evidence binds:

- exact `acceptance_input_id`;
- proposal and canonical summary hashes;
- accepted case/comparison scope;
- reviewer identity type and decision timestamp;
- any exclusions/rerun requirements;
- schema/review-policy version.

Raw model text is never itself accepted evidence. Present-but-invalid artifacts fail loud and cannot be downgraded to missing/incomplete.

`summary.md` và `summary.html` là required deterministic representations của exact validated `run_review_summary`, không phải artifact authority mới. Renderer version/security-policy/hash metadata phải được lưu cho audit và freshness checks, nhưng renderer-owned CSS, presentation order, local render timestamp và bytes của hai representation không tham gia semantic `acceptance_input_id`. Human decision bind canonical structured summary/proposal/evidence scope; stale rendered file một mình không thể authorize acceptance.

## Durable task, run và state model

Default fixed root:

```text
<git-common-dir>/vocaspace-agent-skill-evals/v2/
├── tasks/<task-id>/task.json
├── runs/<run-id>/manifest.json
├── runs/<run-id>/journal.ndjson
├── runs/<run-id>/attempts/
├── runs/<run-id>/review/summary.json
├── runs/<run-id>/review/summary.md
├── runs/<run-id>/review/summary.html
├── runs/<run-id>/runtime/index.json
├── runs/<run-id>/runtime/index.md
├── runs/<run-id>/runtime/attempts/<attempt-id>/input.txt
├── runs/<run-id>/runtime/attempts/<attempt-id>/request.json
├── runs/<run-id>/runtime/attempts/<attempt-id>/events.json
├── objects/<sha256-prefix>/<sha256>/artifact.json
├── indexes/
├── quarantine/
└── trash/
```

`task_id` là primary lifecycle identity; `run_id` là actual run identity. Branch/PR/ref là mutable provenance/index metadata, không phải task identity. Layout normalized giữ `tasks/` và `runs/` top-level để tránh duplicate evidence; `run_manifest` và indexes bind run về stable task. Human-readable timestamp có thể nằm trong manifest/index hoặc convenience listing, nhưng không thay `run_id` hay artifact identity. Review/runtime files là task-store runtime artifacts, không phải tracked repository docs; canonical shared/raw evidence vẫn content-addressed trong `objects/`. Root dưới Git common dir cho phép worktree/process change mà vẫn resume cùng task. V1 OS-temp workspace vẫn là legacy source và không tự được dời/xóa.

`run_manifest.intent` is immutable from run creation and owns the durable operator-recorded answer to “why this run exists”. Its strict shape is:

```text
intent:
  purpose: <bounded human-readable text>
  selection_reason: <bounded human-readable text>
  assurance_profile: runtime_mediated
  authentication_boundary: chatgpt_subscription
  authority_record:
    basis: owner_explicit
    recorded_at: <timestamp>
    scope: <bounded human-readable authorization summary>
    authorized_roles: <sorted subset of reader|evaluator|verification_helper>
    live_model_calls: <boolean>
    live_call_limits:
      reader: <non-negative integer>
      evaluator: <non-negative integer>
      verification_helper: <non-negative integer>
      total: <exact sum>
```

This record is audit evidence, not a self-granting authority token. CP8A deterministic runs require `live_model_calls: false` and every live-call limit `0`; writes to an injected mocked transport are fixture observations, not live calls and do not consume those limits. CP9 may use `live_model_calls: true` and non-zero limits only after a new exact owner authorization. A substituted intent from another task/run, a role outside `authorized_roles`, a live dispatch while `live_model_calls: false`, or a live count above the bound fails before `turn/start`.

CP8A extends the run-manifest schema compatibly rather than mutating completed Stage 1–2 evidence. Existing runs without `intent` remain readable and retain their historical meaning, but are ineligible for concrete App Server dispatch and cannot be backfilled or synthesized into CP8A/CP9 authority; a new run with an immutable validated `intent` is required.

Canonical runtime artifacts live in `objects/`. `runs/<run-id>/runtime/` is a deterministic, atomically replaced finder surface only. `input.txt` uses a versioned lossless length-delimited UTF-8 representation of the exact harness-controlled input; `request.json` is the exact canonical local JSON-RPC request bytes; `events.json` is a bounded projection of linked control-plane records. Each representation records its source artifact/hash and renderer/format version. `index.json`/`index.md` link `why → intended → dispatched → happened → evidence`; they do not become semantic authority and must be rebuildable from canonical objects, attempts and journal. Full streaming deltas/transcripts are optional heavy raw evidence, not default index content.

`run_manifest.runtime_config_sha256` là hash của initial durable runtime configuration được chốt trước Round 1 và không mutate trong run. Nếu Round 1 chứng minh chỉ `runtime.parameters` cần sửa, Round 2 dùng một ephemeral dispatch configuration: `correction.before_sha256` phải bằng durable manifest hash, còn `correction.after_sha256` phải bằng exact runtime hash của mọi Round 2 compiled invocation. Terminal readiness/grant/attempt identity bind dispatch configuration đó; durable manifest vẫn giữ initial configuration để audit chain không bị rewrite.

Run state machine:

```text
created → preflight → readiness → ready → reading → reader_complete
        → evaluating → review_pending → accepted → reported → completed
                                     ↘ rejected
                                     ↘ rerun_required → preflight (affected units)

terminal/side states: rejected | blocked | failed | cancelled | abandoned
```

Trong state machine này, `evaluating` bao gồm proposal validation, canonical summary build và cả hai required renderer. Run chỉ transition sang `review_pending` khi current `summary.json`, `summary.md` và `summary.html` đều valid, arithmetic-consistent, representation-fresh và đạt renderer security policy; schema/arithmetic/encoding/link/sanitization/renderer failure giữ run `blocked` hoặc failed theo classified cause, không tạo review-ready state.

Task lifecycle is separate and deliberately small: `active → closed | abandoned`. Implementation, review, commit, push and PR signals (`implementation_complete`, `review_complete`, `committed`, `pushed`, `pr_open`, `merged`, `pr_closed`) are provenance/status dimensions, not task lifecycle transitions. A task stays `active` while a PR/review/correction/delivery action is open or reasonably resumable; CP10 completion, implementation completion, push or merge alone must not auto-close it. `closed` requires an explicit recorded closure decision/evidence that no known follow-up remains; `abandoned` requires an explicit abandonment decision. A run may be rejected while the owning task remains active for a corrected replacement run. `rerun_required` never reports complete; it appends a new dependency-closed execution path after preflight/readiness. A completed run is immutable and does not become active again.

Transition dùng compare-and-swap revision, atomic temp-write + rename và append-only journal. Attempt record được tạo trước dispatch với idempotency/correlation key. Sau khi call chắc chắn bắt đầu, crash không được giả định là `not_started`; nếu adapter không xác nhận outcome, attempt thành `outcome_unknown` và cần operator resolution hoặc adapter-safe lookup trước retry.

Valid object/artifact immutable và content-addressed. Mutable manifest chỉ trỏ tới object hash và current state. Resume phải:

1. validate task/run manifest và journal continuity;
2. reacquire bounded lease sau khi xác nhận owner process không còn active;
3. revalidate referenced immutable objects;
4. compute current logical impact;
5. reuse valid unaffected objects;
6. tiếp tục từ first incomplete/invalidated unit, không replay toàn run.

## Logical identity, reuse và invalidation

### Identity layers

`reader_input_id` hashes the canonical behavior-relevant harness-controlled input supplied at the App Server boundary and its pre-dispatch `runtime_mediated` attestation:

- case prompt and supplied context bytes;
- target/baseline bundle and blind variant mapping where visible to reader;
- compiled invocation including the exact harness-controlled system/developer/user/tool exposure;
- requested policy plus resolved/attested enforcement capabilities and immutable runtime configuration at dispatch;
- requested model, effort, App Server/runtime class, behavior-relevant parameters, instruction-source/config fingerprints and fresh-context method;
- reader protocol/schema versions.

Nó loại Git HEAD/ref, run/task/attempt IDs, timestamps, JSON-RPC correlation IDs, `threadId`/`turnId`, storage paths và author-facing A/B role nếu các giá trị đó không thuộc behavior-relevant harness input. Exact wire request hash vẫn được integrity/audit-bind riêng.

`runtime_mediated` cannot attest the hidden upstream provider envelope, provider request bytes/IDs, provider-side idempotency or every built-in/model-visible instruction. That opaque envelope is therefore an `unknown` cross-run equivalence dimension for this adapter. Completed valid units may be resumed/reused inside the same run across process/worktree/HEAD changes when exact artifact/runtime lineage remains valid; `codex_chatgpt_app_server` must not claim cross-run reader/evaluator semantic reuse until a future certified capability can bind a stable provider-envelope equivalence. Audit-only request/thread/turn IDs may vary through a newly canonical same-run graph without invalidating semantic identity.

Post-run runtime-observed access/resource evidence is output, not a reader input and never retroactively changes `reader_input_id`. Its behavior-relevant evaluator-visible projection participates in `evaluator_input_id`; the full observation/resource artifact remains separately bound to evaluator-attempt provenance and the acceptance/audit chain. If observed behavior contradicts the pre-dispatch attestation, the observation is invalid/blocked and cannot be reused as accepted reader evidence; do not repair the mismatch by changing the input identity after execution.

`evaluator_input_id` hash canonical exact behavior-relevant evaluator-visible inputs:

- evaluator-visible evidence projections derived deterministically from exact validated observation/resource artifacts;
- hidden rubric/criteria and comparison mapping visible to evaluator;
- evaluator compiled invocation, model/runtime parameters;
- evaluator protocol/schema versions.

Projection schema phải explicit và deterministic. Attempt IDs, timestamps, storage paths và unrelated provenance/audit metadata không invalidate evaluator reuse chỉ vì full source artifact thay đổi; chúng chỉ tham gia identity nếu thực sự được đưa vào compiled evaluator invocation hoặc được schema xác định là behavior-relevant. Full artifact hash/provenance được validate và record riêng trong evaluator attempt/input provenance manifest, không được smuggle vào semantic reuse hash. Mỗi cache hit phải revalidate current full artifacts, derive cùng projection và record current source bindings; projection không được làm yếu source integrity hoặc cho phép evidence từ artifact khác thay thế nhau.

`acceptance_input_id` hash:

- exact evaluator proposal and run summary;
- accepted scope and review policy/schema;
- evidence objects under review.

Evidence bindings không phải caller-selected metadata. Chúng phải được derive hoặc exact-match canonical `observation`/`resource_observation` links của exact evaluator proposal set đã bind vào summary, dùng tuple `artifact_type + artifact_id + content_sha256`; missing, extra, cross-type hoặc conflicting binding fail loud.

Reviewer identity và decision timestamp nằm trong decision/audit record, không làm thay đổi input identity trước khi decision tồn tại.

`human_review_decision` persists the exact review policy and recomputed `acceptance_input_id` for its canonical proposal/summary/evidence/scope input. Deterministic `human_evaluation` repeats that exact ID and binds the exact decision, so stale or substituted acceptance identity cannot enter accepted evidence or a descendant report.

### Conservative impact graph

Dependency graph phải trace artifact field → logical identity → case/variant/role. Change classifier trả một trong:

```text
unaffected | reader_affected | evaluator_affected | acceptance_affected | unknown
```

- `unaffected`: reuse allowed only after hash/schema/integrity check.
- `reader_affected`: invalidate reader observation và toàn bộ evaluator/acceptance/report descendants.
- `evaluator_affected`: giữ reader observation, invalidate proposal/acceptance/report.
- `acceptance_affected`: giữ reader/proposal nếu identities match, invalidate decision/materialized evaluation/report.
- `unknown`: không silently reuse; rerun bounded affected group hoặc stop nếu group không thể bound.

Git ref/commit change tự nó chỉ cập nhật provenance. Bundle/context byte, harness-controlled App Server input, behavior-relevant runtime attestation or resolved instruction/config fingerprint change mới ảnh hưởng identity. Opaque provider-envelope equivalence for this adapter is never silently `unaffected`; cross-run reuse returns `unknown`. Nếu impact analysis phức tạp hơn chi phí rerun một skill/suite/variant group nhỏ, chọn conservative bounded rerun và ghi lý do.

## Readiness và P0 dispatch guard

Historical P0 defect phải có regression test trực tiếp: package có `requested_execution_policy` đúng nhưng compiled reader prompt/context không expose execution-context contract. Expected result là readiness fail và adapter call count bằng `0`.

Readiness là compiler + verifier, không phải string/grep check:

1. build the complete planned set of exact reader `compiled_invocation` objects that the adapter would send;
2. schema-validate every message/tool/context attachment and canonicalize it;
3. compare requested policy với model-visible instruction and adapter capability/enforcement field-by-field;
4. verify package/artifact integrity, fresh-context method, credential/network/remote/filesystem/tool boundary;
5. require every planned reader unit to pass before issuing per-invocation single-use dispatch grants bound to exact hashes;
6. adapter rechecks its unit grant/hash immediately before each external call.

The set-level barrier is mandatory: if invocation number six fails P0, invocations one through five must also have call count `0`. Resume may omit already-valid completed units from a later planned set only after CP2/CP3 identity and object validation proves reuse; it does not waive readiness for any newly dispatchable unit.

Required comparison covers at least filesystem, tools/allowlist, network, credentials, remote action, mutation, fresh context, supplied resources, observation protocol và output schema. `requested` không được reported là `enforced`; unsupported enforcement là blocking `not_run/blocked`, không phải warning.

Runtime readiness cho một run có tối đa hai rounds:

- Round 1: compile + verify exact reader invocation set and the evaluator stage's static plan: selected rubric/criteria, comparison mapping/template, protocol/output schema, runtime config and required adapter capabilities.
- Nếu chỉ run configuration có thể sửa an toàn, cho đúng một ephemeral config correction rồi Round 2.
- Không Round 3. Không sửa suite, schema, repository policy hoặc durable contract để làm pass.
- Nếu Round 2 fail, run `blocked`; zero reader calls vẫn là invariant.

Configuration correction phải được diff/audit trong `readiness_analysis`; round 1 artifact được giữ immutable. P0 readiness failure trước dispatch phải kiểm chứng qua adapter spy/counter, không chỉ state assertion.

### Bounded verification helpers

- Default helper call count là `0`.
- Chỉ khi một genuine uncertainty cluster không thể giải quyết deterministically, readiness có thể dùng tối đa `2` read-only verification helper calls cho đúng cluster đó, với bounded inputs/access và explicit authority cho external/model call nếu helper cần nó.
- Helper có `execution_attempt.role: verification_helper` và immutable `helper_input_hash` từ exact cluster question, supplied context, compiled invocation and runtime config; nó được count/audit riêng nhưng không là reusable semantic cache identity. Nó không phải eval reader/evaluator, không tạo observation/proposal/accepted evidence và không được dùng để lách P0 hoặc semantic gate.
- Mọi helper output chỉ có thể resolve hoặc document readiness uncertainty. Nó không mutate repository/durable contract, không mở cluster thứ hai và không tạo helper-driven correction loop.
- Hai helper calls nằm trong Round 1 uncertainty analysis; chúng không tạo readiness round mới. Sau one ephemeral config correction, Round 2 reruns complete readiness without another helper quota. Unresolved uncertainty tại cuối Round 2 phải conservatively rerun/invalidate the bounded affected group hoặc STOP khi không thể establish trustworthy boundary.

Real helper calls require their own current permission and are optional; absence of permission keeps count `0` and may force conservative rerun/STOP. CP1–CP8B tests use deterministic fake helpers only.

### Evaluator stage-readiness and dispatch guard

Evaluator readiness reuses the generic compiler/hash/grant/attempt machinery but does not duplicate reader P0 semantics. Before reader dispatch, Round 1/2 already validate the evaluator stage's static plan and adapter capabilities. After validated reader observations/resources exist, CP6 must:

1. build the complete planned evaluator invocation set from explicit canonical evaluator-visible projections of exact validated evidence, hidden rubric/criteria, comparison mapping, evaluator protocol/output schema and immutable runtime config;
2. canonicalize and schema/integrity-validate every payload, reject missing/stale/wrong evidence or config, and compute exact `evaluator_input_id` values;
3. require the complete newly dispatchable evaluator set to pass before issuing per-invocation single-use grants;
4. have the concrete adapter recheck grant, invocation hash and capability/runtime attestation immediately before each evaluator call.

This finalization is a stage binding/validation step, not a third readiness round and not another configuration-correction opportunity. If any planned evaluator invocation fails, evaluator call count for that stage is `0`; valid reader evidence remains reusable and the run stops/blocks for bounded correction outside the readiness cycle. Resume may omit valid completed evaluator units only after identity/object validation, exactly as for readers.

## Orchestration, attempts và controls

Mỗi reader/evaluator executable unit là `(case, variant, role, logical_input_id)`. Verification helper attempt dùng `(uncertainty_cluster_id, helper_index, helper_input_hash)`, không tham gia case progress/reuse/report counts. Orchestrator chạy dependency order: reader units trước evaluator units, evaluator trước review surface. Default concurrency `1`; effective concurrency là minimum của operator request, adapter capability và policy cap.

Controls được thêm sau correctness foundation:

- progress là derived counts từ durable unit states, không là mutable truth riêng;
- cancellation cooperative trước dispatch và giữa stream events; attempt đang gọi được ghi `cancel_requested`, không giả thành chưa chạy;
- timeout có dispatch/connect/response phases và giữ call-certainty evidence;
- retry policy theo error class; semantic invalid output không auto-retry vô hạn;
- retry tạo attempt mới, không overwrite attempt cũ;
- evaluator retry không invalidate valid reader evidence;
- reader retry/rerun chỉ invalidate descendants của exact affected unit;
- process signal handling flushes journal/lease state nhưng không claim remote call cancelled nếu adapter không xác nhận.

Bounded concurrency chỉ bật sau sequential behavior pass. Tests phải chứng minh no duplicate dispatch, stable aggregation order, per-adapter cap, cancel behavior và identical report regardless of completion order.

## Human review và acceptance gate

Evaluator là advisory. Nó nhận validated evidence cùng hidden rubric, tạo `evaluator_proposal`, nêu uncertainty và cite exact artifact fields. Mọi linked `observation` và `resource_observation` phải resolve qua exact observation lineage của chính proposal `unit_id` trong cùng run; same-run evidence của unit khác bị reject. Proposal không được tự đổi state thành accepted.

`run_review_summary` là canonical structured source, deterministic và exception-first. Với field không applicable, schema phải dùng explicit null/omission rule thay vì invent count. Mặt review mặc định tối thiểu gồm:

- run/task/provenance, selected suite/case counts và readiness/P0 outcome kèm helper count;
- baseline counts theo existing canonical statuses `passed` (`pass`), `partially_passed` (`partial`), `failed` (`fail`), `not_run`;
- candidate counts theo existing canonical statuses `passed` (`pass`), `partially_passed` (`partial`), `failed` (`fail`), `not_run`;
- comparison counts `improved`, `equivalent`, `regressed`, `inconclusive`;
- reader/evaluator counts cho reused, newly executed, retries và timeout/cancel/blocked khi applicable;
- every failed/partial/regressed/inconclusive/blocked case với concise reason, status/veto/uncertainty và evidence/proposal drill-down links;
- relevant supplied/read/denied routing/resource anomalies và evidence source;
- harness/preflight limitations, missing/invalid/unknown attempts và low-confidence items;
- evaluator recommendation/current review state;
- exact proposed human action `accept`, `reject`, `rerun` và decision scope.

Successful/equivalent cases có thể chỉ xuất hiện trong aggregate counts và optional drill-down; owner không phải mở từng case mặc định cho run 21–24 case.

### Aggregate arithmetic contract

Aggregate values không phải caller-supplied mutable counters. Review builder phải derive chúng deterministically từ exact validated, duplicate-free case/variant/role memberships và immutable attempt/artifact state; relationship validator recomputes và rejects mismatch. Mỗi aggregate record phải declare exact `scope_id`/bound scope và count unit (`case`, logical execution unit hoặc attempt) để không cộng/trừ khác denominator.

- Với complete applicable baseline/candidate scope, `passed + partially_passed + failed + not_run` phải bằng exact selected case count của role đó.
- Missing/incomplete evidence không được relabel thành `not_run`. Incomplete summary phải có explicit unassessed/incomplete partition; `assessed status buckets + unassessed = selected scope`, và unassessed khác `0` blocks acceptance.
- `improved + equivalent + regressed + inconclusive` phải bằng exact assessed comparable scope. Candidate-only/non-comparable units không vào denominator; missing comparative evidence ở explicit unassessed partition, không được ép thành `inconclusive`.
- Trong mỗi declared reader/evaluator logical-unit scope, reused, newly-executed và pre-dispatch blocked là mutually exclusive và exhaustive: `reused + newly_executed + blocked = requested logical units`. Initial và retry là attempt-level; retry không đếm initial và `initial + retry = recorded attempts`. Schema-defined terminal outcomes ít nhất gồm success/error/timeout/cancel/`outcome_unknown`, exactly one class cho mỗi terminal attempt và sum tới terminal-attempt denominator; nonterminal attempts ở explicit partition và block acceptance. Unit-level `blocked` không được trộn vào attempt-level arithmetic, còn `outcome_unknown` không được relabel để làm totals khép giả.
- Helper attempts giữ role/count unit riêng và không tham gia reader/evaluator case, reuse hoặc report totals.
- Accepted report aggregates phải được recompute từ exact dependency-closed membership bound trong human decision, không copy totals của full run khi chỉ partial scope được accept. Mỗi report partition phải sum tới exact accepted denominator và match canonical summary projection cho cùng membership.

Resume/retry/reuse phải rebuild aggregates từ current validated immutable state thay vì increment cached display counters. Completion order, process restart hoặc rerender không đổi canonical arithmetic. Canonical summary không valid nếu bất kỳ partition, denominator, uniqueness hoặc count-unit invariant nào fail.

Canonical `summary.json` là machine-readable source cho schema validation, hashes/identity, acceptance binding và deterministic report linkage. `summary.md` render cùng data theo thứ tự recommendation/current state → aggregate tables → readiness/reuse/execution → exceptions → anomalies/limitations → proposed action → drill-down. `summary.html` render cùng semantics thành self-contained/offline-safe local surface; có thể dùng renderer-owned cards/tables và `<details>` collapse nhưng không external network/CDN và không trở thành web application.

### Renderer trust boundary

Mọi reader/evaluator/user-derived string, rationale, citation label, anomaly, limitation, case text và proposed-action explanation là untrusted display text by default. Chỉ renderer-owned literals, fixed templates/CSS và typed link descriptors created from validated task-store artifact identities là trusted structure.

- Markdown renderer phải dùng một context-aware plain-text primitive để neutralize raw HTML, Markdown links/images/autolinks, code-fence breakout và embedded markup/control sequences. Nó không concat untrusted bytes như raw Markdown/HTML.
- HTML renderer phải escape text by default và không đưa untrusted bytes vào raw HTML, tag/attribute names, `style`, CSS, script, event handlers hoặc URL attributes. Canonical JSON không được embed như executable script data.
- HTML representation dùng static renderer-owned HTML/CSS và `<details>`; JavaScript bị cấm trong initial contract. Không `script`, inline event handler, form submission, iframe/object/embed, remote image/font/media/style, fetch/connect hoặc external network/CDN dependency.
- Evidence links chỉ được build từ validated typed local artifact targets. Renderer canonicalize/containment-check target dưới task store và reject model/user-derived targets, absolute/external/protocol-relative URLs, traversal escape và unsafe schemes như `javascript:`, `data:` hoặc `vbscript:`. Untrusted link-looking text chỉ hiển thị literal.
- Self-contained CSP/meta policy từ chối script, object, frame, form, connect và remote-resource loading là defense in depth; escaping, typed links và no-JavaScript architecture vẫn là primary controls.
- Encoding/sanitization không được silently drop hoặc reinterpret canonical text. Renderer phải preserve round-trip display semantics; invalid control/encoding/link input fail loud, không tạo valid representation.

Cả hai renderer chỉ consume validated canonical object và không tự tính verdict/count/decision scope. Renderer failure hoặc semantic-consistency failure giữ run chưa review-ready/blocked và không được materialize accepted evidence. Rerender presentation với canonical semantic hash không đổi không invalidate accepted evidence; canonical semantic change thì invalidate decision/report descendants. Acceptance command phải revalidate current canonical summary/proposal/evidence identity, nên old Markdown/HTML không thể accept stale scope.

Representation audit metadata bind canonical semantic hash, renderer version, security-policy version và exact output hashes. Acceptance precondition phải require current representations được sinh bởi allowed renderer/security policy và pass integrity; metadata này là audit/freshness gate, không là semantic acceptance identity. Renderer-only security/presentation update không invalidate already accepted semantics, nhưng unsafe/obsolete files không được remain default review surface và phải rerender/quarantine theo lifecycle policy trước decision mới.

Human/authorized reviewer decision phải bind exact summary/proposal hash. Stale decision bị reject nếu acceptance identity đổi. Partial acceptance chỉ hợp lệ khi scope is closed under dependencies; otherwise split run/review group. Deterministic report chỉ aggregate accepted scope và phải phân biệt `review_pending`, `rejected`, `rerun_required`, `incomplete` với `complete`.

## Retention và cleanup

Preflight/readiness sở hữu housekeeping trước run dispatch:

1. enumerate task-owned state and validate manifests;
2. retain all active/resumable task state;
3. detect stale lease/process evidence conservatively;
4. quarantine corrupt/unknown ownership; không delete in place;
5. compact only explicitly `closed` or `abandoned` task heavy raw/temp/process state theo recorded lifecycle; implementation/CP10 completion, push, open PR, merge or PR close alone không đủ;
6. preserve minimum audit/reuse metadata: identities, accepted evidence hashes, decisions, reports, provenance and tombstones;
7. use TTL only for orphan fallback khi task lifecycle không thể resolve.

Canonical/Markdown/HTML review files follow cùng owning task/run lifecycle. Active/resumable task giữ cả ba representation; explicit `closed`/`abandoned` compaction có thể bỏ presentation files theo recorded policy trong khi vẫn giữ minimum canonical acceptance/audit hashes, decisions và tombstones. Git status/add/push scope audit phải chứng minh task-store review files không xuất hiện trong repository changes.

`cleanup --dry-run` là default preview; actual cleanup cần explicit task/scope, closure/abandonment evidence, revalidation và reversible quarantine/trash phase trước permanent purge. Active task, active/open review or PR, expected correction/delivery, hoặc `outcome_unknown` attempt không được purge. Secret scanning/redaction policy áp dụng trước retaining model raw text; never log credentials even when enforcement misconfigured.

## Backward compatibility

- V1 commands, schemas, exit meanings và CI checks giữ nguyên trừ khi CP1 ghi một unavoidable compatibility correction riêng.
- V2 reader có thể inventory/import metadata từ valid v1 workspace/report nhưng label `legacy_v1`.
- V1 observation/human evaluation không có compiled-invocation readiness attestation hoặc v2 acceptance chain, nên không auto-promote thành accepted v2 evidence.
- Reuse v1 reader result cho first real v2 pilot mặc định bị cấm. Nó có thể dùng làm historical comparison/reference only.
- Legacy corrupt/partial artifact fail loud hoặc quarantine; không rewrite source.
- Deterministic v1 report remains reproducible from v1 artifacts; v2 report has separate schema/version and explicit legacy links.

## Organizational implementation stages

- Stage 1 — Foundation & Correctness: CP1–CP4.
- Stage 2 — Eval Workflow: CP5–CP7.
- Stage 3 — Integration & Delivery: CP8A–CP10.

Stage grouping chỉ dùng để tổ chức delivery/authorization. Nó không gộp, tách, đổi owner, dependency, acceptance gate hoặc rollback boundary của bất kỳ CP nào.

### Current Stage 1 checkpoint status

- CP1: `implemented / deterministic checks passed / review passed`; strict v2 artifacts, producer/hash/link/semantic relationship validation, version routing, canonical summary arithmetic/renderer contracts, read-only schema CLI and CI test entry are present. Review found and corrected two `Required` gaps: correct-type links were not yet bound to matching payload identities, and typed local paths did not yet reject the complete Windows/URL/wildcard/trailing-dot unsafe matrix. Terminal CP1 review is `0 Critical / 0 Required`.
- CP2: `implemented / deterministic checks passed / review passed`; golden reader/evaluator/acceptance identities, explicit evaluator-visible projection with separate full-source bindings, and conservative field/identity impact classification are present. Review corrected `Required` gaps for fail-open near-match dependency prefixes, mutable returned canonical projections and acceptance scope/proposal inputs not yet bound back to the canonical summary. Terminal CP2 review is `0 Critical / 0 Required`.
- CP3: `implemented / deterministic checks passed / review passed`; the Git-common-dir store now owns content-addressed objects, task/run state, CAS transitions, hash-chained journal, bounded leases, immutable logical-attempt phase records, crash reconciliation, `outcome_unknown` recovery, selective resume planning and read-only state inspection. Review corrected four `Required` gaps: the initial artifact identity rule could only represent one phase per logical attempt, the first store layout diverged from the approved `runs/<run-id>/{journal,attempts}` ownership, stored links were not recursively rebound to exact content-addressed targets, and mutable run operations were not yet required to present the active lease token. Terminal CP3 review is `0 Critical / 0 Required`.
- CP4: `implemented / deterministic checks passed / review passed`; exact policy-bearing compiler output, generic adapter capability attestation, complete reader/evaluator-static set barrier, bounded one-cluster fixture-helper audit, one ephemeral runtime-parameter correction with a strict two-round cap, single-use exact-hash grants, full-set TOCTOU guard and non-destructive housekeeping preview are present. Review corrected three `Required` gaps: helper attempts could not depend on the analysis they help produce and therefore needed a non-circular terminal-attempt link back from the final analysis; the first dispatch guard did not revalidate the complete reader/evaluator-static/helper graph; and correction/static readiness did not yet bind one exact runtime config plus a selected evaluator unit across every compiled invocation. Terminal CP4 review is `0 Critical / 0 Required`.
- Cumulative Stage 1 review: `passed`; initial cross-checkpoint pass found `0 Critical / 5 Required` covering the incorrect `rerun_required → readiness` shortcut plus ignored unexpected attempt records, hash-valid but revision-discontinuous journal events, under-constrained passed-readiness grants/field/nonces and attempt certainty, missing CP3↔CP4 persistence/reload proof, and correction `changed_fields` not matching the exact runtime-parameter diff. All were corrected and covered by deterministic regressions; terminal cumulative review is `0 Critical / 0 Required`.
- Post-delivery Stage 1 verification/correction: findings A–D were all `Confirmed Required`. Acceptance evidence now exact-matches type/id/hash bindings derived from the canonical proposal set; proposal → summary → decision → materialized evaluation and report → run lineage reject substitutions; `run_manifest.runtime_config_sha256` is explicitly the initial durable Round 1 config with only the audited Round 2 dispatch hash allowed to differ; and plan/brief/master/progress no longer describe initial Stage 1 implementation/delivery as pending.
- Fresh cumulative audit after A–D found and corrected four further `Required` clusters: exact selected reader/summary operational scope plus evaluator evidence/run lineage; reader-attestation and acceptance canonicality; fail-closed attempt certainty/`outcome_unknown`, prepared-call resume and contiguous retry sequencing; and exact Round 2 eligibility/correction schema. Focused harness `103/103`, v1 runner `130/130`, structural validator `37/37`, repository validator `11 skills / 0 errors / 0 warnings`, eval catalog `9 skills / 27 files / 183 cases / 0 diagnostics`, and syntax checks pass. Terminal review is `0 Critical / 0 Required`.
- Follow-up R1–R3 correction: exact `acceptance_input_id` is recomputed from canonical proposal/summary/evidence/scope/review policy, persisted by the reviewer decision and repeated by materialized accepted evidence; same-run cross-unit proposal evidence fails at the relationship owner; delivered/consumed authority is separated from later task-scoped permission. The one-dimension semantic-substitution audit evaluated run/unit/proposal/hash/scope/decision/readiness/attempt candidates, required fail-loud only for contract-forbidden variants, and added an allowed reviewer-audit-metadata control. Focused harness `107/107`; terminal review is `0 Critical / 0 Required`.
- Final Stage 1 correction closed exact report → decision/acceptance lineage: a `generated_report` persists one `decision_id` and `acceptance_input_id`, every accepted evaluation resolves to that exact decision, and report scope equals the complete decision-authorized scope. Focused harness `111/111`, v1 runner `130/130`, structural validator `37/37`, repository validator `11 skills / 0 errors / 0 warnings`, eval catalog `9 skills / 27 files / 183 cases / 0 diagnostics`, syntax and hygiene checks pass. Terminal Stage 1 review is `0 Critical / 0 Required / 1 Advisory`; final delivered Stage 1 HEAD is `54453746b2ea796558ef229831a569a69c4ed3f4`.
- Remaining Advisory: full Node-on-POSIX remains `not_run` because local WSL2 lacks Node; Windows Node behavior and WSL2 POSIX atomic-replace/exclusive-directory primitives passed, and Ubuntu Node coverage remains wired for later CI without claiming it ran in this checkpoint.
- Live model/helper/evaluator/provider evidence: `not_run` by explicit Stage 1 authority.

### Current Stage 2 checkpoint status

- CP5: `implemented / focused deterministic checks passed / review passed`; sequential deterministic-fixture reader orchestration persists immutable attempts and exact observation/resource evidence, reloads evidence across process restart, reuses only exact unaffected units, reruns one changed logical input, exposes derived reader progress/resume planning, and blocks ambiguous `outcome_unknown` or missing-evidence success without duplicate dispatch. Focused harness `116/116`; structural validator `37/37`, repository validator `11/0/0`, eval catalog `9/27/187/0`, syntax and diff checks pass. The initially stopped Windows v1 run was an intermediate observation; a later uninterrupted cumulative run passed `130/130`. Terminal CP5 review is `0 Critical / 0 Required`; no model/helper/evaluator/provider call.
- CP6: `implemented / deterministic checks passed / review passed`; exact evaluator-stage finalization/grants, deterministic fixture proposals, canonical 21-case aggregate review, hostile-text-safe Markdown/HTML, representation freshness, human decision/materialization and accepted-scope report memberships pass focused/full harness `121/121`. Self-review corrected evaluator TOCTOU, graph-validation bypass and Markdown typed-link context handling. Terminal review is `0 Critical / 0 Required`; no model/helper/evaluator/provider call.
- CP7: `implemented / deterministic checks passed / review passed`; bounded reader/evaluator control execution preserves the complete CP4/CP6 stage authority, configured concurrency minimum, durable phased timeout/cancel requests, call certainty, classified retry policy, crash-safe retry continuation, no-duplicate restart behavior and exact logical-input invalidation. Durable attempts rebuild the frozen CP6 operational partitions identically across completion order and process restart; attempted units cannot be semantically substituted into reused/pre-dispatch-blocked membership. Focused control/cross-boundary gate `10/10`, checkpoint full harness `131/131`, v1 `130/130`, structural `37/37`, repository `11/0/0`, catalog `9/27/187/0`, syntax/diff pass. Terminal CP7 review is `0 Critical / 0 Required`; no live model/helper/evaluator/provider call.
- Cumulative Stage 2 review: `passed / 0 Critical / 0 Required`. Corrections close identity-return reuse, cumulative resume/accounting semantics, evaluator restart/lifecycle and complete selected-set behavior, bounded control-confirmation and malformed retry-class handling, exact evaluator static-plan plus reader-evidence lineage, canonical review publication before `review_pending`, and direct summary bindings to every counted attempt. Final gates are v2 `132/132`, v1 `130/130`, structural `37/37`, repository `11/0/0`, catalog `9/27/187/0`, CLI/syntax/diff/UTF-8 pass. Remaining historical Advisories are the previously recorded Node-on-POSIX gap, semantic-dogfood limitations and the then-expected absence of CP8A-certified concrete-runtime enforcement; that last gap was superseded by the completed CP8A checkpoint below. Live calls remain `0`.

### Current Stage 3 checkpoint status

- CP8A: `implemented / deterministic mocked-App-Server certification passed / terminal correction review passed` at `f9c821323ae5e8aa277d2cd68d4b416d80cf553e`; terminal review is `0 Critical / 0 Required / 4 Advisory`. Focused CP8A is `93/93`, full v2 outside the Windows sandbox is `132/132`, v1 outside the sandbox is `130/130`, structural is `37/37`, repository is `11/0/0`, and catalog is `9/27/187/0`. Live model/helper/evaluator/provider/subagent execution calls are `0`.
- CP8B: this Pre-code Contract Freeze is owner-approved; implementation has not started and remains separately unauthorized. CP9/CP10 remain pending their own gates.

## Dependency-ordered implementation checkpoints

Dependency graph:

```text
CP0 planning/decision
  → CP1 v2 contracts + v1 compatibility
    → CP2 logical identity/impact
      → CP3 durable store/attempt/resume
        → CP4 exact invocation/readiness/P0
          → CP5 sequential reader
            → CP6 evaluator/review/acceptance/report
              → CP7 operational controls/concurrency
                → CP8A `codex_chatgpt_app_server` runtime-adapter certification
                  → CP8B retention/legacy/CI/docs
                    → CP9 separately-authorized real pilot
                      → CP10 cumulative review/delivery decision
```

CP9 may be skipped/not authorized; in that case CP10 may review deterministic harness/App-Server-adapter contracts but must report live-model evidence `not_run` and cannot claim observed semantic behavior or hidden provider/runtime controls.

Mỗi checkpoint kết thúc bằng scoped tests, full relevant deterministic gates, self-review `0 Critical / 0 Required`, changed-file report và recommended English Conventional Commit. Commit chỉ sau explicit owner approval cho implementation phase. Checkpoint sau không bắt đầu nếu predecessor acceptance chưa đạt.

### CP0 — Planning and owner decision

**Scope:** documents only. Record architecture, dependencies, risks, gates and explicit pending implementation authority.

**Acceptance:** plan is implementation-ready; links/status consistent; full plan review `0 Critical / 0 Required`; deterministic foundation remains green. No model call.

### CP1 — Compatibility baseline and v2 contracts

**Scope:** freeze observable v1 behavior; add v2 schemas, artifact relationship validator, version routing and test fixtures, including canonical `run_review_summary` scope/count-unit/partition invariants plus renderer trust, typed-link and audit/security-policy contracts. Define exact CLI/output/state contracts before mutation-heavy code.

**Acceptance:** v1 tests byte/behavior compatible; every v2 artifact rejects wrong producer/version/hash/link; summary relationship validation rejects duplicate membership, denominator/partition/count-unit mismatch and incomplete evidence mislabeled as `not_run`/`inconclusive`; renderer contracts default all non-renderer-owned content to untrusted text and allow only typed contained local links; a model-authored `human_evaluation` is rejected; no orchestration/model call. Add CI test entry only when test file exists.

### CP2 — Logical identities and dependency impact

**Scope:** canonical `reader_input_id`, `evaluator_input_id`, `acceptance_input_id`; dependency graph and conservative change classifier.

**Acceptance:** HEAD/ref-only changes reuse; prompt/context/invocation/pre-dispatch-attestation changes invalidate reader descendants; post-run observation/resource evidence participates downstream without circularly redefining reader identity; evaluator-visible evidence projection or rubric/evaluator-protocol changes retain reader and invalidate evaluator descendants; storage/audit-only metadata outside the compiled evaluator payload does not invalidate evaluator reuse; full source integrity/provenance remains bound; unknown impact cannot return unaffected. Golden canonicalization and mutation matrices pass. No model call.

### CP3 — Durable store, immutable attempts and resume

**Scope:** fixed Git-common-dir state, task/run manifests, object store, journal, lease, transition guards, crash recovery and `outcome_unknown` handling.

**Acceptance:** fault-injection at each write/dispatch boundary resumes without duplicate confirmed calls or lost valid objects; attempts are immutable; active state survives new process/worktree/HEAD; corrupt links fail loud. Fixture adapter only, no model call.

### CP4 — Exact compiled invocation readiness and P0 guard

**Scope:** compiler, adapter/helper capability contracts, two-round readiness, one ephemeral config correction, default-zero/max-two helper policy, reader grants, evaluator static-plan readiness and preflight housekeeping preview.

**Acceptance:** historical P0 fixture (correct package policy, invocation does not expose it) fails before dispatch with reader calls `0`; unsupported enforcement also calls `0`; helper default/count/role/one-cluster boundaries pass with fake helpers; evaluator static rubric/protocol/runtime plan is checked; round sequence is exactly `1` or `1→2`, never `3`; durable contracts unchanged; TOCTOU hash mismatch blocks. Fixture adapters/helpers only, no model call.

### CP5 — Sequential reader execution, validation, reuse and resume

**Scope:** one adapter interface, default concurrency 1, per-unit dispatch/attempt/observation/resource validation, selective logical reuse and resumable sequential orchestration.

**Acceptance:** valid completed reader unit survives process/workspace/HEAD changes; reader identity change reruns only bounded descendants; partial run resumes first incomplete unit; invalid output cannot become evidence; outcome-unknown requires safe resolution. Deterministic fake adapter only.

### CP6 — Advisory evaluator, review summary, acceptance and report

**Scope:** evaluator-stage exact payload finalizer/dispatch guard, evaluator proposal adapter path, evaluator artifact validation, arithmetic-validated deterministic exception-first canonical summary, required untrusted-text-safe Markdown/static offline HTML renderers, reviewer decisions, accepted human evaluation materializer and v2 report. This remains one coherent semantic-authority rollback boundary with mandatory internal order `stage guard → proposal → canonical summary → Markdown/HTML rendering → decision → materialization/report`; do not checkpoint a partial chain as usable accepted evidence.

**Acceptance:** missing/stale/wrong rubric, resource evidence, comparison payload, protocol or runtime config fails before the stage with evaluator calls `0`; stage binding cannot create round 3/correction 2; evaluator cannot accept evidence; stale/partial-invalid decisions fail; evaluator-only input change reuses readers. A normal 21–24 case fixture exposes selected counts, baseline/candidate/comparison aggregates, reader/evaluator reuse/execution/retry/control fixtures, P0/helper result, every exception reason, anomalies/limitations, evaluator recommendation and exact human decision scope without requiring successful/equivalent case-by-case review. Validator recomputes exact partitions/denominators from bound members; incomplete, duplicate, cross-unit or contradictory counts fail and cannot reach `review_pending`. `summary.json`, `summary.md` and `summary.html` derive from one validated canonical object and preserve the same semantic text/counts/verdicts/scope. Malicious reader/evaluator/user strings containing raw HTML/Markdown, scripts, event handlers, style breakouts, unsafe/remote URLs, image/autolink syntax, embedded markup and terminal/control sequences remain literal inert text. HTML contains no JavaScript or remote-resource capability, uses only renderer-owned CSS/typed contained local links and includes a restrictive defense-in-depth CSP. Encoding/link/security-policy/renderer failure cannot reach acceptance; stale or obsolete rendered files cannot accept changed/current canonical scope; presentation-only safe rerender does not alter semantic acceptance identity. Accepted-scope report partitions are recomputed from the exact dependency-closed human-decision membership, match that canonical projection and render deterministically/idempotently; partial acceptance cannot inherit full-run totals and review-pending never looks complete. CP6 may use deterministic synthetic control-attempt fixtures to certify schema/renderer behavior; actual retry/cancel/timeout production integration belongs to CP7. Deterministic fake evaluator only.

### CP7 — Operational controls and bounded concurrency

**Scope:** progress, cancellation, phased timeout, classified retry and configurable concurrency after sequential correctness; feed actual control/unit/attempt outcomes into the CP6 canonical operational-aggregate contract without changing its semantics.

**Acceptance:** retry appends attempts; cancel/timeout preserves call certainty; no duplicate dispatch under restart; effective cap is conservative minimum; completion order does not affect report; per-unit invalidation remains exact. Reused/newly-executed/blocked logical-unit partitions and initial/retry/terminal/nonterminal attempt partitions (including explicit `outcome_unknown`) are derived from durable state, exhaust their declared non-overlapping units/scopes, remain identical after restart/resume and satisfy CP6 arithmetic/rendering validators. Stress/fault fixtures only.

## CP8A Pre-code Contract Freeze — owner-approved

This section is the compact execution contract for CP8A. It narrows the generic CP4–CP7 adapter seam without redesigning their completed ownership or rollback boundaries. Material deviation requires a new owner decision before implementation continues.

### Canonical adapter, assurance and claim boundary

- Adapter ID: `codex_chatgpt_app_server`.
- Assurance profile: `runtime_mediated`.
- Authentication boundary: ChatGPT-managed subscription/auth only, represented durably as `chatgpt_subscription`; API key, `chatgptAuthTokens`, Bedrock and other usage-based/direct-provider modes are rejected.
- Transport boundary: a harness-controlled local Codex App Server process over JSONL `stdio`; WebSocket/remote listeners are outside the first-adapter scope.
- “Exact input” means the lossless ordered harness-controlled reader/evaluator/helper input that CP8A maps into `turn/start.params.input`, including resolved output schema and behavior-relevant per-turn settings.
- “Exact request” means the exact canonical JSON-RPC request bytes that the harness writes to the App Server stdin, including local correlation fields.
- Neither phrase means exact upstream provider request bytes/IDs, provider-side idempotency, complete model-visible envelope, hidden built-in instructions or reproducible model output. Provider-transparent claims remain unsupported and must be reported as a `runtime_mediated` limitation.
- `compiled_invocation`, logical identities, readiness/grants, attempts, observation/proposal and acceptance/report authority remain owned by CP1–CP7. CP8A adds concrete runtime evidence that points into that graph; it does not make App Server history or a runtime index authoritative.

### Runtime identity, request and evidence lineage

The acyclic canonical lineage is:

```text
task_manifest
  → run_manifest(intent)
    → compiled_invocation
      → readiness_analysis + single-use grant
        → execution_attempt prepared
          → runtime_attestation
            → runtime_dispatch_request
              → runtime_event(s)
                → execution_attempt dispatched/terminal
                  → observation | evaluator_proposal
                    → existing review/acceptance/report chain
```

Runtime artifacts link to the exact prepared attempt, run, compiled invocation and readiness artifact before dispatch, then append exact dispatch/terminal evidence without rewriting those links; existing attempt phase links do not gain a reverse dependency or mutate. Relationship validation requires identical task/run/unit/role/attempt/invocation/readiness/runtime lineage. Same-run or same-unit near-matches are not sufficient.

Each `runtime_attestation` records only allowlisted execution evidence:

- adapter ID/version and `runtime_mediated` assurance profile;
- selected executable path, executable SHA-256, Codex CLI version, generated App Server protocol/schema hash and `stdio` transport;
- platform/runtime identity returned by initialization;
- sanitized `auth_mode: chatgpt` and optional plan type, without token, email, account ID, raw auth response or full environment/config dump;
- requested and resolved model identity where App Server exposes it, effort and relevant model capability result;
- exact allowlisted effective-config/permission projection and its hash;
- sandbox, approval, filesystem, tools, network, credential, remote-action and mutation attestation;
- fresh `threadId`/`sessionId`, normalized `instructionSources` paths plus exact file hashes, and the fresh-context method;
- explicit unsupported/opaque dimensions and capability limitations.

Every executable attempt uses a new `thread/start`. Before writing it, the adapter persists the exact secret-safe request plus `thread_start_write_intent` in the existing attempt journal; acknowledgement durably binds the returned `threadId`/`sessionId`. A crash or missing acknowledgement after that intent is `shadow_thread_outcome_unknown`: model-turn writes remain `0`, the unresolved bootstrap stays inventoried/quarantined, and neither restart nor CP8B may guess an ID or delete a near-match. Semantic execution must not use `thread/resume`, `thread/fork`, `thread/steer` or `thread/inject_items`; read-only thread lookup may be used only for bounded reconciliation. Unexpected, unreadable or hash-changed `instructionSources`, unsupported permission/config state, runtime/protocol drift or an auth mode other than ChatGPT blocks before `turn/start`.

Each `runtime_dispatch_request` records:

- the byte-for-byte exact newline-terminated UTF-8 `turn/start` JSON-RPC line written to App Server stdin and its `wire_request_sha256`;
- a separately canonical `semantic_dispatch_sha256` over behavior-relevant fields only;
- exact ordered input items, resolved `outputSchema`, model, effort, `cwd`, approval/sandbox policy and relevant per-turn settings;
- exact run/unit/role/attempt/invocation/readiness/grant/runtime-attestation bindings;
- format/schema versions and an explicit assertion that the request contains no credential material.

JSON-RPC ID, `threadId`, `turnId`, timestamps, local process ID and storage path remain audit/correlation metadata unless exposed in behavior-relevant input. They participate in wire/request integrity but not semantic reuse identity.

`runtime_event` is append-only and bounded to control-plane evidence needed for call certainty and debugging: `turn_start_write_intent`, write completion/failure, `turn/start` acknowledgement/error, terminal `turn/completed`, interrupt request/acknowledgement, lookup result and transport/process failure. Full item/delta streams are not required by default; final semantic text remains in existing validated observation/proposal artifacts. Every retained event stores exact relevant JSON bytes/hash when secret-safe; auth/account/config responses use only the allowlisted attestation projection.

### Atomic pre-dispatch snapshot and finder surface

For each reader, evaluator or separately authorized helper attempt, the adapter must perform this order:

1. consume/recheck the exact Stage 1–2 graph, grant, invocation and runtime config;
2. initialize the pinned App Server runtime, durably journal the exact `thread/start` request/write intent, create a fresh thread without starting a model turn and persist its acknowledgement;
3. validate auth/capabilities/config/permission state and returned `instructionSources`;
4. create and content-address the exact `runtime_attestation` and `runtime_dispatch_request`;
5. stage `input.txt`, byte-identical `request.json`, source hashes and an attempt snapshot manifest in a same-filesystem sibling directory; fsync them, atomically rename the complete attempt snapshot directory into `runs/<run-id>/runtime/attempts/<attempt-id>/`, then atomically replace the derived current runtime index;
6. immediately recheck the exact grant, invocation, attestation, request and representation hashes without consuming a second grant;
7. durably append `turn_start_write_intent` bound to the exact request;
8. only then write the exact newline-terminated `turn/start` bytes to App Server stdin;
9. persist write/ack/terminal/control events and existing terminal attempt/evidence in dependency order.

The final attempt-directory rename is the single publication point for the exact input/request snapshot; the derived index may expose that snapshot only after publication. Failure at steps 1–6, including index replacement, yields zero `turn/start` writes. Missing/stale/mismatched human-readable input, request representation, snapshot manifest or index is fail-closed and cannot be reconstructed after dispatch to retroactively legitimize a call. `input.txt` is a versioned lossless length-delimited UTF-8 view rather than Markdown; untrusted input cannot break its structure. `index.md` escapes untrusted display text and only emits typed contained local links.

`runtime/index.json` and `runtime/index.md` are rebuildable navigation views that show, for every unit/attempt, `why → intended → exact request → runtime identity → thread/turn → call certainty/outcome → evidence/result`. Rebuilding presentation with unchanged canonical hashes is audit-only; changing canonical intent/input/request/attestation requires a newly bound graph and the appropriate invalidation.

### Reuse, restart and opaque provider-envelope semantics

- The generic logical identities remain intact, but this concrete adapter cannot prove cross-run equivalence of the opaque provider envelope. Cross-run reader/evaluator semantic reuse is therefore `unknown` and disabled for `codex_chatgpt_app_server` until a future separately certified capability closes that dimension.
- Same-run completed valid evidence remains reusable across restart/worktree/HEAD changes after exact graph, object, runtime and representation validation. A reused unit points to its original attempt/runtime evidence and does not synthesize a new request/thread/turn.
- A retry creates a new attempt, fresh thread, attestation, request and event chain. It never overwrites or relabels the prior attempt.
- A request/thread/turn ID change alone is allowed audit variation only through a newly canonical graph; it cannot repair a stale request or authorize cross-attempt evidence substitution.
- Runtime binary/protocol/model/config/instruction-source/behavior-relevant request drift is `reader_affected` for reader/helper execution and invalidates descendants. Evaluator-only input/runtime drift is `evaluator_affected`. Unowned or opaque equivalence remains `unknown`, never `unaffected`.

### Lifecycle, control and call certainty

The CP7 attempt state machine remains authoritative. CP8A supplies concrete evidence for these conservative mappings:

- `connect` timeout covers process spawn, initialize, auth/capability/config checks and fresh `thread/start`/attestation;
- `dispatch` timeout covers the persisted exact request through complete stdin write and `turn/start` acknowledgement;
- `response` timeout covers an acknowledged turn until a terminal `turn/completed` or classified error;
- absence of a valid `turn_start_write_intent` can prove `confirmed_not_started` only when the ordered durable store/journal is intact;
- from `turn_start_write_intent` onward, a crash or missing acknowledgement is `outcome_unknown` unless exact App Server lookup proves not-started or a terminal outcome;
- an acknowledged `turnId` proves started/correlatable, not finished;
- successful `turn/interrupt` acknowledgement proves only that interruption was requested/accepted; confirmed cancellation requires terminal App Server evidence such as `turn/completed` with the mapped interrupted status;
- missing/ambiguous control acknowledgement, terminal event or lookup never becomes success/cancel/timeout by inference;
- unsupported idempotency/outcome lookup remains an explicit capability limitation. It preserves safety through stop/`outcome_unknown` and may block CP9 fault recovery; it does not weaken retry rules.

Restart must not send another `turn/start` for a dispatched attempt. It may reuse a completed same-run unit, reconcile the exact recorded thread/turn, mark conservative `outcome_unknown`, or create a later retry only after exact confirmed-not-started/terminal retryable evidence.

### App Server shadow store and CP8B ownership

App Server thread history is a runtime-owned shadow store, never the canonical run store, reuse authority or sole evidence source. CP8A records every acknowledged harness-created `threadId`/`sessionId` and its exact attempt relationship, plus every unresolved `thread_start_write_intent` whose resulting ID is not provable; it does not delete history during adapter certification.

CP8B owns shadow-history inventory, dry-run, archive/delete policy, quarantine/tombstones and operator documentation. Active/resumable/open-review/expected-correction tasks, any `outcome_unknown` attempt and every `shadow_thread_outcome_unknown` bootstrap retain canonical runtime/journal evidence and cannot authorize shadow deletion. Cleanup may target only exact acknowledged harness-created thread IDs after terminal certainty, durable evidence/index validation and explicit `closed`/`abandoned` lifecycle authorization. Failure to archive/delete or resolve an orphan remains recorded and does not rewrite canonical evidence, guess ownership or pretend cleanup succeeded.

### Authority, authentication and usage boundary

- CP8A implementation/certification uses deterministic mocked App Server transport only: live model/provider/helper/evaluator calls `0`, no login flow, no credential request and no network.
- Runtime auth validation accepts only ChatGPT-managed `chatgpt` state. It must reject API-key fallback rather than incur separate OpenAI API billing.
- Exact request/artifact/logging paths must never persist OAuth tokens, API keys, raw credential stores, account email/ID, unrestricted environment dumps or unfiltered full config.
- CP9 still requires a new explicit owner authorization for the exact six-case live reader/evaluator/helper call limits, runtime/model/effort, reviewer and retention. Its budget is a bounded ChatGPT-subscription usage/call budget, not an OpenAI API monetary-spend authorization. ChatGPT rate limits/plan constraints may block execution and are not silently bypassed.
- CP8A/CP8B completion, a `READY` contract verdict or available ChatGPT auth does not authorize CP9.

### Bounded semantic-substitution and critical regression contract

Later CP8A tests start from one complete positive graph and substitute one independently valid dimension at a time. Required fail-loud negatives are:

1. same task/scope/runtime but different `run_manifest.intent`/authority record;
2. same run/unit/invocation but `runtime_attestation` from another attempt/thread or runtime/config/instruction-source fingerprint;
3. same invocation text but a request with different model, effort, `outputSchema`, sandbox/approval policy or `semantic_dispatch_sha256`;
4. same run/unit but `runtime_dispatch_request` linked to another valid grant/readiness/attempt;
5. valid `runtime_event`/`threadId`/`turnId` from another request or attempt;
6. valid ChatGPT-shaped runtime graph with `auth_mode` substituted to `apikey`/another supported-but-forbidden mode;
7. valid canonical request with missing, stale or differently bound `input.txt`/`request.json` representation.

Each negative rejects at the relationship owner, performs zero new `turn/start` writes and produces no observation/proposal/accepted descendant. Rebuild the positive graph between dimensions. Allowed controls prove that JSON-RPC ID, timestamps and safe representation rerender can vary only through a newly canonical correctly rebound graph without changing semantic identity.

The smallest critical observable regression set is:

- parameterized positive reader/evaluator/verification-helper serialization and complete lineage over mocked JSONL `stdio`;
- atomic snapshot/index write failure and stale grant/runtime/hash drift both keep `turn/start` write count `0`;
- ChatGPT auth passes while API-key/credential-bearing request fallback fails with zero `turn/start` writes and secret-safe evidence;
- crash matrix before write-intent, after write-intent/before acknowledgement, and after acknowledged `turnId` proves `confirmed_not_started` versus `outcome_unknown`/lookup behavior without duplicate dispatch;
- interrupt plus dispatch/connect/response timeout matrix preserves exact CP7 certainty/outcome semantics;
- restart reuses only completed same-run evidence, never redispatches an unresolved attempt and returns cross-run provider-envelope reuse as `unknown`;
- CP8B fixture proves active/`outcome_unknown` shadow threads and unacknowledged `shadow_thread_outcome_unknown` intents are retained/quarantined, and only explicit closed/abandoned exact acknowledged harness-created IDs become cleanup candidates.

### CP8A post-freeze owner clarification and bounded correction

The correction pass after `6917114` preserves the freeze and adds no CP8B/CP9 authority. The identity layer owns the smallest allowlisted behavior-runtime projection; audit-only thread/turn/request/attempt/timestamp identities remain excluded. Retained secret-safe inbound control-plane events bind exact JSONL bytes/hash plus body↔outer lineage. A durable `verification_helper_input` artifact owns the uncertainty cluster, helper index, immutable helper input hash, question/context/invocation/runtime and run/readiness relationship, while process-local guards remain defense-in-depth only. Canonical reader/evaluator/concrete-helper APIs accept one explicit non-default owner grant and pass it unchanged to the concrete adapter; `run_manifest.intent` remains non-authorizing audit evidence.

Owner clarification for the finder surface is authoritative: `runtime/index.json` and `runtime/index.md` are two independently derived, rebuildable, non-authoritative views. Each is atomically replaced independently. No pair transaction, generation directory, shared pointer or new recovery/retention mechanism is required. The final pre-wire gate independently derives expected current JSON and Markdown from canonical runtime state, reads both current files and exact-compares each to its own expected view. Missing, malformed, stale, mixed, mutually-consistent-but-stale, mismatched or incomplete/extra navigation fails before `turn/start`; any optional rebuild would have to rerun the complete gate.

### CP8A — Concrete App Server runtime adapter certification

**Decision gate:** owner selected `codex_chatgpt_app_server`, `runtime_mediated` assurance and ChatGPT subscription/auth with no separate OpenAI API billing. The Pre-code Contract Freeze above is approved, and CP8A implementation/correction completed at `f9c821323ae5e8aa277d2cd68d4b416d80cf553e` with terminal `0 Critical / 0 Required`. This certification grants no live calls.

**Scope:** implement the selected adapter for reader, evaluator and optional verification-helper roles: exact harness-controlled input mapping and App Server request serialization; `run_manifest.intent`; runtime attestation/request/event lineage; atomic pre-`turn/start` input/request/index persistence; ChatGPT-only auth validation and credential exclusion; capability/protocol/config/instruction-source attestation; correlation and outcome lookup where supported; response/stream/error mapping; cancellation/timeout semantics; and immediate pre-wire grant/hash/runtime recheck. Do not claim or emulate provider-transparent request/response guarantees.

**Acceptance:** deterministic mocked-App-Server transport/replay tests satisfy every positive, zero-write, crash/control/restart and semantic-substitution case in the freeze; exact runtime views and index link the complete intent→request→result chain; invalid/stale grants, runtime/config/instruction-source drift, forbidden auth, secret-bearing request or representation persistence failure produce `turn/start` writes `0`; call certainty and App Server error/control/lookup mappings fail closed. Network/live model calls remain disabled. Inability to meet mandatory P0, pre-wire durability, ChatGPT-only auth or call-certainty contracts blocks CP9 rather than weakening them.

## CP8B Pre-code Contract Freeze — owner-approved

This section is the implementation boundary for the immediate next checkpoint only. It depends on CP8A's certified durable runtime graph, exact acknowledged harness-created thread relationship and explicit unknown states, but it does not inherit CP8A's pre-wire request machinery, live-budget controls or broader execution assurance. Material deviation requires a new owner decision before coding continues.

### Admission verdict and checkpoint boundary

- CP8B is admitted because the harness cannot safely reach a real pilot while task closure, cleanup authority, retained evidence, shared-object reachability, shadow-thread cleanup and representation freshness remain implicit.
- Keep: correctness, wrong-evidence prevention, lifecycle/cleanup authority, reuse and invalidation preservation, bounded execution, legacy migration safety, deterministic CI and operator workflow.
- Do not promote: generic workflow engines, distributed garbage collection, multi-host consensus, background daemons, arbitrary remote-admin support, stronger provider guarantees, automatic stale-thread deletion or theoretical transaction machinery with no CP8B acceptance value.
- CP8B may add only the smallest retention-owned records, validators, derived views, CLI commands, deterministic mocked adapter and documentation needed below. It must reuse the current Git-common-dir v2 store, content-addressed objects, hash/link validation, run journals, runtime snapshots/indexes and canonical review summary.
- CP8B implementation remains unauthorized by this freeze. CP9/CP10, live model/provider/helper/evaluator calls and real App Server archive/delete remain outside scope.

### Immutable creation and append-only task lifecycle

`task_manifest` remains the immutable creation record at `tasks/<task-id>/task.json`; implementations must not rewrite its creation-time `lifecycle`. New tasks start `active`. Current lifecycle is derived from the validated creation record plus a CP8B-owned append-only `task_lifecycle_event` sequence at `tasks/<task-id>/lifecycle.jsonl`:

```text
task_lifecycle_event-v1
  task_id
  sequence
  prior_state
  next_state
  basis
  basis_identity
  authority
  occurred_at
  prior_event_sha256
  event_sha256
```

- Allowed transitions are exactly `active → closed` and `active → abandoned`; no reopen and no second terminal transition.
- `sequence`, `prior_state` and `prior_event_sha256` form the CAS boundary. Append succeeds only against the exact current tail. A partial/torn/non-contiguous/hash-invalid sequence is not current authority and blocks cleanup.
- `event_sha256` is the v2 canonical hash of the event with only that self-hash field omitted; the next event binds it as `prior_event_sha256`. `authority` binds normalized `kind`, `authority_id`, `issuer` and independently verified authority-record hash rather than trusting prose in the event.
- `basis` is exactly `task_bound_pr_merge | owner_reconciled_close | owner_abandoned`.
- `basis_identity` is a strict basis-owned union: merge binds normalized repository/PR identity, merged head commit, merge commit/result, merge timestamp and task-aware event ID; reconciled close binds owner decision ID, exact observed merge identity and reason; abandon binds owner decision ID and reason. Fields from one basis cannot satisfy another.
- `task_bound_pr_merge` is the only automatic-close basis. The authoritative task-aware merge event itself binds exact `task_id` plus that merge identity under attributable task-aware authority. If immutable creation provenance already names a PR, the event must exact-match it; a null creation-time PR does not require manifest rewrite, but permits automatic close only through this exact authoritative task-aware event. A different PR, branch deletion, generic Git state or GitHub search result is not substitutable.
- A task created without a PR and later merged outside that authoritative task-aware event path cannot be auto-closed by inference. It remains `active` until an owner-issued `owner_reconciled_close` event records the exact task and reconciliation basis.
- `owner_reconciled_close` and `owner_abandoned` require explicit attributable owner authority. Review completion, implementation completion, commit, push, PR close, merge signal without the exact task binding, TTL or branch deletion cannot create either event.
- Branch deletion is operational metadata only: it is neither lifecycle authority nor a prerequisite for closure/cleanup, and CP8B adds no branch-deletion machinery.
- Crash recovery derives state by validating the complete sequence. A rebuildable current-state pointer may exist for navigation, but it is never authority and may be replaced only from that sequence.

### Durable cleanup holds

Holds are explicit append-only `cleanup_hold_event-v1` records under the owning task. Each record binds `task_id`, stable `hold_id`, `sequence`, `action: place | release`, exact `category`, attributable authority identity/hash, reason, timestamp, previous event hash and its own canonical self-excluding hash. Categories are exactly:

```text
open_review
open_pr
expected_correction
```

- A hold is active after a valid `place` with no later valid `release` for the same `hold_id`. Duplicate place/release, wrong prior state, missing sequence, cross-task authority or hash discontinuity fails closed.
- Any active hold blocks every destructive canonical or shadow cleanup action, even when task lifecycle is `closed` or `abandoned`.
- Creation/removal must be explicit, durable, attributable and deterministic. A task-aware workflow may write the event under its exact delegated authority; ad hoc inspection of local Git, branch names, GitHub PR status, timestamps or prose cannot place or release a hold.
- Lifecycle transition and hold release are separate records. A successful exact task-bound merge may close the lifecycle but cannot silently clear `open_pr`; if a crash occurs between those actions, the remaining hold safely blocks cleanup.

### Retain-first classification and durable plan

The planner enumerates the exact task scope plus globally shared objects and classifies every candidate exactly once as:

```text
retain
quarantine
purge_eligible
```

It persists an immutable `cleanup_plan-v1` before mutation. The plan binds:

- exact `task_id`, creation-manifest hash, derived lifecycle state/tail hash and active-hold set/tail hash;
- exact canonical task/run roots, run-manifest revisions/journal tails, runtime/review roots and candidate paths;
- complete retained, quarantined and purge-eligible memberships with stable item identity, bytes/content hash, classification and reason code;
- global shared-CAS reachability roots, traversal result and uncertainty/corruption status;
- exact shadow actions and eligibility evidence;
- planner/policy/schema versions, creation time, `plan_id` and canonical `plan_sha256`.

Planning is the default dry-run and has zero filesystem/App Server mutation other than durably publishing this audit plan. Every proposed apply must name the exact reviewed `plan_sha256`; the implementation must not silently recompute or broaden it.

Classification fixes the maximum action: `retain` stays in place; `quarantine` may move only to recoverable quarantine and is not purgeable under that plan; `purge_eligible` must first pass the same recoverable quarantine/apply phase and only then may enter the separately authorized purge phase.

Retained minimum must be enough to reconstruct why the task existed, its lifecycle/hold decisions, every cleanup plan/apply/purge outcome and the semantic authority of each retained run. At minimum retain task creation; lifecycle and hold histories; run manifests and authoritative journals; intent, compiled/readiness/runtime request/attestation/event/result certainty bindings; accepted observation/resource/proposal/summary/decision/evaluation/report identities and hashes; representation metadata; cleanup authority/attempt records; and tombstones explaining every quarantined or purged item. Heavy duplicate presentation/raw bytes may move only when their canonical relationship and required semantic/audit hashes remain reconstructible.

Active tasks retain all canonical and resume-required state. `outcome_unknown`, `shadow_thread_outcome_unknown`, corrupt ownership, incomplete graph, missing canonical dependency or uncertain reachability is `retain` or a fail-closed planning error; it never becomes `purge_eligible`.

### Global reachability for shared CAS objects

Shared content-addressed objects are classified by one deterministic global graph walk from all retained task/run manifests, validated journals, lifecycle/hold histories, accepted semantic graphs, runtime/review roots and pending cleanup records across the store—not by the task currently being cleaned.

- An object reachable from any retained graph is `retain`, including when the current task no longer references it.
- An unreferenced object may become `purge_eligible` only when the exact reviewed plan proves complete global traversal, valid links and zero retained roots.
- Missing/corrupt roots, unknown artifact/link type, traversal disagreement or concurrent root change fails closed as retain/stale-plan; no guessing or partial mark-and-sweep.
- CP8B does not introduce distributed GC, a global lock service or background collector. It uses the current single-store CAS/revision primitives and revalidates immediately before each bounded mutation phase.

### CLI, authority, apply and purge

The smallest command surface is:

```text
node .agents/scripts/run-skill-eval-harness.mjs retention plan --task <task-id>
node .agents/scripts/run-skill-eval-harness.mjs retention apply --plan <plan-sha256> --authority <authority.json>
node .agents/scripts/run-skill-eval-harness.mjs retention purge --apply <apply-sha256> --authority <authority.json>
node .agents/scripts/run-skill-eval-harness.mjs legacy inventory --root <legacy-root>
```

Cleanup authority files are strict, credential-free, independently verified records rather than generic JSON bags. Both bind `authority_id`, `issuer`, `issued_at`, `expires_at`, single-operation `nonce`, `task_id` and `plan_sha256`. Apply additionally binds a sorted exact `allowed_actions` subset of `local_quarantine | shadow_archive | shadow_quarantine`; purge additionally binds exact `apply_sha256`, sorted exact `purge_item_ids` and an `allowed_actions` subset of `local_delete | shadow_delete`. Unknown/extra fields, invalid verification, expiry, set mismatch, cross-task/plan/apply substitution or reuse of one nonce for a different operation rejects the authority; replay of the exact same apply/purge identity enters idempotent reconciliation instead of spending a second operation.

- `retention plan` is dry-run/default, creates no quarantine/purge/shadow mutation and emits the durable plan identity.
- `retention apply` requires an owner-issued `cleanup_apply_authority-v1` that binds exact task, exact `plan_sha256`, allowed local quarantine plus shadow inspect/archive/quarantine actions and expiry/nonce. It cannot authorize local or shadow deletion. The authority record is validated input/audit evidence, not a self-grant by the harness. Before mutation, apply exact-compares all lifecycle/hold/journal/revision/path/hash/reachability/shadow preconditions. Any drift returns stale-plan failure with zero new mutation.
- Apply writes a durable `cleanup_apply_record-v1` intent before its first action, uses exact per-item idempotency keys, quarantines recoverably before any purge, and appends acknowledged/failed/ambiguous item results. Repeating the same apply reconciles that exact record; a different plan or authority cannot adopt its actions.
- Crash/ambiguity does not infer success. Reconciliation exact-checks the target/source identity and recorded acknowledgement; otherwise the item remains quarantined/unknown and blocks purge. The implementation need not provide a cross-filesystem/global transaction.
- `retention purge` is a separate destructive phase and requires a separate owner-issued `cleanup_purge_authority-v1` bound to the exact completed `apply_sha256` and exact `purge_eligible` membership. It revalidates lifecycle, holds, global reachability, successful prior local/shadow quarantine or archive acknowledgement, quarantine identity and every item hash. It may remove no item absent from the reviewed plan and cannot expand a `quarantine` item to purge on its own.
- Repeated acknowledged apply/purge is idempotent. A concurrent lifecycle/hold/root/revision change makes the reviewed plan stale; the operator must create and review a new plan rather than force the old one.
- Every actual removal leaves a durable tombstone with task/plan/apply/authority/item identity, original classification/reason, prior hash, action result and timestamp. Failure stays explicit and cannot be rendered as success.

### App Server shadow-store certification boundary

The canonical v2 store and App Server shadow history remain separate. CP8B certification uses only an injected deterministic/mock `shadow_cleanup_adapter-v1`; production/live App Server archive/delete capability remains unsupported and must fail with an explicit capability limitation.

A shadow action is eligible only when all are true: exact harness-created acknowledged `threadId`; exact task/run/attempt binding; terminal attempt certainty; task lifecycle `closed` or `abandoned`; no active hold; no `outcome_unknown` or `shadow_thread_outcome_unknown`; canonical evidence and runtime indexes validate; and the exact action appears in the reviewed plan. Fuzzy title/input/time/branch matching, nearby thread IDs, runtime search results and unknown ownership are never authority.

The mocked boundary supports only exact inspection, `archive | quarantine | delete` intent, acknowledgement/result and same-idempotency-key reconciliation. Apply certification may issue only inspect/archive/quarantine; delete is reachable only from separately authorized purge after the exact prior acknowledgement. It persists `shadow_cleanup_event-v1` with plan/apply/item/thread/action identity before the call and records acknowledgement, explicit failure or ambiguity afterward. Ambiguous outcome blocks a different retry and any success/tombstone claim; only exact adapter reconciliation may resolve it. Shadow failure never rewrites canonical evidence, lifecycle or retention classification.

### TTL boundary

TTL may derive only age-based operator-review hints and local quarantine eligibility for already non-authoritative orphan material. TTL cannot establish certainty, close/abandon a task, release a hold, delete unresolved state, prove shadow ownership, convert unknown to terminal or override the exact reviewed plan. CP8B has no automatic stale-thread deletion.

### Canonical review and derived representations

`run_review_summary`/`summary.json` and the bound human decision chain remain semantic authority. `summary.md`, `summary.html`, `runtime/index.json` and `runtime/index.md` are derived views. CP8B adds the smallest durable `review/representations.json` metadata record that binds canonical summary identity/hash, `renderer_version`, `security_policy_version`, `summary.json`/Markdown/HTML hashes and one deterministic freshness/rebuild identity.

- A missing, malformed, stale, mixed-policy or hash-corrupt derived file is detected against canonical state and metadata, then atomically rebuilt from the exact canonical summary or quarantined.
- Rebuild may update only derived bytes/metadata. It cannot change the canonical summary, human decision, acceptance identity, report membership or semantic verdict.
- If canonical inputs are unavailable/corrupt, fail closed and quarantine the presentation surface; do not reconstruct semantics from Markdown/HTML/runtime indexes.
- Runtime indexes keep CP8A's two independently derived/replaceable views. CP8B may rebuild/quarantine them but does not add pair transactions, a generation directory or shared-pointer authority.

### Legacy v1 compatibility boundary

`legacy inventory --root <legacy-root>` is read-only. It emits a `legacy_v1_inventory-v1` catalog with exact normalized source-root identity, contained relative path, readable bytes hash when available, detected v1 artifact/report type, `readable | unreadable | unsupported` status and limitations. Source files are never rewritten.

Within CP8B, “import” means catalog/reference only. A legacy entry may be linked for historical comparison, but it is not written as a v2 artifact and cannot satisfy any v2 task/run/readiness/runtime/reuse/evaluator/acceptance/report or cleanup authority relationship. V1 commands/goldens/report reproducibility remain unchanged. Corrupt or partial v1 material is reported/quarantined as legacy source material, never repaired into v2 evidence.

### Semantic relationship freeze

| Chain | Authority owner | Producer | Consumer | Exact identity | Positive control | Forbidden substitution | Rejecting owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lifecycle transition → cleanup eligibility | validated lifecycle sequence | attributed operator or exact task-aware merge workflow | retention planner | `task_id + creation_sha256 + sequence + prior_event_sha256 + event_sha256` | exact bound PR closes `active`, then no-hold plan may classify | unrelated PR, branch delete, stale tail, inferred merge, reopen | lifecycle validator before planner |
| Hold state → destructive blocking | validated hold sequence | attributed hold authority | planner, apply, purge and shadow adapter | `task_id + hold_id + sequence + event_sha256` | explicit release of exact active hold removes that one blocker | Git/GitHub inference, wrong task/category/hold, missing release | every destructive entry gate |
| Cleanup plan → apply/purge | immutable cleanup plan plus separate authority records | planner, then attributed apply/purge authority | apply record, then purge record | exact `plan_sha256`; then exact `apply_sha256` plus separately bound authority | unchanged store applies only listed action; separately authorized purge removes only listed eligible item | stale/recomputed/expanded plan, authority from another task/action | apply/purge validator before mutation |
| Canonical retained root → shared object | complete global retained-root graph | global reachability builder | object classifier and apply/purge gates | root type/id/hash plus exact content-addressed link closure | object reachable from any retained task stays retained | current-task-only scan, path/name similarity, missing/corrupt link treated absent | global reachability validator |
| Canonical runtime attempt → shadow action | CP8A runtime/journal relationship graph plus reviewed plan | CP8A adapter evidence and retention planner | mocked shadow cleanup adapter | exact task/run/attempt plus acknowledged `threadId`, certainty, plan item and idempotency key | closed/no-hold terminal acknowledged thread gets planned mocked archive then separately authorized delete | fuzzy donor, nearby thread, unknown/unacknowledged ID, other run/task | shadow eligibility gate and adapter |
| Canonical summary → review representations | canonical `run_review_summary` and decision chain | review builder and deterministic renderer | representation validator and reviewer surface | summary artifact id/hash + renderer/security versions + output hashes + freshness id | corrupt Markdown is rebuilt from unchanged valid summary | derive semantics from Markdown/HTML/index, stale metadata accepted | representation validator before review/default display |
| Legacy source → inventory/reference | legacy inventory boundary | read-only legacy inventory reader | operator/reference view | normalized root identity + contained relative path + bytes hash/status | valid v1 report remains readable as `legacy_v1` reference | any v1 entry used as v2 readiness/reuse/runtime/eval/task authority | legacy boundary and v2 graph validator |

### Required regression contract

CP8B implementation is not complete until deterministic fixtures prove at least:

1. unrelated PR merge cannot close a task;
2. exact task-bound successful PR merge can close it;
3. stale lifecycle tail/CAS transition is rejected;
4. abandon requires exact owner authority;
5. active task cannot enter destructive cleanup;
6. each `open_review`, `open_pr` and `expected_correction` hold independently blocks apply/purge/shadow actions;
7. dry-run publishes only its immutable audit plan and creates zero cleanup-target/quarantine/purge/shadow mutation;
8. exact reviewed plan and apply authority affect only listed quarantine actions;
9. lifecycle/hold/root/revision drift makes the plan stale with zero new mutation;
10. retained roots and their complete required semantic/audit closure survive cleanup;
11. one object shared by a retained graph and a cleanup candidate remains retained;
12. an unreferenced object becomes eligible only through a complete reviewed global plan;
13. apply/purge cannot exceed plan membership, and purge requires separate authority;
14. a wrong task/run/attempt/thread donor cannot authorize shadow action;
15. TTL and unknown state cannot close, release, delete or establish certainty;
16. ambiguous shadow action remains explicit and cannot be retried under a different identity or claimed successful;
17. stale/corrupt review/runtime representation rebuild does not change canonical semantic authority;
18. v1 inventory/reference cannot satisfy any v2 relationship or readiness/reuse/acceptance gate.

The positive fixture starts from one complete valid graph. Each negative substitutes exactly one independently valid dimension where practical so failures prove semantic relationship enforcement rather than malformed input rejection.

### Planned source, test, CI and documentation map

- New `.agents/scripts/lib/skill-evals/retention-v2.mjs`: lifecycle/holds, plan/reachability, authority/apply/purge, tombstone, representation-retention and legacy-inventory behavior.
- Minimal compatible extensions to `.agents/scripts/lib/skill-evals/harness-schema-v2.mjs`, `.agents/scripts/lib/skill-evals/run-store-v2.mjs` and `.agents/scripts/lib/skill-evals/review-v2.mjs` only where the frozen records/relationships and rebuild hooks require them; no CP1–CP8A authority redesign.
- Extend `.agents/scripts/run-skill-eval-harness.mjs` with only the four frozen command forms.
- New `.agents/scripts/run-skill-eval-harness-cp8b.test.mjs` for the positive graph, 18 required regressions, crash/stale/idempotency behavior, mocked shadow adapter, review rebuild and v1 non-promotion. Reuse current CP8A fixtures instead of reproducing the runtime adapter.
- `.github/workflows/ci.yml`: add deterministic CP8A and CP8B harness test entries alongside the current v2 harness test; no network, credential, database, browser or live App Server step.
- Update `.agents/skills/maintain-repo-skills/references/eval-design.md` with the implemented operator contract only during CP8B implementation, plus this plan, owner brief and progress. Do not create a dashboard, hosted viewer or generic cleanup-platform document.

### Explicit exclusions and stop conditions

- No live model/provider/helper/evaluator execution; no real App Server archive/delete; no credentials or network.
- No CP9 pilot, CP10 cumulative review/delivery, skill migration, suite semantic change, product/database/Supabase/frontend work or broad v1 refactor.
- No automatic merge inference outside the exact task-aware event, branch deletion automation, TTL lifecycle authority, generic scheduler/workflow engine, distributed GC, multi-host lock/consensus, background cleanup daemon or provider-transparent guarantee.
- STOP implementation rather than invent semantics if exact task/PR binding cannot be established, a current record cannot be validated/rebuilt, global reachability is incomplete, a destructive authority does not bind the exact plan/apply, real shadow mutation would be required for certification, or any checkpoint requirement would need CP9/CP10 ownership.

### CP8B — Retention, legacy compatibility, CI and operator docs

**Scope:** implement only the frozen lifecycle/hold sequences, retain-first planning, global shared-object reachability, exact-plan quarantine/separately-authorized purge, deterministic mocked shadow cleanup, derived representation validation/rebuild, read-only legacy v1 inventory/reference, the four-command CLI surface, operator docs and deterministic CI wiring above.

**Acceptance:** all 18 frozen regressions pass from exact positive controls; dry-run writes only its immutable plan and produces zero cleanup-target/shadow mutation; stale or expanded plans fail before mutation; active/held/unknown/corrupt state retains or fails closed; only exact lifecycle and separate apply/purge authorities permit bounded actions; global reachability preserves every shared retained object; mocked shadow actions use exact acknowledged task/run/attempt/thread bindings and keep ambiguity explicit; canonical summaries/decisions remain unchanged across representation rebuild; v1 remains read-only/reference-only and cannot satisfy v2 authority. Minimum semantic/audit evidence and tombstones survive, task-store artifacts remain outside Git scope, all deterministic suites/repository validation pass, and model/live App Server calls remain `0`.

### CP9 — Authorized six-case real-model pilot

**Authority gate:** CP8A must already have certified `codex_chatgpt_app_server` under `runtime_mediated` without live calls, and CP8B must have certified its durable/shadow retention boundary. Separate explicit owner approval is still required for exact live reader/evaluator/helper call limits, ChatGPT runtime/model/effort and rate-limit boundary, reviewer and retention. API-key fallback and separate OpenAI API billing remain forbidden. CP1–CP8B completion does not authorize this checkpoint.

**Affected cases:** exact representative set, two variants where suite defines comparison:

- `gcw-reg-commit-versus-push`
- `gcw-route-push-remote`
- `gcw-fresh-dirty-secret-stop`
- `ghci-reg-explicit-fix-exact-actions`
- `ghci-route-db-risk-stop`
- `ghci-fresh-self-fix-cycle`

**Reuse:** no historical v1 observation is accepted because it lacks v2 compiled-invocation readiness. Within one CP9 run, resume/reuse a reader observation only when exact `reader_input_id`, object integrity, runtime/request representations and readiness/runtime attestation match; evaluator proposals require exact `evaluator_input_id` plus their full runtime lineage. Cross-run reader/evaluator semantic reuse for this adapter is `unknown` because the provider envelope is opaque and is disabled. Acceptance is never reused when `acceptance_input_id` or review scope changes.

**Readiness before first call:** clean preflight; immutable `run_manifest.intent` matching the current authorization; certified adapter; exact executable/protocol/config/auth/capability attestation; exact compiled reader invocation set and evaluator static plan; required harness-controlled policy/input exposed at the App Server boundary; pre-dispatch attested filesystem/tool/network/credential/remote/mutation conditions; validated fresh thread plus `instructionSources`; integrity pass; readiness round ≤2; grants bound to invocation hashes; and exact pre-`turn/start` input/request/index persistence. Optional helper count defaults `0`, is capped at `2` for one cluster and is separately authorized/recorded. Any pre-reader failure means zero reader `turn/start` writes for the run. After reader evidence exists, exact evaluator stage finalization and the same runtime/request snapshot sequence must pass before any evaluator `turn/start`; failure preserves valid reader evidence and yields evaluator writes `0`.

**Partial state:** persist per-case/per-variant attempts, runtime attestations/requests/events and reader observations, then evaluator attempts/runtime evidence/proposals independently. Resume completed valid same-run units; `outcome_unknown` is looked up/resolved or stopped, not blindly retried. A process failure after four reader units must not rerun those four when identities and complete runtime lineage remain valid. App Server shadow history alone cannot establish completion or reuse.

**Invalidation:** prompt/context/bundle/compiled invocation/harness-controlled App Server request, behavior-relevant runtime config/attestation/instruction-source/fresh-context change invalidates affected reader and all descendants. Wire-only correlation metadata remains audit-only through a newly bound graph. Post-run observation/resource evidence or evaluator rubric/protocol/runtime changes invalidate evaluator and acceptance/report but do not circularly redefine an otherwise valid reader input identity; observed access contradicting attestation invalidates/blocks that observation itself. Proposal/summary/review-policy/scope change invalidates acceptance/report only. Opaque provider-envelope cross-run equivalence is `unknown`; rerun the bounded six-case group or smaller proven dependency-closed subset, never silently reuse and never default to all 187 cases.

**Acceptance:** validated observations → advisory proposals → arithmetic-valid canonical summary → current security-policy-valid Markdown/HTML representations → authorized human decision. Stop at `review_pending` until current canonical identity, runtime lineage and required safe representations are valid and that decision exists. Preserve unfavorable/inconclusive evidence. Record exact ChatGPT-subscription call counts/limits, reuse/invalidation, helper count, reader P0, evaluator-stage attestations and runtime/shadow limitations; do not invent API cost or provider request evidence. CP9 proves only six-case semantic behavior and App Server/runtime facts actually observed at the `runtime_mediated` boundary. CP7 and CP8A deterministic fixtures remain authoritative for exhaustive cancellation/timeout/retry/call-certainty matrices; do not spend real calls or induce failures merely to re-prove them. No claim beyond these six cases, the local App Server boundary or unobserved provider controls.

### CP10 — Cumulative hardening review and delivery decision

**Scope:** complete-diff integration review, threat/lifecycle audit, deterministic rerun, pilot evidence review if CP9 was authorized, documentation/status reconciliation and separate delivery permission check.

**Acceptance:** `0 Critical / 0 Required`; clean relevant deterministic suite; all artifacts/status truthful; no active secret/raw-state leak; owner decides whether and how to deliver. CP10 does not imply PR/merge/deploy authority.

## Verification strategy

### Deterministic automated coverage

- schema positive/negative/cross-artifact and producer-authority tests;
- canonical identity golden fixtures plus one-field mutation matrix;
- evaluator-visible projection fixtures proving behavior-relevant changes invalidate evaluator reuse while attempt/timestamp/storage-only metadata changes do not, without weakening full-artifact integrity/provenance validation;
- dependency-impact matrix including `unknown` fail-closed;
- atomic write, journal, lease and crash-point fault injection;
- P0 zero-call spies for missing model-visible policy and unavailable enforcement;
- exact two-round/one-correction readiness tests plus default-zero/max-two/one-cluster helper matrix;
- evaluator static-plan and exact stage-payload zero-call guards for missing/stale/wrong evidence, rubric, comparison, protocol and runtime config;
- resume/reuse across process, path, workspace and HEAD changes;
- advisory evaluator/acceptance authority tests;
- 21–24 case aggregate/exception review fixtures plus exact denominator/membership/partition/count-unit arithmetic, incomplete-vs-`not_run`/`inconclusive`, resume/retry/reuse reconstruction and report-scope reconciliation tests;
- canonical-to-Markdown/HTML semantic round-trip, offline HTML, renderer/security-policy failure, stale/obsolete-render and presentation-only-rerender tests;
- malicious untrusted-text fixtures covering `<script>`, event/style/tag breakouts, raw Markdown/HTML, images/autolinks, code-fence breakout, `javascript:`/`data:`/`vbscript:`/external/protocol-relative/traversal URLs and terminal/control sequences; assert literal inert display, typed contained local links only, no JavaScript/remote resources and restrictive CSP defense in depth;
- cancellation/timeout/retry/call-certainty/concurrency stress tests;
- `codex_chatgpt_app_server` contract tests over a mocked JSON-RPC/App Server transport with network disabled, including exact pre-dispatch snapshots, ChatGPT-only auth, runtime attestation, fresh-thread/instruction-source binding, crash/call-certainty mapping and the bounded semantic-substitution matrix frozen above;
- retention lifecycle including implementation-complete/open-PR state, derived runtime-index rebuild, App Server shadow-thread inventory, active/`outcome_unknown` retention, quarantine, dry-run and v1 golden compatibility tests;
- deterministic report idempotence independent of attempt completion order;
- existing runner tests, repository skill validator and all suite validation.

Tests assert observable artifacts, calls, states and reports, not private helper shape. Network/provider calls are forbidden in deterministic CI.

### Model evidence boundary

Only CP9 may call models, only after separate authority, CP8A `codex_chatgpt_app_server` certification, CP8B retention certification and exact reader/evaluator-stage readiness. Optional real verification helpers are separately counted/authorized and are not semantic eval evidence. The pilot is diagnostic evidence for six named cases, not proof for all 187 cases, the opaque provider envelope or every provider/runtime. Its budget is exact ChatGPT-subscription call usage, not API-key/OpenAI API spend; auth fallback is forbidden. Any later affected group must repeat the CP9 template: exact cases, reuse identity, readiness, partial state and separate reader/evaluator invalidation. Full-suite model rerun requires a recorded impact reason and a new usage/authority gate.

### Manual QA strategy

Manual QA không thay deterministic tests và không chạy model nếu chưa có CP9 authority.

- CP1–CP4: inspect CLI help/error surfaces, schema diagnostics, readiness field diff and zero-call failure output using local fixtures.
- CP5: interrupt/restart one fake-adapter run from a second process and verify only incomplete unit continues.
- CP6: inspect evaluator-stage zero-call failures and canonical `summary.json` plus Markdown/HTML views for aggregate pass/regression, invalid evidence, stale proposal and partial-review fixtures; verify arithmetic denominators/partitions and each exception without opening successful/equivalent cases. Inspect malicious-looking text in both views as literal inert content, confirm local typed evidence links only and no script/remote load path, then perform local reviewer accept/reject/rerun flows.
- CP7: exercise Ctrl+C, timeout and bounded concurrency with slow/failing fake adapters; verify progress, immutable attempt history and identical unit/attempt aggregates after restart/resume.
- CP8A: inspect exact mocked App Server input/request snapshots, `run_manifest.intent`, runtime attestation/index, ChatGPT-only auth, fresh-thread/instruction-source, error/cancel/lookup and crash/call-certainty mappings; confirm no live credentials/network/model call and no provider-transparent claim.
- CP8B: run cleanup dry-run on active, implementation-complete-with-open-PR, `outcome_unknown`, explicitly closed, abandoned and corrupt fixture tasks; inspect canonical evidence retention, derived runtime-index rebuild, App Server shadow-thread candidates/quarantine/tombstones and unchanged v1 report.
- CP9: if separately authorized, authorized human reviewer inspects all six case surfaces before any acceptance. Manual QA is blocking for CP9 acceptance.

QA fixtures must be synthetic, credential-free and generated under test temp or the test-owned task root. Manual state fixtures are never pointed at real active task data. Missing GUI/browser infrastructure is not a blocker because the harness interface is CLI/artifact based.

## Documentation và progress tracking

- `docs/agent-skills/plan.md`: program-level intended architecture and authority boundary.
- this `plan.md`: detailed implementation/checkpoint source.
- `owner-review-brief.md`: explicit owner decisions and pending/approved gates.
- `docs/agent-skills/progress.md`: current checkpoint, verification, review, commit/push/PR state.
- `.agents/skills/maintain-repo-skills/references/eval-design.md`: current operational eval contract; update in CP8B or earlier only when implemented behavior needs it.
- CLI `--help` and any operator guide: exact executable contract, not a substitute for ownership/permission docs.

Each completed checkpoint updates plan/progress truthfully in the same checkpoint. Model raw artifacts and generated `summary.json`/`summary.md`/`summary.html` remain task-store evidence and are not committed. Final docs must state model evidence `not_run`, partial, pending human review or accepted without prediction.

## Risk register

| Risk | Impact | Planned control |
| --- | --- | --- |
| policy present in package but absent from actual invocation | entire model batch invalid | compiled invocation P0, single-use hash grant, zero-call regression |
| evaluator payload is stale/incomplete after valid readers | evaluator batch waste and invalid proposal | prevalidated static plan plus exact set-level evaluator stage guard and zero-call tests |
| optional helper loop expands readiness | unbounded cost/authority drift | default 0, maximum 2 calls, one cluster, Round 1 only, no evidence authority |
| CP9 starts before the App Server adapter is certified | pilot becomes hidden implementation/debug checkpoint | mandatory CP8A deterministic `codex_chatgpt_app_server` certification |
| crash after App Server dispatch | duplicate subscription usage/evidence ambiguity | pre-dispatch immutable attempt, call certainty, `outcome_unknown`, adapter lookup/stop |
| over-broad or stale reuse | invalid semantic evidence accepted | layered canonical identities, content integrity, fail-closed impact graph |
| audit-only evaluator metadata invalidates reuse | unnecessary evaluator calls despite identical model-visible evidence | explicit canonical evaluator-visible projection plus separate full-artifact integrity/provenance binding |
| HEAD-based invalidation | needless reruns/lost work | Git-only provenance, logical model-visible input keys |
| evaluator authority leakage | model proposal becomes final truth | producer validation, human decision binding, deterministic materializer |
| aggregate review hides run shape or renderer drifts | owner accepts stale/incomplete scope | canonical aggregate summary, same-source Markdown/HTML, semantic-consistency/stale-render gates |
| model/user text executes in a review representation | local code/script/CSS execution, unsafe navigation or remote data/resource load during human review | untrusted-text-by-default renderers, no JavaScript, typed contained local links, context escaping, restrictive CSP and hostile fixtures |
| aggregate arithmetic contradicts declared scope | owner decides from impossible or double-counted totals | derived duplicate-free memberships, declared count units/denominators, exact partition validation and resume reconstruction |
| CP7 controls bypass the CP6 summary contract | retries/timeouts/cancels exist in state but review counts stay stale or ambiguous | CP6 schema/fixture contract followed by mandatory CP7 durable-state integration tests |
| concurrency race | duplicate dispatch/corrupt state | sequential-first, CAS revision, lease/journal, bounded stress tests |
| implementation completion is mistaken for task closure | open-PR/correction resume evidence is deleted | explicit `active/closed/abandoned` lifecycle, orthogonal delivery/PR signals, dry-run + quarantine |
| raw model output contains sensitive data | secret retention/leak | credentials excluded, bounded input, redaction/scan, no committed raw evidence |
| v2 changes v1 behavior | historical report/CI regression | separate entrypoint/schema, v1 goldens and full runner suite every checkpoint |
| pilot evidence overclaimed | misleading program decision | exact six-case scope, human gate, claim boundary and separate authority |
| local App Server evidence is mislabeled as provider-transparent | false audit/reproducibility guarantees | canonical `runtime_mediated` terminology, exact harness-boundary claim and explicit opaque-envelope limitation |
| auth/config silently falls back to API-key billing | unauthorized credential/cost boundary | require sanitized ChatGPT auth attestation, reject API-key/credential-bearing request before `turn/start`, zero-write regression |
| crash occurs between persistence and App Server dispatch | missing input evidence or duplicate/ambiguous call | atomic input/request/index persistence, durable write-intent ordering, lookup-or-`outcome_unknown`, never blind retry |
| opaque provider envelope is treated as cross-run equivalent | unsafe semantic evidence reuse | same-run-only runtime reuse for this adapter; cross-run equivalence is `unknown` and reruns a bounded dependency-closed scope |
| App Server thread history becomes canonical or is cleaned too early | lost evidence or hidden state authority | canonical task-store evidence plus separate shadow inventory; CP8B deletes only exact terminal closed/abandoned harness-created IDs |
| App Server binary/protocol/config/instruction sources drift | dispatched behavior differs from certified behavior | behavior-relevant runtime attestation, immediate pre-wire recheck and affected-only invalidation/zero-write failure |

## Specialist plan-review decision

Specialist count: `0`. Direct repository evidence resolves current ownership, schema, test, Git and lifecycle questions; no unresolved domain gap requires a specialist to make the planning verdict. This main-agent self-review does not claim independent/fresh-reader identity. A model fresh-reader is `not_run` because current authority excludes model execution and deterministic/document review is sufficient for this planning gate.

## Stop conditions

Stop and report before further mutation when:

- repository evidence contradicts an owner-decided baseline;
- any required enforcement cannot be proven on exact compiled invocation;
- readiness would require round 3 or durable-contract mutation;
- helper use exceeds one cluster/two calls, lacks explicit external-call authority, or remains unresolved after Round 2;
- evaluator static plan or exact stage payload cannot be validated without another readiness/correction cycle;
- `codex_chatgpt_app_server` has not passed the frozen CP8A deterministic certification before CP9;
- App Server auth is not sanitized `chatgpt`, an API-key/credential fallback is required, or the owner-approved ChatGPT subscription boundary cannot be maintained;
- exact harness-controlled input/request snapshots, `run_manifest.intent`, runtime attestation or the derived runtime index cannot be validated and atomically persisted before `turn/start`;
- App Server executable/protocol/config/model/effort/permissions/instruction-source state drifts after readiness and cannot be rebound without dispatch;
- an implementation would need provider-envelope transparency, provider-side idempotency or cross-run semantic reuse that `runtime_mediated` cannot attest;
- App Server shadow-thread ownership or terminal cleanup eligibility cannot be proven without relying on the shadow store as canonical evidence;
- state ownership, lease or call outcome is ambiguous and retry may duplicate a call;
- artifact identity/integrity/producer authority fails;
- canonical summary membership/denominator/partition/count-unit arithmetic fails;
- renderer cannot preserve untrusted content as inert text, validate typed contained links, satisfy current security policy or prove representation freshness;
- impact is unknown and no safe bounded group can be defined;
- cleanup would touch active/open-review/open-PR/expected-correction/outcome-unknown/unowned state or lacks explicit closure/abandonment evidence;
- model/remote/implementation action lacks explicit authority;
- a checkpoint review has any unresolved Critical or Required finding.

## Rollback and correction boundaries

- Each checkpoint is a separately reviewable rollback boundary; do not combine schema/identity/store/readiness in one correction range.
- Never rewrite immutable attempts or accepted evidence. A correction appends superseding state and invalidates descendants explicitly.
- V1 compatibility regressions roll back the current v2 checkpoint, not historical artifacts.
- CP9 reader/evaluator failures do not roll back deterministic CP1–CP8B; they remain preserved evidence and may block promotion.
- Git commit, push, PR, CI fix, merge and deployment are separate permission gates under repository workflow.

## Planning self-review record

- Review scope: full five-file planning diff on synchronized `3cb7a9f9707e805c275bfced1c4e11b489727eb3`, including ownership/schema, P0/readiness, identity/invalidation, state/resume, reviewer authority, lifecycle/cleanup, legacy, tests, Git/status and all user-required model-eval fields.
- Initial pass: `0 Critical / 3 Required`. Findings were inaccurate v1 lib inventory plus current-head wording, missing transferable handoff sections/file map/manual QA/risk, and insufficiently exact source-of-truth presentation.
- First correction re-review: `0 Critical / 3 Required`. It found the exact CI path was still wrong, run-state arrows could imply rejected/rerun evidence becomes completed, and readiness did not yet require the entire planned invocation set to pass before call one.
- Corrections: use exact synchronized paths and Git labels; add confirmed facts/assumptions/conflicts, skills, trade-offs, file map, dependency graph, manual QA, tracking and risk sections; split task/run lifecycle transitions; add set-level P0 barrier with call count `0` for every unit when any planned invocation fails.
- Final staged-diff pass: `0 Critical / 1 Required` because the generalized implementation-plan index retained one `PR` column label and one `per-PR` sentence. Both now use `workstream` consistently.
- Final findings: `0 Critical / 0 Required`; no unresolved material suggestion or nit. Specialist `0`; independent/model fresh-reader `not_run` without overclaim.
- Deterministic verification on Node `v24.11.1`: syntax checks for runner and three v1 libs pass; CLI help pass; structural-validator tests `37/37`; eval-runner tests `130/130`; repository validator `11 skills / 0 errors / 0 warnings`; eval catalog `9 skills / 27 files / 183 cases / 0 diagnostics`.
- Document/integration audits: all five local Markdown link sets resolve; UTF-8 without BOM and final newline pass; exact six CP9 IDs resolve to current suites; no conflict marker, machine-specific path or TODO/FIXME; `git diff --check` pass. Refreshed `HEAD == origin/main == 3cb7a9f`, divergence `0/0` before planning commits.
- Verdict: `Approved` for the owner-authorized planning commits and exactly one final normal push only. Harness implementation, model execution and PR remain unauthorized/not run.

### Stage 3 pre-code contract review addendum

- Review scope: the bounded Stage 3 adjustment in this plan plus `owner-review-brief.md`; completed Stage 1–2 contracts were checked only at their CP8A/CP8B/CP9 boundaries and were not re-audited or redesigned.
- Adversarial dimensions: exactness/claim ownership, immutable intent and external authority, logical identity versus runtime wire identity, same-run reuse versus opaque cross-run equivalence, pre-dispatch atomicity, crash/interruption/timeout/call certainty, App Server shadow retention, ChatGPT auth/cost separation and CP9 evidence claims.
- Initial adversarial pass: `0 Critical / 3 Required`. It found stale provider-transparent/status assumptions across CP8A–CP9; pre-dispatch lineage/atomic-publication and live-versus-mocked call-budget ambiguity; and missing compatibility behavior for completed runs without `run_manifest.intent`.
- First corrections: establish the exact `runtime_mediated` claim boundary; make immutable `run_manifest.intent` own “why”; publish exact human-readable input and byte-identical canonical request as one pre-`turn/start` snapshot; distinguish mocked transport writes from live-call limits; keep historical runs readable but dispatch-ineligible; disable opaque-envelope cross-run reuse; assign shadow cleanup to CP8B; and bound CP9 usage/auth/claims.
- Correction re-review: `0 Critical / 1 Required` because a crash after `thread_start_write_intent` but before acknowledgement could create an unprovable shadow thread. The final contract records acknowledged IDs exactly, classifies missing acknowledgement as `shadow_thread_outcome_unknown`, keeps model-turn writes `0` and permits inventory/quarantine but never guessed deletion.
- Deterministic document/repository gates: `git diff --check` pass; eval catalog `9 skills / 27 files / 187 cases / 0 errors / 0 warnings`; repository validator `11 skills / 0 errors / 0 warnings`; two-file Markdown links, UTF-8/no-BOM/final-newline and conflict-marker checks pass; 27 required/3 forbidden contract assertions plus exact two-file diff-scope assertion pass.
- Terminal findings for this historical planning/contract scope: `0 Critical / 0 Required`. At that review point CP8A implementation and live calls were `not_run`/unauthorized; later CP8A implementation status is recorded in the current Stage 3 section, while provider-envelope claims remain unsupported.

### CP8B pre-code contract-freeze review addendum

- Review scope: four documentation files on clean synchronized `f9c821323ae5e8aa277d2cd68d4b416d80cf553e`; no source, test, CI, skill/reference or runtime artifact changed.
- Admission result: CP8B is necessary for lifecycle/cleanup authority, retained evidence, global CAS reachability, shadow cleanup, representation freshness and legacy non-promotion. CP8A's durable runtime relationships are a prerequisite, but its live-budget/pre-wire machinery and stronger execution assurance are not CP8B scope.
- Initial adversarial pass: `0 Critical / 3 Required`. It found automatic PR closure was over-restricted to creation-time non-null PR provenance; `quarantine` versus `purge_eligible` and local/shadow delete phase authority were not yet disjoint; and the seven-chain matrix conflated authority owner, producer and consumer.
- Corrections: allow automatic close only through the exact attributable task-aware merge event, with any non-null creation PR still required to match; freeze classification maximum actions plus quarantine-before-separately-authorized-purge for local and shadow items; and split every relationship into explicit authority owner, producer, consumer, identity, positive control, forbidden substitution and rejecting owner.
- Correction re-review: `0 Critical / 1 Required` because “dry-run zero mutation” could contradict the required durable plan publication. The regression and checkpoint acceptance now permit only that immutable audit-plan write and forbid every cleanup-target/quarantine/purge/shadow mutation.
- Terminal re-review: `0 Critical / 0 Required`; no unresolved contract, product, architecture, ownership or acceptance decision remains for CP8B implementation. Specialist `0`; model/helper/evaluator/fresh-reader/subagent calls `not_run` because this task explicitly forbids them and direct repository/contract evidence resolved the bounded questions.
- Deterministic document gates: exact four-file scope, all required contract literals, seven relationship rows, exactly 18 CP8B regression items, owner-brief link/status and `git diff --check` pass. Existing CP8A/source/test evidence was not rerun because this checkpoint changes documentation only.
- Contract verdict: `READY_FOR_CP8B_IMPLEMENTATION`. This authorizes no implementation, live call or remote action by itself.

### Verification/correction review of `f21e306`

| ID | Classification | Evidence and disposition |
| --- | --- | --- |
| A | `Confirmed Required` | Historical owner Part F requires helper default `0`, max `2`, one uncertainty cluster and no loop; `f21e306` kept two rounds but omitted helper ownership/count. Restored in CP1/CP4/readiness without adding a round. |
| B | `Confirmed Required` | `evaluator_input_id` named compiled inputs, but CP6/CP9 had no exact pre-call evaluator set barrier. Added static preflight plus post-reader stage binding, single-use grants and evaluator calls `0` on failure. |
| C | `Confirmed Required` | CP1–CP8 used fake adapters while CP9 claimed no source change; no checkpoint implemented the first concrete provider adapter. Added mandatory CP8A before CP9 without selecting a provider. |
| D | `Confirmed Required` | `active → completed | merged | abandoned` allowed CP10/implementation completion to be mistaken for cleanup authority. Replaced it with explicit `active → closed | abandoned`; delivery/PR states are orthogonal evidence. |
| E | `Advisory` | CP6 is broad but one coherent semantic-authority chain. Kept it unsplit and documented mandatory internal order/one rollback boundary. |
| F | `Advisory` | CP9 did not explicitly limit runtime-control claims. Clarified that CP7/CP8A deterministic matrices remain authoritative and CP9 claims only observed real-provider behavior. |
| G | `Confirmed Required` | `actual enforcement contract` could circularly include post-run evidence in `reader_input_id`. Replaced it with pre-dispatch attested conditions; runtime-observed access is output bound into evaluator inputs and contradictions invalidate evidence. |

- Cross-boundary simulations: `owner decisions → CP ownership → first CP9 call`, first evaluator call, interrupted resume, implementation-complete/open-PR cleanup and optional-helper uncertainty all traced against current contracts.
- Correction scope: detailed plan, owner brief, master-plan summary and current progress only; no harness/source/suite/CI implementation.
- First correction re-review: `0 Critical / 2 Required` because verification-helper attempts lacked a non-case audit identity and CP9 still used ambiguous runtime/enforcement invalidation wording. Added immutable `helper_input_hash`/separate helper tuple and distinguished pre-dispatch attestation from post-run observed evidence throughout CP2/CP9.
- Terminal correction re-review: `0 Critical / 0 Required`; no unresolved material suggestion or nit. Specialist `0`; model/fresh-reader `not_run` because current authority excludes model execution and direct historical/current contract evidence resolved every hypothesis.
- Deterministic/document verification: `node .agents/scripts/run-skill-evals.mjs validate --all` → `9 skills / 27 files / 183 cases / 0 diagnostics`; `node .agents/scripts/validate-skill.mjs` → `11 skills / 0 errors / 0 warnings`; runner `--help` confirms no model execution/semantic grading; four-file link, UTF-8/no-BOM/final-newline, conflict/machine-path/actionable-TODO, exact six case IDs, A–G contract assertions and `git diff --check` pass.
- Existing parent evidence remains current because no source/skill/test file changed: eval-runner tests `130/130` and structural-validator tests `37/37` were not needlessly rerun. Verdict: `Approved` for the authorized planning correction commit and exactly one normal push only.

### Review-summary/renderer verification and correction of `a99104a`

| ID | Classification | Evidence and disposition |
| --- | --- | --- |
| A | `Confirmed Required` | Existing exception-first `run_review_summary` listed readiness, reuse and exceptions but did not require selected counts, baseline/candidate/comparison aggregates or complete reader/evaluator operational counts. Added the aggregate/exception contract, 21–24 case CP6 acceptance fixture and no-default-per-successful-case drill-down rule. |
| B | `Confirmed Required` | Existing `evaluator_input_id` hashed full validated observation/resource artifacts without defining the evaluator-visible projection, so non-visible attempt/timestamp/storage metadata could invalidate evaluator reuse. Identity now hashes deterministic behavior-relevant evaluator-visible inputs plus runtime/protocol identity; current full source artifacts are revalidated and recorded separately for provenance/integrity on every execution or cache hit. |

- Owner decision: one canonical structured `run_review_summary`/`summary.json` owns semantics; required `summary.md` and self-contained/offline-safe `summary.html` are deterministic representations only. Acceptance binds current canonical proposal/evidence scope, not renderer/CSS bytes.
- Storage/lifecycle: normalized task store keeps `tasks/<task-id>` and `runs/<run-id>/review/summary.{json,md,html}` with manifest/index task linkage. Stable IDs own identity; timestamp/branch/PR are navigation/provenance. Active state retains review artifacts; explicit closed/abandoned compaction preserves minimum canonical acceptance/audit records; generated review artifacts never enter repository Git scope.
- Checkpoint ownership: no new checkpoint. CP6 remains one semantic-authority rollback boundary through stage guard, proposal, canonical summary, renderers, decision and materialization/report. CP8B owns only review-artifact retention/cleanup/operator behavior.
- Cross-boundary simulation: `validated evidence → evaluator-visible projection/stage guard → proposal → canonical summary → Markdown/HTML → human decision → accepted semantic evidence → deterministic report` preserves zero evaluator calls on bad inputs, blocks on renderer failure/drift, rejects stale rendered scope, keeps presentation-only rerender outside semantic acceptance identity and retains review artifacts under task lifecycle.
- Initial correction self-review: `0 Critical / 2 Required` because full-source integrity links could be read as entering `evaluator_input_id`, and the historical foundation `HTML eval viewer` deferral was not explicitly reconciled with the new owner decision. Corrections separate provenance manifest binding from semantic reuse identity and narrow supersession to deterministic offline representation, excluding dashboard/hosted/web-app scope.
- Staged-diff re-review: `0 Critical / 1 Required` because one earlier sentence still said the full post-run observation/resource evidence participated in `evaluator_input_id`. It now assigns only the behavior-relevant evaluator-visible projection to semantic identity and keeps the full artifact in evaluator-attempt provenance plus acceptance/audit binding.
- Terminal correction re-review: `0 Critical / 0 Required`; no unresolved material suggestion or nit. Specialist `0`; model/fresh-reader `not_run` because current authority excludes model calls and direct repository/contract simulation resolved the hypotheses.
- Deterministic/document verification: `node .agents/scripts/run-skill-evals.mjs validate --all` → `9 skills / 27 files / 183 cases / 0 diagnostics`; `node .agents/scripts/validate-skill.mjs` → `11 skills / 0 errors / 0 warnings`; runner `--help` confirms no model execution/semantic grading; four-file scope, Markdown links, UTF-8/no-BOM/final-newline, conflict/machine-path/actionable-TODO, A/B/aggregate/renderer/storage/checkpoint assertions and `git diff --check` pass.
- Existing source/test evidence remains current because no harness/source/skill/test file changed: eval-runner `130/130` and structural-validator `37/37` were not rerun. Verdict: `Approved` for the owner-authorized planning correction commit and exactly one normal push only.

### Renderer-security/arithmetic verification and correction of `a35a7ce`

| ID | Classification | Evidence and disposition |
| --- | --- | --- |
| A | `Confirmed Required` | Required offline/deterministic representations did not yet define reader/evaluator/user text as untrusted or prohibit raw Markdown/HTML, executable JavaScript/CSS, unsafe URLs and remote-resource loads. Added untrusted-text-by-default encoding/escaping, typed contained local links, static no-JavaScript HTML, defense-in-depth CSP, fail-loud security/freshness gates and hostile fixtures. |
| B | `Confirmed Required` | Canonical summary named aggregate fields but did not require exact memberships, denominators, partitions or count units, so contradictory totals could validate. Added derived duplicate-free memberships, assessed/unassessed and logical-unit/attempt partitions, explicit `outcome_unknown`/nonterminal handling, resume reconstruction and accepted-report scope reconciliation. |
| C | `Confirmed Required` | CP6 required retry/cancel/timeout counts before CP7 implemented those controls, while CP7 did not own canonical-summary integration. CP6 now freezes and certifies the schema/renderer with deterministic synthetic control fixtures; CP7 must feed actual durable outcomes through that existing contract. No checkpoint or rollback boundary was added. |

- Cross-boundary simulations: `canonical summary → Markdown/HTML render → human review → decision` and `validated suite → readiness → reader → validated evidence → evaluator guard → evaluator proposal → canonical review → human decision → accepted evidence → report` both preserve advisory evaluator authority, zero-call readiness/stage failure, current canonical/representation revalidation, exact accepted decision scope and lifecycle retention.
- Initial review: `0 Critical / 2 Required` for renderer trust and aggregate arithmetic. Broader-flow review added `0 Critical / 1 Required` for the CP6→CP7 integration gap. Correction re-review found `0 Critical / 2 Required` within arithmetic closure: partial acceptance could still copy full-run totals, and terminal-attempt arithmetic omitted explicit `outcome_unknown`/nonterminal treatment. Both are corrected in the same existing contract.
- Terminal correction re-review: `0 Critical / 0 Required / 0 Advisory`; no unresolved material suggestion or nit. Specialist `0`; model/fresh-reader `not_run` because current authority excludes model/helper/evaluator execution and direct repository/contract evidence resolved the hypotheses.
- Deterministic/document verification: `node .agents/scripts/run-skill-evals.mjs validate --all` → `9 skills / 27 files / 183 cases / 0 diagnostics`; `node .agents/scripts/validate-skill.mjs` → `11 skills / 0 errors / 0 warnings`; runner `--help` confirms it does not execute or grade a model; four-file scope, Markdown links, UTF-8/no-BOM/final-newline, conflict/machine-path/actionable-TODO, eleven renderer/arithmetic/dependency assertions and `git diff --check` pass.
- Existing source/test evidence remains current because no harness/source/skill/test file changed: eval-runner `130/130` and structural-validator `37/37` were not rerun. Verdict: `Approved` for the owner-authorized planning correction commit and exactly one normal push only.

## Remaining implementation-level decisions

These are deliberately deferred to bounded checkpoint discovery, not broad redesign:

1. Exact local App Server executable/config key, supported protocol/schema version range and bounded read-only lookup capability discovered during CP8A preflight. These implementation details must satisfy the frozen `codex_chatgpt_app_server` contract; absent idempotency/lookup stays fail-closed as `outcome_unknown` and does not reopen adapter/profile/auth selection.
2. Exact authorized-reviewer identity source and signature mechanism for `human_review_decision`; local named reviewer can be the minimal first implementation if audit needs are met.
3. Default closed/abandoned retention durations and raw model text policy after threat/privacy review; explicit lifecycle classification remains primary regardless of chosen TTL.
4. Whether CP1 needs JSON Schema files in addition to existing JavaScript validators; choose only from current repo/tooling evidence.
5. Final CLI command names (including any `review show/open` convenience), renderer module split, renderer audit-version/hash fields and adapter configuration keys, provided ownership and observable contracts above remain intact.

None of these questions permits weakening P0, advisory evaluator authority, logical reuse, immutable attempts, conservative invalidation or human acceptance.
