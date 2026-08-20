# Agent Skill Eval Harness hardening — detailed implementation plan

## Trạng thái và quyền hạn

- Workstream: `eval-harness-hardening`.
- Planning branch: `refactor/agent-skill-eval-harness`.
- Synchronized planning base: `origin/main` tại `3cb7a9f9707e805c275bfced1c4e11b489727eb3` ngày `2026-08-20`.
- Document status: `ready for owner implementation approval`.
- Implementation decision: `pending`.
- Owner-decided architecture baseline trong task này là authoritative cho plan; nó không tự cấp quyền implement bất kỳ checkpoint nào.
- Task hiện tại chỉ cho phép discovery, planning, review, planning commits và đúng một normal push. Không có harness implementation, model call, PR, CI watch/fix, merge hoặc deploy.

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
  → human-readable review surface
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
- Eval catalog hiện configure `9 skills / 27 suite files / 183 cases` và deterministic validation không có diagnostic; repository structural validator nhận `11 skills`.

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

### Assumptions cần verify cục bộ trong checkpoint

- Node built-ins đủ cho atomic local store/lease của single-host trusted-local threat model; CP3 phải kiểm chứng Windows/POSIX rename/lock behavior trước khi đóng implementation.
- Provider adapter đầu tiên có thể expose exact compiled invocation và capability evidence; nếu không, CP4/CP9 dừng thay vì hạ requirement.
- Git common dir là stable task-state root cho current worktree workflows; bare repo, detached/no-repo invocation và permission errors cần explicit negative behavior.
- Human reviewer identity ban đầu có thể là bounded local identity record; stronger signing remains an explicit CP6 decision.

Assumption không được biến thành claim. Nếu checkpoint evidence bác bỏ assumption, dừng tại checkpoint boundary và update plan/owner decision trước khi đổi architecture.

### Conflicts

Không có material conflict giữa owner baseline, synchronized code và repo skill contracts. Foundation v1 cố ý không execute/grade model; v2 orchestration vì vậy phải là additive layer, không reinterpret v1 như incomplete implementation defect.

### Open questions

Các implementation-level questions được liệt kê cuối plan. Chúng không block planning vì checkpoint và stop condition đã bound từng quyết định; chúng block checkpoint tương ứng nếu repository evidence không resolve được.

### Size và review depth

Classification: `Large/high-risk`. Lý do là external-call authority, P0 enforcement, crash/call certainty, durable mutation, conservative invalidation, human evidence authority và cleanup có khả năng phá dữ liệu. Plan dùng 10 dependency checkpoints; không parallelize CP1–CP6. Sau CP6, CP7 control work và CP8 docs/legacy preparation vẫn nên tuần tự trên cùng branch vì cùng state/schema contracts; chỉ test-fixture authoring độc lập mới có thể parallelize nếu owner/agent system cho phép.

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
| review | evaluator proposal validation, run summary, acceptance decision materialization | reader execution |
| retention | lifecycle classification, quarantine/cleanup policy | active-run correctness decisions |

Production dependencies phải giữ ở Node built-ins nếu feasible. Thêm package chỉ khi một checkpoint chứng minh existing code không thể đáp ứng atomicity/schema/locking requirement bằng bounded implementation.

### Planned file/checkpoint map

| Checkpoint | Exact intended files/domains |
| --- | --- |
| CP1 | new `harness-schema-v2.mjs`, harness test fixtures/test file; minimal v1 version-routing reuse only if required |
| CP2 | new `logical-identity-v2.mjs` plus identity/impact tests |
| CP3 | new `run-store-v2.mjs`, harness CLI state commands, fault/recovery tests |
| CP4 | new `readiness-v2.mjs`, adapter capability interface in orchestrator boundary, P0 tests |
| CP5 | new `orchestrator-v2.mjs`, harness CLI reader commands, fake adapter tests |
| CP6 | new `review-v2.mjs`, CLI review/accept/report commands, fake evaluator and authority tests |
| CP7 | extend orchestrator/CLI/tests only for controls/concurrency; no schema ownership migration |
| CP8 | new `retention-v2.mjs`, CLI housekeeping/legacy commands, operator/eval-design docs, CI test wiring |
| CP9 | no required source change; authorized runtime artifacts live in task store, not repository |
| CP10 | only justified corrections plus plan/progress/status reconciliation |

Forbidden throughout unless separately approved: skill/reference/suite semantic changes, product/database code, package upgrade, workflow changes beyond the exact deterministic test step, historical artifact rewrite, committed raw model evidence or secrets.

## Artifact và schema contract v2

Mỗi artifact dùng strict `artifact_type`, `schema_version: 2`, stable logical identity, content hash, producer metadata và links tới exact inputs. Unknown field handling phải explicit; không silently coerce v1 thành v2.

| Artifact | Producer | Mục đích |
| --- | --- | --- |
| `task_manifest` | operator/harness | task identity, lifecycle, branch/PR provenance, retention policy |
| `run_manifest` | harness | selected suites/cases/variants, config, runtime/adapter, state |
| `compiled_invocation` | readiness compiler | exact model-visible prompt/context/tools/policy/runtime payload |
| `readiness_analysis` | readiness | round, field-by-field requested/compiled/enforced result, dispatch grant |
| `execution_attempt` | orchestrator | immutable reader/evaluator attempt, timing, outcome/call certainty |
| `observation` | adapter + validator | raw reader output, observed access/resource/timing, input/attempt links |
| `resource_observation` | adapter + validator | supplied/read/denied resource evidence with evidence source |
| `evaluator_proposal` | advisory evaluator | proposed case/comparison statuses, rationale, citations, uncertainty |
| `run_review_summary` | review builder | exception-first human-readable surface and proposal/evidence links |
| `human_review_decision` | authorized reviewer | accept/reject/rerun decision, scope, identity, rationale |
| `human_evaluation` | deterministic materializer | accepted semantic evidence bound to proposal, summary and decision |
| `generated_report` | deterministic reporter | aggregate only structurally valid, accepted evidence |

`human_evaluation` v2 may reuse the historical artifact name for downstream continuity, but only deterministic code may materialize it after a valid `human_review_decision`. Model output with that artifact type is rejected. Accepted evidence binds:

- exact `acceptance_input_id`;
- proposal and summary hashes;
- accepted case/comparison scope;
- reviewer identity type and decision timestamp;
- any exclusions/rerun requirements;
- schema/review-policy version.

Raw model text is never itself accepted evidence. Present-but-invalid artifacts fail loud and cannot be downgraded to missing/incomplete.

## Durable task, run và state model

Default fixed root:

```text
<git-common-dir>/vocaspace-agent-skill-evals/v2/
├── tasks/<task-id>/task.json
├── runs/<run-id>/manifest.json
├── runs/<run-id>/journal.ndjson
├── runs/<run-id>/attempts/
├── objects/<sha256>/
├── indexes/
├── quarantine/
└── trash/
```

`task_id` là primary lifecycle identity. Branch/PR/ref là mutable provenance metadata, không phải task identity. Root dưới Git common dir cho phép worktree/process change mà vẫn resume cùng task. V1 OS-temp workspace vẫn là legacy source và không tự được dời/xóa.

Run state machine:

```text
created → preflight → readiness → ready → reading → reader_complete
        → evaluating → review_pending → accepted → reported → completed
                                     ↘ rejected
                                     ↘ rerun_required → preflight (affected units)

terminal/side states: rejected | blocked | failed | cancelled | abandoned
```

Task lifecycle is separate: `active → completed | merged | abandoned`. A run may be rejected while the owning task remains active for a corrected replacement run. `rerun_required` never reports complete; it appends a new dependency-closed execution path after preflight/readiness. A completed run is immutable and does not become active again.

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

`reader_input_id` hash canonical exact model-visible and enforced inputs:

- case prompt and supplied context bytes;
- target/baseline bundle and blind variant mapping where visible to reader;
- compiled invocation including system/developer/user/tool exposure;
- requested and actual enforcement contract;
- model/provider/runtime class, relevant parameters and fresh-context method;
- reader protocol/schema versions.

Nó loại Git HEAD/ref, run/task/attempt IDs, timestamps, storage paths và author-facing A/B role nếu reader không thấy các giá trị đó.

`evaluator_input_id` hash:

- exact validated observation/resource artifacts;
- hidden rubric/criteria and comparison mapping visible to evaluator;
- evaluator compiled invocation, model/runtime parameters;
- evaluator protocol/schema versions.

`acceptance_input_id` hash:

- exact evaluator proposal and run summary;
- accepted scope and review policy/schema;
- evidence objects under review.

Reviewer identity và decision timestamp nằm trong decision/audit record, không làm thay đổi input identity trước khi decision tồn tại.

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

Git ref/commit change tự nó chỉ cập nhật provenance. Bundle/context byte hoặc model-visible invocation change mới ảnh hưởng identity. Nếu impact analysis phức tạp hơn chi phí rerun một skill/suite/variant group nhỏ, chọn conservative bounded rerun và ghi lý do.

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

- Round 1: compile + verify exact requested config.
- Nếu chỉ run configuration có thể sửa an toàn, cho đúng một ephemeral config correction rồi Round 2.
- Không Round 3. Không sửa suite, schema, repository policy hoặc durable contract để làm pass.
- Nếu Round 2 fail, run `blocked`; zero reader calls vẫn là invariant.

Configuration correction phải được diff/audit trong `readiness_analysis`; round 1 artifact được giữ immutable. P0 readiness failure trước dispatch phải kiểm chứng qua adapter spy/counter, không chỉ state assertion.

## Orchestration, attempts và controls

Mỗi executable unit là `(case, variant, role, logical_input_id)`. Orchestrator chạy dependency order: reader units trước evaluator units, evaluator trước review surface. Default concurrency `1`; effective concurrency là minimum của operator request, adapter capability và policy cap.

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

Evaluator là advisory. Nó nhận validated evidence cùng hidden rubric, tạo `evaluator_proposal`, nêu uncertainty và cite exact artifact fields. Proposal không được tự đổi state thành accepted.

`run_review_summary` deterministic và exception-first, tối thiểu gồm:

- run/task/provenance và readiness outcome;
- reused versus newly executed evidence cùng identities;
- missing/invalid/unknown attempts;
- proposed status changes, regressions, vetoes, inconclusive/low-confidence items;
- resource supplied/read/denied evidence source;
- per-case evidence/proposal links và affected scope;
- actions `accept`, `reject`, `rerun` với explicit scope.

Human/authorized reviewer decision phải bind exact summary/proposal hash. Stale decision bị reject nếu acceptance identity đổi. Partial acceptance chỉ hợp lệ khi scope is closed under dependencies; otherwise split run/review group. Deterministic report chỉ aggregate accepted scope và phải phân biệt `review_pending`, `rejected`, `rerun_required`, `incomplete` với `complete`.

## Retention và cleanup

Preflight/readiness sở hữu housekeeping trước run dispatch:

1. enumerate task-owned state and validate manifests;
2. retain all active/resumable task state;
3. detect stale lease/process evidence conservatively;
4. quarantine corrupt/unknown ownership; không delete in place;
5. compact completed/merged/abandoned task heavy raw/temp/process state theo recorded lifecycle;
6. preserve minimum audit/reuse metadata: identities, accepted evidence hashes, decisions, reports, provenance and tombstones;
7. use TTL only for orphan fallback khi task lifecycle không thể resolve.

`cleanup --dry-run` là default preview; actual cleanup cần explicit task/scope, revalidation và reversible quarantine/trash phase trước permanent purge. Active task hoặc `outcome_unknown` attempt không được purge. Secret scanning/redaction policy áp dụng trước retaining model raw text; never log credentials even when enforcement misconfigured.

## Backward compatibility

- V1 commands, schemas, exit meanings và CI checks giữ nguyên trừ khi CP1 ghi một unavoidable compatibility correction riêng.
- V2 reader có thể inventory/import metadata từ valid v1 workspace/report nhưng label `legacy_v1`.
- V1 observation/human evaluation không có compiled-invocation readiness attestation hoặc v2 acceptance chain, nên không auto-promote thành accepted v2 evidence.
- Reuse v1 reader result cho first real v2 pilot mặc định bị cấm. Nó có thể dùng làm historical comparison/reference only.
- Legacy corrupt/partial artifact fail loud hoặc quarantine; không rewrite source.
- Deterministic v1 report remains reproducible from v1 artifacts; v2 report has separate schema/version and explicit legacy links.

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
                → CP8 retention/legacy/CI/docs
                  → CP9 separately-authorized real pilot
                    → CP10 cumulative review/delivery decision
```

CP9 may be skipped/not authorized; in that case CP10 may review deterministic hardening readiness but must report real-model evidence `not_run` and cannot claim production adapter behavior.

Mỗi checkpoint kết thúc bằng scoped tests, full relevant deterministic gates, self-review `0 Critical / 0 Required`, changed-file report và recommended English Conventional Commit. Commit chỉ sau explicit owner approval cho implementation phase. Checkpoint sau không bắt đầu nếu predecessor acceptance chưa đạt.

### CP0 — Planning and owner decision

**Scope:** documents only. Record architecture, dependencies, risks, gates and explicit pending implementation authority.

**Acceptance:** plan is implementation-ready; links/status consistent; full plan review `0 Critical / 0 Required`; deterministic foundation remains green. No model call.

### CP1 — Compatibility baseline and v2 contracts

**Scope:** freeze observable v1 behavior; add v2 schemas, artifact relationship validator, version routing and test fixtures. Define exact CLI/output/state contracts before mutation-heavy code.

**Acceptance:** v1 tests byte/behavior compatible; every v2 artifact rejects wrong producer/version/hash/link; a model-authored `human_evaluation` is rejected; no orchestration/model call. Add CI test entry only when test file exists.

### CP2 — Logical identities and dependency impact

**Scope:** canonical `reader_input_id`, `evaluator_input_id`, `acceptance_input_id`; dependency graph and conservative change classifier.

**Acceptance:** HEAD/ref-only changes reuse; prompt/context/invocation/enforcement changes invalidate reader descendants; rubric/evaluator-protocol changes retain reader and invalidate evaluator descendants; unknown impact cannot return unaffected. Golden canonicalization and mutation matrices pass. No model call.

### CP3 — Durable store, immutable attempts and resume

**Scope:** fixed Git-common-dir state, task/run manifests, object store, journal, lease, transition guards, crash recovery and `outcome_unknown` handling.

**Acceptance:** fault-injection at each write/dispatch boundary resumes without duplicate confirmed calls or lost valid objects; attempts are immutable; active state survives new process/worktree/HEAD; corrupt links fail loud. Fixture adapter only, no model call.

### CP4 — Exact compiled invocation readiness and P0 guard

**Scope:** compiler, adapter capability contract, two-round readiness, one ephemeral config correction, single-use dispatch grant and preflight housekeeping preview.

**Acceptance:** historical P0 fixture (correct package policy, invocation does not expose it) fails before dispatch with adapter calls `0`; unsupported enforcement also calls `0`; round sequence is exactly `1` or `1→2`, never `3`; durable contracts unchanged; TOCTOU hash mismatch blocks. Fixture adapter only, no model call.

### CP5 — Sequential reader execution, validation, reuse and resume

**Scope:** one adapter interface, default concurrency 1, per-unit dispatch/attempt/observation/resource validation, selective logical reuse and resumable sequential orchestration.

**Acceptance:** valid completed reader unit survives process/workspace/HEAD changes; reader identity change reruns only bounded descendants; partial run resumes first incomplete unit; invalid output cannot become evidence; outcome-unknown requires safe resolution. Deterministic fake adapter only.

### CP6 — Advisory evaluator, review summary, acceptance and report

**Scope:** evaluator proposal adapter path, evaluator artifact validation, deterministic exception-first summary, reviewer decisions, accepted human evaluation materializer and v2 report.

**Acceptance:** evaluator cannot accept evidence; stale/partial-invalid decisions fail; evaluator-only input change reuses readers; accepted scope reports deterministically and idempotently; review-pending never looks complete. Deterministic fake evaluator only.

### CP7 — Operational controls and bounded concurrency

**Scope:** progress, cancellation, phased timeout, classified retry and configurable concurrency after sequential correctness.

**Acceptance:** retry appends attempts; cancel/timeout preserves call certainty; no duplicate dispatch under restart; effective cap is conservative minimum; completion order does not affect report; per-unit invalidation remains exact. Stress/fault fixtures only.

### CP8 — Retention, legacy compatibility, CI and operator docs

**Scope:** lifecycle housekeeping, dry-run cleanup/quarantine/purge boundary, legacy v1 inventory/import labels, CLI/operator docs, final deterministic CI wiring.

**Acceptance:** active/outcome-unknown state retained; completed/abandoned heavy state cleanup preserves minimum audit/reuse records; TTL only handles unresolved orphan; v1 golden fixtures/reports remain valid; all deterministic suites and repository validator pass. No model call.

### CP9 — Authorized six-case real-model pilot

**Authority gate:** separate explicit owner approval for provider/model use, cost, exact adapter/enforcement, reviewer and retention. CP1–CP8 completion does not authorize this checkpoint.

**Affected cases:** exact representative set, two variants where suite defines comparison:

- `gcw-reg-commit-versus-push`
- `gcw-route-push-remote`
- `gcw-fresh-dirty-secret-stop`
- `ghci-reg-explicit-fix-exact-actions`
- `ghci-route-db-risk-stop`
- `ghci-fresh-self-fix-cycle`

**Reuse:** no historical v1 observation is accepted because it lacks v2 compiled-invocation readiness. Within CP9, reuse a reader observation only when exact `reader_input_id`, object integrity and readiness attestation match. Reuse evaluator proposal only when exact `evaluator_input_id` matches. Acceptance is never reused when `acceptance_input_id` or review scope changes.

**Readiness before first call:** clean preflight, adapter capability attestation, exact compiled invocation, required policy exposed to reader, actual filesystem/tool/network/credential/remote/mutation enforcement satisfied, integrity pass, fresh-context method recorded, readiness round ≤2 and dispatch grant bound to invocation hash. Any failure means zero reader calls for the run.

**Partial state:** persist per-case/per-variant reader attempts and observations, then evaluator attempts/proposals independently. Resume completed valid reader units; `outcome_unknown` is resolved/stopped, not blindly retried. A process failure after four reader units must not rerun those four when identities remain valid.

**Invalidation:** prompt/context/bundle/compiled invocation/runtime/enforcement/fresh-context changes invalidate affected reader and all descendants. Observation/resource/evaluator rubric/protocol/runtime changes invalidate evaluator and acceptance/report but retain unaffected reader. Proposal/summary/review-policy/scope change invalidates acceptance/report only. Unknown impact reruns the bounded six-case group or smaller proven dependency-closed subset; no full 183-case rerun by default.

**Acceptance:** validated observations → advisory proposals → human-readable summary → authorized human decision. Stop at `review_pending` until that decision. Preserve unfavorable/inconclusive evidence. Record cost/calls/reuse/invalidation and P0 attestation. No claim beyond these six cases.

### CP10 — Cumulative hardening review and delivery decision

**Scope:** complete-diff integration review, threat/lifecycle audit, deterministic rerun, pilot evidence review if CP9 was authorized, documentation/status reconciliation and separate delivery permission check.

**Acceptance:** `0 Critical / 0 Required`; clean relevant deterministic suite; all artifacts/status truthful; no active secret/raw-state leak; owner decides whether and how to deliver. CP10 does not imply PR/merge/deploy authority.

## Verification strategy

### Deterministic automated coverage

- schema positive/negative/cross-artifact and producer-authority tests;
- canonical identity golden fixtures plus one-field mutation matrix;
- dependency-impact matrix including `unknown` fail-closed;
- atomic write, journal, lease and crash-point fault injection;
- P0 zero-call spies for missing model-visible policy and unavailable enforcement;
- exact two-round/one-correction readiness tests;
- resume/reuse across process, path, workspace and HEAD changes;
- advisory evaluator/acceptance authority tests;
- cancellation/timeout/retry/call-certainty/concurrency stress tests;
- retention lifecycle, quarantine, dry-run and v1 golden compatibility tests;
- deterministic report idempotence independent of attempt completion order;
- existing runner tests, repository skill validator and all suite validation.

Tests assert observable artifacts, calls, states and reports, not private helper shape. Network/provider calls are forbidden in deterministic CI.

### Model evidence boundary

Only CP9 may call models, only after separate authority and exact readiness. The pilot is diagnostic evidence for six named cases, not proof for all 183 cases or every provider/runtime. Any later affected group must repeat the CP9 template: exact cases, reuse identity, readiness, partial state and separate reader/evaluator invalidation. Full-suite model rerun requires a recorded impact reason and cost/authority gate.

### Manual QA strategy

Manual QA không thay deterministic tests và không chạy model nếu chưa có CP9 authority.

- CP1–CP4: inspect CLI help/error surfaces, schema diagnostics, readiness field diff and zero-call failure output using local fixtures.
- CP5: interrupt/restart one fake-adapter run from a second process and verify only incomplete unit continues.
- CP6: inspect exception-first summary for pass, regression, invalid evidence, stale proposal and partial-review fixtures; perform local reviewer accept/reject/rerun flows.
- CP7: exercise Ctrl+C, timeout and bounded concurrency with slow/failing fake adapters; verify progress and immutable attempt history.
- CP8: run cleanup dry-run on active/completed/abandoned/corrupt fixture tasks, inspect quarantine and retained audit metadata; verify v1 report remains unchanged.
- CP9: if separately authorized, authorized human reviewer inspects all six case surfaces before any acceptance. Manual QA is blocking for CP9 acceptance.

QA fixtures must be synthetic, credential-free and generated under test temp or the test-owned task root. Manual state fixtures are never pointed at real active task data. Missing GUI/browser infrastructure is not a blocker because the harness interface is CLI/artifact based.

## Documentation và progress tracking

- `docs/agent-skills/plan.md`: program-level intended architecture and authority boundary.
- this `plan.md`: detailed implementation/checkpoint source.
- `owner-review-brief.md`: explicit owner decisions and pending/approved gates.
- `docs/agent-skills/progress.md`: current checkpoint, verification, review, commit/push/PR state.
- `.agents/skills/maintain-repo-skills/references/eval-design.md`: current operational eval contract; update in CP8 or earlier only when implemented behavior needs it.
- CLI `--help` and any operator guide: exact executable contract, not a substitute for ownership/permission docs.

Each completed checkpoint updates plan/progress truthfully in the same checkpoint. Model raw artifacts remain task-store evidence and are not committed. Final docs must state model evidence `not_run`, partial, pending human review or accepted without prediction.

## Risk register

| Risk | Impact | Planned control |
| --- | --- | --- |
| policy present in package but absent from actual invocation | entire model batch invalid | compiled invocation P0, single-use hash grant, zero-call regression |
| crash after remote dispatch | duplicate cost/evidence ambiguity | pre-dispatch immutable attempt, call certainty, `outcome_unknown`, adapter lookup/stop |
| over-broad or stale reuse | invalid semantic evidence accepted | layered canonical identities, content integrity, fail-closed impact graph |
| HEAD-based invalidation | needless reruns/lost work | Git-only provenance, logical model-visible input keys |
| evaluator authority leakage | model proposal becomes final truth | producer validation, human decision binding, deterministic materializer |
| concurrency race | duplicate dispatch/corrupt state | sequential-first, CAS revision, lease/journal, bounded stress tests |
| cleanup deletes resumable evidence | irrecoverable loss/audit gap | lifecycle-first retention, active/unknown protection, dry-run + quarantine |
| raw model output contains sensitive data | secret retention/leak | credentials excluded, bounded input, redaction/scan, no committed raw evidence |
| v2 changes v1 behavior | historical report/CI regression | separate entrypoint/schema, v1 goldens and full runner suite every checkpoint |
| pilot evidence overclaimed | misleading program decision | exact six-case scope, human gate, claim boundary and separate authority |

## Specialist plan-review decision

Specialist count: `0`. Direct repository evidence resolves current ownership, schema, test, Git and lifecycle questions; no unresolved domain gap requires a specialist to make the planning verdict. This main-agent self-review does not claim independent/fresh-reader identity. A model fresh-reader is `not_run` because current authority excludes model execution and deterministic/document review is sufficient for this planning gate.

## Stop conditions

Stop and report before further mutation when:

- repository evidence contradicts an owner-decided baseline;
- any required enforcement cannot be proven on exact compiled invocation;
- readiness would require round 3 or durable-contract mutation;
- state ownership, lease or call outcome is ambiguous and retry may duplicate a call;
- artifact identity/integrity/producer authority fails;
- impact is unknown and no safe bounded group can be defined;
- cleanup would touch active/outcome-unknown/unowned state;
- model/remote/implementation action lacks explicit authority;
- a checkpoint review has any unresolved Critical or Required finding.

## Rollback and correction boundaries

- Each checkpoint is a separately reviewable rollback boundary; do not combine schema/identity/store/readiness in one correction range.
- Never rewrite immutable attempts or accepted evidence. A correction appends superseding state and invalidates descendants explicitly.
- V1 compatibility regressions roll back the current v2 checkpoint, not historical artifacts.
- CP9 reader/evaluator failures do not roll back deterministic CP1–CP8; they remain preserved evidence and may block promotion.
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

## Remaining implementation-level decisions

These are deliberately deferred to bounded checkpoint discovery, not broad redesign:

1. Which concrete provider adapter is first supported in CP5/CP9, including whether it exposes idempotency/call lookup sufficient to resolve `outcome_unknown`.
2. Exact authorized-reviewer identity source and signature mechanism for `human_review_decision`; local named reviewer can be the minimal first implementation if audit needs are met.
3. Default completed/abandoned retention durations and raw model text policy after threat/privacy review; lifecycle classification remains primary regardless of chosen TTL.
4. Whether CP1 needs JSON Schema files in addition to existing JavaScript validators; choose only from current repo/tooling evidence.
5. Final CLI command names and adapter configuration keys, provided ownership and observable contracts above remain intact.

None of these questions permits weakening P0, advisory evaluator authority, logical reuse, immutable attempts, conservative invalidation or human acceptance.
