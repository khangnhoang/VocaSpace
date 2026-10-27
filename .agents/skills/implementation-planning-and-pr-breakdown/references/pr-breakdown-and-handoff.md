# PR breakdown and implementation brief

Read when splitting PRs/checkpoints, deciding parallel work or writing a transferable brief.

## Boundaries

Choose vertical, foundation-first, contract-first, migration-first, risk-first or docs-first slicing from the real dependency graph. One PR/checkpoint is a coherent reviewable outcome; it can span layers serving that contract. Do not combine unrelated outcomes or split implementation from its direct regression coverage for ceremony.

Record only useful fields: outcome, dependency/order, scope/non-goals, allowed/untouched domains, guardrails vs hypotheses, observable acceptance, checks/manual QA, risks and completion/rollback boundaries. File/line count is a signal, not a limit.

Parallel work requires satisfied prerequisites, stable contracts, non-overlapping file/state ownership, known integration order and independent acceptance. Migrations, permission/status models and overlapping shared contracts normally stay sequential. Permission to implement is not permission to dispatch agents.

## Brief

When an accepted plan exists, name its actual path/revision as the task contract. Add only:
- Assigned checkpoints (all together unless a later one needs a new Owner decision).
- The exact authority granted and boundaries on edits, commits, push, PR, hosted/model actions.
- Read-first sources and every matching skill/reference, without rewording their contracts.
- Missing operational facts/snapshots with evidence limits, and domains not to touch.
- Uncovered concerns as risks to verify, with the expected observable result.
- The report: changed files/why, actual checks/results, self-review evidence, bounded deviations, pending QA/risks and commit list.

Do not copy the plan's scope/acceptance into competing prose or say the plan overrides shared authority. Without an existing plan, include the minimum scope/acceptance/dependency/verification contract needed for a safe handoff. A missing material decision is a stop, not something the implementor silently invents.

An implementor reads the contract, performs only assigned work and reports material mismatch to the coordinator. Reversible hypothesis changes may proceed only within the Spec/guardrails and current grant; record and verify them in the existing State.
