# Review Artifact and Reconciliation

## Minimal ephemeral ledger

Before dispatch, Main records in the current orchestration context:

```text
workflow_id
mode
phase
episode_id
active_role and session identity
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

## Evidence boundary

Exact comparison proves only candidate stability within the recorded turn. Git ignore/tracked/staged checks prove only the checked repository state. Native role observation proves only the exact runtime/session exercised. None proves strict filesystem isolation, cross-workspace durability, malicious-agent resistance, or future native behavior.

## Stable progress closure

Do not place transient text in a tracker that becomes false when the commit containing it succeeds. After admitted `PASS`, keep the reviewed candidate stable, commit the implementation, then use a progress-only commit to record the implementation hash and other observed stable facts. The tracker does not record the progress-only commit's own hash, say that its own checkpoint is pending, or trigger rereview unless the update changes a reviewed semantic, authority, acceptance, verification, or completion claim. Git history supplies the progress-only commit identity.
