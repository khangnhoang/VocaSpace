# Repo-local skill evaluation design

Use this reference to design and interpret repository-owned skill evaluation suites and their evidence. It explains the evaluation vocabulary and authority split. The mandatory permission, safety, approval, review, source-of-truth, and stop invariants remain in the core `SKILL.md` and still apply.

## Artifact roles

- A `suite_definition` is the test specification. It contains executor-visible input, hidden evaluator criteria, and suite-specific configuration; it is not execution evidence.
- `executor_input` is the only case content supplied to the tested agent: prompt, selected context, and the requested execution policy.
- `evaluator_only` is the hidden answer key and rubric. Expected behavior, forbidden behavior, criteria, safety vetoes, reviewer conclusions, the other variant's output, and baseline/candidate identity during a blind comparison must not enter executor-visible input.
- A baseline or candidate observation is the executor's raw response plus execution metadata. Preserve it verbatim; do not replace it with a summary or human judgment.
- A `skill_resource_access` artifact records observation-bound evidence about exact bundle resources supplied to or read by one execution. It is optional for semantic completeness and must not be confused with bundle availability or runner enforcement.
- A `human_evaluation` is a reviewer-authored semantic assessment of an observation and, when an explicit baseline exists, a comparison proposal.
- A `generated_report` is a deterministic aggregation of validated artifacts. It does not semantic-grade, choose a winner, or invent a verdict.

Every standalone JSON artifact has `schema_version`, `artifact_type`, and the identity fields required for its role. PR 3A implements `suite_definition` and `validation_result`; PR 3B implements the workspace, observation, human-evaluation, and report identities below; ASM-PR1 adds `skill_resource_access`:

```text
workspace_manifest
bundle_manifest
execution_context_manifest
baseline_observation
candidate_observation
human_evaluation
generated_report
skill_resource_access
```

## Skill-resource access evidence

Keep these facts separate:

- `available` is runner-owned: every present file in the selected immutable bundle manifest, reported once per source role.
- `supplied` is evidence about the exact bundle-relative resources handed to one execution.
- `read` is evidence about exact resource reads observed or reported for one execution. It is not required to be a subset of `supplied`; both sets must independently be subsets of `available`.
- `unknown` means the exact set is unavailable. It uses `resources: null`, never an observed empty array.

An observed dimension uses a lexically sorted, duplicate-free array of exact `{ path, sha256 }` entries and one evidence label:

```text
runtime_observation
operator_observation
executor_self_report
```

`unavailable` is reserved for an unknown dimension. `basis` and `limitations` must state what was observed and what the evidence cannot prove. Self-report stays explicitly labeled as self-report.

Each present artifact binds independently to its workspace, skill, suite, case, variant, execution-context hash, bundle-manifest hash, and `sha256` of the exact accepted observation file bytes. Do not reserialize an observation before hashing it. Candidate and baseline evidence cannot borrow or swap observation hashes, even when their bundle file bytes are identical. When `execution_status: not_run`, both supplied and read must remain unknown; an observed empty set would falsely imply an execution observation.

Missing optional resource evidence leaves supplied/read unknown without changing existing semantic completeness. Present invalid evidence is a hard failure, not incomplete or unknown evidence. A complete report may therefore persist with unknown resource access, but immutable-report rules still refuse later differing enrichment.

Manifest-derived file, line, and byte metrics describe exact selected files only. They do not prove semantic improvement, token savings, native routing, automatic activation, context reduction, runtime isolation, runner enforcement, credential exclusion, network denial, mutation prevention, or filesystem containment. `basis_type` alone never supports those claims.

## Comparison and incomplete evidence

An `improved`, `equivalent`, or `regressed` claim requires an explicit, resolvable baseline and comparable baseline/candidate evidence. A first accepted version may be evaluated candidate-only and later become a baseline, but it cannot claim improvement in its initial candidate-only evaluation. Candidate-only evidence has no comparison verdict.

A missing required observation is not an execution that explicitly did not run:

```text
missing observation
→ evidence_status: incomplete
→ case_status: null
→ comparison_status: null

explicit observation with execution_status: not_run and a reason
→ case_status may be not_run after human assessment
→ never counts as a pass
```

The runner validates artifact presence, structure, versions, provenance, and cross-artifact consistency. It must not infer `passed`, `partially_passed`, `failed`, or `not_run` from absent evidence.

Use three separate status dimensions:

- `evidence_status: complete` means every artifact required for the selected candidate-only or comparative mode is present, structurally valid, provenance-consistent, and mutually consistent. `incomplete` means at least one otherwise-required observation or human evaluation is genuinely absent; it forces semantic case and comparison status to `null` until supplied.
- A present but malformed, invalid, wrong-identity, provenance-inconsistent, mutually inconsistent, or integrity-failed artifact is not missing evidence. The command must fail non-zero and must not create a valid `generated_report`; `evidence_status` never downgrades corrupt or unusable input into a successful report.
- `case_status: passed` means the observation satisfies all material criteria with no safety veto; `partially_passed` means it satisfies some material criteria but has a material omission or defect without triggering a safety veto; `failed` means it violates a material required behavior, exhibits forbidden behavior, or triggers a safety veto; `not_run` means an explicit observation artifact records `execution_status: not_run` and a concrete reason. `not_run` is never a pass.
- `comparison_status: improved` means candidate behavior is materially better than the explicit baseline without a material regression; `equivalent` means no material behavioral difference is established; `regressed` means candidate behavior is materially worse or triggers a new safety veto; `inconclusive` means complete comparative evidence exists but equivalence, confounding, or reviewer evidence cannot support the other three conclusions.

Only a human reviewer proposes semantic case/comparison statuses. The deterministic runner may carry a structurally valid human proposal into a report, but it never creates or upgrades that proposal.

## Requested policy is not enforced isolation

The suite records a requested execution policy. `packaging_mode: synthetic` means deterministic packaging of selected inputs; it is not a sandbox and does not prove executor isolation. Evidence must record actual access separately, including filesystem, tool, network, credential, remote, and mutation access. Do not describe isolation, enforcement, credential exclusion, or read-only behavior unless the execution evidence proves the claim.

Repository-routing evaluation is supported by the foundation. Native platform trigger evaluation is deferred. The runner does not invoke a model or subagent; execution needs separate owner authorization and occurs outside the runner.

## V2 semantic-lineage substitution

For v2 eval-harness relationship regressions, begin with one complete valid artifact graph and substitute exactly one independently valid semantic dimension at a time. Keep every artifact schema-valid; canonically rebuild the changed artifact and recompute its own identity/content hash where required, while preserving unrelated fields and every untouched link. The failing boundary must identify the missing lineage check rather than generic corruption or a stale hash.

Cover the dimensions owned by the affected graph, as applicable:

- task, run, suite, case, variant, role, and logical unit identity;
- compiled invocation, readiness grant, runtime configuration, attempt, and observation identity;
- exact observation/resource-evidence tuples and evaluator-visible projections;
- proposal, canonical summary, accepted scope or membership, and review-policy identity;
- `decision_id`, `acceptance_input_id`, materialized `human_evaluation`, and the complete report-authorized scope.

High-value near-misses include artifacts from the same run or summary that differ only in unit, proposal, decision, acceptance identity, or accepted membership. Each forbidden substitution must fail loud at the relationship owner and must not produce a valid descendant, accepted artifact, or report. Rebuild the canonical positive graph between dimensions rather than stacking mutations.

Also include allowed controls for deliberately non-semantic provenance or audit fields. An allowed change passes only through a newly canonical, correctly rebound graph; it must not bless in-place mutation or stale descendant links. Align the expected invalidation with `reader_affected`, `evaluator_affected`, `acceptance_affected`, or `unaffected`; classify an unowned or ambiguous dimension as `unknown`, never silently reusable.

This technique is semantic evidence only when the substituted objects remain individually valid and the test isolates one relationship dimension. Malformed JSON, wrong hashes, schema violations, random bytes, or multi-axis fixture changes remain useful structural tests but do not establish semantic-lineage enforcement.

## Evidence retention

Committed artifacts are tooling, versioned schemas, and suite definitions after a real consumer is separately approved. Full raw evidence must remain transient, including exact executor packages, bundle copies, raw observations, manifests, execution metadata, detailed human-evaluation working artifacts, generated reports, transcripts, workspace metadata, and absolute temporary paths.

A later major gate may commit a concise owner-approved evidence summary. It must not contain credentials, full environment dumps, full transcripts, bundle copies, or absolute temporary paths. OS-managed temporary storage is not durable retention; preserve required evidence explicitly before it expires, but do not weaken the no-raw-evidence commit rule.

## V2 retention operator workflow

The canonical v2 task manifest is an immutable creation record and always keeps `payload.lifecycle: active`. Current cleanup authority comes from the validated append-only `tasks/<task-id>/lifecycle.jsonl` sequence. The only transitions are `active → closed` and `active → abandoned`: an exact task-aware successful merge event may close its bound PR, while reconciliation and abandonment require explicit owner authority. Branch deletion, current Git/GitHub state, silence, or elapsed time are never lifecycle authority.

Explicit append-only holds in `tasks/<task-id>/holds.jsonl` use exactly `open_review`, `open_pr`, or `expected_correction`. Any active hold vetoes local and shadow destructive work. Closing a lifecycle does not implicitly release a hold.

Use the bounded CLI in this order:

```text
node .agents/scripts/run-skill-eval-harness.mjs retention plan --task <task-id>
node .agents/scripts/run-skill-eval-harness.mjs retention apply --plan <plan-sha256> --authority <authority.json>
node .agents/scripts/run-skill-eval-harness.mjs retention purge --apply <apply-sha256> --authority <authority.json>
node .agents/scripts/run-skill-eval-harness.mjs legacy inventory --root <legacy-root>
```

`retention plan` is the default dry-run. It publishes one immutable audit plan but does not mutate cleanup targets, quarantine, purge, or App Server state. The planner starts from every retained task/run/journal root in the shared store, validates the full content-addressed link closure, and classifies each item exactly once as `retain`, `quarantine`, or `purge_eligible`. Uncertain or corrupt reachability fails closed. TTL produces only an operator-review hint; it never closes a task, releases a hold, changes `outcome_unknown`, or authorizes deletion.

Review the exact `plan_sha256` before apply. Cleanup issuance is a separate trusted integration boundary: `issueCleanupAuthority(...)` requires a strict owner issuance record, an independently returning-`true` `authorityVerifier`, and an exact `subject_sha256` over the complete apply or purge authority before it writes immutable `tasks/<task-id>/cleanup/authorities/<authority-id>.json`. The CLI `--authority <authority.json>` file is only the exact `{ authority_id, authority_sha256, record_sha256, task_id }` reference to that already-issued canonical record; arbitrary caller-authored authority JSON, including self-asserted `issuer: "repository-owner"`, is not authority. Resolution exact-validates record/version/kind/self-hash/issuance binding, then operation validation requires `issued_at <= operation_time <= expires_at` plus the frozen task/plan/action/membership bindings before mutation.

`retention apply` revalidates lifecycle, holds, run revisions/journal tails, roots, hashes, reachability, and shadow ownership before mutation. Any drift returns `CLEANUP_PLAN_STALE`; create and review a new plan instead of forcing the old one. Apply moves only reviewed non-retained local items into recoverable quarantine and records exact per-item intent/result. A `quarantine` item cannot be promoted to purge by that plan.

Irreversible deletion is a separate `retention purge` phase. Its separate authority must bind the completed exact `apply_sha256`, the exact sorted `purge_item_ids`, and delete actions. Every acknowledged removal leaves a durable tombstone. Missing acknowledgement, hash mismatch, crash ambiguity, or different-operation replay stays explicit and blocks a success claim.

App Server history is a non-authoritative shadow store. CP8B supports only injected `deterministic_mock_shadow_cleanup` certification; the operator CLI deliberately has no live App Server cleanup capability. A mock shadow action requires an exact harness-created acknowledged `thread_id`, exact task/run/attempt ownership, a matching validated runtime index, terminal CP8A certainty, closed/abandoned lifecycle, no hold, and exact plan membership. Fuzzy lookup, another valid thread donor, `outcome_unknown`, `shadow_thread_outcome_unknown`, and ambiguous adapter results all fail closed. Real App Server archive/delete remains unsupported.

Canonical review semantics remain the hash-bound `run_review_summary` and human decision chain. `review/summary.json`, `summary.md`, `summary.html`, and runtime indexes are derived views. `review/representations.json` binds canonical summary identity/hash, renderer/security versions, exact output hashes, and freshness identity. Validate or rebuild stale views only from the exact canonical summary; never infer semantics from Markdown, HTML, or an index.

`legacy inventory` is read-only catalog/reference compatibility. It hashes readable source bytes and reports contained relative paths and `readable | unreadable | unsupported` status without rewriting sources. A v1 entry cannot satisfy any v2 task, run, readiness, runtime, reuse, evaluation, acceptance, report, or cleanup relationship.

## Authority split

- The runner checks deterministic structure, completeness, provenance, and consistency only.
- A human or main-agent reviewer may inspect hidden criteria and raw observations to recommend semantic case and comparison statuses.
- The owner retains the final acceptance, baseline, implementation, rollout, and lifecycle decision.

No runner result or reviewer recommendation grants permission to modify a skill, execute a model, correct a candidate, stage, commit, push, create or merge a pull request, or roll out a change. Obtain the exact current-task permission before each action boundary and stop under the core skill's mandatory stop conditions.
