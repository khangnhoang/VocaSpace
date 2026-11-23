---
name: test-quality-strategy
description: Choose test layers, behavior coverage, mocks, fixtures, regression protection and truthful verification. Use before writing/changing/reviewing tests or selecting and reporting checks.
---

# Test quality strategy

## Use when / do not use when

Use for tests, fixtures/mocks/data, coverage/regression decisions, verification scope or result reporting. Pure docs need this only when defining test strategy/commands. Domain skills own validation/database/product behavior; this skill chooses evidence and never grants environment/data actions.

## Current repository

Inspect package.json, Vitest/Playwright configs and nearby tests before choosing a command:
| Layer | Existing location | Command |
| --- | --- | --- |
| Pure helper | __tests__/utils | npm run test:run -- <file> |
| Schema | __tests__/schemas | npm run test:run -- <file> |
| Component/form interaction | __tests__/components | npm run test:run -- <file> with its existing environment/setup |
| Server Action / route behavior | __tests__/actions, nearest existing route tests | npm run test:run -- <file> |
| Real DB/RLS/RPC/constraint/concurrency | __tests__/integration | npm run test:integration -- <file>; inspect its local fixture/setup requirements |
| Smoke/browser | e2e/ | npm run test:e2e -- <spec>; the runner owns isolated setup |
| Agent tooling / docs checker | .agents/scripts, scripts/docs | node --test <affected .test.mjs> |

npm test is watch-mode Vitest; prefer the finite targeted command for evidence. Do not copy DevSpace's unit/rls projects, payment action harness, seed users or helpers as VocaSpace facts. Existing config may load local env files; do not print their contents or infer hosted access from a test command.

## Core rules

1. Assert promised inputs, outputs, permissions, persistence and visible state transitions, not internal calls/classes/state. Name actor + condition + result.
2. Choose the smallest layer proving the guarantee. Do not repeat it across layers without added value; don't use expensive DB/E2E tests for a pure schema/helper.
3. Cover applicable success, invalid/boundary, hostile-client, denied-permission, transition/retry/duplicate/stale/partial-failure cases. Server boundaries include bypassed UI, another user's ID and forbidden client-sent fields.
4. Do not mock the guarantee. RLS/RPC/constraints need real DB integration; authorization tests cannot mock permission checks. Forms whose guarantee is submit integration cannot mock away the submitted action.
5. A denied/empty result is useful only after proving the target data and request preconditions exist. Assert the intended denial/failure, not any unrelated constraint, setup or transport error, and verify no forbidden mutation occurred.
6. Use minimal deterministic isolated invented data; never copy hosted user rows. Keep setup/read-back/cleanup separate from the actor's actual request. A privileged fixture client must not perform the request whose authorization is tested.
7. Restore every changed fixture/delete each added row even on failure. Tests cannot depend on another file's writes or order. After a fixture-writing change, a second bounded local run may establish cleanup when the owning test setup supports it; this is not permission to reset a shared stack.
8. Reproduce a bug before fixing when practical, then protect the observable failure. A known unfixed bug is reported to its owning problem, not silently skipped or encoded as correct. VocaSpace has no DevSpace knownBug helper; adding one is deferred.
9. Treat database reset, seed/migration changes and shared runtimes as separately controlled operations. Test intent never grants a destructive command or hosted action.
10. Test-plan headers record stable intent/coverage/gaps; actual last-run results belong in the report, not a timestamp/status comment that goes stale.

## Workflow and scope

Before writing: identify the invariant and layer, inspect setup/helpers, choose meaningful cases and determine whether a header is required. During writing: act through the real boundary, assert observable results and keep tests focused. Afterwards: run the narrowest relevant check and report actual counts/results and limitations.

Focused UI/CSS changes normally need directly related interaction tests, relevant type/lint checks, diff hygiene and proportionate visual QA, not every suite/build/reset. Local logic changes need affected unit/action/component checks. Broaden for shared routing/schema/build/config boundaries, a discovered regression risk, a final required PR gate or explicit Owner request; state why first. Reuse unchanged current passing evidence.

## Verification stages

docs/agent-loops.md owns when a checkpoint, self-review and final review happen; this section owns which checks each stage runs. An intermediate checkpoint is never final verification.

| Stage | Checks |
| --- | --- |
| Implementation | Add or extend the regression test with the behavior and run the affected files at the smallest sufficient layer, including callers and shared dependencies, not only files named in the diff. |
| Checkpoint | Verify the whole affected area plus the static checks that apply (`npx tsc --noEmit`, `npm run lint`). Widen early for shared schemas, fixtures, test tooling or config whose reach is uncertain. A checkpoint does not require every suite. |
| Final regression | After the whole-diff self-review corrections, for a code, test, dependency or executable-config change run once: `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`, the affected `npm run test:integration -- <file>` files and E2E specs, and `npm run build` when build-affecting config changed. This is not a command to repeat at every checkpoint. |
| Correction after verification | Rerun what the correction can invalidate. Reuse earlier passing evidence only with a concrete dependency-based reason; a change to shared behavior, tooling or uncertain reach reruns the relevant full checks. A later prose-only correction reruns no application suite. While an independent review loop is open, the next row decides when those full checks run. |
| Correction during an independent review loop | Each round's correction runs the Implementation and Checkpoint checks for what it can invalidate (affected files, callers, shared dependencies and specs, `npx tsc --noEmit`, `npm run lint`), plus `npm run test:ci` when it changes shared behavior. When the loop's corrections changed code, the full regression and any plan-required acceptance evidence (for example snapshot pairs, scans, route tables or a full E2E run) rerun once, on the final code commit, after the loop ends (no Critical or Required finding left, or the Owner's decision on the remaining ones) and before delivery. Run them earlier only when the plan or the Owner requires it, or when focused checks cannot bound the correction's reach. Record the commit each piece of evidence ran on, in the round's review brief and in State; evidence from an earlier commit stays labeled with that commit, never presented as final-commit evidence. |
| Docs-only | `npm run docs:check`, plus `node .agents/scripts/validate-skill.mjs` when a skill changed. Application suites, typecheck and build are not required locally. |

A focused pass is checkpoint evidence, not evidence that a full suite passed. Final regression needs current passing evidence before work is first reported ready for review, and again on the final code commit before delivery when review corrections changed code; a missing prerequisite or a failed check stays pending or blocked.

### Intermittent failures

Preserve the first failure's log and trace before anything else. Repeat the relevant scenario under the suspected conditions. A passing rerun neither erases the failure nor proves its cause, and two green runs do not prove isolation or resolve a flake. A new flake in a changed area blocks the report until it is explained or recorded in the owning problems.md.

### Reporting evidence by CI job

CI runs the lint/skills/docs, unit, build, integration, learner-integrity and E2E jobs on a pull request. The final report names the revision and, per CI job, whether it ran and passed on that revision. CI E2E proves only `e2e/smoke`; an affected executable Playwright spec outside it (today `e2e/admin/*.spec.ts` and `e2e/d2/*.spec.ts`) must be run locally with `npm run test:e2e -- <spec>`. A skipped job, an unpushed revision or missing push/PR authority leaves that evidence pending, never passed. Local checks are not CI evidence.

## Local runtimes

Local project IDs are voca_space (root supabase/, API 45321) for dev/manual QA and voca_space_e2e (.e2e-runtime, API 45441) for isolated tests. Do not infer a project is unused from one process ending.

- Start a stack only when needed; verify its status and project-labeled containers.
- When a check or debugging session ends, stop the exact stack the task started with npx supabase stop --project-id <project_id> and confirm docker ps -a --filter label=com.supabase.cli.project=<project_id> lists no containers. First establish that no other session/run or remaining manual QA needs it; if shared use is uncertain, ask instead of stopping it, and report why cleanup remains pending. Do not stop a pre-existing stack the task does not own.
- npm run test:e2e manages the E2E stack and normally stops it; E2E_KEEP_SUPABASE=1 retains it for debugging and remains subject to the cleanup rule above.
- npm run dev leaves its dev stack up after Next exits. When asked to close development, also use npm run supabase:dev:stop if no other session/QA needs it; verify containers are gone.
- Before any data-wiping reset, establish no other session/run uses that stack; ask when uncertain. Stop only the exact stack the task owns.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [Smoke/browser](references/smoke-e2e-and-browser.md) | Planning/adding/changing/running/reviewing browser coverage or its fixture readiness. | No browser evidence. |
| [Manual QA fixtures](references/manual-qa-and-fixtures.md) | Manual QA depends on authenticated roles, DB state/order or related records. | Automated-only or data-independent QA. |
| [Test-plan headers](references/test-plan-headers.md) | A concrete non-trivial integration/RPC/RLS/action/API/form/payment/webhook/upload/concurrency/regression/multi-group test file needs its documentation reviewed/changed. | Tiny one-case units, or merely selecting a test layer/reporting existing evidence. |
| [Mocks/regression](references/mocking-and-regression.md) | Directly designing/reviewing a mock boundary, bug-regression protection or semantic graph-substitution case. | Ordinary layer selection or incidental mocks/relationship words. |

Semantic substitution means individually valid objects from different valid graphs become invalid only through a deliberately wrong relationship. Ordinary denial, uniqueness, race or malformed input is not that subject. An existing mock/header alone does not activate its reference.

## Report and stop

Separate automated results/counts, static checks, manual/browser QA, deterministic fixture-backed states, pending/historical and environment-limited evidence. Targeted success is not full-suite success; static assertions are not interaction/mobile/browser proof. Report checks not run and why.

Stop for unsupported evidence, missing fixture/permission or a scope-changing fix. Advice cannot replace test execution. Never hide a failure behind a mock, skip, weakened assertion or unsupported PASS.
