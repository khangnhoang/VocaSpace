# Special review cases

Read this reference when reviewing a bug fix, refactor, dead-code removal, or dependency change. Skip it for a feature or checkpoint review with none of those change types.

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
