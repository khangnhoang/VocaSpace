# Tracked sources and durable plans

Read when a task belongs to a tracked program or needs durable plan/progress reconciliation. Skip unrelated programs and standalone work.

Read the owning plan/charter, progress, problems and exact unit's accepted plan/Owner record when they exist. Add an ADR, deferred source or another consumer only when it can change scope, dependencies, authority or verification. A tracker existing is not a reason to load it.

Reconcile current behavior, ownership, scope/exclusions, acceptance, dependencies, verification and permission. Pending approval grants no implementation. Stop for a material conflict; reflect an Owner-controlled contract change in the owning plan and re-review before dependent work.

Keep one owner per fact:
- Master plan/charter: intent, shared invariants, unit dependencies/gates and stable decisions.
- Detail plan: binding Spec/guardrails, necessary baseline facts and bounded hypotheses.
- Progress: current unit, authority, evidence, deviations, blockers and next action.
- Git/review evidence: detailed changes, commands and review history.

repo-docs-system owns exact paths, State fields/templates and lifecycle. Use its template, not another program's historical shape. Do not create retrospective, empty or duplicate plans/trackers. Existing historical docs need not be mass-rewritten.

A durable plan is justified by multi-session continuity, dependencies, risk, material decisions or rollout/rollback needs. Smaller coherent work uses lifecycle's concise plan. Self-review uses the review skill method plus plan completeness, dependency, acceptance, assumption/invalidation and authority checks.
