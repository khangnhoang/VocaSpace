# ASM-PR1 — Detailed Implementation Plan: Shared Skill-Resource Access Evidence

Owner-facing decision summary: [owner-review-brief.md](./owner-review-brief.md).

## 1. Status and authority

| Field | Current value |
| --- | --- |
| Plan status | `approved` |
| Planning date | `2026-07-29` |
| Branch | `feat/agent-skills-asm-pr1` |
| Synchronized baseline | `aa91278993d7bcad9e3cafb34405ac57a23a514a` |
| Final head | `5a8ed0884169e5f34365e4934c4643655d6937fc` |
| Base relationship | Branch được tạo từ `main == origin/main == aa91278993d7bcad9e3cafb34405ac57a23a514a`; final head không rebase hoặc rewrite baseline |
| Roadmap dependency | PR #63 merge commit `aa91278993d7bcad9e3cafb34405ac57a23a514a` chứa approved structural-migration roadmap và namespace ASM-PR1–ASM-PR6 |
| Runner dependency | PR #62 merge commit `d8a67a1b1e015d44ab52095e823cd8334bf1fead` nằm trong baseline |
| Current work mode | ASM-PR1 implementation complete; CP2 complete; CP3 complete; PR #64 `OPEN` and ready for review |
| Preliminary size | `Large/high-risk` |
| Final size | `Large/high-risk`, do shared evidence contract, artifact compatibility, identity/integrity checks, claim safety, ordered checkpoints và rollback dependency |
| Owner-review state | `approved` |
| Implementation | `complete; 0 Critical / 0 Required` |
| CP2 | `complete` |
| CP3 | `complete` |
| Stage/commit/push | `consumed by delivered checkpoints; no standing authority` |
| Pull request | `#64 OPEN; ready for review` |
| Initial CI watch | `consumed; success` |
| CI result | `success` — `Test and Build`, `production-gate` and the Node 20 runner/validator/build path succeeded |
| Node 20 CI evidence | `verified` — runner tests, validator tests, repository validator and application build succeeded in run `30456110172` |
| CI-fix attempts used | `0` |
| Conditional CI-fix permission | `not used; no standing authority` |
| Merge/auto-merge | `not granted` |
| Deployment/production/database | `not granted; out of scope` |
| Next action | `owner review and separate merge decision` |

Initial planning task granted repository/Git inspection, normal fetch, fast-forward-only synchronization, branch creation, planning-document edits, planning self-review và in-scope corrections. Các planning, implementation, checkpoint, normal-push, PR-creation và initial-CI-watch permissions đã được consumed bởi delivered branch/PR state. Conditional CI-fix permission không được sử dụng vì initial CI thành công; nó không tạo standing authority. Merge, auto-merge, force-push, history rewrite, deployment và production/database mutation vẫn không được cấp.

CP1 được owner duyệt rõ trong current instruction trước CP2. Approval này đồng thời cấp exact implementation/Git/PR/CI authority được ghi ở bảng trên; nó không mở rộng sang later ASM PRs hoặc các excluded action.

## 2. Goal and observable outcome

ASM-PR1 thêm đúng một shared evidence capability cho mọi later structural migration:

1. `bundle_manifest` tiếp tục chứng minh exact bundle files `available`.
2. Một standalone `skill_resource_access` artifact v1 ghi exact bundle-relative resources được `supplied` và exact resources được quan sát là `read`, hoặc ghi `unknown` riêng cho từng dimension.
3. Runner validate identity, path, hash và relationship dựa trên immutable prepared manifests, đồng thời bind mỗi present artifact vào exact observation bytes của cùng role/suite/case/execution bằng `observation_sha256`.
4. Runner derive file/line/byte metrics từ trusted `bundle_manifest`; không tin metric do executor/operator nhập.
5. `generated_report` expose additive resource-access facts và claim boundaries mà không đổi meaning của existing observation, human-evaluation, completeness hoặc semantic-status fields.
6. Missing resource-access evidence không làm semantic report incomplete; present-but-invalid evidence vẫn fail non-zero và không tạo valid final report.
7. Không output nào biến packaging, self-report hoặc structural validation thành isolation, enforcement, automatic activation, context-reduction conclusion hoặc token-saving proof.

Observable completion là focused và cumulative black-box tests chứng minh các behavior trên trong candidate-only và comparative workspaces, trong khi existing validation/prepare/report behavior vẫn pass.

## 3. Current repository state

### 3.1 Confirmed current facts

- `.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs` sở hữu artifact v1 validators, canonical JSON, SHA-256 helpers, manifest entries và normalized-path checks.
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` chụp current-tree/ref bundles, copy toàn bộ regular file trong selected skill bundle, tạo `bundle_manifest`, `execution_context_manifest`, observation template và immutable workspace inventory.
- `.agents/scripts/run-skill-evals.mjs` sở hữu public `validate`, `prepare`, `report`; `report` verify prepared manifests/inventory, optional observations, human proposals và generated report persistence.
- `.agents/scripts/run-skill-evals.test.mjs` là black-box `node:test` suite; baseline được merged với 97 passing tests trên Node 20 trong PR #62 CI evidence.
- `bundle_manifest.files` và `workspace_manifest.sources[role].files` chứa repository-relative path, raw-byte SHA-256, byte count, line count và Git provenance. Chúng được runner tạo từ captured bytes.
- `execution_context_manifest.context` chỉ chứa suite-declared context files dưới `context/<context_id>.txt`; nó không ghi skill bundle resource nào đã vào model context.
- Observation `observed_access` chỉ có category-level `observed | not_observed | unknown` cho filesystem/process/tools/network/credentials/remote/mutation/model runtime cùng một free-text basis.
- Runner không invoke model/subagent và không instrument executor runtime.
- Existing `generated_report.evidence_status` chỉ phản ánh observation và human-evaluation presence/validity của selected candidate-only/comparison mode.
- Existing incomplete report exit `0`; present malformed, inconsistent hoặc integrity-failed artifact fail non-zero.
- Existing complete report được persist immutable; differing rerun bị refuse.
- `readCaseEvidence` hiện load observation theo role trước human evaluation, validate workspace/skill/suite/case/variant/execution-context identity, hash exact submitted observation bytes bằng `sha256Bytes(bytes)`, rồi yêu cầu `human_evaluation.observation_hashes[role]` match hash đó.
- Submitted observation/human artifacts được strict-parse và schema-validate nhưng không bị reserialize để tính relationship hash; chỉ runner-produced manifests được `assertCanonicalRunnerArtifact`. Vì vậy compatible execution binding phải dùng exact accepted observation file bytes, không dùng `sha256Canonical(parsedObservation)`.
- `assertObservation` cho phép đúng `execution_status: completed | not_run`; `not_run` cần non-empty reason. `assertHumanEvaluation` yêu cầu candidate `not_run` đi với `case_status: not_run`, và comparison có bất kỳ role `not_run` phải `inconclusive`.
- Current error classes đã tách invalid submitted evidence (`ArtifactError` mặc định exit `1`), unsupported version (`2`) và trusted runner-state integrity/operational refusal (`3`). Existing tests xác nhận wrong observation identity/hash exit `1`, prepared bundle-byte tampering exit `3`, và differing persisted complete report exit `3`.
- `generateReport` hiện verify immutable packages một lần, iterate suite theo `regression → routing → fresh-reader`, sort case ID lexical, rồi canonicalize output bằng recursively sorted object keys. Shared role-level inventory không cần lặp theo case và không đổi existing case ordering.
- `suite-schema-v1.mjs` không có resource-access fields và ASM-PR1 không cần đổi suite schema.
- Structural validator đã sở hữu static resource-routing/path/link checks; nó không quan sát runtime supplied/read behavior.
- CI hiện đã chạy runner Node tests và structural validator tests trên Node 20; ASM-PR1 không sửa CI.

### 3.2 Exact tooling gap

| Evidence question | Current proof |
| --- | --- |
| Resource `available` trong prepared executor package? | Có. `bundle_manifest.files`, bundle copies, workspace inventory và hash verification chứng minh exact present bundle files. |
| Exact skill resource `supplied` vào executor/model context? | Không. `execution_context_manifest` chỉ ghi prompt và suite context; full bundle availability không đồng nghĩa supplied context. |
| Exact skill resource thực sự `read` trong execution? | Không. Category-level `observed_access.filesystem` không identify file. |
| Supplied/read enforcement? | Không. Runner chỉ package; không control executor runtime. |
| Actual token usage? | Không. Không artifact hiện tại có runtime token measurement. |

Vì vậy supplied/read facts hiện phải là `unknown`. Không được suy ra chúng từ bundle copy, prompt wording, operator expectation hoặc category-level access.

### 3.3 Immutable versus self-reported evidence

Runner-controlled immutable facts:

- workspace, skill, suite, case, variant mapping;
- source role, resolved commit, current-tree state và bundle membership;
- exact prepared bundle/context bytes, SHA-256, byte count và line count;
- execution-context hash, bundle-manifest aggregate hash và artifact inventory;
- structurally valid artifact presence, identity và cross-artifact consistency.

Executor/operator-supplied facts:

- raw response và execution status/reason;
- category-level observed access và its basis;
- future exact supplied/read sets, evidence basis và limitation in `skill_resource_access`;
- human semantic case/comparison proposal.

Structural validation của executor/operator evidence chỉ chứng minh artifact conforms và references immutable inputs. Nó không chứng minh runtime environment enforced the claimed access.

### 3.4 Historical facts

- Historical PR 3B plan designed synthetic packaging/reporting and explicit requested-policy versus observed-access separation.
- Later PR #62 corrections hardened source capture, eval-directory membership, path/link checks và current-tree/ref provenance.
- Historical plan language về intended full/core/reference metrics không phải current capability; roadmap ngày 2026-07-28 explicitly moved remediation into ASM-PR1.
- Historical test counts remain evidence at their checkpoints; ASM-PR1 must not rewrite them as current implementation evidence.

### 3.5 Review-correction investigation and resolution

Sources inspected for this correction:

- `.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs`: `ArtifactError`, `assertObservation`, `assertHumanEvaluation`, canonical/hash helpers and trusted-manifest integrity checks;
- `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs`: template/package construction, fixed evidence paths, immutable inventory reads and `writeCompleteReport`;
- `.agents/scripts/run-skill-evals.mjs`: `runReport`, `generateReport`, `verifyPreparedInventory`, `verifyPreparedPackages`, `verifyEvidenceLayout` and `readCaseEvidence`;
- `.agents/scripts/run-skill-evals.test.mjs`: missing/invalid observation, observation-hash relationship, `not_run`, package tamper, deterministic report and persisted-report refusal fixtures;
- `docs/agent-skills/pr-3b-eval-runner-plan.md`, `eval-design.md`, approved master plan, roadmap and current tracker.

Finding resolutions:

| Finding | Classification | Repository evidence and smallest compatible resolution |
| --- | --- | --- |
| Resource evidence was not bound to the exact observation/execution | `correct in scope`, with one wording revision | Current human evaluation already binds each role to `sha256Bytes` of its exact accepted observation file. Add required `observation_sha256`, load/validate the corresponding observation first, and match the same byte hash independently per role. Do not introduce a new execution ID, suite-schema field or model instrumentation. |
| Requested “canonical observation bytes” | `correct intent; revised to preserve current contract` | Runner-produced manifests are canonical-enforced; submitted observations are strict-parsed/schema-validated but their relationship hash is over exact raw file bytes. Use `sha256Bytes(observationBytes)` like `human_evaluation`, not `sha256Canonical(parsedObservation)`, and do not silently add a new canonical-order requirement to existing observations. |
| Wrong submitted resource/bundle/observation binding should exit `1` | `correct in scope` | `ArtifactError` defaults to exit `1`; current wrong observation identity/hash tests use exit `1`. Map every submitted `skill_resource_access` schema/identity/relationship/path/member/hash failure to existing exit-`1` codes. |
| Exit `3` should remain trusted-state integrity/operational refusal | `correct in scope`, not an assertion that every malformed trusted JSON shape must exit `3` | Current prepared-byte/inventory/hash tamper and persisted-report overwrite/state failures use exit `3`. Preserve those paths and do not use `INTEGRITY_MISMATCH` merely because an untrusted submitted evidence field disagrees with a trusted manifest. |
| Shared `available` inventory per role | `correct in scope` | `verifyPreparedPackages` already validates each role bundle once and report serialization is deterministic. Return validated role bundle data to `generateReport`, emit one shared role inventory, and keep only supplied/read execution summaries per case. This is simpler than repeating invariant available data in every case. |

No repository conflict, new public CLI, suite-schema change, CI change, new artifact identity or ASM program-scope change is required. Both findings are accepted with the exact compatibility qualification above.

## 4. Confirmed requirements

1. Add exactly one evidence artifact identity: `artifact_type: "skill_resource_access"`, `schema_version: 1`.
2. Keep `available`, `supplied`, `read` and `unknown` semantically separate.
3. Bind evidence to exact workspace, skill, suite, case, variant, execution context, bundle manifest and exact accepted observation artifact bytes.
4. Use normalized bundle-relative paths, not repository-absolute or OS paths.
5. Validate exact path/hash membership against the selected variant's immutable `bundle_manifest`.
6. Preserve existing artifact field meanings, observation/human authority, incomplete-report semantics, exit-code taxonomy and immutable report persistence.
7. Resource evidence is optional for semantic completeness; invalid present evidence is never downgraded to missing/unknown success.
8. Derive all metrics from the manifest entries selected by validated paths.
9. Preserve deterministic ordering and canonical output.
10. Do not alter suite schema, create suites, execute models, semantic-grade, choose winners or modify CI.
11. Do not claim isolation, enforcement, read-only executor, credential/network denial, native trigger behavior, context reduction or token savings beyond actual evidence.
12. Candidate and baseline use the same artifact contract, but each resolves against its own variant manifest.
13. A present resource-access artifact requires its corresponding valid observation and must never be paired with another execution's response or human semantic proposal.
14. Preserve current exit taxonomy: invalid submitted resource evidence exits `1`; trusted runner-owned integrity/operational failures remain exit `3`.

## 5. Exact scope

### 5.1 Behavior owners

| File | Classification | Responsibility |
| --- | --- | --- |
| `.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs` | Required implementation | `skill_resource_access` schema validator, relationship helpers and reusable resource-entry validation. |
| `.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs` | Required implementation | Deterministic per-case template, evaluator evidence directories and prepared inventory support. |
| `.agents/scripts/run-skill-evals.mjs` | Required implementation | Evidence-layout allowlist, optional ingestion, manifest cross-check, report integration, missing/invalid behavior and claim boundaries. |

No new internal module is justified. Artifact validation already belongs to `artifact-schema-v1.mjs`; workspace creation belongs to `synthetic-workspace-v1.mjs`; report integration belongs to the runner. A generic helper module would split one coherent responsibility without demonstrated reuse.

### 5.2 Test support

| File | Classification | Responsibility |
| --- | --- | --- |
| `.agents/scripts/run-skill-evals.test.mjs` | Required test support | Black-box prepare/report fixtures for valid, absent, malformed, unknown, self-reported, identity/path/hash, ordering, comparison and compatibility cases. |
| `.agents/scripts/validate-skill.test.mjs` | Audit-only; cumulative execution | Existing structural-validator regression suite; no planned edit. |

### 5.3 Authority and tracker owners

| File | Classification | Responsibility |
| --- | --- | --- |
| `.agents/skills/maintain-repo-skills/references/eval-design.md` | Required authority/documentation | Define artifact role, available/supplied/read semantics, self-report limits, missing/invalid behavior and claim boundary. |
| `docs/agent-skills/progress.md` | Required tracker | Record actual checkpoint status, verification, permissions and delivery state only after evidence exists. |

### 5.4 Planning/history owners

| File | Classification | Planned disposition |
| --- | --- | --- |
| `docs/agent-skills/implementation-plans/README.md` | Planning routing owner | Index ASM-PR1 and route readers. |
| `docs/agent-skills/implementation-plans/asm-pr1/plan.md` | Detailed plan owner | Own this specification and checkpoint contract. |
| `docs/agent-skills/implementation-plans/asm-pr1/owner-review-brief.md` | Owner decision surface | Stay `pending` until explicit approval. |
| `docs/agent-skills/structural-migration-roadmap.md` | Approved program/history owner | Audit-only for implementation unless a minimal truthful direct link/status update is later required by its ownership; do not duplicate mechanics. |
| `docs/agent-skills/plan.md` | Program master/history owner | Audit-only; existing gap routing to ASM-PR1 is sufficient. |
| `docs/agent-skills/pr-3b-eval-runner-plan.md` | Historical completed plan | Audit-only; do not rewrite historical contract. |

### 5.5 Audit-only implementation sources

- `AGENTS.md`;
- `docs/agent-loops.md`;
- `.agents/skills/maintain-repo-skills/SKILL.md`;
- `.agents/skills/maintain-repo-skills/references/progressive-disclosure.md`;
- `.agents/skills/maintain-repo-skills/references/fresh-reader-testing.md`;
- `.agents/scripts/lib/skill-evals/suite-schema-v1.mjs`;
- `.agents/scripts/validate-skill.mjs`;
- `.github/workflows/ci.yml`;
- Adaptive Workflow implementation-plan examples.

### 5.6 Forbidden files and domains

- `.agents/evals/**`;
- candidate skill bundle edits;
- suite-schema changes;
- structural-validator implementation changes;
- CI workflow changes;
- model/subagent execution;
- semantic grader or automatic winner;
- native platform-trigger evaluation;
- mutation-capable evaluation;
- product/runtime/UI/application tests;
- Supabase/database files or state;
- deployment/production;
- broad cleanup, unrelated refactor or generic helper extraction;
- raw evidence/workspaces/transcripts in Git.

## 6. Artifact and evidence design

### 6.1 Artifact location and lifecycle

Prepared template:

```text
executor/<variant>/cases/<suite>/<case-id>/skill-resource-access-template.json
```

Optional evaluator evidence:

```text
evaluator/skill-resource-access/<role>/<suite>/<case-id>.json
```

`prepare` creates template and exact empty role directories. `report` accepts evidence only at prepared case-graph paths and rejects unexpected extra files. Evidence remains transient with the workspace.

Template là runner guidance không mang `artifact_type` riêng; nó dùng `template_for: "skill_resource_access"` để hướng evaluator tạo đúng standalone evidence artifact. Cách này giữ đúng current owner instruction rằng ASM-PR1 chỉ thêm một new artifact identity: `artifact_type: "skill_resource_access"`, `schema_version: 1`.

### 6.2 Exact v1 artifact fields

```json
{
  "schema_version": 1,
  "artifact_type": "skill_resource_access",
  "workspace_id": "ws-...",
  "skill": "example-skill",
  "suite": "routing",
  "case_id": "routing-case",
  "variant_id": "A",
  "execution_context_hash": "<sha256>",
  "bundle_manifest_hash": "<sha256>",
  "observation_sha256": "<sha256 of exact accepted observation file bytes>",
  "supplied": {
    "status": "observed",
    "resources": [
      {
        "path": "SKILL.md",
        "sha256": "<sha256>"
      }
    ],
    "basis_type": "operator_observation",
    "basis": "Exact package handed to the executor was recorded before execution.",
    "limitations": "The runner did not enforce executor filesystem or tool access."
  },
  "read": {
    "status": "unknown",
    "resources": null,
    "basis_type": "unavailable",
    "basis": "The executor runtime exposed no file-read trace.",
    "limitations": "No exact resource-read claim is supported."
  }
}
```

Exact allowed values:

```text
status:
  observed | unknown

basis_type:
  runtime_observation
  operator_observation
  executor_self_report
  unavailable
```

Relationship rules:

- A present `skill_resource_access` artifact requires the corresponding observation at `evaluator/observations/<role>/<suite>/<case-id>.json` to be present and valid first.
- `observation_sha256` must equal `sha256Bytes(observationBytes)` for that exact observation file. This intentionally matches current `human_evaluation.observation_hashes[role]`; it does not hash a reserialized parsed object or add a new canonical-order rule for existing submitted observations.
- Workspace, skill, suite, case, variant and execution-context identity must agree across evidence path, resource artifact, observation, prepared case graph and role mapping.
- Candidate and baseline bind independently to their own observation bytes. A candidate hash can never satisfy baseline evidence or vice versa, including when both variants share identical bundle bytes.
- When a human evaluation is present, its role hash and the resource artifact's `observation_sha256` must both equal the same runner-computed observation byte hash. This prevents supplied/read evidence from one execution being paired with another execution's response or semantic proposal.
- For an observation with `execution_status: not_run`, a resource artifact may be present only with both `supplied` and `read` set to `status: unknown`, `resources: null` and `basis_type: unavailable`. It may explain the evidence limit, but must not encode observed empty sets or imply an executor/model execution occurred.
- `status: observed` requires `resources` to be an array, including `[]` when zero resources were positively observed; `basis_type` must not be `unavailable`.
- `status: unknown` requires `resources: null` and `basis_type: unavailable`; it must not use `[]`.
- `basis` and `limitations` are non-empty trimmed strings for both statuses.
- Each resource entry has exactly `path` and `sha256`.
- Evidence contains no line count, byte count, token count, enforcement boolean, semantic conclusion or source-role literal.
- `variant_id`, not baseline/candidate identity, appears in executor-facing template. Role remains evaluator-owned.

`runtime_observation` means an actual runtime trace or platform record was observed; it does not mean the runner enforced access. `operator_observation` means the operator recorded the exact package/action. `executor_self_report` preserves a weaker claim explicitly. `unavailable` records why the dimension remains unknown.

### 6.3 Path, hash and identity validation

The validator must:

1. enforce exact top-level and nested keys;
2. enforce artifact v1/type and current identity grammar;
3. load and validate the corresponding role observation before accepting present resource evidence;
4. match workspace, skill, suite, case and variant across the evidence path, resource artifact, observation and prepared graph;
5. match both artifacts' `execution_context_hash` to the prepared case manifest;
6. match `observation_sha256` to the exact accepted observation file bytes already used for human-evaluation binding;
7. match `bundle_manifest_hash` to that variant's `bundle_manifest.aggregate_sha256`;
8. apply the explicit `execution_status: not_run` unknown-only rule;
9. require forward-slash normalized, non-empty, bundle-relative paths;
10. reject absolute paths, drive/UNC/ADS forms, control characters, glob characters, empty/`.`/`..` segments, Windows reserved segments, trailing dot/space and backslashes;
11. require exact case-sensitive match after prefixing `.agents/skills/<skill>/` against a present `bundle_manifest.files` entry;
12. reject deleted/missing entries;
13. require supplied/read arrays independently lexicographically sorted and duplicate-free;
14. match each provided SHA-256 to its manifest entry;
15. reject unknown/observed relationship violations.

`read` is not required to be a subset of `supplied`: a runtime may read an available resource after initial context supply. Both sets must independently be subsets of `available`.

Error mapping:

| Condition | Result |
| --- | --- |
| Missing artifact | Valid optional absence; supplied/read become unknown in report; no completeness downgrade |
| Invalid UTF-8/JSON/newline/schema/status/path | Exit `1`; no valid report |
| Unsupported integer artifact version | Exit `2`; no valid report |
| Resource artifact present while its role observation is absent | Exit `1` with existing relationship-invalid class; no valid report |
| Workspace/skill/suite/case/variant/context/bundle/observation identity mismatch | Exit `1`; no valid report |
| Duplicate/unsorted path or path not present in manifest | Exit `1`; no valid report |
| Submitted resource SHA, bundle hash or observation hash disagrees with trusted prepared/observation evidence | Exit `1` as invalid submitted evidence; no valid report |
| `not_run` observation paired with observed supplied/read evidence | Exit `1` with existing relationship-invalid class; no valid report |
| Runner-owned prepared manifest/captured byte/inventory integrity mismatch, unsafe operational state or persisted-report conflict | Preserve existing exit `3`; no valid report |
| Partially unknown | Valid; observed dimension reported, unknown dimension bounded |
| Self-report only | Valid structural evidence with explicit self-report label and restricted claims |

Use existing error classes/codes where they fit:

- `ARTIFACT_SCHEMA_INVALID` for malformed submitted structure/value;
- `ARTIFACT_IDENTITY_MISMATCH` for bound workspace/skill/suite/case/variant/context/bundle/resource/observation hash disagreement;
- `ARTIFACT_RELATIONSHIP_INVALID` for unexpected evidence path, missing corresponding observation, duplicate/order/member/status relationship failures;
- `ARTIFACT_VERSION_UNSUPPORTED` with exit `2`;
- `INTEGRITY_MISMATCH`, `REPORT_STATE_INCONSISTENT`, `REPORT_OVERWRITE_REFUSED` and operational/path refusal codes remain exit `3` only on their existing trusted runner-state boundaries.

### 6.4 Trusted metric derivation

For `available`, `supplied` and `read`, runner derives:

```text
file_count
byte_count
line_count
core:
  file_count
  byte_count
  line_count
resources:
  file_count
  byte_count
  line_count
```

Rules:

- `available` selects every present entry in `bundle_manifest.files`.
- `supplied`/`read` select validated manifest entries named by their observed arrays.
- `core` is exact bundle-relative `SKILL.md`.
- `resources` is every other selected bundle file, including references, scripts or assets.
- `byte_count` and `file_count` are deterministic sums.
- `line_count` is the sum only when every selected entry has non-null `line_count`; otherwise it is `null`.
- Unknown supplied/read dimensions have `metrics: null`, never zero.
- Metrics are not accepted from artifact input.
- Line/byte differences may be described exactly; they are not token savings.

### 6.5 Report integration

`generated_report` gains one top-level shared inventory:

```text
resource_access:
  available:
    baseline: <role inventory>   # comparison only
    candidate: <role inventory>
```

Each role inventory contains:

- `variant_id`;
- `bundle_manifest_hash`;
- exact lexically sorted bundle-relative `available` paths/hashes derived from that role's validated bundle manifest after its `.agents/skills/<skill>/` prefix is verified and removed;
- manifest-derived available metrics.

Each generated report case gains one additive execution summary:

```text
resource_access:
  baseline: <case execution summary>   # comparison only
  candidate: <case execution summary>
```

Each case execution summary contains:

- resource evidence artifact SHA-256 or `null`;
- corresponding observation artifact SHA-256 or `null`;
- `supplied` status, evidence basis, limitations, exact validated paths/hashes or `null`, and derived metrics or `null`;
- `read` with the same shape;
- deterministic role-level claim boundaries.

`available` is emitted once per role because it is invariant across cases in one prepared workspace. `verifyPreparedPackages` already validates each variant bundle once; it should return the validated bundle data alongside `contextHashes` so `generateReport` can construct the shared inventory without rereading or trusting submitted metrics. Object keys remain canonical-sorted; resource arrays inherit manifest lexical order; suite/case order remains unchanged.

Existing case keys and meanings for `observations`, `human_evaluation`, `case_status`, `comparison_status` and `evidence_status` remain unchanged. Existing top-level meaning and persistence rules remain unchanged. The new top-level shared inventory and per-case execution summaries are additive `generated_report` fields; owner approval of CP1 explicitly approves that compatibility decision.

No new public CLI command or flag is added.

### 6.6 Missing, invalid and immutable-final behavior

- Missing resource artifact never changes existing semantic `evidence_status`.
- When semantic evidence is otherwise complete, the complete report may still persist with supplied/read `unknown` and explicit boundaries.
- Because final reports are immutable, resource evidence needed for a claim must be placed before the first successful complete `report` call. Later enrichment that changes output remains refused; ASM-PR1 does not weaken no-overwrite behavior.
- A present invalid resource artifact fails before a valid report is returned or persisted.
- A present resource artifact with no corresponding observation is invalid relationship evidence, not optional absence.
- A missing observation plus missing resource artifact remains existing semantic incomplete evidence; shared `available` still reports the prepared role inventory, while that case's observation hash and supplied/read evidence remain `null`/`unknown`.
- Unexpected evidence outside the prepared graph fails like unexpected observation/human-evaluation evidence.

### 6.7 Baseline/candidate comparability

- Both roles use the same v1 schema and validation rules.
- Each role binds to its own variant, bundle manifest, execution-context hash and exact observation byte hash.
- Human evaluation and resource evidence independently bind to the same runner-computed observation hash per role; neither role can borrow the other's observation or semantic proposal.
- Available/supplied/read metrics are derived independently from each immutable role bundle.
- A line/byte comparison for a dimension is mechanically available only when that dimension is `observed` for both roles.
- Material execution variance, different runtime instrumentation or different evidence-basis strength remains visible and can make human interpretation inconclusive.
- Runner does not turn metric difference into `improved`, `equivalent`, `regressed`, context-reduction success or winner selection.
- Candidate-only evidence may report exact facts but cannot make a comparative reduction claim.

### 6.8 Allowed and prohibited claims

| Evidence state | Allowed claim | Prohibited claim |
| --- | --- | --- |
| Bundle manifest only | “These resources were available in the prepared bundle.” | supplied, read, isolation, enforcement or context reduction |
| Supplied `unknown` | “Exact supplied resources are unknown.” | supplied-context reduction |
| Read `unknown` | “Exact reads are unknown.” | read reduction or proof that an unread resource was unnecessary |
| `executor_self_report` | “The executor self-reported these resources.” | runner-observed, runtime-enforced, isolated or trusted reduction conclusion |
| `operator_observation` | “The operator recorded this exact set under the stated limits.” | environment-enforced access denial |
| `runtime_observation` | “Runtime evidence observed these resources under the stated basis.” | runner enforcement or broader isolation unless separately proved |
| Both roles observed with comparable conditions | Exact line/byte/file differences | semantic improvement, automatic activation proof or token savings |
| No actual token measurement | None about token reduction | any token-saving percentage/count/conclusion |

No basis type alone proves credential exclusion, network denial, read-only mutation policy, filesystem containment or tool denial. Such claims require separate direct evidence outside this artifact.

### 6.9 Backward compatibility

Must remain unchanged:

- suite-definition v1 exact schema;
- workspace, bundle, execution-context, observation and human-evaluation exact fields and meanings;
- requested policy versus observed access separation;
- existing completeness, semantic status and comparison status authority;
- current exit-code classes;
- source capture, blind variant mapping and bundle bytes;
- report ordering and immutable persistence;
- public help/CLI grammar.

Expected additive differences:

- one prepared template per variant/case and corresponding inventory/file count;
- empty evaluator resource-access directories;
- optional accepted evidence files;
- additive top-level shared `resource_access.available` inventory per role;
- additive per-case `resource_access` supplied/read execution summaries bound to exact observation hashes;
- additional claim boundaries.

Compatibility tests must protect every unchanged item and make additive output changes explicit.

## 7. Dependency and checkpoint order

```text
CP0 baseline/authority
  → CP1 durable detailed-design approval
    → CP2 atomic artifact + template + ingestion + metrics + report contract
      → CP3 cumulative verification, review, reconciliation and delivery readiness
```

CP2 and the prompt's proposed CP3 are intentionally combined. Direct code inspection shows `runReport → generateReport → readCaseEvidence` is one coherent boundary that simultaneously:

- validates optional evidence;
- distinguishes missing from invalid;
- maps role/variant/context/bundle/observation identity;
- constructs case report output;
- controls final report persistence.

Splitting validator/template from ingestion would leave dead schema or accept evidence without truthful report behavior. Splitting ingestion from report output would validate and discard evidence. Either intermediate state is misleading, so one atomic checkpoint is safer.

### CP0 — Baseline, dependency, authority and scope confirmation

- **Goal:** confirm safe start state.
- **Allowed files:** none.
- **Prerequisites:** clean worktree/index; authorized fetch; fast-forward-only `main`; PR #63/roadmap and PR #62 foundation present; no branch conflict.
- **Observable output:** `feat/agent-skills-asm-pr1` at exact baseline with `main..HEAD` empty.
- **Focused verification:** branch/status/rev/log/roadmap/history inspection.
- **Review:** main preflight.
- **Stop:** dirty/ambiguous ownership, divergence, absent dependency, conflicting branch, reset/rebase required.
- **Correction boundary:** no correction; stop and report.
- **Commit boundary:** no.
- **Rollback:** switch back only under later owner direction; do not delete branch.

### CP1 — Durable plan, owner brief, source ownership and design freeze

- **Goal:** reconcile explicit owner approval, implementation authority và delivery gates trước khi chạm implementation sources.
- **Allowed files for this correction:** `plan.md`, `owner-review-brief.md` and `docs/agent-skills/progress.md` only when its current-status ownership changes; implementation-plan index and roadmap remain audit-only.
- **Prerequisites:** CP0 complete and direct runner/history/template discovery complete.
- **Observable output:** exact artifact design, scope, checkpoint, verification, claim, permission and rollback contract; detailed plan và owner brief đều `approved`.
- **Focused verification:** Markdown/link/path/UTF-8/final-newline checks; `git diff --check`; scope audit; adversarial plan self-review.
- **Review:** main-agent adversarial plan review, correction and re-review to 0 Critical/Required.
- **Stop:** material conflict with current code or approved roadmap; compatibility cannot be maintained; owner design decision cannot be represented safely.
- **Correction boundary:** planning docs only.
- **Commit boundary:** CP1 reconciliation stays with the coherent CP2 implementation checkpoint; no ceremonial approval-only commit.
- **Rollback:** revert only planning artifact checkpoint; no implementation exists.

### CP2 — Atomic resource-access contract, report integration and focused tests

- **Goal:** implement the smallest usable end-to-end evidence slice.
- **Status:** `complete, committed and pushed` on 2026-07-29 at `fcc23a9506ea4de1f22fa0b417a2caa60eec5823`; formal main checkpoint review found `0 Critical / 0 Required`.
- **Allowed files:** three behavior owners, runner test, `eval-design.md`, and `progress.md` for actual checkpoint evidence.
- **Prerequisites:** CP1 explicitly approved and separate implementation permission granted; CP0 revalidated against current `main`.
- **Observable output:** prepare template, optional artifact validator, exact observation/execution binding, evidence layout, shared role inventory, per-case manifest-derived summaries and truthful boundaries work together.
- **Focused verification:**
  - `node --check` on changed MJS files;
  - focused runner test-name subset while iterating;
  - full `node --test .agents/scripts/run-skill-evals.test.mjs` before checkpoint;
  - `node .agents/scripts/run-skill-evals.mjs --help`;
  - `git diff --check`.
- **Review:** checkpoint self-review of artifact shape, path/hash/identity, missing/invalid, determinism, claims and compatibility; 0 Critical/Required.
- **Stop:** requires suite-schema/CI/validator/new helper/out-of-scope file; optional evidence cannot coexist with immutable report; report needs semantic inference; path/hash binding is ambiguous.
- **Correction boundary:** only CP2 allowed files and tests; no suite/skill/CI/product changes.
- **Commit boundary:** one coherent owner-authorized implementation commit; do not split schema/template/report into misleading commits.
- **Rollback:** revert the atomic CP2 implementation; existing v1 prepare/report behavior returns intact.

### CP3 — Cumulative verification, adversarial review and delivery readiness

- **Goal:** establish full local readiness and execute only the exact owner-authorized delivery actions.
- **Status:** `complete` on 2026-07-29; cumulative verification pass and adversarial integration review found `0 Critical / 0 Required`.
- **Allowed files:** entire planned final set for audit; corrections only inside CP2 scope; `progress.md` for actual evidence.
- **Prerequisites:** CP2 focused checks pass.
- **Observable output:** cumulative commands pass, scope is exact, docs match implementation, no Critical/Required finding remains, owner permissions and delivery evidence remain truthful.
- **Cumulative verification:** exact set in section 9.
- **Review:** main adversarial implementation/integration review; re-review after supported corrections.
- **Stop:** any Critical/Required remains; deterministic output or compatibility fails; Node 20 is claimed without evidence; new material decision/file/domain required.
- **Correction boundary:** supported in-scope correction only; material expansion returns to owner.
- **Commit boundary:** no ceremonial CP3 commit. An in-scope substantive correction may use one coherent owner-authorized correction commit; a factual documentation commit is allowed only when it records real completed checkpoint evidence.
- **Rollback:** revert correction independently where coherent, otherwise revert atomic CP2.

Final CI evidence: GitHub Actions run `30456110172` completed successfully at final head `5a8ed0884169e5f34365e4934c4643655d6937fc`. `Test and Build` and `production-gate` succeeded. The repository CI configuration selected Node 20, and the runner-test, validator-test, repository-validator and application-build steps all succeeded. Initial CI watch is consumed; CI-fix attempts used: `0`; the unused conditional permission creates no standing authority.

## 8. Acceptance criteria

1. Given a prepared candidate-only workspace, `bundle_manifest` still proves every available bundle file without claiming it was supplied/read.
2. `generated_report` emits one shared `available` inventory per role and does not duplicate invariant available paths/metrics in every case.
3. Given no resource-access artifact, `report` preserves existing semantic completeness behavior and emits supplied/read `unknown` with explicit blocked-claim boundaries.
4. Given a valid artifact, its `observation_sha256` matches the exact accepted observation file bytes for the same role/suite/case/variant/context, and report exposes supplied/read sets and metrics derived only from the bound immutable manifest.
5. Given a human evaluation, both it and the resource artifact independently bind to the same runner-computed observation hash for each role.
6. Given `status: unknown`, report uses null set/metrics rather than zero.
7. Given a completed observation and an observed empty set, report distinguishes `[]`/zero metrics from unknown.
8. Given `execution_status: not_run`, present resource evidence is valid only when supplied/read are both unknown; it cannot claim observed empty access or model execution.
9. Given malformed, unsupported-version, wrong-identity, unsafe-path, duplicate, unsorted, missing-path or hash-inconsistent submitted evidence, report fails with exit `1` except unsupported version exit `2`, and does not create a valid final report.
10. Given runner-owned package/inventory/persisted-report integrity or operational failure, existing exit `3` behavior remains unchanged.
11. Given a partially unknown artifact, the known dimension remains visible and the unknown dimension blocks only its unsupported claim.
12. Given executor self-report, report labels it as self-report and never upgrades it to runtime enforcement or trusted context-reduction evidence.
13. Given comparison mode, baseline and candidate evidence bind independently to the correct opaque variants, their own immutable manifests and their own observation bytes; swapping hashes/artifacts is refused.
14. Given comparable observed sets, runner reports exact file/line/byte facts without semantic winner, context-success or token-saving conclusion.
15. Existing suite v1, observation/human proposal, incomplete report, exit codes, deterministic order, package blindness and immutable report behavior remain protected.
16. No new helper, CLI, suite, skill migration, CI, product or database change appears.

## 9. Verification strategy

### 9.1 Syntax and focused iteration

```text
node --check .agents/scripts/lib/skill-evals/artifact-schema-v1.mjs
node --check .agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs
node --check .agents/scripts/run-skill-evals.mjs
node --check .agents/scripts/run-skill-evals.test.mjs
```

During CP2, use `node --test --test-name-pattern <pattern> .agents/scripts/run-skill-evals.test.mjs` only for focused iteration, then run the full suite before checkpoint reporting.

### 9.2 Focused runner test matrix

- prepare creates canonical template bound to bundle/execution-context identity and instructs the operator to fill `observation_sha256` from the exact observation file bytes;
- shared `available` inventory appears once per role, with lexical resources and deterministic manifest-derived metrics;
- candidate-only valid observed/unknown and observed-empty cases;
- absent artifact;
- resource artifact present while corresponding observation is absent;
- exact observation hash match, wrong observation hash, observation replacement after resource capture and non-canonical-but-currently-valid observation byte binding;
- comparison candidate/baseline observation-hash swap and independent same-bundle role binding;
- `execution_status: not_run` with required unknown/unknown resource state, plus refusal of observed supplied/read;
- partial unknown;
- self-report, operator observation and runtime observation labels;
- exact core/resource metrics;
- binary/null line-count propagation;
- malformed JSON/encoding/newline;
- unsupported version;
- extra/missing fields and invalid enums;
- unknown with array, observed with null, unavailable basis on observed;
- unsafe/absolute/backslash/dot/traversal/reserved paths;
- duplicate and unsorted paths;
- path absent/deleted from manifest;
- wrong resource SHA, bundle hash, context hash and identity all exit `1`;
- existing runner-owned prepared byte/inventory/hash tamper and persisted-report conflict remain exit `3`;
- unexpected evidence path;
- comparison role/variant binding and different bundle metrics;
- missing role evidence in comparison;
- deterministic repeat output;
- persisted-report immutability after absent evidence;
- package leak scan remains clean.

### 9.3 Cumulative final verification

```text
node --test .agents/scripts/run-skill-evals.test.mjs
node --test .agents/scripts/validate-skill.test.mjs
node .agents/scripts/run-skill-evals.mjs validate --all
node .agents/scripts/validate-skill.mjs
git diff --check
```

Also run:

- `git status --short` and `git diff --name-status`;
- diff against recorded baseline;
- Markdown local-link resolution for changed docs;
- strict UTF-8/final-newline/trailing-whitespace audit;
- conflict-marker, zero-width, absolute-temp-path and accidental raw-evidence search;
- deterministic output assertions already implemented in the runner suite;
- final forbidden-scope audit for `.agents/evals/**`, skill bundles, CI, product and database.

Node 20 compatibility may be claimed only from an actual Node 20 run, normally later CI after separately authorized PR/CI workflow. Local non-20 success must record the exact local version and remain local evidence only.

No browser, application, Supabase, database, E2E or manual UI QA applies.

## 10. Review strategy

### 10.1 Main plan self-review

Review this draft against:

- approved ASM scope/order/exclusions;
- current runner and artifact code;
- standalone versioning and generated-report compatibility;
- available/supplied/read/unknown truthfulness;
- missing versus invalid behavior;
- identity/path/hash/order/duplicate/containment safety;
- deterministic output and immutable persistence;
- hostile and incomplete test coverage;
- checkpoint coherence and rollback;
- file ownership and permission boundaries;
- unnecessary helper/file creation.

Correct all in-scope Critical/Required findings and re-review.

### 10.2 Implementation review

CP2 receives a formal main checkpoint review because it changes a shared evidence boundary. CP3 receives cumulative integration review. Findings are classified Critical/Required/Suggestion/Nit/FYI; only Critical/Required block readiness.

### 10.3 Specialist and fresh-reader decision

- Specialist count: `0`. Main repository/code/history evidence is sufficient; no independent unresolved risk cluster remains that needs a specialist.
- Planning fresh-reader: `not_run`. ASM-PR1 fresh reader is optional, not mandatory. A qualified independent reader was not needed to resolve a remaining material ambiguity after direct code inspection and self-review; running one only to increase evidence volume would violate the program rule.
- Self-review is not fresh-reader evidence.
- A later implementing task may reconsider one bounded read-only comprehension case after main review only if an actual ambiguity remains and the executor/package meets `fresh-reader-testing.md`.

## 11. Rollback and correction strategy

1. Before implementation, rollback means revert only the planning artifact checkpoint after owner direction.
2. CP2 is atomic: revert artifact validator, template/layout, ingestion, metrics, report field, tests and eval-design text together.
3. Do not leave templates that the report ignores or report code that accepts unvalidated resource evidence.
4. Existing report persistence and old artifact semantics must work after revert.
5. In-scope later defect corrections use additive commits by default after explicit commit permission.
6. Do not amend, squash, rebase, reset, force-push, delete branch or delete transient workspaces as rollback.
7. Raw transient evidence is never committed.

## 12. Stop conditions

Stop and report when:

- branch/base/dependency/working-tree ownership becomes unclear;
- detailed owner brief remains pending when implementation is requested;
- implementation permission is absent;
- current code requires a suite-schema breaking change;
- existing observation/human/completeness semantics must change;
- additive report shape cannot remain compatible with existing consumers/tests;
- exact resource identity cannot bind to bundle, execution-context and corresponding observation bytes;
- candidate/baseline resource evidence cannot remain independently bound to their own observations;
- `not_run` evidence would require inferring an execution or observed resource set;
- missing and invalid evidence cannot remain distinct;
- supplied/read unknown cannot block unsupported claims;
- implementation would require another artifact type, helper module, CLI, suite, skill, validator, CI, product or database file without a new owner decision;
- runtime enforcement, model execution or semantic grading becomes necessary;
- deterministic output, immutable persistence or path/hash safety fails;
- a Critical/Required review finding remains;
- any stage/commit/push/PR/CI/merge/deploy/database/history action lacks exact current permission.

## 13. Expected final file set

Expected implementation branch changes after all later authorized checkpoints:

```text
.agents/scripts/lib/skill-evals/artifact-schema-v1.mjs
.agents/scripts/lib/skill-evals/synthetic-workspace-v1.mjs
.agents/scripts/run-skill-evals.mjs
.agents/scripts/run-skill-evals.test.mjs
.agents/skills/maintain-repo-skills/references/eval-design.md
docs/agent-skills/implementation-plans/README.md
docs/agent-skills/implementation-plans/asm-pr1/plan.md
docs/agent-skills/implementation-plans/asm-pr1/owner-review-brief.md
docs/agent-skills/progress.md
```

`docs/agent-skills/structural-migration-roadmap.md` remains audit-only unless ownership later requires one minimal direct link or truthful status transition. `docs/agent-skills/plan.md`, PR 3B history, suite schema, structural validator and CI remain unchanged.

## 14. Implementation handoff

Before implementation, the later agent must read:

1. `AGENTS.md`;
2. `docs/agent-loops.md`;
3. `docs/agent-skills/structural-migration-roadmap.md`;
4. `docs/agent-skills/progress.md`;
5. this `plan.md`;
6. [owner-review-brief.md](./owner-review-brief.md);
7. `maintain-repo-skills/SKILL.md`, `eval-design.md` and triggered references;
8. test, planning and Git skills;
9. current versions of the three behavior owners and runner tests.

The agent must stop on a material conflict between this plan and owner brief, revalidate baseline/dependency, and stay inside the exact implementation/stage/commit/normal-push/one-PR/initial-CI-watch/one-conditional-fix authority granted by the current owner instruction. Merge and auto-merge remain ungranted.

Expected final implementation report:

- exact base, branch and dependency;
- checkpoints completed;
- files changed by ownership class;
- actual focused and cumulative commands/results with runtime version;
- compatibility, deterministic, hostile and claim-boundary evidence;
- self-review findings/resolutions and remaining blockers;
- fresh-reader status and limits;
- implementation, staging, commit, push, PR, CI, merge, deploy and database states;
- exact English Conventional Commit evidence for each owner-authorized commit.

## 15. Planning adversarial self-review record

Review type: main-agent adversarial durable-plan review.

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | 0 | None. |
| Required | Initial checkpoint shape separated schema/template from report ingestion even though current `readCaseEvidence` owns validation and report construction together. | Combined proposed CP2/CP3 into one atomic CP2 and retained cumulative review as CP3. |
| Required | Initial artifact sketch could not distinguish self-report from stronger observation. | Added exact `basis_type` enum and claim matrix; self-report remains structurally valid but cannot support runtime-enforced/trusted reduction claims. |
| Required | Initial missing-evidence wording did not address immutable final report enrichment. | Specified that missing evidence may persist as unknown and later differing enrichment remains refused; evidence needed for claims must exist before first complete report. |
| Required | Initial metric design did not define binary/null line handling or core/resource classification. | Added deterministic total/core/resources metrics and null propagation rules derived only from manifest entries. |
| Required | Initial scope treated roadmap and structural-validator tests as writable by default. | Classified roadmap, validator implementation/tests, suite schema and CI as audit-only; validator tests are cumulative execution only. |
| Required | Review found no binding between a resource artifact and the exact observation/execution whose response and semantic proposal enter the same case. | Added required `observation_sha256`, exact-byte binding parallel to `human_evaluation`, independent role binding, missing-observation refusal, cross-execution prevention and `not_run` rules. |
| Required | Initial error table treated wrong submitted resource SHA/bundle hash as trusted integrity failure exit `3`. | Corrected all submitted resource schema/identity/relationship/member/hash failures to exit `1`; preserved exit `3` for existing trusted runner-state integrity/operational/persistence boundaries. |
| Required | Initial per-case report repeated invariant `available` inventory and did not apply the owner's preferred shared shape. | Confirmed current aggregation/deterministic ordering supports a top-level shared inventory per role; cases now contain only observation-bound supplied/read summaries. |
| Required | “Canonical observation bytes” could have introduced a silent compatibility change because current submitted observations are not canonical-enforced. | Bound to exact accepted observation file bytes with `sha256Bytes`, matching current human-evaluation behavior; explicitly prohibited reserialization or a new observation canonical-order requirement. |
| Suggestion | A new schema helper module could shorten files. | Rejected: no independent responsibility or demonstrated reuse; current artifact-schema owner is sufficient. |

Re-review result:

```text
Critical: 0
Required: 0
Specialist: 0
Fresh-reader: not_run
Plan verdict: approved by owner; CP2 and CP3 implementation authorized
```

Fresh-reader remains `not_run`: ASM-PR1 tooling/planning use is optional under the approved program default, direct code/tests resolved both findings, and no independent material comprehension uncertainty remains. Self-review is not fresh-reader evidence, no model/runner execution occurred, and this status makes no isolation, formal-suite or comparative-behavior claim.

The self-review itself did not approve this agent-authored design. The current owner instruction is the explicit approval and implementation/Git/PR/CI authority recorded in section 1.
