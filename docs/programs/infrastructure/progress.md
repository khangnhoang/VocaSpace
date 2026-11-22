# Progress — Infrastructure and reliability

Charter: [README.md](./README.md). Problems: [problems.md](./problems.md).

## State

| Field | Value |
| --- | --- |
| Spec revision | [INFRA-U2 plan](./implementation-plans/u2-e2e-parallel-workers/plan.md) r3, Codex plan gate PASS, Owner-approved 2026-11-22. INFRA-U1: [plan](./implementation-plans/u1-test-runtime/plan.md) r3, closed. |
| Current unit / checkpoint | INFRA-U2 CP2 done locally (student-side fixtures, `seed` project, `E2E_WORKERS`); CP3 follows in the next commit. |
| Status | CP1 and CP2 verified locally; implementor continues with CP3. |
| Completed evidence | INFRA-U2 discovery 2026-11-22: a read-only audit of the 26 smoke files found 16 unsafe and 4 risky under more than one worker (shared fixture IDs, seeded rows, student-wide counts); facts in plan section 2. AC1 ownership table: [u2-smoke-data-ownership.md](./sources/u2-smoke-data-ownership.md) (17 worker-scoped, 5 seed-bound, 4 read-only). CP1 pilot (`exercise-authoring` on worker 0 and `flashcard-delete` on worker 1, production build): the two runs overlapped (09:20:32.845Z–09:20:50.093Z and 09:20:32.849Z–09:20:51.608Z), both workers' rows existed side by side afterwards and the seed topic `66666666-…` stayed `published`. INFRA-U1 evidence is in its milestones and PR 194. |
| Accepted deviations | The ownership table lives under `sources/` as frozen evidence, not in the plan. CP1 and CP2 changes were verified together on the combined working tree, so the CP1 commit alone was not re-run. E2E-LOCAL-001's cause is code evidence (portfolio dense mode at 5 or more courses), not reproduced on the base. Verification ran on the production build (`E2E_WEB_SERVER=start`) as CI does; `next dev` runs show known dev-mode flakiness (ACTION-QUEUE-001, E2E-DEV-001). |
| Blockers / Owner decisions | INFRA-U2 Owner decisions 1–3 recorded in the plan. |
| Next action | Implementor continues with CP3 (shard manifest, CI wiring, shard ID check, final regression). |
| Current authority | Owner 2026-11-22: implementation of r3 CP1–CP3 through the Sonnet implementor with local commits on `infra/u2-e2e-parallel`. CI budget: two runs on the final revision, each needing its own grant. No push, PR, re-run or merge. |

## Milestones

- 2026-11-22 INFRA-U1 plan r1–r3 drafted with baseline CI timing from 12 CI runs; Codex plan gate PASS on r3; Owner approved r3 (`b422a91b`)
- 2026-11-22 CP1 steps 1–3: Vitest and ESLint exclude `.claude/worktrees/**`; worktree G6 inventory recorded, no worktree removed (`dfd4f43a`)
- 2026-11-22 CP2: adopted agent rules (test verification stages, tool selection, finding triage, shared writer rule, Skill-tool reading, PowerShell for Node, MSIX) at their owners (`e895c59d`)
- 2026-11-22 CP3 local part: CI E2E background Supabase start, cache steps and a reset-decision runner with a focused test; the reset skip is not enabled yet, pending the CI probe check (`56362dfc`)
- 2026-11-22 CP3: workflow opts into the reset skip through `E2E_SKIP_DB_RESET_EVIDENCE`; push this commit only after the probe check on `56362dfc` (`cf2ff2da`)
- 2026-11-22 CP1 step 4: the four approved worktrees removed with git worktree remove after the G6 recheck and the Owner's per-path confirmation; no prune, no branch deletion (`9b343dcd`)
- 2026-11-22 CP4 local work added duration-balanced shard lists and a shard-ID check; the Owner then dropped CP4 and H6, and the next commit removes the shard lists again (`0edea8a7`)
- 2026-11-22 INFRA-U1 closed at CP3: CP3 CI evidence recorded (PR 194, slowest-shard median 557 s over two runs of `9b343dcd`, G2 probe proven, AC7 identity holds), CP4 and H6 dropped, FEAT-028 recorded (`354b7569`)
- 2026-11-22 INFRA-U1 merged to main (PR 194, 1e3ae411)
- 2026-11-22 INFRA-U2 opened: plan r3 for parallel E2E workers and balanced shards, Codex plan gate PASS, Owner-approved (`a92f25cc`)
- 2026-11-22 INFRA-U2 CP1: worker-scope helper and test, shared accounts set up once, teacher-side smoke fixtures and specs moved to worker scope, AC1 ownership table, pilot with overlapping workers and intact data (`31ca31a8`)
- 2026-11-22 INFRA-U2 CP2: matrix and free-enrollment specs on worker accounts, `seed` project with one worker for the five seed-bound files, `E2E_WORKERS` (default 1); three consecutive full smoke runs with two workers passed 86 of 86 and one run with one worker passed 86 of 86; `e2e/admin` and `e2e/d2` passed 11 of 11 with one worker; `npm run test:e2e` defaults held (reset before, runtime stopped after) (this commit)
