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
