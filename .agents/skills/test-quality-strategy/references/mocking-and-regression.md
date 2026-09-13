# Mocking and Regression

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for test-layer choice, observable guarantees, verification, and reporting.

## Mocking

Mock only boundaries outside the behavior under test.

Good candidates:

* external providers
* browser APIs unavailable in the environment
* email delivery
* Storage/provider result when local handling is the actual subject

Do not mock:

* schema validation while testing validation
* DB/RLS/RPC while testing database guarantees
* permission checks while testing authorization
* the Server Action in a form test when submit integration itself is the guarantee

A UI-only test may mock the action when the subject is only rendering a known result state.

## Regression tests

For a bug fix:

1. Reproduce the old failure when practical.
2. Add a focused test.
3. Apply the fix.
4. Confirm the test passes.
5. Keep the test tied to observable behavior or invariant.

When exact reproduction is too expensive, add the closest stable protection.

### Bounded semantic substitution

Use semantic substitution when every artifact or object can be individually valid but the system must reject the wrong relationship between them. Typical dimensions include actor or tenant, parent or child, run or unit, decision or acceptance identity, revision, scope, membership, and linked evidence.

1. Start with one canonical positive graph that succeeds.
2. Choose one semantic dimension and replace only that value, link, object, or member with an otherwise valid near-match from a different valid graph.
3. Keep syntax, schema, unrelated fields, and all other dimensions unchanged so the failure identifies the relationship under test.
4. Assert rejection at the boundary that owns the relationship and assert that no downstream mutation, accepted evidence, or success artifact is produced.
5. Restore the canonical graph before testing another dimension; do not combine substitutions in one negative case.

When the contract intentionally ignores a field, add an allowed control proving that the field can vary through a newly valid bound graph. Random corruption, malformed fixtures, or changing several dimensions at once does not prove semantic-lineage enforcement. Do not mock away the relationship owner or let a fixture helper silently rebuild the substituted graph into a valid one.

## Test data

Test data must be:

* minimal
* realistic enough
* deterministic
* isolated
* clearly named
* reset or cleaned by existing setup

Do not depend accidentally on seed data.

DB tests follow existing reset and seed conventions.
