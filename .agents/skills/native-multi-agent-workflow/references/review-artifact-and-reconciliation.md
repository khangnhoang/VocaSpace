# Review Artifact and Reconciliation

## Minimal ephemeral ledger

Before dispatch, Main records in the current orchestration context:

```text
workflow_id
mode
phase
episode_id
current_role
managed_role_session_ids
owner_input_revision and ordered refs
authority snapshot
candidate_ref and candidate_revision
review_round and expected_review_artifact_ref
completed_correction_rounds
candidate start snapshot
allowed writer paths
status, blocker, and next allowed transition
```

This ledger is ephemeral orchestration state. Do not persist it as a database, event log, manifest, fingerprint registry, scheduler, or custom state-machine executable.

Retain each exact managed-role session identity through the enclosing managed workflow even after that role finishes a turn, no longer appears active, or completes an individual review episode. Finished, completed, idle, non-running, absent from `list_agents`, or episode `PASS`/completion describes only listing, turn, or episode state; none by itself proves that the stored session cannot accept a same-session follow-up. Remove the identity only when the enclosing managed workflow reaches its terminal state or exact native evidence establishes that the session is unavailable.

## Review round opening

Before opening round `0`, Main confirms that Main or the author has closed every applicable deterministic expectation according to existing ownership; do not rerun an unchanged passing check merely to duplicate evidence. At minimum, inspect encoding, consistent EOL, final newline, exact status literals, expected Owner/candidate revisions, changed-path scope, and review-artifact ignored/tracked/staged state. Add another check only when the owning contract supplies an exact expected value. A failure returns to the owning writer before Reviewer dispatch and consumes neither a review nor correction round; do not encode semantic judgment or unresolved Owner intent as a deterministic check.

Main preassigns exactly:

```text
docs/native-multi-agent/reviews/
  <workflow_id>/<episode_id>/
  <candidate_revision>-review-r<review_round>.md
```

Verify the destination is path-safe, inside the ignored review root, absent or the exact blocker-resume artifact for the same logical round, and neither tracked nor staged. Freeze candidate writers and capture exact candidate path/existence/bytes plus working-tree scope. Reviewer receives candidate-read-only authority and may create or update only `expected_review_artifact_ref`.

Any other Reviewer write returns `BLOCKED(reviewer_scope_violation)`. Any tracked/staged artifact returns `BLOCKED(review_artifact_git_scope_violation)`. Do not delete or revert evidence without exact Owner authority.

## Master Plan review staged disclosure

Apply this section only to a Master Plan Reviewer for a `MULTI_AGENT_MASTER_PLAN` candidate. Generic plan and implementation reviews continue to use the surrounding artifact, identity, admission, and correction rules without staged disclosure.

### Stage R-A — independent baseline

Main supplies the complete projected Owner Source Package and repository access while withholding the candidate content and candidate ref from the model-visible payload. The Reviewer admits the declared Owner package, then writes a frozen independent baseline into the same exact `expected_review_artifact_ref`. The baseline must reconstruct the Owner outcome, protected invariants, explicit exclusions, authority boundaries, material ambiguities, expected ownership and lifecycle properties, and relevant repository facts or source conflicts. Only after all required baseline content is recorded may the Reviewer return exact status `BASELINE_READY`; this is not a candidate verdict.

If candidate content or its ref became model-visible or the Reviewer inspected the candidate before freezing the baseline, return `BLOCKED(review_baseline_contaminated)` instead of claiming independence. Staged disclosure is a model-visible prompt boundary only. Record actual repository and tool access; do not claim strict filesystem isolation.

### Stage R-B — candidate review

After Main admits `BASELINE_READY`, the same Reviewer session receives the exact candidate ref, content, and revision. The Reviewer compares it with the frozen baseline and current repository evidence, updates the same exact review artifact for that logical round, and dispositions all six canonical dimensions:

1. **Owner-intent fidelity:** derive fidelity from exact included Owner source and route material ambiguity to Main's Owner gate.
2. **Repository reality and ownership:** verify current owners and contracts; detect duplicate ownership, semantic collision, and obsolete assumptions.
3. **Bidirectional traceability and necessity:** trace Owner requirement → GOAL → contract → workstream → phase gate, each material mechanism back to an Owner requirement or repository necessity, and each assumption to evidence plus an invalidation condition.
4. **Lifecycle integrity:** walk the happy path and representative failures; each transition identifies detector, state owner, authority, source/candidate identity, writer boundary, next route, and recovery condition.
5. **Correctness, liveness and boundedness:** prevent transition on wrong intent, candidate, authority, or evidence; require a resolver or Owner gate for blocked states; reject unbounded retry, recursive delegation, silent continuation, and unchanged-state progress claims.
6. **Implementability, phase verification and simplicity:** ensure a fresh Implementor need not invent material semantics, every phase checks its observable contract before dependent work, and unnecessary mechanisms are removed without weakening correctness, ownership, or recovery.

For a Master Plan candidate, use these exact dispositions:

- `PASS` only when all six dimensions are complete, no `Critical` or `Required` finding remains, no material Owner ambiguity remains, and no verdict-changing limitation remains.
- `BLOCKING_FINDINGS` when a material defect is within candidate/author control.
- `BLOCKED` when external context or evidence is unavailable and a trustworthy verdict cannot be reached.
- Materially ambiguous Owner input returns `BLOCKED(ambiguous_owner_intent)`; Main alone opens `OWNER_DECISION_REQUIRED`.

A `Critical` or `Required` finding must connect violated source or contract → triggering scenario → exact failed transition or claim → observable impact → why the existing mechanism cannot handle it → smallest sufficient correction → affected workstream or phase gate. Preference, reversible implementation detail, an out-of-scope theoretical threat, or audit/provenance luxury without that causal path is non-blocking.

Master Plan Reviewer `PASS` ends reviewed planning only. It is not Owner approval and grants no implementation, Git, remote, database, production, destructive, deployment, or workflow-transition authority. The surrounding exact-artifact, handoff, candidate-stability, blocker-resume, same-session rereview, and correction-budget rules remain the single state machine for both stages.

## Handoff and verdict admission

Require handoff and artifact identity to match the open ledger: workflow, role, phase, episode, Owner revision, candidate ref/revision, review round, artifact ref, status, findings/blocker counts, verification, and recommended route. Never choose by newest file, glob, mtime, or directory order.

Immediately before admission, exact-compare candidate path/existence/bytes and allowed changed-path scope with the start snapshot. A mismatch quarantines the verdict as `BLOCKED(candidate_moved)`. Crossed/stale identity returns `BLOCKED(stale_handoff)`. CLI success, a conversational summary, or artifact presence alone is not a semantic verdict.

Reviewer artifact owns detailed findings and verdict. Conversational handoff is only a projection. Main validates identity and transitions but does not adjudicate findings or rewrite Reviewer-owned content.

## Correction budget

- Initial review uses `review_round=0` and consumes no correction round.
- `BLOCKING_FINDINGS` routes the exact artifact to the same candidate author.
- One completed round is: same author corrects the candidate, then the same Reviewer completes rereview of the new logical candidate revision.
- Rereviews use rounds `1` and `2`; maximum automatic completed correction rounds is `2`.
- `BLOCKED` before or during author/reviewer work consumes no correction round; resume the same session and logical review round after an observed state change.
- If rereview round `2` still has blocking findings, Main stops at `OWNER_DECISION_REQUIRED`. Round `3+` requires exact Owner authorization and never resets history.

The author independently verifies and dispositions every finding. Main reconciles identity/evidence, not correctness by majority vote. A correction must not silently change GOAL, scope, authority, or an owning plan; report `PLAN_CONTRACT_MISMATCH` or `MASTER_PLAN_CONTRACT_MISMATCH` instead.

For multiple findings in one causal family, the author corrects the governing invariant rather than only the cited literals, then scans the full candidate for every same-family manifestation and reports that closure. Same-Reviewer rereview receives the previous findings, per-finding dispositions, the exact correction diff, affected verification, and a narrow regression scan; the full candidate remains available on demand. Repeat the full review package when Owner revision, scope, authority, semantics, or the affected boundary materially changes, or when the regression scan exposes a wider risk.

Finding severity is artifact-neutral. A defect is `Required` only when evidence gives it a material causal path to authority, routing/state transition, ownership/source of truth, candidate identity, acceptance/verification, or completion truth. Cosmetic wording and historical detail without that path remain non-blocking under the review taxonomy.

## Blocker and recovery routing

Record blocker code, affected claim/action, resolver, unchanged candidate/artifact identity, actual partial state, and smallest state change needed. Resume the same role session only after that change is observed and revalidate Owner package, permissions, candidate currentness, artifact Git boundary, and remaining budget.

Required model/session/config unavailable: `BLOCKED(model_unavailable)`, `BLOCKED(session_unavailable)`, or `BLOCKED(config_unavailable)`. No silent model/backend/session substitution or custom orchestration fallback.

For `BLOCKED(session_unavailable)`, Main must first use the exact stored managed-role session identity. If the identity is not immediately present, attempt to recover or retrieve that exact identity from the available native workflow/session context; emit the blocker only when it genuinely cannot be recovered or retrieved. If the identity is known, actually attempt native same-session resume or follow-up and emit this blocker only when the runtime explicitly rejects that exact session as unavailable. If same-session resume or follow-up succeeds, keep the original session as the correction/rereview target and do not emit the blocker. A role being finished, completed, idle, non-running, or absent from `list_agents` is not a failed availability check. A usage quota, service, permission, model, or configuration error keeps its different exact blocker and must not be relabeled `session_unavailable`.

## Evidence boundary

Exact comparison proves only candidate stability within the recorded turn. Git ignore/tracked/staged checks prove only the checked repository state. Native role observation proves only the exact runtime/session exercised. None proves strict filesystem isolation, cross-workspace durability, malicious-agent resistance, or future native behavior.

## Stable progress closure

Do not place transient text in a tracker that becomes false when the commit containing it succeeds. After admitted `PASS`, keep the reviewed candidate stable, commit the implementation, then use a progress-only commit to record the implementation hash and other observed stable facts. The tracker does not record the progress-only commit's own hash, say that its own checkpoint is pending, or trigger rereview unless the update changes a reviewed semantic, authority, acceptance, verification, or completion claim. Git history supplies the progress-only commit identity.
