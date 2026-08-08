# Manual QA and Fixtures

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for verification scope, evidence claims, and reporting.

## Manual QA state matrix

Before data-dependent manual QA, define the observable state matrix that must be reproduced. Include only states that matter to the approved behavior, such as authenticated roles; ordering; empty, partial, completed, hidden, or error states; multiple related records; and stateful payment, enrollment, progress, review, or collaboration flows.

For each matrix row record the actor or role, starting data state, action, expected visible result, and evidence needed. This matrix defines the manual-QA coverage claim; a state not reproduced and observed remains pending.

## Manual QA fixture readiness

Use this gate when observable QA depends on authenticated roles, database-backed workflow state, ordering, empty/partial/completed/hidden/error states, multiple related records, or similarly stateful flows.

Required sequence:

1. Define the observable manual-QA state matrix.
2. Identify the canonical repository fixture or seed source.
3. Inspect whether existing deterministic fixtures already cover each required state.
4. Reuse existing fixtures whenever they are sufficient.
5. Add only scenarios missing from the matrix.
6. Complete fixture preparation before browser-based QA starts.
7. Validate fixtures through the repository's documented local reset/setup workflow.
8. Run browser QA only after every required state is reproducible.

Do not add or modify seed data when the feature can be fully verified without it. Fixture changes, when required, must be deterministic, idempotent under the documented reset workflow, minimal in volume, tied to observable QA scenarios, based on exact physical schema fields, local/test-only, and safe to rerun.

Do not:

* duplicate users, courses, payments, enrollments, or other entities when existing fixtures already cover the state
* add irrelevant "just in case" data
* create undocumented one-off local rows when a canonical deterministic fixture is appropriate
* delay fixture assessment until final manual QA
* modify remote or production data for QA
* treat a fixture requirement as permission to create a migration or change RLS

Fixture readiness is conditional, not a requirement to add seed data for every task. Follow `supabase-safe-migration` whenever an independently approved change actually touches seed, schema, migration, RLS, or other database behavior.
