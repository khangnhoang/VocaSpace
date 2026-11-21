# Progress — Infrastructure and reliability

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [INFRA-U1 plan](./implementation-plans/u1-test-runtime/plan.md) r3, Owner-approved 2026-11-22. |
| Current unit / checkpoint | INFRA-U1 CP1 steps 1–3 done; step 4 stopped at the G6 inventory, no worktree removed. CP2 and CP3 local work follow on `docs/infra-u1-test-runtime`. |
| Status | CP1 hygiene checks passed locally; worktree removal pending the Owner's per-path confirmation. |
| Completed evidence | AC1 (`npx vitest list --filesOnly`: 702 → 167 files, 0 under `.claude/worktrees`; integration config 203 → 52, 0 under it; main-checkout lists identical) and AC2 (`tsc` already lists none; ESLint did lint a worktree file and now ignores it), checked 2026-11-22. `npx tsc --noEmit` and `npm run lint` pass; `npm run test:ci`: 164 of 166 files and all 2507 tests pass, the two failing suites are untracked leftover probe specs under the ignored `test-results/` that were already collected before this change (not in CI). |
| Accepted deviations | None. |
| Blockers / Owner decisions | Owner decisions 1–5 recorded in the plan. Per-path Owner confirmation of the G6 inventory for each of the four worktrees. CP3–CP4 need push, PR-creation and re-run grants. |
| Next action | Main obtains the Owner's per-path confirmations and tells the implementor which worktrees to remove; implementor continues CP2 and CP3 local work. |
| Current authority | Owner 2026-11-22: implementation of r3 and local commits on `docs/infra-u1-test-runtime`. No push, PR, re-run, merge, branch deletion or worktree removal without per-path Owner confirmation. |

## Milestones

- 2026-11-22 INFRA-U1 plan r1–r3 drafted with baseline CI timing from 12 CI runs; Codex plan gate PASS on r3; Owner approved r3 (`b422a91b`)
- 2026-11-22 CP1 steps 1–3: Vitest and ESLint exclude `.claude/worktrees/**`; worktree G6 inventory recorded, no worktree removed (this commit)
