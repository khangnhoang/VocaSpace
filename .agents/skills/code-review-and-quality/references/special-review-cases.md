# Special review cases

Read this reference only when the prompt or review target explicitly identifies a bug fix needing root-cause/regression assessment, a refactor needing contract-preservation assessment, a dead-code removal, or a dependency change. Skip it when a correction re-review only verifies resolution of earlier findings, when a baseline/range/currentness review merely observes one of those change types in the cumulative range, or when a feature/checkpoint review has none of the four explicit change types.

## Bug fixes

Confirm root cause, direct correction, regression coverage, adjacent valid behavior, safe failure paths, and correct permission/data boundaries.

## Refactors

Confirm observable behavior and public contracts are preserved, tests protect behavior, error/performance characteristics remain acceptable, and new behavior was not mixed accidentally.

## Dead code

* created by the current change: remove when safety is established
* pre-existing and outside scope: report as follow-up
* unclear ownership: investigate before deletion

## Dependencies

Check necessity, existing alternatives, maintenance, security, license when relevant, bundle/runtime placement, lockfile changes, and installation permission.
