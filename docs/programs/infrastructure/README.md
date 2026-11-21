# Charter — Infrastructure and reliability

Progress: [progress.md](./progress.md). Problems: [problems.md](./problems.md). Future directions: [future-features.md](./future-features.md).

## 1. Capability and boundary

- Capability: Maintain dependency policy, local/test environments, CI/CD execution and operational tooling reliability.
- Boundary: Agent workflow owns agent permission/procedure; security owns safety requirements. This charter grants no update, deployment, reset or CI behavior change.

## 2. Owner decisions

1. (2026-10-28) The Owner accepted this capability among the five evergreen homes and approved [DOCS-MIG r1](../docs-model-migration/plan.md), including its transfer and compatibility boundaries.

## 3. Invariants

- Keep one live owner for each direction and residual; migration preserves decisions, evidence limits and old entry anchors.
- Historical observations remain dated; an entry transfer does not close its acceptance condition or renew a historical action grant.
- Follow the shared [lifecycle](../../agent-loops.md) and applicable skills for planning/review and actual authority; this charter does not replace their procedures.

## 4. Initiatives

Read [progress.md](./progress.md) for the current initiative. Keep closed initiative rows when initiatives are delivered; historical delivery programs below are references, not retroactively created initiatives.

| Initiative | Plan | Branch | Outcome | Dependencies | Gate to open |
| --- | --- | --- | --- | --- | --- |
| INFRA-U1 test runtime, agent rules and CI E2E speed | [plan](./implementation-plans/u1-test-runtime/plan.md) | `docs/infra-u1-test-runtime` | Local tests read only this checkout, DevSpace working rules adapted, E2E critical path shortened with unchanged coverage. | None | Owner approval of the Codex-reviewed revision. Owner decision 1 in the plan routes the agent-rule edits here as an exception to section 1; the edited rule files and skills stay canonical. |

## 5. Opening an initiative

1. The Owner selects a direction or residual from this program, or supplies a new bounded request.
2. Discover its current contract and write an initiative detail plan at implementation-plans/u<n>-<slug>/plan.md; add its actual Plan link to the table.
3. Complete the required review and obtain actual approval/implementation authority. At most one initiative is open; progress alone records current State and authority.

## 6. Sources and related delivery work

- [Local development SOP](../../sop/local-development.md).
- [Production release SOP](../../sop/production-release-gate.md).
- [Smoke SOP](../../sop/exercise-authoring-smoke-e2e.md).
