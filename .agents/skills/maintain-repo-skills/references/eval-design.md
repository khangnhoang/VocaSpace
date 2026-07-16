# Repo-local skill evaluation design

Use this reference to design and interpret repository-owned skill evaluation suites and their evidence. It explains the evaluation vocabulary and authority split. The mandatory permission, safety, approval, review, source-of-truth, and stop invariants remain in the core `SKILL.md` and still apply.

## Artifact roles

- A `suite_definition` is the test specification. It contains executor-visible input, hidden evaluator criteria, and suite-specific configuration; it is not execution evidence.
- `executor_input` is the only case content supplied to the tested agent: prompt, selected context, and the requested execution policy.
- `evaluator_only` is the hidden answer key and rubric. Expected behavior, forbidden behavior, criteria, safety vetoes, reviewer conclusions, the other variant's output, and baseline/candidate identity during a blind comparison must not enter executor-visible input.
- A baseline or candidate observation is the executor's raw response plus execution metadata. Preserve it verbatim; do not replace it with a summary or human judgment.
- A `human_evaluation` is a reviewer-authored semantic assessment of an observation and, when an explicit baseline exists, a comparison proposal.
- A `generated_report` is a deterministic aggregation of validated artifacts. It does not semantic-grade, choose a winner, or invent a verdict.

Every standalone JSON artifact has `schema_version`, `artifact_type`, and the identity fields required for its role. PR 3A implements `suite_definition` and `validation_result`. The following identities are reserved for PR 3B rather than specified here in detail:

```text
workspace_manifest
bundle_manifest
execution_context_manifest
baseline_observation
candidate_observation
human_evaluation
generated_report
```

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

- `evidence_status: complete` means every artifact required for the selected candidate-only or comparative mode is present, structurally valid, provenance-consistent, and mutually consistent. `incomplete` means at least one required artifact is missing, invalid, or inconsistent; it forces semantic case and comparison status to `null` until corrected.
- `case_status: passed` means the observation satisfies all material criteria with no safety veto; `partially_passed` means it satisfies some material criteria but has a material omission or defect without triggering a safety veto; `failed` means it violates a material required behavior, exhibits forbidden behavior, or triggers a safety veto; `not_run` means an explicit observation artifact records `execution_status: not_run` and a concrete reason. `not_run` is never a pass.
- `comparison_status: improved` means candidate behavior is materially better than the explicit baseline without a material regression; `equivalent` means no material behavioral difference is established; `regressed` means candidate behavior is materially worse or triggers a new safety veto; `inconclusive` means complete comparative evidence exists but equivalence, confounding, or reviewer evidence cannot support the other three conclusions.

Only a human reviewer proposes semantic case/comparison statuses. The deterministic runner may carry a structurally valid human proposal into a report, but it never creates or upgrades that proposal.

## Requested policy is not enforced isolation

The suite records a requested execution policy. `packaging_mode: synthetic` means deterministic packaging of selected inputs; it is not a sandbox and does not prove executor isolation. Evidence must record actual access separately, including filesystem, tool, network, credential, remote, and mutation access. Do not describe isolation, enforcement, credential exclusion, or read-only behavior unless the execution evidence proves the claim.

Repository-routing evaluation is supported by the foundation. Native platform trigger evaluation is deferred. The runner does not invoke a model or subagent; execution needs separate owner authorization and occurs outside the runner.

## Evidence retention

Committed artifacts are tooling, versioned schemas, and suite definitions after a real consumer is separately approved. Full raw evidence must remain transient, including exact executor packages, bundle copies, raw observations, manifests, execution metadata, detailed human-evaluation working artifacts, generated reports, transcripts, workspace metadata, and absolute temporary paths.

A later major gate may commit a concise owner-approved evidence summary. It must not contain credentials, full environment dumps, full transcripts, bundle copies, or absolute temporary paths. OS-managed temporary storage is not durable retention; preserve required evidence explicitly before it expires, but do not weaken the no-raw-evidence commit rule.

## Authority split

- The runner checks deterministic structure, completeness, provenance, and consistency only.
- A human or main-agent reviewer may inspect hidden criteria and raw observations to recommend semantic case and comparison statuses.
- The owner retains the final acceptance, baseline, implementation, rollout, and lifecycle decision.

No runner result or reviewer recommendation grants permission to modify a skill, execute a model, correct a candidate, stage, commit, push, create or merge a pull request, or roll out a change. Obtain the exact current-task permission before each action boundary and stop under the core skill's mandatory stop conditions.
