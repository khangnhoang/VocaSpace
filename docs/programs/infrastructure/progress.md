# Progress — Infrastructure and reliability

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [INFRA-U1 plan](./implementation-plans/u1-test-runtime/plan.md) r3, Owner-approved 2026-11-22. |
| Current unit / checkpoint | INFRA-U1 CP1 steps 1–3, CP2 and the local part of CP3 done; CP1 step 4 done (AC3). CP3 CI checks pending; the reset-skip opt-in sits in its own last commit so it can be held back until the G2 probe check on a CI runner. |
| Status | Local checks passed; the CP3 CI evidence (G2 probe check, step times, cache states, AC7) are pending Owner grants. |
| Completed evidence | AC1 (`npx vitest list --filesOnly`: 702 → 167 files, 0 under `.claude/worktrees`; integration config 203 → 52, 0 under it; main-checkout lists identical) and AC2 (`tsc` already lists none; ESLint did lint a worktree file and now ignores it), checked 2026-11-22. CP2: `node .agents/scripts/validate-skill.mjs` and `npm run docs:check` (no new broken links) pass. `npx tsc --noEmit` and `npm run lint` pass; `npm run test:ci`: 164 of 166 files and all 2507 tests pass, the two failing suites are untracked leftover probe specs under the ignored `test-results/` that were already collected before this change (not in CI). CP3 local: `node --test scripts/e2e/reset-decision.test.mjs` 9 of 9 pass; one local `npm run test:e2e:smoke` with default flags (reset ran, runtime stopped, no `voca_space_e2e` container left): 85 passed, 1 failed (`topic-builder-sheet-layout`, timeout waiting for a button, first-failure artifacts kept outside the repo); the same spec rerun alone passed 2 of 2, which does not establish the cause. |
| Accepted deviations | None. |
| Blockers / Owner decisions | Owner decisions 1–5 recorded in the plan. CP3–CP4 need push, PR-creation and re-run grants. |
| Next action | Main pushes `56362dfc` first, then `cf2ff2da` after the probe check, under the Owner's push grant; the CI probe check, step times and cache states then follow. |
| Current authority | Owner 2026-11-22: implementation of r3 and local commits on `docs/infra-u1-test-runtime`. No push, PR, re-run, merge or branch deletion; the local branch `claude/laughing-dijkstra-654589` stays. |

## Milestones

- 2026-11-22 INFRA-U1 plan r1–r3 drafted with baseline CI timing from 12 CI runs; Codex plan gate PASS on r3; Owner approved r3 (`b422a91b`)
- 2026-11-22 CP1 steps 1–3: Vitest and ESLint exclude `.claude/worktrees/**`; worktree G6 inventory recorded, no worktree removed (`dfd4f43a`)
- 2026-11-22 CP2: adopted agent rules (test verification stages, tool selection, finding triage, shared writer rule, Skill-tool reading, PowerShell for Node, MSIX) at their owners (`e895c59d`)
- 2026-11-22 CP3 local part: CI E2E background Supabase start, cache steps and a reset-decision runner with a focused test; the reset skip is not enabled yet, pending the CI probe check (`56362dfc`)
- 2026-11-22 CP3: workflow opts into the reset skip through `E2E_SKIP_DB_RESET_EVIDENCE`; push this commit only after the probe check on `56362dfc` (`cf2ff2da`)
- 2026-11-22 CP1 step 4: the four approved worktrees removed with git worktree remove after the G6 recheck and the Owner's per-path confirmation; no prune, no branch deletion (this commit)
