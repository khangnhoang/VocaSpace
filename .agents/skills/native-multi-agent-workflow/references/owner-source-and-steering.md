# Owner Source and Steering

## Package construction and admission

Main captures each relevant Owner entry whole when it arrives, preserves exact wording, assigns an ordered `source_entry_ref`, and increments logical `owner_input_revision`. Routing summaries are separate and explicitly non-authoritative. Do not build a transcript database, manifest artifact, hash registry, or provenance service.

Before substantive work, give the role the complete ordered package required by its candidate and authority snapshot. The role echoes `owner_input_revision` and ordered refs. Main admits coverage only when revision, order, readability, and content are complete. Missing, truncated, reordered, unreadable, or coverage-incomplete input returns `BLOCKED(owner_input_unavailable)`; Main does not disclose or route dependent candidate work. Input that permits materially different semantic interpretations affecting outcome, scope, invariant, ownership, or architecture returns `BLOCKED(ambiguous_owner_intent)`; Main opens the Owner gate instead of selecting an interpretation.

Master Planner or Planner derives candidate GOAL/contract directly from exact Owner source. Main routes but does not semantic-translate it. Master Plan Reviewer receives the same exact package and independently checks fidelity; `PASS` never substitutes for Owner approval.

## Later Owner input classes

| Class | Effect | Required route |
| --- | --- | --- |
| Clarification | Removes ambiguity without changing GOAL, ownership, dependency, acceptance, or authority | Increment Owner revision; update affected logical candidate revision; same author absorbs and affected review repeats |
| Detailed-plan change | Changes lower-level contract, dependency, or acceptance within the same GOAL | Supersede affected detailed candidate; reopen same Planner; review the new plan revision |
| Authority-only change | Grants or revokes an action without changing semantic candidate content | Increment Owner revision and authority snapshot; synchronize affected running role; do not invent a GOAL/candidate semantic revision |
| GOAL/invariant/scope change | Changes outcome, protected boundary, ownership, or initiative scope | Preserve existing work; stop at `OWNER_DECISION_REQUIRED`; Owner owns GOAL revision and prior-work disposition |
| Prior-work disposition | Owner decides retain, rework, supersede, revert, or abandon already-produced work | Record exact disposition and affected lineage before dependent work resumes; never discard implicitly |

If one entry spans classes, apply every affected boundary and use the most restrictive required stop. A message that merely arrives does not retroactively authorize or undo an action.

## Running-role synchronization

For non-order-sensitive information, Main may deliver a live message and record only that delivery was requested. For any semantic or authority steer that must apply before the next protected action:

1. interrupt or otherwise establish role quiescence;
2. audit actual completed, in-flight, partial, and unacknowledged state;
3. capture the exact Owner entry and update revision/package/authority;
4. send the exact steer to the same role session;
5. require the role to echo refreshed revision/refs and reconcile actual state;
6. resume only the action still authorized by the refreshed snapshot.

If quiescence, audit, or same-session resume cannot be established, return `BLOCKED(owner_steer_not_synchronized)`. Report actions already completed before revocation; do not claim rollback or apply the new grant retroactively.

## Claim limits

Prompt-bounded source does not prove filesystem isolation, malicious-role resistance, cross-workspace retention, or future platform behavior. Report actual context and access. An Owner instruction can grant an action but cannot turn unsupported enforcement into evidence.
